import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Patient } from "../models/Patient.js";
import { Reminder } from "../models/Reminder.js";
import { Waitlist } from "../models/Waitlist.js";
import { bookAppointment } from "../services/appointmentBookingService.js";
import { mockEligibilityCheck } from "../services/mockEligibility.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function scopedPopulate(query, req) {
  const match = { tenantId: req.tenantId, locationId: req.locationId };
  return query
    .populate({ path: "patientId", select: "name contact", match })
    .populate({ path: "doctorId", select: "name email", match: { ...match, role: "doctor" } })
    .populate({ path: "resourceId", select: "name type", match });
}

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId, locationId: req.locationId };
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === "doctor") {
    filter.doctorId = req.user._id;
  } else if (req.query.doctorId) {
    filter.doctorId = req.query.doctorId;
  }

  const appointments = await scopedPopulate(
    Appointment.find(filter).sort({ scheduledAt: 1 }),
    req,
  ).lean();

  res.json({ success: true, data: { appointments } });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const appointment = await bookAppointment({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, payload: req.body });

  const populated = await scopedPopulate(Appointment.findOne({
    _id: appointment._id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  }), req).lean();
  res.status(201).json({ success: true, data: { appointment: populated } });
});

export const checkInAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  });
  if (!appointment) throw new ApiError(404, "Appointment not found in this location");
  if (appointment.status !== "scheduled") {
    throw new ApiError(409, `Cannot check in an appointment with status ${appointment.status}`);
  }

  const patient = await Patient.findOne({ _id: appointment.patientId, tenantId: req.tenantId, locationId: req.locationId }).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  appointment.status = "checked_in";
  appointment.eligibilityStatus = mockEligibilityCheck(patient);
  appointment.eligibilityCheckedAt = new Date();
  await appointment.save();
  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "appointment_checked_in",
    targetType: "Appointment",
    targetId: appointment._id,
  });

  const populated = await scopedPopulate(Appointment.findOne({
    _id: appointment._id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  }), req).lean();
  res.json({ success: true, data: { appointment: populated } });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (reason.length < 3) throw new ApiError(400, "Cancellation reason must be at least 3 characters");
  const appointment = await Appointment.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!appointment) throw new ApiError(404, "Appointment not found in this location");
  if (!["scheduled", "checked_in"].includes(appointment.status)) throw new ApiError(409, `Cannot cancel an appointment with status ${appointment.status}`);
  appointment.status = "cancelled"; appointment.cancellationReason = reason; appointment.cancelledAt = new Date();
  await appointment.save();
  await Reminder.updateMany({ tenantId: req.tenantId, locationId: req.locationId, appointmentId: appointment._id, status: "scheduled" }, { $set: { status: "cancelled", detail: "Reminder cancelled because appointment was cancelled." } });
  const waitlistCount = await Waitlist.countDocuments({ tenantId: req.tenantId, locationId: req.locationId, doctorId: appointment.doctorId });
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "appointment_cancelled", targetType: "Appointment", targetId: appointment._id });
  const populated = await scopedPopulate(Appointment.findOne({ _id: appointment._id, tenantId: req.tenantId, locationId: req.locationId }), req).lean();
  res.json({ success: true, data: { appointment: populated, waitlistCount } });
});

export const markNoShow = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!appointment) throw new ApiError(404, "Appointment not found in this location");
  if (appointment.status !== "scheduled") throw new ApiError(409, `Cannot mark an appointment with status ${appointment.status} as no-show`);
  if (appointment.scheduledAt > new Date()) throw new ApiError(400, "An appointment can only be marked no-show after its scheduled time");
  appointment.status = "no_show"; appointment.noShowAt = new Date(); await appointment.save();
  await Reminder.updateMany({ tenantId: req.tenantId, locationId: req.locationId, appointmentId: appointment._id, status: "scheduled" }, { $set: { status: "cancelled", detail: "Reminder cancelled because appointment was marked no-show." } });
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "appointment_no_show", targetType: "Appointment", targetId: appointment._id });
  const populated = await scopedPopulate(Appointment.findOne({ _id: appointment._id, tenantId: req.tenantId, locationId: req.locationId }), req).lean();
  res.json({ success: true, data: { appointment: populated } });
});
