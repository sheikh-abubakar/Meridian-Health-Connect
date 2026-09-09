import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Encounter } from "../models/Encounter.js";
import { EncounterTemplate } from "../models/EncounterTemplate.js";
import { Patient } from "../models/Patient.js";
import { VisitType } from "../models/VisitType.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateClinicalSummary, GROQ_SUMMARY_MODEL } from "../services/groqSummaryService.js";
import { assertAllowedAttachment, deleteClinicalAttachment, signedClinicalAttachmentUrl, uploadClinicalAttachment } from "../services/s3AttachmentService.js";

function scopedEncounterQuery(query, req) {
  const match = { tenantId: req.tenantId, locationId: req.locationId };
  return query
    .populate({ path: "patientId", select: "name contact address", match })
    .populate({ path: "doctorId", select: "name email", match })
    .populate({ path: "appointmentId", select: "visitType scheduledAt status", match })
    .populate({ path: "attachments.uploadedBy", select: "name role", match })
    .populate({ path: "amendments.actor", select: "name role", match });
}

function presentEncounter(encounter) {
  if (!encounter) return encounter;
  return { ...encounter, attachments: (encounter.attachments || []).map(({ key, ...attachment }) => attachment) };
}

async function resolveTemplateSnapshot(appointment, req) {
  if (!appointment.visitTypeId) return null;
  let template = await EncounterTemplate.findOne({ tenantId: req.tenantId, locationId: req.locationId, targetType: "visit_type", targetId: appointment.visitTypeId, isActive: { $ne: false } }).lean();
  if (!template) {
    const visitType = await VisitType.findOne({ _id: appointment.visitTypeId, tenantId: req.tenantId, locationId: req.locationId }).lean();
    const specialtyId = visitType?.specialtyIds?.[0];
    if (specialtyId) template = await EncounterTemplate.findOne({ tenantId: req.tenantId, locationId: req.locationId, targetType: "specialty", targetId: specialtyId, isActive: { $ne: false } }).lean();
  }
  return template ? { templateId: template._id, name: template.name, targetType: template.targetType, fields: template.fields || [] } : null;
}

function cleanTemplateAnswers(encounter, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return encounter.templateAnswers || {};
  const fields = encounter.templateSnapshot?.fields || []; const allowed = new Map(fields.map((field) => [field.key, field])); const answers = {};
  for (const [key, rawValue] of Object.entries(input)) {
    const field = allowed.get(key); if (!field) continue;
    if (field.type === "checkbox") answers[key] = Boolean(rawValue);
    else if (field.type === "number") { const value = String(rawValue ?? "").trim(); if (value && !Number.isFinite(Number(value))) throw new ApiError(400, `${field.label} must be a number`); answers[key] = value; }
    else { const value = String(rawValue ?? "").trim(); if (field.type === "select" && value && !field.options.includes(value)) throw new ApiError(400, `${field.label} has an invalid option`); answers[key] = value; }
  }
  return answers;
}

function missingTemplateFields(encounter) {
  const answers = encounter.templateAnswers instanceof Map ? Object.fromEntries(encounter.templateAnswers) : (encounter.templateAnswers || {});
  return (encounter.templateSnapshot?.fields || []).filter((field) => field.required && (field.type === "checkbox" ? answers[field.key] !== true : !String(answers[field.key] ?? "").trim()));
}

function encounterFilter(req) {
  return {
    _id: req.params.id,
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: req.user._id,
  };
}

function scopedEncounterFilter(req) {
  return {
    _id: req.params.id,
    tenantId: req.tenantId,
    locationId: req.locationId,
  };
}

export const startEncounter = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.body.appointmentId,
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: req.user._id,
    status: "checked_in",
  }).lean();
  if (!appointment) throw new ApiError(404, "Checked-in appointment not found in your queue");

  const existing = await Encounter.findOne({
    tenantId: req.tenantId,
    locationId: req.locationId,
    appointmentId: appointment._id,
  }).lean();
  if (existing) {
    const populatedExisting = await scopedEncounterQuery(Encounter.findOne({
      _id: existing._id,
      tenantId: req.tenantId,
      locationId: req.locationId,
      doctorId: req.user._id,
    }), req).lean();
    return res.json({ success: true, data: { encounter: presentEncounter(populatedExisting) } });
  }

  const encounter = await Encounter.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    doctorId: req.user._id,
    status: "draft",
    templateSnapshot: await resolveTemplateSnapshot(appointment, req) || undefined,
  });
  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "encounter_started",
    targetType: "Encounter",
    targetId: encounter._id,
  });

  const populated = await scopedEncounterQuery(Encounter.findOne({
    _id: encounter._id,
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: req.user._id,
  }), req).lean();
  res.status(201).json({ success: true, data: { encounter: presentEncounter(populated) } });
});

export const getEncounter = asyncHandler(async (req, res) => {
  const encounter = await scopedEncounterQuery(Encounter.findOne(scopedEncounterFilter(req)), req).lean();
  if (!encounter) throw new ApiError(404, "Encounter not found in this location");
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "encounter_record_viewed", targetType: "Encounter", targetId: encounter._id });
  res.json({ success: true, data: { encounter: presentEncounter(encounter) } });
});

export const listPatientEncounters = asyncHandler(async (req, res) => {
  const patient = await Patient.exists({
    _id: req.params.patientId,
    tenantId: req.tenantId,
    locationId: req.locationId,
  });
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const encounters = await scopedEncounterQuery(Encounter.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    patientId: req.params.patientId,
    status: "finalized",
  }).sort({ finalizedAt: -1 }), req).lean();
  res.json({ success: true, data: { encounters: encounters.map(presentEncounter) } });
});

export const updateDraft = asyncHandler(async (req, res) => {
  const encounter = await Encounter.findOne(encounterFilter(req));
  if (!encounter) throw new ApiError(404, "Encounter not found in this location");
  if (encounter.status !== "draft") {
    throw new ApiError(409, "Finalized encounter notes are immutable; add an amendment instead");
  }

  for (const field of ["symptoms", "observations", "diagnosis"]) {
    if (Object.hasOwn(req.body, field)) {
      const value = String(req.body[field] ?? "").trim();
      if (value.length > 10000) throw new ApiError(400, `${field} cannot exceed 10000 characters`);
      encounter.notes[field] = value;
    }
  }
  if (Object.hasOwn(req.body, "templateAnswers")) encounter.templateAnswers = cleanTemplateAnswers(encounter, req.body.templateAnswers);
  await encounter.save();

  const populated = await scopedEncounterQuery(Encounter.findOne(encounterFilter(req)), req).lean();
  res.json({ success: true, data: { encounter: presentEncounter(populated) } });
});

export const generateAiSummary = asyncHandler(async (req, res) => {
  const encounter = await Encounter.findOne(encounterFilter(req)).lean();
  if (!encounter) throw new ApiError(404, "Draft encounter not found in this location");
  if (encounter.status !== "draft") throw new ApiError(409, "AI summaries can only be generated before encounter finalization");
  if (![encounter.notes.symptoms, encounter.notes.observations, encounter.notes.diagnosis].some((value) => value?.trim())) throw new ApiError(400, "Add clinical notes before generating an AI summary");
  const suggestion = await generateClinicalSummary(encounter.notes);
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "ai_summary_generated", targetType: "Encounter", targetId: encounter._id });
  res.json({ success: true, data: { suggestion } });
});

export const acceptAiSummary = asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) throw new ApiError(400, "Accepted clinical summary text is required");
  if (text.length > 10000) throw new ApiError(400, "Clinical summary cannot exceed 10000 characters");
  const encounter = await Encounter.findOne(encounterFilter(req));
  if (!encounter) throw new ApiError(404, "Draft encounter not found in this location");
  if (encounter.status !== "draft") throw new ApiError(409, "Finalized AI-assisted summaries are immutable; add an amendment instead");
  const generatedAt = new Date(req.body.generatedAt);
  encounter.aiSummary = { text, generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt, model: GROQ_SUMMARY_MODEL, acceptedAt: new Date() };
  await encounter.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "ai_summary_accepted", targetType: "Encounter", targetId: encounter._id });
  const populated = await scopedEncounterQuery(Encounter.findOne(encounterFilter(req)), req).lean();
  res.json({ success: true, data: { encounter: presentEncounter(populated) } });
});

export const finalizeEncounter = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const encounter = await Encounter.findOne(encounterFilter(req)).session(session);
      if (!encounter) throw new ApiError(404, "Encounter not found in this location");
      if (encounter.status !== "draft") throw new ApiError(409, "Encounter is already finalized");
      if (!encounter.notes.symptoms || !encounter.notes.observations || !encounter.notes.diagnosis) {
        throw new ApiError(400, "Symptoms, observations, and diagnosis are required before finalizing");
      }
      const missing = missingTemplateFields(encounter);
      const overrideReasons = req.body?.templateOverrideReasons && typeof req.body.templateOverrideReasons === "object" ? req.body.templateOverrideReasons : {};
      for (const field of missing) {
        const reason = String(overrideReasons[field.key] || "").trim();
        if (!reason) throw new ApiError(400, `${field.label} is required. Provide an override reason to finalize without it.`);
        encounter.templateRequiredOverrides.push({ fieldKey: field.key, reason, actor: req.user._id, timestamp: new Date() });
      }

      const appointment = await Appointment.findOne({
        _id: encounter.appointmentId,
        tenantId: req.tenantId,
        locationId: req.locationId,
        doctorId: req.user._id,
        status: "checked_in",
      }).session(session);
      if (!appointment) throw new ApiError(409, "Linked appointment is not checked in");

      encounter.status = "finalized";
      encounter.finalizedAt = new Date();
      appointment.status = "completed";
      await encounter.save({ session });
      await appointment.save({ session });
      await AuditLog.create([{
        tenantId: req.tenantId,
        locationId: req.locationId,
        actorUserId: req.user._id,
        action: "encounter_finalized",
        targetType: "Encounter",
        targetId: encounter._id,
      }, {
        tenantId: req.tenantId,
        locationId: req.locationId,
        actorUserId: req.user._id,
        action: "appointment_completed",
        targetType: "Appointment",
        targetId: appointment._id,
      }, ...missing.map((field) => ({
        tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id,
        action: "encounter_template_required_override", targetType: "Encounter", targetId: encounter._id,
      }))], { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }

  const populated = await scopedEncounterQuery(Encounter.findOne(encounterFilter(req)), req).lean();
  res.json({ success: true, data: { encounter: presentEncounter(populated) } });
});

export const addAmendment = asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) throw new ApiError(400, "Amendment text is required");
  if (text.length > 5000) throw new ApiError(400, "Amendment cannot exceed 5000 characters");

  const encounter = await Encounter.findOne(scopedEncounterFilter(req));
  if (!encounter) throw new ApiError(404, "Encounter not found in this location");
  if (encounter.status !== "finalized") {
    throw new ApiError(409, "Amendments can only be added to finalized encounters");
  }
  encounter.amendments.push({ text, actor: req.user._id, timestamp: new Date() });
  await encounter.save();
  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "encounter_amended",
    targetType: "Encounter",
    targetId: encounter._id,
  });

  const populated = await scopedEncounterQuery(Encounter.findOne(scopedEncounterFilter(req)), req).lean();
  res.status(201).json({ success: true, data: { encounter: presentEncounter(populated) } });
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  assertAllowedAttachment(req.file);
  const encounter = await Encounter.findOne(encounterFilter(req));
  if (!encounter) throw new ApiError(404, "Draft encounter not found in this location");
  if (encounter.status !== "draft") throw new ApiError(409, "Finalized encounter attachments are locked; use an amendment workflow");
  const stored = await uploadClinicalAttachment({ file: req.file, encounter, tenantId: req.tenantId, locationId: req.locationId, patientId: encounter.patientId });
  const attachment = { ...stored, uploadedBy: req.user._id, uploadedAt: new Date() };
  encounter.attachments.push(attachment);
  await encounter.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "encounter_attachment_uploaded", targetType: "Encounter", targetId: encounter._id });
  const saved = encounter.attachments[encounter.attachments.length - 1];
  res.status(201).json({ success: true, data: { attachment: { id: saved._id, fileName: saved.fileName, mimeType: saved.mimeType, size: saved.size, uploadedAt: saved.uploadedAt, uploadedBy: req.user._id } } });
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const encounter = await Encounter.findOne(encounterFilter(req));
  if (!encounter) throw new ApiError(404, "Draft encounter not found in this location");
  if (encounter.status !== "draft") throw new ApiError(409, "Finalized encounter attachments are locked");
  const attachment = encounter.attachments.id(req.params.attachmentId);
  if (!attachment) throw new ApiError(404, "Attachment not found");
  await deleteClinicalAttachment(attachment.key);
  attachment.deleteOne(); await encounter.save();
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "encounter_attachment_removed", targetType: "Encounter", targetId: encounter._id });
  res.json({ success: true, data: { removed: true } });
});

export const viewAttachment = asyncHandler(async (req, res) => {
  const encounter = await Encounter.findOne(scopedEncounterFilter(req));
  if (!encounter) throw new ApiError(404, "Encounter not found in this location");
  const attachment = encounter.attachments.id(req.params.attachmentId);
  if (!attachment) throw new ApiError(404, "Attachment not found");
  const url = await signedClinicalAttachmentUrl(attachment.key);
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "encounter_attachment_viewed", targetType: "Encounter", targetId: encounter._id });
  res.json({ success: true, data: { url, expiresInSeconds: 300 } });
});
