import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { EncounterTemplate } from "../models/EncounterTemplate.js";
import { Specialty } from "../models/Specialty.js";
import { VisitType } from "../models/VisitType.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const validTypes = new Set(["short_text", "long_text", "number", "date", "select", "checkbox"]);
function serialize(item) { return { id: item._id, name: item.name, targetType: item.targetType, targetId: String(item.targetId), fields: (item.fields || []).sort((a, b) => a.order - b.order), isActive: item.isActive }; }
function makeKey(label, used) { const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 64) || "field"; let key = base; let suffix = 2; while (used.has(key)) key = `${base}_${suffix++}`; used.add(key); return key; }
function parseFields(input) {
  if (!Array.isArray(input) || !input.length) throw new ApiError(400, "Add at least one template field");
  if (input.length > 30) throw new ApiError(400, "A template can have at most 30 fields");
  const used = new Set();
  return input.map((item, index) => {
    const label = String(item.label || "").trim(); const type = String(item.type || "");
    if (label.length < 2 || label.length > 120) throw new ApiError(400, "Each field label must be 2 to 120 characters");
    if (!validTypes.has(type)) throw new ApiError(400, "Invalid template field type");
    const options = [...new Set((Array.isArray(item.options) ? item.options : []).map((value) => String(value).trim()).filter(Boolean))];
    if (type === "select" && options.length < 2) throw new ApiError(400, `Select field '${label}' needs at least two options`);
    return { key: makeKey(label, used), label, type, required: Boolean(item.required), options: type === "select" ? options : [], order: index };
  });
}
async function assertTarget(req, targetType, targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw new ApiError(400, "Invalid template target");
  const target = targetType === "visit_type"
    ? await VisitType.exists({ _id: targetId, ...scope(req), isActive: { $ne: false } })
    : targetType === "specialty" ? await Specialty.exists({ _id: targetId, tenantId: req.tenantId, isActive: { $ne: false } }) : null;
  if (!target) throw new ApiError(400, "Template target is not active in this clinic");
}

export const listEncounterTemplates = asyncHandler(async (req, res) => {
  const templates = await EncounterTemplate.find(scope(req)).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: { templates: templates.map(serialize) } });
});
export const createEncounterTemplate = asyncHandler(async (req, res) => {
  const targetType = String(req.body.targetType || ""); const targetId = req.body.targetId; const name = String(req.body.name || "").trim();
  if (!name) throw new ApiError(400, "Template name is required");
  if (!["visit_type", "specialty"].includes(targetType)) throw new ApiError(400, "Choose a visit type or specialty target");
  await assertTarget(req, targetType, targetId);
  const template = await EncounterTemplate.create({ ...scope(req), targetType, targetId, name, fields: parseFields(req.body.fields) });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "encounter_template_created", targetType: "EncounterTemplate", targetId: template._id });
  res.status(201).json({ success: true, data: { template: serialize(template) } });
});
export const updateEncounterTemplate = asyncHandler(async (req, res) => {
  const template = await EncounterTemplate.findOne({ _id: req.params.id, ...scope(req) });
  if (!template) throw new ApiError(404, "Clinical template not found in this location");
  if (Object.hasOwn(req.body, "name")) { const name = String(req.body.name || "").trim(); if (!name) throw new ApiError(400, "Template name is required"); template.name = name; }
  if (Object.hasOwn(req.body, "fields")) template.fields = parseFields(req.body.fields);
  if (Object.hasOwn(req.body, "isActive")) template.isActive = Boolean(req.body.isActive);
  await template.save();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "encounter_template_updated", targetType: "EncounterTemplate", targetId: template._id });
  res.json({ success: true, data: { template: serialize(template) } });
});
