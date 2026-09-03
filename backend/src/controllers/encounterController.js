import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Encounter } from "../models/Encounter.js";
import { Patient } from "../models/Patient.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateClinicalSummary, GROQ_SUMMARY_MODEL } from "../services/groqSummaryService.js";

function scopedEncounterQuery(query, req) {
  const match = { tenantId: req.tenantId, locationId: req.locationId };
  return query
    .populate({ path: "patientId", select: "name contact address", match })
    .populate({ path: "doctorId", select: "name email", match })
    .populate({ path: "appointmentId", select: "visitType scheduledAt status", match })
    .populate({ path: "amendments.actor", select: "name role", match });
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
    return res.json({ success: true, data: { encounter: populatedExisting } });
  }

  const encounter = await Encounter.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    doctorId: req.user._id,
    status: "draft",
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
  res.status(201).json({ success: true, data: { encounter: populated } });
});

export const getEncounter = asyncHandler(async (req, res) => {
  const encounter = await scopedEncounterQuery(Encounter.findOne(scopedEncounterFilter(req)), req).lean();
  if (!encounter) throw new ApiError(404, "Encounter not found in this location");
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "encounter_record_viewed", targetType: "Encounter", targetId: encounter._id });
  res.json({ success: true, data: { encounter } });
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
  res.json({ success: true, data: { encounters } });
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
  await encounter.save();

  const populated = await scopedEncounterQuery(Encounter.findOne(encounterFilter(req)), req).lean();
  res.json({ success: true, data: { encounter: populated } });
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
  res.json({ success: true, data: { encounter: populated } });
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
      }], { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }

  const populated = await scopedEncounterQuery(Encounter.findOne(encounterFilter(req)), req).lean();
  res.json({ success: true, data: { encounter: populated } });
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
  res.status(201).json({ success: true, data: { encounter: populated } });
});
