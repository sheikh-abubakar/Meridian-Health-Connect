import crypto from "node:crypto";
import mongoose from "mongoose";
import { AssignedForm } from "../models/AssignedForm.js";
import { AuditLog } from "../models/AuditLog.js";
import { FormTemplate } from "../models/FormTemplate.js";
import { Patient } from "../models/Patient.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const supportedTypes = new Set(["static_text", "checkbox", "short_text", "yes_no", "signature"]);
const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });

function serializeTemplate(template) {
  return {
    id: template._id,
    name: template.name,
    fields: template.fields || [],
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function serializeAssignedForm(form) {
  const snapshot = form.templateSnapshot?.name
    && Array.isArray(form.templateSnapshot?.fields)
    && form.templateSnapshot.fields.every((field) => field && typeof field === "object" && typeof field.id === "string")
    ? form.templateSnapshot
    : null;
  const template = snapshot || (form.formTemplateId ? { name: form.formTemplateId.name, fields: form.formTemplateId.fields || [] } : null);
  return {
    id: form._id,
    status: form.status,
    assignedAt: form.assignedAt,
    formTemplate: template ? { id: form.formTemplateId?._id || form.formTemplateId, name: template.name, fields: template.fields || [] } : null,
    responses: form.responses || {},
    signatureData: form.signatureData || null,
    signedAt: form.signedAt || null,
  };
}

function parseName(value) {
  const name = String(value || "").trim();
  if (name.length < 3 || name.length > 140) throw new ApiError(400, "Template name must be 3 to 140 characters");
  return name;
}

function parseFields(input) {
  if (!Array.isArray(input) || input.length === 0) throw new ApiError(400, "Add at least one form field");
  if (input.length > 30) throw new ApiError(400, "A form template can have at most 30 fields");
  const ids = new Set();
  return input.map((field) => {
    const type = String(field?.type || "");
    const label = String(field?.label || "").trim();
    if (!supportedTypes.has(type)) throw new ApiError(400, "A form field has an unsupported type");
    if (label.length < 2 || label.length > 500) throw new ApiError(400, "Each field label must be 2 to 500 characters");
    const id = String(field?.id || crypto.randomUUID()).trim();
    if (!id || ids.has(id)) throw new ApiError(400, "Each form field must have a unique ID");
    ids.add(id);
    return { id, type, label, required: type === "signature" ? true : type === "static_text" ? false : Boolean(field.required) };
  });
}

export const listFormTemplates = asyncHandler(async (req, res) => {
  const templates = await FormTemplate.find(scope(req)).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: { templates: templates.map(serializeTemplate) } });
});

export const createFormTemplate = asyncHandler(async (req, res) => {
  const template = await FormTemplate.create({ ...scope(req), name: parseName(req.body.name), fields: parseFields(req.body.fields), createdBy: req.user._id });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "consent_form_template_created", targetType: "FormTemplate", targetId: template._id });
  res.status(201).json({ success: true, data: { template: serializeTemplate(template) } });
});

export const updateFormTemplate = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid form template ID");
  const template = await FormTemplate.findOne({ _id: req.params.id, ...scope(req) });
  if (!template) throw new ApiError(404, "Consent form template not found in this location");
  if (Object.hasOwn(req.body, "name")) template.name = parseName(req.body.name);
  if (Object.hasOwn(req.body, "fields")) template.fields = parseFields(req.body.fields);
  await template.save();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "consent_form_template_updated", targetType: "FormTemplate", targetId: template._id });
  res.json({ success: true, data: { template: serializeTemplate(template) } });
});

export const assignForm = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.body.formTemplateId)) throw new ApiError(400, "Choose a valid patient and consent form");
  const [patient, template] = await Promise.all([
    Patient.findOne({ _id: req.params.id, ...scope(req) }).select("_id").lean(),
    FormTemplate.findOne({ _id: req.body.formTemplateId, ...scope(req) }).lean(),
  ]);
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  if (!template) throw new ApiError(400, "This consent form is not available in this location");
  const assigned = await AssignedForm.create({ ...scope(req), patientId: patient._id, formTemplateId: template._id, templateSnapshot: { name: template.name, fields: template.fields }, assignedBy: req.user._id, status: "pending", responses: {} });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "consent_form_assigned", targetType: "AssignedForm", targetId: assigned._id });
  const populated = await AssignedForm.findOne({ _id: assigned._id, ...scope(req) }).populate({ path: "formTemplateId", select: "name fields", match: scope(req) }).lean();
  res.status(201).json({ success: true, data: { assignedForm: serializeAssignedForm(populated) } });
});

function formForPatient(form) {
  return serializeAssignedForm(form);
}

export const patientPortalForms = asyncHandler(async (req, res) => {
  const forms = await AssignedForm.find({ ...scope(req), patientId: req.portalPatient._id })
    .populate({ path: "formTemplateId", select: "name fields", match: scope(req) })
    .sort({ assignedAt: -1 })
    .lean();
  res.json({ success: true, data: { forms: forms.map(formForPatient) } });
});

function missingRequiredFields(fields, responses, signatureData) {
  return fields.filter((field) => {
    if (!field.required) return false;
    if (field.type === "signature") return !signatureData;
    const value = responses[field.id];
    if (field.type === "checkbox") return value !== true;
    if (field.type === "yes_no") return !["yes", "no"].includes(value);
    return typeof value !== "string" || !value.trim();
  });
}

export const submitPatientPortalForm = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.assignedFormId)) throw new ApiError(400, "This form is not valid");
  const form = await AssignedForm.findOne({ _id: req.params.assignedFormId, ...scope(req), patientId: req.portalPatient._id })
    .populate({ path: "formTemplateId", select: "name fields", match: scope(req) });
  if (!form) throw new ApiError(404, "This form is not available in your portal");
  if (form.status === "completed") throw new ApiError(409, "This form has already been submitted and cannot be changed");
  const snapshot = form.templateSnapshot?.name
    && Array.isArray(form.templateSnapshot?.fields)
    && form.templateSnapshot.fields.every((field) => field && typeof field === "object" && typeof field.id === "string")
    ? form.templateSnapshot
    : null;
  const template = snapshot || (form.formTemplateId ? { name: form.formTemplateId.name, fields: form.formTemplateId.fields || [] } : null);
  if (!template?.fields?.length) throw new ApiError(409, "This form's template is unavailable. Please contact your clinic");
  const incoming = req.body.responses && typeof req.body.responses === "object" && !Array.isArray(req.body.responses) ? req.body.responses : {};
  const responses = {};
  for (const field of template.fields) {
    if (["static_text", "signature"].includes(field.type)) continue;
    const value = incoming[field.id];
    if (field.type === "checkbox") responses[field.id] = value === true;
    else if (field.type === "yes_no") responses[field.id] = ["yes", "no"].includes(value) ? value : "";
    else responses[field.id] = String(value || "").trim().slice(0, 2000);
  }
  const signatureData = String(req.body.signatureData || "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signatureData) || signatureData.length > 750000) throw new ApiError(400, "Please provide a valid signature before submitting");
  const missing = missingRequiredFields(template.fields, responses, signatureData);
  if (missing.length) throw new ApiError(400, `Complete the required field${missing.length === 1 ? "" : "s"}: ${missing.map((field) => field.label).join(", ")}`);
  // Preserve a snapshot for Batch 5a assignments that predate snapshots too.
  if (!snapshot) form.templateSnapshot = { name: template.name, fields: template.fields };
  form.responses = responses;
  form.signatureData = signatureData;
  form.signatureIpAddress = String(req.ip || "").slice(0, 128);
  form.signedAt = new Date();
  form.status = "completed";
  await form.save();
  await AuditLog.create({ ...scope(req), actorPatientId: req.portalPatient._id, action: "consent_form_signed", targetType: "AssignedForm", targetId: form._id });
  res.json({ success: true, data: { form: formForPatient(form.toObject()) } });
});

export const listAssignedForms = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid patient ID");
  const patient = await Patient.exists({ _id: req.params.id, ...scope(req) });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const forms = await AssignedForm.find({ ...scope(req), patientId: req.params.id })
    .populate({ path: "formTemplateId", select: "name fields", match: scope(req) })
    .sort({ assignedAt: -1 })
    .lean();
  res.json({ success: true, data: { assignedForms: forms.map(serializeAssignedForm) } });
});
