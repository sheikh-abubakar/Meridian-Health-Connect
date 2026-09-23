import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Availability } from "../models/Availability.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Resource } from "../models/Resource.js";
import { Location } from "../models/Location.js";
import { Reminder } from "../models/Reminder.js";
import { VisitType } from "../models/VisitType.js";
import { SchedulingSlotLock } from "../models/SchedulingSlotLock.js";
import { Referral } from "../models/Referral.js";
import { isRangeWithinAvailability, parseClinicDateTime } from "./availabilityService.js";
import { mockEligibilityCheck } from "./mockEligibility.js";
import { ApiError } from "../utils/ApiError.js";
import { notifyPatient, notifyStaffUsers } from "./staffNotificationService.js";

const useSession = (query, session) => session ? query.session(session) : query;
let schedulingLockIndexReady;
const ensureSchedulingLockIndex = () => (schedulingLockIndexReady ||= SchedulingSlotLock.init());

export async function bookAppointment({ tenantId, locationId, actorUserId, actorPatientId = null, payload, session = null, selfScheduling = false, rescheduleOf = null, skipAudit = false, skipNotifications = false }) {
  // All appointment writes run in one MongoDB transaction. The unique slot-lock index
  // makes the final reservation atomic even when two confirmations arrive together.
  if (!session) {
    await ensureSchedulingLockIndex();
    const transactionSession = await mongoose.startSession();
    try {
      let appointment;
      await transactionSession.withTransaction(async () => {
        appointment = await bookAppointment({ tenantId, locationId, actorUserId, actorPatientId, payload, session: transactionSession, selfScheduling, rescheduleOf, skipAudit, skipNotifications });
      });
      return appointment;
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, selfScheduling ? "That time was just booked by another patient. Please choose another available time." : "That time was just booked. Refresh availability and choose another time.");
      throw error;
    } finally { await transactionSession.endSession(); }
  }
  let referral = null;
  if (payload.referralId) {
    if (!mongoose.isValidObjectId(payload.referralId)) throw new ApiError(400, "Invalid referral selected for this appointment");
    referral = await useSession(Referral.findOne({ _id: payload.referralId, tenantId, targetLocationId: locationId, patientId: payload.patientId, targetDoctorId: payload.doctorId, status: rescheduleOf ? "scheduled" : { $in: ["sent", "received"] } }), session).lean();
    if (!referral) throw new ApiError(409, "This referral is no longer open for the selected patient and Doctor");
  }
  // Cross-branch referrals retain the origin patient record. A linked referral is the
  // explicit authorization for Front-desk at the receiving branch to schedule it.
  const patient = await useSession(Patient.findOne({ _id: payload.patientId, tenantId, ...(referral ? {} : { locationId }) }), session).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const doctor = await useSession(User.findOne({ _id: payload.doctorId, tenantId, locationId, role: "doctor", isActive: { $ne: false } }), session).lean();
  if (!doctor) throw new ApiError(404, "Doctor not found in this location");

  let visitType = String(payload.visitType || "").trim();
  let visitTypeId; let durationMinutes = 30; let requiredResourceType = null;
  if (payload.visitTypeId) {
    const configured = await useSession(VisitType.findOne({ _id: payload.visitTypeId, tenantId, locationId, isActive: { $ne: false } }), session).lean();
    if (!configured) throw new ApiError(404, "Selected visit type is not available in this location");
    if (selfScheduling && !rescheduleOf && !configured.patientSelfSchedulingEnabled) throw new ApiError(403, "This visit type is not available for online booking");
    const doctorSpecialties = (doctor.specialtyIds || []).map(String);
    if (!configured.specialtyIds.some((id) => doctorSpecialties.includes(String(id)))) throw new ApiError(400, "Selected Doctor is not eligible for this visit type");
    visitType = configured.name; visitTypeId = configured._id; durationMinutes = configured.durationMinutes; requiredResourceType = configured.requiredResourceType;
  }
  if (!visitType) throw new ApiError(400, "Visit type is required");
  const { scheduledAt, dayOfWeek, time } = parseClinicDateTime(payload.scheduledAt);
  const availability = await useSession(Availability.findOne({ tenantId, locationId, doctorId: doctor._id }), session).lean();
  if (!availability?.slots.length) throw new ApiError(400, "This doctor has not set availability for this location");
  if (!isRangeWithinAvailability(availability.slots, dayOfWeek, time, durationMinutes)) throw new ApiError(400, `The full ${durationMinutes}-minute visit must fit within the Doctor's availability`);

  const location = await useSession(Location.findOne({ _id: locationId, tenantId }), session).lean();
  const clinicDate = String(payload.scheduledAt || "").slice(0, 10);
  if (selfScheduling && (location?.schedulingSettings?.selfSchedulingBlackouts || []).some((item) => clinicDate >= item.startDate && clinicDate <= item.endDate)) throw new ApiError(400, "Online booking is not available on this date. Please choose another day.");
  const activeStatuses = { $in: ["scheduled", "checked_in"] };
  const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const overlaps = (entry) => new Date(entry.scheduledAt).getTime() < endAt.getTime() && new Date(entry.scheduledAt).getTime() + (entry.durationMinutes || 30) * 60 * 1000 > scheduledAt.getTime();
  const doctorConflicts = (await useSession(Appointment.find({ tenantId, locationId, doctorId: doctor._id, status: activeStatuses }).select("_id scheduledAt durationMinutes").lean(), session)).filter(overlaps);
  let resource = null;
  let resourceConflicts = [];
  if (payload.resourceId) {
    resource = await useSession(Resource.findOne({ _id: payload.resourceId, tenantId, locationId, isActive: true }), session).lean();
    if (!resource) throw new ApiError(404, "Selected resource is not available in this location");
    resourceConflicts = (await useSession(Appointment.find({ tenantId, locationId, resourceId: resource._id, status: activeStatuses }).select("_id scheduledAt durationMinutes").lean(), session)).filter(overlaps);
  }
  if (selfScheduling && requiredResourceType && !resource) {
    const candidates = await useSession(Resource.find({ tenantId, locationId, type: requiredResourceType, isActive: true }), session).lean();
    for (const candidate of candidates) {
      const conflicts = (await useSession(Appointment.find({ tenantId, locationId, resourceId: candidate._id, status: activeStatuses }).select("_id scheduledAt durationMinutes").lean(), session)).filter(overlaps);
      if (!conflicts.length) { resource = candidate; resourceConflicts = []; break; }
    }
    if (!resource) throw new ApiError(409, `No ${requiredResourceType.replaceAll("_", " ")} is available for that appointment time.`);
  }
  if (requiredResourceType && !resource) throw new ApiError(400, `This visit type requires a ${requiredResourceType.replaceAll("_", " ")}`);
  if (requiredResourceType && resource.type !== requiredResourceType) throw new ApiError(400, `This visit type requires a ${requiredResourceType.replaceAll("_", " ")}`);
  const conflictTypes = [...(doctorConflicts.length ? ["doctor"] : []), ...(resourceConflicts.length ? ["resource"] : [])];
  const overrideReason = String(payload.overrideReason || "").trim();
  let isOverbooked = false;
  if (conflictTypes.length) {
    if (selfScheduling) throw new ApiError(409, "That appointment time was just taken. Please choose another available time.");
    if (!overrideReason) throw new ApiError(409, "Scheduling conflict detected. Use the explicit override flow and provide a reason to continue.", { conflictTypes, doctorConflictCount: doctorConflicts.length, resourceConflictCount: resourceConflicts.length });
    if (overrideReason.length < 3) throw new ApiError(400, "Override reason must be at least 3 characters");
    if (doctorConflicts.length) {
      const dayStart = new Date(scheduledAt); dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const usedOverbooks = await useSession(Appointment.countDocuments({ tenantId, locationId, doctorId: doctor._id, scheduledAt: { $gte: dayStart, $lt: dayEnd }, isOverbooked: true, status: activeStatuses }), session);
      const limit = location?.schedulingSettings?.maxOverbookSlotsPerDoctorPerDay || 0;
      if (limit <= usedOverbooks) throw new ApiError(409, `Overbook limit reached for this doctor today (${limit}).`);
      isOverbooked = true;
    }
  }

  const appointment = new Appointment({ tenantId, locationId, patientId: patient._id, doctorId: doctor._id, visitType, visitTypeId, durationMinutes, scheduledAt, resourceId: resource?._id, isOverbooked, override: conflictTypes.length ? { reason: overrideReason, conflictTypes, conflictingAppointmentIds: [...doctorConflicts, ...resourceConflicts].map((item) => item._id), actorUserId, timestamp: new Date() } : undefined, eligibilityStatus: mockEligibilityCheck(patient), eligibilityCheckedAt: new Date(), createdBy: actorUserId || undefined, bookedBy: selfScheduling ? "patient" : "staff", referralId: referral?._id });
  if (!isOverbooked) {
    const capacityKeys = [`doctor:${doctor._id}`, ...(resource ? [`resource:${resource._id}`] : [])];
    const locks = [];
    for (let minute = 0; minute < durationMinutes; minute += 1) for (const capacityKey of capacityKeys) locks.push({ tenantId, locationId, capacityKey, slotAt: new Date(scheduledAt.getTime() + minute * 60000), appointmentId: appointment._id });
    try {
      await SchedulingSlotLock.insertMany(locks, { session, ordered: true });
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, selfScheduling ? "That time was just booked by another patient. Please choose another available time." : "That time was just booked. Refresh availability and choose another time.");
      throw error;
    }
  }
  await appointment.save({ session: session || undefined });
  if (referral && !rescheduleOf) {
    const now = new Date();
    const scheduledReferral = await Referral.findOneAndUpdate(
      { _id: referral._id, tenantId, targetLocationId: locationId, status: { $in: ["sent", "received"] } },
      { $set: { status: "scheduled" }, $push: { statusHistory: { status: "scheduled", actor: actorUserId, timestamp: now } } },
      { new: true, session },
    );
    if (!scheduledReferral) throw new ApiError(409, "This referral was already scheduled or closed");
    referral = scheduledReferral.toObject();
    await notifyStaffUsers({ tenantId, locationId, recipientUserIds: [referral.targetDoctorId], type: "referral_scheduled", title: "Referral visit scheduled", body: "Front-desk booked the specialist visit. It will appear in My Queue after check-in.", targetPath: "/my-referrals", targetId: referral._id, session });
  } else if (!selfScheduling && actorUserId && !skipNotifications) {
    await notifyStaffUsers({ tenantId, locationId, recipientUserIds: [doctor._id], type: "appointment_booked", title: "New appointment booked", body: `Front-desk booked ${visitType} for ${patient.name}.`, targetPath: "/queue", targetId: appointment._id, session });
    if (patient.portalActivated) await notifyPatient({ tenantId, locationId, patientId: patient._id, type: "patient_appointment_booked", title: "Appointment booked", body: `Your clinic booked a ${visitType} appointment with ${doctor.name}.`, targetPath: "/portal?view=appointments", targetId: appointment._id, session });
  }
  const audits = skipAudit ? [] : [{ tenantId, locationId, ...(actorUserId ? { actorUserId } : { actorPatientId }), action: selfScheduling ? "patient_portal_appointment_booked" : "appointment_booked", targetType: "Appointment", targetId: appointment._id }];
  if (referral && !rescheduleOf && !skipAudit) {
    for (const referralLocationId of [...new Set([String(referral.originLocationId), String(referral.targetLocationId)])]) {
      audits.push({ tenantId, locationId: referralLocationId, actorUserId, action: "referral_status_updated", targetType: "Referral", targetId: referral._id });
    }
  }
  if (conflictTypes.length) audits.push({ tenantId, locationId, actorUserId, action: "appointment_override_recorded", targetType: "Appointment", targetId: appointment._id });
  // Voice and email remain future integrations. Only an explicit SMS rule creates a real reminder.
  const rules = (location?.schedulingSettings?.reminderRules || []).filter((rule) => rule.channel === "sms");
  const reminders = rules.map((rule) => ({ tenantId, locationId, appointmentId: appointment._id, patientId: patient._id, ...(actorUserId ? { actorUserId } : { actorPatientId }), channel: rule.channel, scheduledFor: new Date(scheduledAt.getTime() - rule.offsetHours * 60 * 60 * 1000), status: patient.communicationPreferences?.smsOptOut ? "skipped_opt_out" : "scheduled", detail: patient.communicationPreferences?.smsOptOut ? "Patient opted out of SMS reminders." : "SMS reminder scheduled." }));
  if (reminders.length) await Reminder.insertMany(reminders, { session: session || undefined, ordered: true });
  if (reminders.length) audits.push({ tenantId, locationId, ...(actorUserId ? { actorUserId } : { actorPatientId }), action: "reminders_scheduled", targetType: "Appointment", targetId: appointment._id });
  if (audits.length) {
    if (session) await AuditLog.create(audits, { session, ordered: true });
    else await AuditLog.create(audits);
  }
  return appointment;
}

export async function releaseAppointmentSlotLocks({ tenantId, locationId, appointmentId, session = null }) {
  const query = SchedulingSlotLock.deleteMany({ tenantId, locationId, appointmentId });
  if (session) query.session(session);
  await query;
}

const patientChangeCutoffMs = 24 * 60 * 60 * 1000;

async function restoreReferralToBooking({ referralId, tenantId, locationId, actorUserId, actorPatientId, session }) {
  if (!referralId) return;
  const referral = await Referral.findOne({ _id: referralId, tenantId, targetLocationId: locationId, status: "scheduled" }).session(session);
  if (!referral) return;
  const priorStatus = [...(referral.statusHistory || [])].reverse().find((entry) => ["sent", "received"].includes(entry.status))?.status || "received";
  referral.status = priorStatus;
  referral.statusHistory.push({ status: priorStatus, ...(actorUserId ? { actor: actorUserId } : { actorPatientId }), timestamp: new Date() });
  await referral.save({ session });
}

export async function cancelPatientAppointment({ tenantId, locationId, patientId, appointmentId, reasonCode, reason }) {
  await ensureSchedulingLockIndex();
  const session = await mongoose.startSession();
  try {
    let appointment;
    await session.withTransaction(async () => {
      appointment = await Appointment.findOne({ _id: appointmentId, tenantId, locationId, patientId, status: "scheduled" }).session(session);
      if (!appointment) throw new ApiError(404, "This appointment is not available to cancel");
      if (appointment.scheduledAt.getTime() - Date.now() < patientChangeCutoffMs) throw new ApiError(409, "Online changes close 24 hours before your appointment. Please contact your clinic.");
      appointment.status = "cancelled";
      appointment.cancellationReasonCode = reasonCode;
      appointment.cancellationReason = reason;
      appointment.cancelledAt = new Date();
      await appointment.save({ session });
      await releaseAppointmentSlotLocks({ tenantId, locationId, appointmentId: appointment._id, session });
      await Reminder.updateMany({ tenantId, locationId, appointmentId: appointment._id, status: "scheduled" }, { $set: { status: "cancelled", detail: "Reminder cancelled because the patient cancelled the appointment." } }, { session });
      await restoreReferralToBooking({ referralId: appointment.referralId, tenantId, locationId, actorPatientId: patientId, session });
      const [patient, frontDesk] = await Promise.all([
        Patient.findById(patientId).select("name").session(session).lean(),
        User.find({ tenantId, locationId, role: "frontdesk", isActive: { $ne: false } }).select("_id").session(session).lean(),
      ]);
      await notifyStaffUsers({ tenantId, locationId, recipientUserIds: frontDesk.map((user) => user._id), type: "patient_appointment_cancelled", title: "Patient cancelled appointment", body: `${patient?.name || "A patient"} cancelled their ${appointment.visitType} appointment. Reason: ${reason}.`, targetPath: "/scheduling", targetId: appointment._id, session });
      await AuditLog.create([{ tenantId, locationId, actorPatientId: patientId, action: "patient_portal_appointment_cancelled", targetType: "Appointment", targetId: appointment._id }], { session });
    });
    return appointment;
  } finally { await session.endSession(); }
}

export async function rescheduleAppointment({ tenantId, locationId, appointmentId, scheduledAt, reason, actorUserId = null, actorPatientId = null, patientSelfService = false }) {
  await ensureSchedulingLockIndex();
  const session = await mongoose.startSession();
  try {
    let original; let replacement;
    await session.withTransaction(async () => {
      original = await Appointment.findOne({ _id: appointmentId, tenantId, locationId, ...(patientSelfService ? { patientId: actorPatientId } : {}), status: "scheduled" }).session(session);
      if (!original) throw new ApiError(404, "This appointment is not available to reschedule");
      if (patientSelfService && original.scheduledAt.getTime() - Date.now() < patientChangeCutoffMs) throw new ApiError(409, "Online changes close 24 hours before your appointment. Please contact your clinic.");
      if (new Date(scheduledAt).getTime() === original.scheduledAt.getTime()) throw new ApiError(400, "Choose a different appointment time");
      replacement = await bookAppointment({
        tenantId, locationId, actorUserId, actorPatientId,
        selfScheduling: patientSelfService,
        rescheduleOf: original._id,
        skipAudit: true,
        skipNotifications: true,
        session,
        payload: { patientId: original.patientId, doctorId: original.doctorId, visitTypeId: original.visitTypeId, visitType: original.visitType, resourceId: patientSelfService ? undefined : original.resourceId, referralId: original.referralId, scheduledAt },
      });
      original.status = "rescheduled";
      original.rescheduledAt = new Date();
      original.rescheduledToAppointmentId = replacement._id;
      original.cancellationReason = reason;
      await original.save({ session });
      replacement.rescheduledFromAppointmentId = original._id;
      await replacement.save({ session });
      await releaseAppointmentSlotLocks({ tenantId, locationId, appointmentId: original._id, session });
      await Reminder.updateMany({ tenantId, locationId, appointmentId: original._id, status: "scheduled" }, { $set: { status: "cancelled", detail: "Reminder cancelled because the appointment was rescheduled." } }, { session });
      const action = patientSelfService ? "patient_portal_appointment_rescheduled" : "appointment_rescheduled";
      await AuditLog.create([{ tenantId, locationId, ...(actorUserId ? { actorUserId } : { actorPatientId }), action, targetType: "Appointment", targetId: original._id }], { session });
      if (patientSelfService) {
        const [patient, frontDesk] = await Promise.all([
          Patient.findById(actorPatientId).select("name").session(session).lean(),
          User.find({ tenantId, locationId, role: "frontdesk", isActive: { $ne: false } }).select("_id").session(session).lean(),
        ]);
        await notifyStaffUsers({ tenantId, locationId, recipientUserIds: frontDesk.map((user) => user._id), type: "patient_appointment_rescheduled", title: "Patient rescheduled appointment", body: `${patient?.name || "A patient"} moved their ${original.visitType} appointment to ${replacement.scheduledAt.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}.`, targetPath: "/scheduling", targetId: replacement._id, session });
      }
    });
    return { original, replacement };
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, patientSelfService ? "That time was just booked by another patient. Please choose another available time." : "That time was just booked. Refresh availability and choose another time.");
    throw error;
  } finally { await session.endSession(); }
}
