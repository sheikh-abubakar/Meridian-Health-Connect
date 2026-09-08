import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Availability } from "../models/Availability.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Resource } from "../models/Resource.js";
import { Location } from "../models/Location.js";
import { Reminder } from "../models/Reminder.js";
import { VisitType } from "../models/VisitType.js";
import { isRangeWithinAvailability, parseClinicDateTime } from "./availabilityService.js";
import { mockEligibilityCheck } from "./mockEligibility.js";
import { ApiError } from "../utils/ApiError.js";

const useSession = (query, session) => session ? query.session(session) : query;

export async function bookAppointment({ tenantId, locationId, actorUserId, payload, session = null }) {
  const patient = await useSession(Patient.findOne({ _id: payload.patientId, tenantId, locationId }), session).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const doctor = await useSession(User.findOne({ _id: payload.doctorId, tenantId, locationId, role: "doctor", isActive: { $ne: false } }), session).lean();
  if (!doctor) throw new ApiError(404, "Doctor not found in this location");

  let visitType = String(payload.visitType || "").trim();
  let visitTypeId; let durationMinutes = 30; let requiredResourceType = null;
  if (payload.visitTypeId) {
    const configured = await useSession(VisitType.findOne({ _id: payload.visitTypeId, tenantId, locationId, isActive: { $ne: false } }), session).lean();
    if (!configured) throw new ApiError(404, "Selected visit type is not available in this location");
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
  if (requiredResourceType && !resource) throw new ApiError(400, `This visit type requires a ${requiredResourceType.replaceAll("_", " ")}`);
  if (requiredResourceType && resource.type !== requiredResourceType) throw new ApiError(400, `This visit type requires a ${requiredResourceType.replaceAll("_", " ")}`);
  const conflictTypes = [...(doctorConflicts.length ? ["doctor"] : []), ...(resourceConflicts.length ? ["resource"] : [])];
  const overrideReason = String(payload.overrideReason || "").trim();
  let isOverbooked = false;
  if (conflictTypes.length) {
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

  const appointment = new Appointment({ tenantId, locationId, patientId: patient._id, doctorId: doctor._id, visitType, visitTypeId, durationMinutes, scheduledAt, resourceId: resource?._id, isOverbooked, override: conflictTypes.length ? { reason: overrideReason, conflictTypes, conflictingAppointmentIds: [...doctorConflicts, ...resourceConflicts].map((item) => item._id), actorUserId, timestamp: new Date() } : undefined, eligibilityStatus: mockEligibilityCheck(patient), eligibilityCheckedAt: new Date(), createdBy: actorUserId });
  await appointment.save({ session: session || undefined });
  const audits = [{ tenantId, locationId, actorUserId, action: "appointment_booked", targetType: "Appointment", targetId: appointment._id }];
  if (conflictTypes.length) audits.push({ tenantId, locationId, actorUserId, action: "appointment_override_recorded", targetType: "Appointment", targetId: appointment._id });
  // Voice and email remain future integrations. Only an explicit SMS rule creates a real reminder.
  const rules = (location?.schedulingSettings?.reminderRules || []).filter((rule) => rule.channel === "sms");
  const reminders = rules.map((rule) => ({ tenantId, locationId, appointmentId: appointment._id, patientId: patient._id, actorUserId, channel: rule.channel, scheduledFor: new Date(scheduledAt.getTime() - rule.offsetHours * 60 * 60 * 1000), status: patient.communicationPreferences?.smsOptOut ? "skipped_opt_out" : "scheduled", detail: patient.communicationPreferences?.smsOptOut ? "Patient opted out of SMS reminders." : "SMS reminder scheduled." }));
  if (reminders.length) await Reminder.insertMany(reminders, { session: session || undefined, ordered: true });
  if (reminders.length) audits.push({ tenantId, locationId, actorUserId, action: "reminders_scheduled", targetType: "Appointment", targetId: appointment._id });
  if (session) await AuditLog.create(audits, { session, ordered: true });
  else await AuditLog.create(audits);
  return appointment;
}
