import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { bookAppointment } from "../services/appointmentBookingService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function scopedPopulate(query, req) {
  const match = { tenantId: req.tenantId, locationId: req.locationId };
  return query
    .populate({ path: "patientId", select: "name contact", match })
    .populate({ path: "doctorId", select: "name email", match: { ...match, role: "doctor" } });
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

  appointment.status = "checked_in";
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
