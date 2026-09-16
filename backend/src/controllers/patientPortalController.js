import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { AuditLog } from "../models/AuditLog.js";
import { Location } from "../models/Location.js";
import { Patient } from "../models/Patient.js";
import { Tenant } from "../models/Tenant.js";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../services/passwordService.js";
import { sendPortalInvite } from "../services/portalEmailService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Appointment } from "../models/Appointment.js";
import { Availability } from "../models/Availability.js";
import { User } from "../models/User.js";
import { VisitType } from "../models/VisitType.js";
import { bookAppointment } from "../services/appointmentBookingService.js";
import { CarePlan } from "../models/CarePlan.js";
import { Task } from "../models/Task.js";
import { getAdministrativeVisitHistory } from "../services/administrativeVisitHistoryService.js";
import { renderVisitHistoryPdf } from "../services/pdfExportService.js";

const cleanEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const activationError = () =>
  new ApiError(
    400,
    "This activation link is invalid, expired, or has already been used. Please contact your clinic for a new invitation.",
  );
function passwordFrom(req) {
  const value = String(req.body.password || "");
  if (value.length < 8)
    throw new ApiError(400, "Choose a password with at least 8 characters");
  return value;
}

export const invitePatientToPortal = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({
    _id: req.params.id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  if (patient.portalActivated)
    throw new ApiError(
      409,
      "This patient already has an active portal account",
    );
  const email = cleanEmail(patient.contact?.email);
  if (!email)
    throw new ApiError(
      400,
      "Add the patient's email address before sending a portal invitation",
    );
  const duplicate = await Patient.findOne({
    portalEmail: email,
    _id: { $ne: patient._id },
  }).lean();
  if (duplicate)
    throw new ApiError(
      409,
      "This email is already used by a patient portal account",
    );
  const token = crypto.randomBytes(32).toString("hex");
  patient.portalEmail = email;
  patient.activationToken = token;
  patient.activationTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await patient.save();
  const tenant = await Tenant.findById(req.tenantId).lean();
  const clinicName = tenant?.name || "Meridian Health";
  try {
    await sendPortalInvite({
      recipient: email,
      patientName: patient.name,
      clinicName,
      activationUrl: `${env.frontendUrl}/portal/activate/${token}`,
    });
  } catch (error) {
    patient.activationToken = undefined;
    patient.activationTokenExpiry = undefined;
    await patient.save();
    throw new ApiError(
      502,
      "The invitation email could not be sent. Check the clinic email settings and try again.",
    );
  }
  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "patient_portal_invite_sent",
    targetType: "Patient",
    targetId: patient._id,
  });
  res.json({
    success: true,
    data: { portalActivated: false, invitationSentTo: email },
  });
});

export const inspectActivation = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({
    activationToken: req.params.token,
    activationTokenExpiry: { $gt: new Date() },
    portalActivated: false,
  })
    .select("name")
    .lean();
  if (!patient) throw activationError();
  res.json({ success: true, data: { valid: true, patientName: patient.name } });
});

export const activatePortal = asyncHandler(async (req, res) => {
  const password = passwordFrom(req);
  const patient = await Patient.findOne({
    activationToken: req.params.token,
    activationTokenExpiry: { $gt: new Date() },
    portalActivated: false,
  }).select("+passwordHash +activationToken +activationTokenExpiry");
  if (!patient) throw activationError();
  patient.passwordHash = await hashPassword(password);
  patient.portalActivated = true;
  patient.activationToken = undefined;
  patient.activationTokenExpiry = undefined;
  await patient.save();
  await AuditLog.create({
    tenantId: patient.tenantId,
    locationId: patient.locationId,
    actorPatientId: patient._id,
    action: "patient_portal_activated",
    targetType: "Patient",
    targetId: patient._id,
  });
  res.json({ success: true, data: { activated: true } });
});

export const patientPortalLogin = asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!email || !password)
    throw new ApiError(400, "Enter your email and password");
  const patient = await Patient.findOne({
    portalEmail: email,
    portalActivated: true,
  }).select("+passwordHash");
  if (!patient || !(await verifyPassword(password, patient.passwordHash)))
    throw new ApiError(401, "The email or password is not correct");
  const [tenant, location] = await Promise.all([
    Tenant.findById(patient.tenantId).lean(),
    Location.findOne({
      _id: patient.locationId,
      tenantId: patient.tenantId,
    }).lean(),
  ]);
  if (!tenant || !location)
    throw new ApiError(401, "This portal account is not available");
  const accessToken = jwt.sign(
    {
      tokenType: "patient_portal",
      patientId: String(patient._id),
      tenantId: String(patient.tenantId),
      locationId: String(patient.locationId),
    },
    env.jwtSecret,
    { subject: String(patient._id), expiresIn: env.jwtExpiresIn },
  );
  await AuditLog.create({
    tenantId: patient.tenantId,
    locationId: patient.locationId,
    actorPatientId: patient._id,
    action: "patient_portal_logged_in",
    targetType: "Patient",
    targetId: patient._id,
  });
  res.json({
    success: true,
    data: {
      accessToken,
      patient: { id: patient._id, name: patient.name },
      clinic: { name: tenant.name, branchName: location.name },
    },
  });
});

export const patientPortalSession = asyncHandler(async (req, res) => {
  const [tenant, location] = await Promise.all([
    Tenant.findById(req.tenantId).lean(),
    Location.findOne({ _id: req.locationId, tenantId: req.tenantId }).lean(),
  ]);
  res.json({
    success: true,
    data: {
      patient: { id: req.portalPatient._id, name: req.portalPatient.name },
      clinic: {
        name: tenant?.name || "Your clinic",
        branchName: location?.name || "Your branch",
      },
    },
  });
});

const appointmentView = (item) => ({
  id: item._id,
  scheduledAt: item.scheduledAt,
  visitType: item.visitType,
  status: item.status,
  doctor: item.doctorId?.name || "Your clinician",
  bookedBy: item.bookedBy || "staff",
});
export const patientPortalAppointments = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await Appointment.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    patientId: req.portalPatient._id,
  })
    .populate({
      path: "doctorId",
      select: "name",
      match: { tenantId: req.tenantId, locationId: req.locationId },
    })
    .sort({ scheduledAt: -1 })
    .lean();
  res.json({
    success: true,
    data: {
      upcoming: items
        .filter(
          (item) =>
            item.scheduledAt >= now &&
            ["scheduled", "checked_in"].includes(item.status),
        )
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .map(appointmentView),
      past: items
        .filter(
          (item) =>
            item.scheduledAt < now ||
            ["completed", "cancelled", "no_show"].includes(item.status),
        )
        .map(appointmentView),
    },
  });
});
function isBlackout(date, windows) {
  return (windows || []).some(
    (window) => date >= window.startDate && date <= window.endDate,
  );
}
export const patientPortalBookingOptions = asyncHandler(async (req, res) => {
  const location = await Location.findOne({
    _id: req.locationId,
    tenantId: req.tenantId,
  }).lean();
  const visitTypes = await VisitType.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    isActive: { $ne: false },
    patientSelfSchedulingEnabled: true,
  }).lean();
  const doctors = await User.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    role: "doctor",
    isActive: { $ne: false },
  })
    .select("name specialtyIds")
    .lean();
  const availability = await Availability.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
  }).lean();
  const blackoutWindows =
    location?.schedulingSettings?.selfSchedulingBlackouts || [];
  const data = {
    visitTypes: visitTypes.map((item) => ({
      id: item._id,
      name: item.name,
      durationMinutes: item.durationMinutes,
      specialtyIds: item.specialtyIds.map(String),
    })),
    doctors: doctors.map((doctor) => ({
      id: doctor._id,
      name: doctor.name,
      specialtyIds: (doctor.specialtyIds || []).map(String),
      slots:
        availability.find(
          (item) => String(item.doctorId) === String(doctor._id),
        )?.slots || [],
    })),
    blackoutWindows,
  };
  const { visitTypeId, doctorId, date } = req.query;
  if (visitTypeId && doctorId && /^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    const visitType = visitTypes.find(
      (item) => String(item._id) === String(visitTypeId),
    );
    const doctor = doctors.find(
      (item) => String(item._id) === String(doctorId),
    );
    if (
      !visitType ||
      !doctor ||
      !(visitType.specialtyIds || []).some((id) =>
        (doctor.specialtyIds || []).map(String).includes(String(id)),
      )
    )
      throw new ApiError(400, "Choose a valid visit type and clinician");
    if (isBlackout(date, blackoutWindows)) data.availableTimes = [];
    else {
      const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
      const slots =
        availability.find(
          (item) => String(item.doctorId) === String(doctor._id),
        )?.slots || [];
      const existing = await Appointment.find({
        tenantId: req.tenantId,
        locationId: req.locationId,
        doctorId: doctor._id,
        status: { $in: ["scheduled", "checked_in"] },
      })
        .select("scheduledAt durationMinutes")
        .lean();
      data.availableTimes = slots
        .filter((slot) => slot.dayOfWeek === dayOfWeek)
        .flatMap((slot) => {
          const [sh, sm] = slot.startTime.split(":").map(Number);
          const [eh, em] = slot.endTime.split(":").map(Number);
          const results = [];
          for (
            let minute = sh * 60 + sm;
            minute + visitType.durationMinutes <= eh * 60 + em;
            minute += visitType.durationMinutes
          ) {
            const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
            const start = new Date(`${date}T${time}:00+05:00`);
            const end = new Date(
              start.getTime() + visitType.durationMinutes * 60000,
            );
            if (
              !existing.some(
                (item) =>
                  new Date(item.scheduledAt) < end &&
                  new Date(item.scheduledAt).getTime() +
                    (item.durationMinutes || 30) * 60000 >
                    start.getTime(),
              )
            )
              results.push(time);
          }
          return results;
        });
    }
  }
  res.json({ success: true, data });
});
export const patientPortalBookAppointment = asyncHandler(async (req, res) => {
  const appointment = await bookAppointment({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorPatientId: req.portalPatient._id,
    selfScheduling: true,
    payload: { ...req.body, patientId: req.portalPatient._id },
  });
  const item = await Appointment.findOne({
    _id: appointment._id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  })
    .populate({ path: "doctorId", select: "name" })
    .lean();
  res
    .status(201)
    .json({ success: true, data: { appointment: appointmentView(item) } });
});
export const patientPortalCarePlans = asyncHandler(async (req, res) => {
  const location = await Location.findOne({
    _id: req.locationId,
    tenantId: req.tenantId,
  })
    .select("schedulingSettings.showCarePlansInPatientPortal")
    .lean();
  if (!location?.schedulingSettings?.showCarePlansInPatientPortal)
    return res.json({ success: true, data: { enabled: false, carePlans: [] } });
  const plans = await CarePlan.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    patientId: req.portalPatient._id,
  })
    .select("goal targetMeasure reviewCadence createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const tasks = await Task.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    carePlanId: { $in: plans.map((plan) => plan._id) },
  })
    .select("carePlanId status")
    .lean();
  const carePlans = plans.map((plan) => {
    const linked = tasks.filter(
      (task) => String(task.carePlanId) === String(plan._id),
    );
    const completed = linked.filter(
      (task) => task.status === "completed",
    ).length;
    return {
      id: plan._id,
      goal: plan.goal,
      targetMeasure: plan.targetMeasure,
      reviewCadence: plan.reviewCadence,
      progress: { completed, total: linked.length },
    };
  });
  res.json({ success: true, data: { enabled: true, carePlans } });
});

export const patientPortalExport = asyncHandler(async (req, res) => {
  const { patient, appointments } = await getAdministrativeVisitHistory({
    tenantId: req.tenantId,
    locationId: req.locationId,
    patientId: req.portalPatient._id,
  });
  const [tenant, location] = await Promise.all([
    Tenant.findById(req.tenantId).lean(),
    Location.findOne({ _id: req.locationId, tenantId: req.tenantId }).lean(),
  ]);

  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorPatientId: patient._id,
    action: "patient_portal_history_exported",
    targetType: "Patient",
    targetId: patient._id,
  });
  renderVisitHistoryPdf(res, {
    tenant,
    location,
    patient,
    appointments,
    exportedBy: "Patient Portal",
    requestedByPatient: true,
  });
});
