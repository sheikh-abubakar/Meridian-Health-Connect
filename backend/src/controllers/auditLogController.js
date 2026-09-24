import mongoose from "mongoose";
import { Availability } from "../models/Availability.js";
import { Resource } from "../models/Resource.js";
import { Waitlist } from "../models/Waitlist.js";
import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { Encounter } from "../models/Encounter.js";
import { EncounterTemplate } from "../models/EncounterTemplate.js";
import { Patient } from "../models/Patient.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { RecallRequest } from "../models/RecallRequest.js";
import { FormTemplate } from "../models/FormTemplate.js";
import { AssignedForm } from "../models/AssignedForm.js";
import { Referral } from "../models/Referral.js";
import { LabTest } from "../models/LabTest.js";
import { LabOrder } from "../models/LabOrder.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const models = { User, Patient, Appointment, Encounter, EncounterTemplate, CarePlan, Task, RecallRequest, Availability, Resource, Waitlist, FormTemplate, AssignedForm, Referral, LabTest, LabOrder };
const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });

function targetLabel(type, target) {
  if (!target) return "Deleted or unavailable record";
  if (type === "User") return `${target.name} (${String(target.role || "staff").replace("_", " ")})`;
  if (type === "Patient") return target.name;
  if (type === "Appointment") return `${target.patientId?.name || "Patient"} — ${target.visitType}`;
  if (type === "Encounter") return `${target.patientId?.name || "Patient"} — clinical encounter`;
  if (type === "CarePlan") return `${target.patientId?.name || "Patient"} — ${target.goal}`;
  if (type === "Task") return target.description;
  if (type === "RecallRequest") return `${target.patientId?.name || "Patient"} — recall request`;
  if (type === "Availability") return `${target.doctorId?.name || "Doctor"} — working hours`;
  if (type === "Resource") return `${target.name} (${target.type.replaceAll("_", " ")})`;
  if (type === "Waitlist") return `${target.patientId?.name || "Patient"} — waitlist`;
  if (type === "FormTemplate") return target.name;
  if (type === "AssignedForm") return `${target.patientId?.name || "Patient"} — ${target.formTemplateId?.name || "consent form"}`;
  if (type === "Referral") return `${target.patientId?.name || "Patient"} — referral to ${target.targetDoctorId?.name || "doctor"}`;
  if (type === "LabTest") return `${target.name} (${target.code})`;
  if (type === "LabOrder") return `${target.patientId?.name || "Patient"} - ${target.testName}`;
  return type;
}

async function resolveTargets(logs, req) {
  const grouped = new Map();
  for (const log of logs) grouped.set(log.targetType, [...(grouped.get(log.targetType) || []), log.targetId]);
  const resolved = new Map();
  await Promise.all([...grouped].map(async ([type, ids]) => {
    const Model = models[type];
    if (!Model) return;
    let query = Model.find({ _id: { $in: ids }, tenantId: req.tenantId });
    if (!["User", "Referral"].includes(type)) query = query.find({ locationId: req.locationId });
    if (["Appointment", "Encounter", "CarePlan", "RecallRequest", "Waitlist", "AssignedForm", "Referral", "LabOrder"].includes(type)) query = query.populate({ path: "patientId", select: "name", match: { tenantId: req.tenantId } });
    if (type === "AssignedForm") query = query.populate({ path: "formTemplateId", select: "name", match: scope(req) });
    if (type === "Referral") query = query.populate({ path: "targetDoctorId", select: "name", match: { tenantId: req.tenantId } });
    if (type === "Availability") query = query.populate({ path: "doctorId", select: "name", match: scope(req) });
    const targets = await query.lean();
    for (const target of targets) resolved.set(`${type}:${target._id}`, target);
  }));
  return resolved;
}

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = scope(req);
  if (req.query.actorUserId) {
    if (!mongoose.isValidObjectId(req.query.actorUserId)) throw new ApiError(400, "Invalid actor user ID");
    filter.actorUserId = req.query.actorUserId;
  }
  if (req.query.action) filter.action = String(req.query.action).trim();
  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) { const from = new Date(`${req.query.from}T00:00:00.000Z`); if (Number.isNaN(from.getTime())) throw new ApiError(400, "Invalid from date"); filter.timestamp.$gte = from; }
    if (req.query.to) { const to = new Date(`${req.query.to}T23:59:59.999Z`); if (Number.isNaN(to.getTime())) throw new ApiError(400, "Invalid to date"); filter.timestamp.$lte = to; }
  }
  const logs = await AuditLog.find(filter).populate({ path: "actorUserId", select: "name email role", match: { tenantId: req.tenantId } }).populate({ path: "actorPatientId", select: "name contact.email", match: scope(req) }).sort({ timestamp: -1 }).limit(500).lean();
  const targets = await resolveTargets(logs, req);
  res.json({ success: true, data: { auditLogs: logs.map((log) => ({ id: log._id, actor: log.actorUserId ? { id: log.actorUserId._id, name: log.actorUserId.name, email: log.actorUserId.email, role: log.actorUserId.role } : log.actorPatientId ? { id: log.actorPatientId._id, name: log.actorPatientId.name, email: log.actorPatientId.contact?.email || "", role: "patient" } : null, action: log.action, target: { type: log.targetType, id: log.targetId, label: targetLabel(log.targetType, targets.get(`${log.targetType}:${log.targetId}`)) }, timestamp: log.timestamp })) } });
});
