import mongoose from "mongoose";
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
    communicationPreferences: patient.communicationPreferences || { smsOptOut: false, emailOptOut: false, voiceOptOut: false },
    createdAt: patient.createdAt,
  };
}

function serializeRelatedParty(party) {
  return { id: party._id, name: party.name, phone: party.phone, email: party.email || "", relationship: party.relationship, addedBy: party.addedBy, addedAt: party.addedAt };
}

function serializeHouseholdMember(member) {
  return { id: member._id, name: member.name, phone: member.contact?.phone || "", email: member.contact?.email || "" };
}

async function profileRelations(patient, req) {
  const ids = (patient.householdMembers || []).map((id) => id?._id || id);
  const members = ids.length ? await Patient.find({ _id: { $in: ids }, tenantId: req.tenantId, locationId: req.locationId }).select("name contact").lean() : [];
  const relationships = new Map((patient.householdRelationships || []).map((item) => [String(item.patientId), item.relationship]));
  return { relatedParties: (patient.relatedParties || []).map(serializeRelatedParty), householdMembers: members.map((member) => ({ ...serializeHouseholdMember(member), relationship: relationships.get(String(member._id)) || "other" })) };
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
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId })
    .populate({ path: "editHistory.editedBy", select: "name role" })
    .lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const encounterQuery = Encounter.find(scope)
    .populate({ path: "doctorId", select: "name", match: { tenantId: req.tenantId, locationId: req.locationId } })
    .populate({ path: "appointmentId", select: "visitType scheduledAt status", match: { tenantId: req.tenantId, locationId: req.locationId } })
    .sort({ createdAt: -1 });
  if (req.user.role === "frontdesk") {
    encounterQuery.select("doctorId appointmentId status createdAt finalizedAt");
  }
  const [appointments, encounters, noShowCount] = await Promise.all([
    Appointment.find(scope).populate({ path: "doctorId", select: "name", match: { tenantId: req.tenantId, locationId: req.locationId } }).sort({ scheduledAt: -1 }).lean(),
    encounterQuery.lean(),
    Appointment.countDocuments({ ...scope, status: "no_show" }),
  ]);
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_record_viewed", targetType: "Patient", targetId: patient._id });
  const relations = await profileRelations(patient, req);
  const editHistory = (patient.editHistory || []).slice().sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt)).map((entry) => ({ id: entry._id, field: entry.field, oldValue: entry.oldValue, newValue: entry.newValue, editedAt: entry.editedAt, editedBy: entry.editedBy ? { id: entry.editedBy._id, name: entry.editedBy.name, role: entry.editedBy.role } : null }));
  res.json({ success: true, data: { patient: { ...serializePatient(patient), ...relations, editHistory, noShowCount }, appointments, encounters } });
});

export const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const fields = ["name", "phone", "email", "address", "insuranceProvider", "policyNumber"];
  const current = { name: patient.name, phone: patient.contact.phone, email: patient.contact.email || "", address: patient.address, insuranceProvider: patient.insuranceInfo?.provider || "", policyNumber: patient.insuranceInfo?.policyNumber || "" };
  const next = { ...current };
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(req.body, field)) next[field] = String(req.body[field] ?? "").trim();
  if (next.name.length < 2) throw new ApiError(400, "Patient name must be at least 2 characters");
  if (!next.phone) throw new ApiError(400, "Phone number is required");
  if (!next.address) throw new ApiError(400, "Address is required");
  if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new ApiError(400, "Enter a valid email address");
  const changes = fields.filter((field) => next[field] !== current[field]);
  if (!changes.length) return res.json({ success: true, data: { patient: serializePatient(patient), changedFields: [] } });
  patient.name = next.name; patient.contact.phone = next.phone; patient.contact.email = next.email || undefined; patient.address = next.address; patient.insuranceInfo = patient.insuranceInfo || {}; patient.insuranceInfo.provider = next.insuranceProvider || undefined; patient.insuranceInfo.policyNumber = next.policyNumber || undefined;
  const editedAt = new Date();
  patient.editHistory.push(...changes.map((field) => ({ field, oldValue: current[field], newValue: next[field], editedBy: req.user._id, editedAt })));
  await patient.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_information_updated", targetType: "Patient", targetId: patient._id });
  const editHistory = patient.editHistory.slice().reverse().map((entry) => ({ id: entry._id, field: entry.field, oldValue: entry.oldValue, newValue: entry.newValue, editedAt: entry.editedAt, editedBy: { id: req.user._id, name: req.user.name, role: req.user.role } }));
  res.json({ success: true, data: { patient: { ...serializePatient(patient), editHistory }, changedFields: changes } });
});

export const addRelatedParty = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const relationship = String(req.body.relationship || "").trim();
  if (name.length < 2 || !phone) throw new ApiError(400, "Name and phone are required");
  if (!["guardian", "caregiver", "guarantor", "emergency_contact"].includes(relationship)) throw new ApiError(400, "Invalid relationship");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address");
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const entry = { name, phone, email: email || undefined, relationship, addedBy: req.user._id, addedAt: new Date() };
  patient.relatedParties.push(entry);
  await patient.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_related_party_added", targetType: "Patient", targetId: patient._id });
  const saved = patient.relatedParties[patient.relatedParties.length - 1];
  res.status(201).json({ success: true, data: { relatedParty: serializeRelatedParty(saved) } });
});

export const removeRelatedParty = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const entry = patient.relatedParties.id(req.params.entryId);
  if (!entry) throw new ApiError(404, "Related party not found");
  entry.deleteOne();
  await patient.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_related_party_removed", targetType: "Patient", targetId: patient._id });
  res.json({ success: true, data: { removed: true } });
});

async function householdUpdate(req, mode) {
  const { id } = req.params;
  const otherPatientId = req.params.otherPatientId || req.body.otherPatientId || req.body.patientId;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(otherPatientId)) throw new ApiError(400, "The selected patient ID is invalid");
  if (String(id) === String(otherPatientId)) throw new ApiError(400, "You cannot link a patient to their own profile");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const filter = { tenantId: req.tenantId, locationId: req.locationId };
      const [patient, other] = await Promise.all([Patient.findOne({ ...filter, _id: id }).session(session), Patient.findOne({ ...filter, _id: otherPatientId }).session(session)]);
      if (!patient || !other) throw new ApiError(404, "Both patients must belong to this location");
      const relationship = ["mother", "father", "brother", "sister", "other"].includes(req.body.relationship) ? req.body.relationship : "other";
      const update = mode === "link" ? { $addToSet: { householdMembers: other._id }, $pull: { householdRelationships: { patientId: other._id } } } : { $pull: { householdMembers: other._id, householdRelationships: { patientId: other._id } } };
      const reverse = mode === "link" ? { $addToSet: { householdMembers: patient._id }, $pull: { householdRelationships: { patientId: patient._id } } } : { $pull: { householdMembers: patient._id, householdRelationships: { patientId: patient._id } } };
      await Patient.updateOne({ _id: patient._id, ...filter }, update, { session });
      await Patient.updateOne({ _id: other._id, ...filter }, reverse, { session });
      if (mode === "link") {
        await Patient.updateOne({ _id: patient._id, ...filter }, { $push: { householdRelationships: { patientId: other._id, relationship } } }, { session });
        await Patient.updateOne({ _id: other._id, ...filter }, { $push: { householdRelationships: { patientId: patient._id, relationship } } }, { session });
      }
      const action = mode === "link" ? "patient_household_linked" : "patient_household_unlinked";
      await AuditLog.create([{ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action, targetType: "Patient", targetId: patient._id }, { tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action, targetType: "Patient", targetId: other._id }], { session, ordered: true });
      result = { patientId: patient._id, otherPatientId: other._id };
    });
  } finally { await session.endSession(); }
  return result;
}

export const linkHouseholdMember = asyncHandler(async (req, res) => {
  const result = await householdUpdate(req, "link");
  res.status(201).json({ success: true, data: result });
});

export const unlinkHouseholdMember = asyncHandler(async (req, res) => {
  const result = await householdUpdate(req, "unlink");
  res.json({ success: true, data: result });
});

export const updateCommunicationPreferences = asyncHandler(async (req, res) => {
  const preferences = { smsOptOut: Boolean(req.body.smsOptOut), emailOptOut: Boolean(req.body.emailOptOut), voiceOptOut: Boolean(req.body.voiceOptOut) };
  const patient = await Patient.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId }, { $set: { communicationPreferences: preferences } }, { new: true }).lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_communication_preferences_updated", targetType: "Patient", targetId: patient._id });
  res.json({ success: true, data: { patient: serializePatient(patient) } });
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
