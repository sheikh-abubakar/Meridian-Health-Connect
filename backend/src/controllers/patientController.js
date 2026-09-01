import { AuditLog } from "../models/AuditLog.js";
import { Appointment } from "../models/Appointment.js";
import { Encounter } from "../models/Encounter.js";
import { Patient } from "../models/Patient.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function serializePatient(patient) {
  return {
    id: patient._id,
    name: patient.name,
    phone: patient.contact.phone,
    email: patient.contact.email || "",
    address: patient.address,
    insuranceProvider: patient.insuranceInfo?.provider || "",
    policyNumber: patient.insuranceInfo?.policyNumber || "",
    createdAt: patient.createdAt,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withLastVisit(patients, req) {
  if (!patients.length) return [];
  const visits = await Appointment.aggregate([
    { $match: { tenantId: req.tenantId, locationId: req.locationId, patientId: { $in: patients.map((patient) => patient._id) }, scheduledAt: { $lte: new Date() } } },
    { $group: { _id: "$patientId", lastVisitAt: { $max: "$scheduledAt" } } },
  ]);
  const byPatient = new Map(visits.map((visit) => [String(visit._id), visit.lastVisitAt]));
  return patients.map((patient) => ({ ...serializePatient(patient), lastVisitAt: byPatient.get(String(patient._id)) || null }));
}

export const listPatients = asyncHandler(async (req, res) => {
  const patients = await Patient.find({ tenantId: req.tenantId, locationId: req.locationId })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: { patients: patients.map(serializePatient) } });
});

export const searchPatients = asyncHandler(async (req, res) => {
  const phone = String(req.query.phone || "").trim();
  const name = String(req.query.name || "").trim();
  const query = phone || name;
  if (query.length < 2) return res.json({ success: true, data: { patients: [] } });

  const filter = { tenantId: req.tenantId, locationId: req.locationId };
  if (phone) filter["contact.phone"] = { $regex: escapeRegex(phone), $options: "i" };
  else filter.name = { $regex: escapeRegex(name), $options: "i" };
  const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(10).lean();
  res.json({ success: true, data: { patients: await withLastVisit(patients, req) } });
});

export const getPatient = asyncHandler(async (req, res) => {
  const scope = { tenantId: req.tenantId, locationId: req.locationId, patientId: req.params.id };
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId }).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const encounterQuery = Encounter.find(scope)
    .populate({ path: "doctorId", select: "name", match: { tenantId: req.tenantId, locationId: req.locationId } })
    .populate({ path: "appointmentId", select: "visitType scheduledAt status", match: { tenantId: req.tenantId, locationId: req.locationId } })
    .sort({ createdAt: -1 });
  if (req.user.role === "frontdesk") {
    encounterQuery.select("doctorId appointmentId status createdAt finalizedAt");
  }
  const [appointments, encounters] = await Promise.all([
    Appointment.find(scope).populate({ path: "doctorId", select: "name", match: { tenantId: req.tenantId, locationId: req.locationId } }).sort({ scheduledAt: -1 }).lean(),
    encounterQuery.lean(),
  ]);
  res.json({ success: true, data: { patient: serializePatient(patient), appointments, encounters } });
});

export const createPatient = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const address = String(req.body.address || "").trim();
  const insuranceProvider = String(req.body.insuranceProvider || "").trim();
  const policyNumber = String(req.body.policyNumber || "").trim();

  if (name.length < 2) throw new ApiError(400, "Patient name must be at least 2 characters");
  if (!phone) throw new ApiError(400, "Phone number is required");
  if (!address) throw new ApiError(400, "Address is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Enter a valid email address");
  }

  const duplicate = await Patient.findOne({ tenantId: req.tenantId, locationId: req.locationId, "contact.phone": phone }).lean();
  if (duplicate && req.body.allowDuplicate !== true) {
    throw new ApiError(409, `A patient with this phone number already exists: ${duplicate.name}. View the existing patient or explicitly confirm duplicate creation.`);
  }

  const patient = await Patient.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    name,
    contact: { phone, email: email || undefined },
    address,
    insuranceInfo: {
      provider: insuranceProvider || undefined,
      policyNumber: policyNumber || undefined,
    },
  });

  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "patient_created",
    targetType: "Patient",
    targetId: patient._id,
  });

  res.status(201).json({ success: true, data: { patient: serializePatient(patient) } });
});
