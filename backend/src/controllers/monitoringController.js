import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { MonitoringEnrollment } from "../models/MonitoringEnrollment.js";
import { MonitoringReading } from "../models/MonitoringReading.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { notifyStaffUsers } from "../services/staffNotificationService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const types = ["blood_pressure", "blood_sugar", "weight", "pulse_oximeter"];
const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const label = (type) => ({ blood_pressure: "blood pressure", blood_sugar: "blood sugar", weight: "weight", pulse_oximeter: "pulse oximeter" }[type] || type);
const validId = (id, message) => { if (!mongoose.isValidObjectId(id)) throw new ApiError(400, message); return id; };
const valueText = (reading) => { const value = reading.value?.systolic != null ? `${reading.value.systolic}/${reading.value.diastolic}` : String(reading.value?.number); return reading.statusText && reading.statusText !== "Within target" ? `${value} — ${reading.statusText}` : value; };
const numberOrNull = (value) => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
function canonicalTargetRange(type, raw = {}) {
  if (type !== "blood_pressure") return { min: numberOrNull(raw.min), max: numberOrNull(raw.max) };
  return {
    systolicMin: numberOrNull(raw.systolicMin ?? raw.min), systolicMax: numberOrNull(raw.systolicMax ?? raw.max),
    diastolicMin: numberOrNull(raw.diastolicMin), diastolicMax: numberOrNull(raw.diastolicMax),
  };
}
function assessReading(enrollment, value) {
  const target = canonicalTargetRange(enrollment.type, enrollment.targetRange);
  if (enrollment.type === "blood_pressure" && [target.systolicMin, target.systolicMax, target.diastolicMin, target.diastolicMax].some((limit) => limit == null)) return { targetRange: target, isOutOfRange: true, issues: [], statusText: "Target setup incomplete" };
  const issues = [];
  const check = (component, current, minimum, maximum) => {
    if (minimum != null && current <= minimum) issues.push({ component, direction: "low", value: current, minimum, maximum });
    if (maximum != null && current >= maximum) issues.push({ component, direction: "high", value: current, minimum, maximum });
  };
  if (enrollment.type === "blood_pressure") { check("Systolic", value.systolic, target.systolicMin, target.systolicMax); check("Diastolic", value.diastolic, target.diastolicMin, target.diastolicMax); }
  else check(label(enrollment.type), value.number, target.min, target.max);
  return { targetRange: target, isOutOfRange: issues.length > 0, issues, statusText: issues.length ? issues.map((issue) => `${issue.component} ${issue.direction}`).join(", ") : "Within target" };
}
const viewReading = (reading, enrollment) => { const assessment = enrollment ? assessReading(enrollment, reading.value) : { isOutOfRange: reading.isOutOfRange, statusText: reading.statusText || "Within target", issues: reading.assessmentIssues || [] }; return { id: reading._id, value: reading.value, valueText: reading.value?.systolic != null ? `${reading.value.systolic}/${reading.value.diastolic}` : String(reading.value?.number), note: reading.note || "", recordedAt: reading.recordedAt, source: reading.source, isOutOfRange: assessment.isOutOfRange, statusText: assessment.statusText, assessmentIssues: assessment.issues, acknowledgedAlert: reading.acknowledgedAlert, acknowledgementNote: reading.acknowledgementNote || "", acknowledgedAt: reading.acknowledgedAt, acknowledgedBy: reading.acknowledgedBy ? { id: reading.acknowledgedBy._id, name: reading.acknowledgedBy.name } : null }; };
const viewEnrollment = (enrollment, readings = []) => ({ id: enrollment._id, type: enrollment.type, typeLabel: label(enrollment.type), targetRange: canonicalTargetRange(enrollment.type, enrollment.targetRange), status: enrollment.status, enrolledAt: enrollment.createdAt, enrolledBy: enrollment.enrolledByDoctorId ? { id: enrollment.enrolledByDoctorId._id, name: enrollment.enrolledByDoctorId.name } : null, closingNote: enrollment.closingNote, closedAt: enrollment.closedAt, lastReviewedAt: enrollment.lastReviewedAt, readings: readings.map((reading) => viewReading(reading, enrollment)) });

function readingValue(type, body) {
  if (type === "blood_pressure") { const systolic = Number(body.systolic); const diastolic = Number(body.diastolic); if (!Number.isFinite(systolic) || !Number.isFinite(diastolic) || systolic <= 0 || diastolic <= 0) throw new ApiError(400, "Enter valid systolic and diastolic values"); return { systolic, diastolic }; }
  const number = Number(body.value); if (!Number.isFinite(number) || number < 0) throw new ApiError(400, "Enter a valid numeric reading"); return { number };
}
async function fullEnrollment(enrollment, req, includeAcknowledgement = false) { const readings = await MonitoringReading.find({ ...scope(req), enrollmentId: enrollment._id }).populate({ path: "acknowledgedBy", select: "name" }).sort({ recordedAt: -1 }).lean(); const result = viewEnrollment(enrollment, readings); result.readings.forEach((reading) => { if (includeAcknowledgement && reading.acknowledgementNote) reading.note = [reading.note, `Doctor acknowledgement: ${reading.acknowledgementNote}`].filter(Boolean).join(" — "); if (!includeAcknowledgement) { delete reading.acknowledgementNote; delete reading.acknowledgedAt; delete reading.acknowledgedBy; } }); return result; }

export const listPatientMonitoring = asyncHandler(async (req, res) => {
  validId(req.params.patientId, "Invalid patient ID");
  const patient = await Patient.findOne({ _id: req.params.patientId, ...scope(req) }).lean(); if (!patient) throw new ApiError(404, "Patient not found in this location");
  const enrollments = await MonitoringEnrollment.find({ ...scope(req), patientId: patient._id }).populate({ path: "enrolledByDoctorId", select: "name" }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { enrollments: await Promise.all(enrollments.map((item) => fullEnrollment(item, req, true))) } });
});

export const enrollPatientMonitoring = asyncHandler(async (req, res) => {
  validId(req.params.patientId, "Invalid patient ID"); const type = String(req.body.type || ""); const rawRange = req.body.targetRange || {}; const min = Number(rawRange.min); const max = Number(rawRange.max); let targetRange;
  if (!types.includes(type)) throw new ApiError(400, "Choose a supported monitoring type");
  if (type === "blood_pressure") { const systolicMin = Number(rawRange.systolicMin); const systolicMax = Number(rawRange.systolicMax); const diastolicMin = Number(rawRange.diastolicMin); const diastolicMax = Number(rawRange.diastolicMax); if (![systolicMin, systolicMax, diastolicMin, diastolicMax].every(Number.isFinite) || systolicMin >= systolicMax || diastolicMin >= diastolicMax) throw new ApiError(400, "Blood pressure needs valid systolic and diastolic lower and upper limits"); targetRange = { systolicMin, systolicMax, diastolicMin, diastolicMax }; } else { if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw new ApiError(400, "Target range needs a valid minimum below maximum"); targetRange = { min, max }; }
  const patient = await Patient.exists({ _id: req.params.patientId, ...scope(req) }); if (!patient) throw new ApiError(404, "Patient not found in this location");
  const enrollment = await MonitoringEnrollment.create({ ...scope(req), patientId: req.params.patientId, enrolledByDoctorId: req.user._id, type, targetRange });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "monitoring_enrolled", targetType: "MonitoringEnrollment", targetId: enrollment._id });
  res.status(201).json({ success: true, data: { enrollment: await fullEnrollment((await enrollment.populate("enrolledByDoctorId", "name")).toObject(), req) } });
});

export async function addMonitoringReading({ tenantId, locationId, patientId, enrollmentId, body, actorPatientId = null, actorUserId = null }) {
  validId(enrollmentId, "Invalid monitoring enrollment"); const enrollment = await MonitoringEnrollment.findOne({ _id: enrollmentId, tenantId, locationId, patientId }); if (!enrollment) throw new ApiError(404, "Monitoring enrollment not found"); if (enrollment.status !== "active") throw new ApiError(409, "Monitoring has ended; no further readings can be added");
  const target = canonicalTargetRange(enrollment.type, enrollment.targetRange); if (enrollment.type === "blood_pressure" && [target.systolicMin, target.systolicMax, target.diastolicMin, target.diastolicMax].some((limit) => limit == null)) throw new ApiError(409, "This older blood-pressure enrollment has incomplete target limits. End it and create a new enrollment with all four limits."); const value = readingValue(enrollment.type, body); const assessment = assessReading(enrollment, value); const isOutOfRange = assessment.isOutOfRange; const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date(); if (Number.isNaN(recordedAt.getTime()) || recordedAt > new Date(Date.now() + 5 * 60000)) throw new ApiError(400, "Enter a valid reading time");
  const reading = await MonitoringReading.create({ tenantId, locationId, patientId, enrollmentId, value, note: String(body.note || "").trim(), recordedAt, source: "manual_entry", isOutOfRange: assessment.isOutOfRange, statusText: assessment.statusText, assessmentIssues: assessment.issues, acknowledgedAlert: !assessment.isOutOfRange });
  if (isOutOfRange) await notifyStaffUsers({ tenantId, locationId, recipientUserIds: [enrollment.enrolledByDoctorId], type: "monitoring_threshold_alert", title: "Monitoring reading outside target", body: `${label(enrollment.type)} reading (${valueText(reading)}) is outside the configured target range — review needed.`, targetPath: `/patients/${patientId}`, targetId: enrollment._id });
  await AuditLog.create({ tenantId, locationId, ...(actorPatientId ? { actorPatientId } : { actorUserId }), action: "monitoring_reading_recorded", targetType: "MonitoringReading", targetId: reading._id });
  return reading;
}

export const addStaffReading = asyncHandler(async (req, res) => { const reading = await addMonitoringReading({ ...scope(req), patientId: req.params.patientId, enrollmentId: req.params.enrollmentId, body: req.body, actorUserId: req.user._id }); res.status(201).json({ success: true, data: { reading: viewReading(reading) } }); });
export const acknowledgeMonitoringAlert = asyncHandler(async (req, res) => { const note = String(req.body.note || "").trim(); if (note.length < 3) throw new ApiError(400, "Add a short acknowledgement note"); const reading = await MonitoringReading.findOne({ _id: req.params.readingId, ...scope(req), acknowledgedAlert: false }); if (!reading) throw new ApiError(404, "Unacknowledged alert reading not found"); const enrollment = await MonitoringEnrollment.findOne({ _id: reading.enrollmentId, ...scope(req), enrolledByDoctorId: req.user._id, status: "active" }); if (!enrollment) throw new ApiError(403, "Only the enrolling Doctor can acknowledge this alert"); reading.acknowledgedAlert = true; reading.acknowledgementNote = note; reading.acknowledgedAt = new Date(); reading.acknowledgedBy = req.user._id; await reading.save(); enrollment.lastReviewedAt = new Date(); enrollment.reviewReminderSentFor = null; await enrollment.save(); await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "monitoring_alert_acknowledged", targetType: "MonitoringReading", targetId: reading._id }); res.json({ success: true, data: { reading: viewReading((await reading.populate("acknowledgedBy", "name")).toObject()) } }); });
export const endMonitoring = asyncHandler(async (req, res) => { const closingNote = String(req.body.closingNote || "").trim(); if (closingNote.length < 3) throw new ApiError(400, "A closing note is required"); const enrollment = await MonitoringEnrollment.findOne({ _id: req.params.enrollmentId, ...scope(req), enrolledByDoctorId: req.user._id, status: "active" }); if (!enrollment) throw new ApiError(404, "Active monitoring enrollment not found"); enrollment.status = "completed"; enrollment.closingNote = closingNote; enrollment.closedAt = new Date(); enrollment.closedBy = req.user._id; await enrollment.save(); await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "monitoring_completed", targetType: "MonitoringEnrollment", targetId: enrollment._id }); res.json({ success: true, data: { enrollment: viewEnrollment(enrollment) } }); });

export const adherenceEnrollments = asyncHandler(async (req, res) => { const cutoff = new Date(Date.now() - 86400000 * 5); const enrollments = await MonitoringEnrollment.find({ ...scope(req), status: "active" }).populate({ path: "patientId", select: "name" }).populate({ path: "enrolledByDoctorId", select: "name" }).lean(); const items = []; for (const enrollment of enrollments) { const latest = await MonitoringReading.findOne({ ...scope(req), enrollmentId: enrollment._id }).sort({ recordedAt: -1 }).lean(); if (!latest || latest.recordedAt < cutoff) items.push({ ...viewEnrollment(enrollment), patient: { id: enrollment.patientId?._id, name: enrollment.patientId?.name }, daysSinceLastReading: latest ? Math.floor((Date.now() - new Date(latest.recordedAt)) / 86400000) : Math.floor((Date.now() - new Date(enrollment.createdAt)) / 86400000) }); } res.json({ success: true, data: { enrollments: items } }); });

export const createMonitoringOutreachTask = asyncHandler(async (req, res) => { const enrollment = await MonitoringEnrollment.findOne({ _id: req.params.enrollmentId, ...scope(req), status: "active" }).lean(); if (!enrollment) throw new ApiError(404, "Active monitoring enrollment not found"); const plan = await CarePlan.findOne({ ...scope(req), patientId: enrollment.patientId }).sort({ createdAt: -1 }).lean(); if (!plan) throw new ApiError(409, "Create a care plan for this patient before creating an outreach task"); const task = await Task.create({ ...scope(req), carePlanId: plan._id, description: `Remind patient to submit ${label(enrollment.type)} readings`, assignedToUserId: req.user._id, assignedByUserId: req.user._id, dueDate: new Date(Date.now() + 86400000), type: "outreach" }); await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "monitoring_outreach_task_created", targetType: "Task", targetId: task._id }); res.status(201).json({ success: true, data: { task } }); });

export const patientPortalMonitoring = asyncHandler(async (req, res) => { const enrollments = await MonitoringEnrollment.find({ ...scope(req), patientId: req.portalPatient._id, status: "active" }).populate({ path: "enrolledByDoctorId", select: "name" }).sort({ createdAt: -1 }).lean(); res.json({ success: true, data: { enrollments: await Promise.all(enrollments.map((item) => fullEnrollment(item, req))) } }); });
export const patientPortalAddMonitoringReading = asyncHandler(async (req, res) => { const reading = await addMonitoringReading({ ...scope(req), patientId: req.portalPatient._id, enrollmentId: req.params.enrollmentId, body: req.body, actorPatientId: req.portalPatient._id }); res.status(201).json({ success: true, data: { reading: viewReading(reading) } }); });
