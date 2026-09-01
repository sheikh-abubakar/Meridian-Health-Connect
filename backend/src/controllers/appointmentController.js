import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Availability } from "../models/Availability.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { isWithinAvailability, parseClinicDateTime } from "../services/availabilityService.js";
import { mockEligibilityCheck } from "../services/mockEligibility.js";
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
  const patient = await Patient.findOne({
    _id: req.body.patientId,
    tenantId: req.tenantId,
    locationId: req.locationId,
  }).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const doctor = await User.findOne({
    _id: req.body.doctorId,
    tenantId: req.tenantId,
    locationId: req.locationId,
    role: "doctor",
    isActive: { $ne: false },
  }).lean();
  if (!doctor) throw new ApiError(404, "Doctor not found in this location");

  const visitType = String(req.body.visitType || "").trim();
  if (!visitType) throw new ApiError(400, "Visit type is required");

  const { scheduledAt, dayOfWeek, time } = parseClinicDateTime(req.body.scheduledAt);
  const availability = await Availability.findOne({
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: doctor._id,
  }).lean();
  if (!availability?.slots.length) {
    throw new ApiError(400, "This doctor has not set availability for this location");
  }
  if (!isWithinAvailability(availability.slots, dayOfWeek, time)) {
    throw new ApiError(400, "Selected date and time is outside the doctor's availability");
  }

  const conflict = await Appointment.exists({
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: doctor._id,
    scheduledAt,
  });
  if (conflict) throw new ApiError(409, "Doctor already has an appointment at this date and time");

  const appointment = await Appointment.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    patientId: patient._id,
    doctorId: doctor._id,
    visitType,
    scheduledAt,
    eligibilityStatus: mockEligibilityCheck(patient),
    createdBy: req.user._id,
  });

  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "appointment_booked",
    targetType: "Appointment",
    targetId: appointment._id,
  });

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
