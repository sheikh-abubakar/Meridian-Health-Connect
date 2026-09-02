import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Availability } from "../models/Availability.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { isWithinAvailability, parseClinicDateTime } from "./availabilityService.js";
import { mockEligibilityCheck } from "./mockEligibility.js";
import { ApiError } from "../utils/ApiError.js";

const useSession = (query, session) => session ? query.session(session) : query;

export async function bookAppointment({ tenantId, locationId, actorUserId, payload, session = null }) {
  const patient = await useSession(Patient.findOne({ _id: payload.patientId, tenantId, locationId }), session).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const doctor = await useSession(User.findOne({ _id: payload.doctorId, tenantId, locationId, role: "doctor", isActive: { $ne: false } }), session).lean();
  if (!doctor) throw new ApiError(404, "Doctor not found in this location");

  const visitType = String(payload.visitType || "").trim();
  if (!visitType) throw new ApiError(400, "Visit type is required");
  const { scheduledAt, dayOfWeek, time } = parseClinicDateTime(payload.scheduledAt);
  const availability = await useSession(Availability.findOne({ tenantId, locationId, doctorId: doctor._id }), session).lean();
  if (!availability?.slots.length) throw new ApiError(400, "This doctor has not set availability for this location");
  if (!isWithinAvailability(availability.slots, dayOfWeek, time)) throw new ApiError(400, "Selected date and time is outside the doctor's availability");

  const conflict = await useSession(Appointment.exists({ tenantId, locationId, doctorId: doctor._id, scheduledAt }), session);
  if (conflict) throw new ApiError(409, "Doctor already has an appointment at this date and time");

  const appointment = new Appointment({ tenantId, locationId, patientId: patient._id, doctorId: doctor._id, visitType, scheduledAt, eligibilityStatus: mockEligibilityCheck(patient), createdBy: actorUserId });
  await appointment.save({ session: session || undefined });
  const audit = { tenantId, locationId, actorUserId, action: "appointment_booked", targetType: "Appointment", targetId: appointment._id };
  if (session) await AuditLog.create([audit], { session });
  else await AuditLog.create(audit);
  return appointment;
}
