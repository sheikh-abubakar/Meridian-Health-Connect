import { AuditLog } from "../models/AuditLog.js";
import { Location } from "../models/Location.js";
import { Resource } from "../models/Resource.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });

export const listResources = asyncHandler(async (req, res) => {
  const resources = await Resource.find({ ...scope(req), isActive: { $ne: false } }).sort({ type: 1, name: 1 }).lean();
  res.json({ success: true, data: { resources } });
});

export const createResource = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim(); const type = String(req.body.type || "");
  if (!name) throw new ApiError(400, "Resource name is required");
  if (!["room", "equipment", "telehealth_link"].includes(type)) throw new ApiError(400, "Choose a valid resource type");
  const resource = await Resource.create({ ...scope(req), name, type });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "resource_created", targetType: "Resource", targetId: resource._id });
  res.status(201).json({ success: true, data: { resource } });
});

export const updateSchedulingSettings = asyncHandler(async (req, res) => {
  const max = Number(req.body.maxOverbookSlotsPerDoctorPerDay);
  if (!Number.isInteger(max) || max < 0 || max > 20) throw new ApiError(400, "Overbook limit must be a whole number from 0 to 20");
  const inputRules = Array.isArray(req.body.reminderRules) ? req.body.reminderRules : [];
  const reminderRules = inputRules.map((rule) => ({ channel: String(rule.channel), offsetHours: Number(rule.offsetHours) }));
  if (reminderRules.some((rule) => rule.channel !== "sms" || !Number.isFinite(rule.offsetHours) || rule.offsetHours < 0 || rule.offsetHours > 8760)) throw new ApiError(400, "Only SMS reminders are currently supported; select an offset from 0 to 8760 hours");
  const location = await Location.findOneAndUpdate({ _id: req.locationId, tenantId: req.tenantId }, { $set: { "schedulingSettings.maxOverbookSlotsPerDoctorPerDay": max, "schedulingSettings.reminderRules": reminderRules } }, { new: true, runValidators: true }).lean();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "scheduling_settings_updated", targetType: "Location", targetId: location._id });
  res.json({ success: true, data: { settings: location.schedulingSettings } });
});
