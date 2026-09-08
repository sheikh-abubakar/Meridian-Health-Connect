import { AuditLog } from "../models/AuditLog.js";
import { Specialty } from "../models/Specialty.js";
import { VisitType } from "../models/VisitType.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const serializeSpecialty = (item) => ({ id: item._id, name: item.name, isActive: item.isActive });
const serializeVisitType = (item) => ({ id: item._id, name: item.name, durationMinutes: item.durationMinutes, requiredResourceType: item.requiredResourceType || null, specialtyIds: (item.specialtyIds || []).map((specialty) => specialty._id ? String(specialty._id) : String(specialty)), specialties: (item.specialtyIds || []).filter((specialty) => specialty.name).map((specialty) => ({ id: String(specialty._id), name: specialty.name })) });

export const listSpecialties = asyncHandler(async (req, res) => {
  const specialties = await Specialty.find({ tenantId: req.tenantId, isActive: { $ne: false } }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { specialties: specialties.map(serializeSpecialty) } });
});

export const createSpecialty = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (name.length < 2) throw new ApiError(400, "Specialty name must be at least 2 characters");
  const specialty = await Specialty.create({ tenantId: req.tenantId, name });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "specialty_created", targetType: "Specialty", targetId: specialty._id });
  res.status(201).json({ success: true, data: { specialty: serializeSpecialty(specialty) } });
});

export const listVisitTypes = asyncHandler(async (req, res) => {
  const visitTypes = await VisitType.find({ ...scope(req), isActive: { $ne: false } }).populate({ path: "specialtyIds", select: "name", match: { tenantId: req.tenantId, isActive: { $ne: false } } }).sort({ name: 1 }).lean();
  res.json({ success: true, data: { visitTypes: visitTypes.map(serializeVisitType) } });
});

export const createVisitType = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim(); const durationMinutes = Number(req.body.durationMinutes); const requiredResourceType = req.body.requiredResourceType || null;
  const specialtyIds = [...new Set(Array.isArray(req.body.specialtyIds) ? req.body.specialtyIds.map(String) : [])];
  if (name.length < 2) throw new ApiError(400, "Visit type name must be at least 2 characters");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) throw new ApiError(400, "Duration must be between 5 and 480 minutes");
  if (!specialtyIds.length) throw new ApiError(400, "Choose at least one eligible specialty");
  if (requiredResourceType && !["room", "equipment", "telehealth_link"].includes(requiredResourceType)) throw new ApiError(400, "Invalid required resource type");
  const count = await Specialty.countDocuments({ tenantId: req.tenantId, _id: { $in: specialtyIds }, isActive: { $ne: false } });
  if (count !== specialtyIds.length) throw new ApiError(400, "Every selected specialty must be active in this tenant");
  const visitType = await VisitType.create({ ...scope(req), name, specialtyIds, durationMinutes, requiredResourceType });
  const populated = await VisitType.findById(visitType._id).populate("specialtyIds", "name").lean();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "visit_type_created", targetType: "VisitType", targetId: visitType._id });
  res.status(201).json({ success: true, data: { visitType: serializeVisitType(populated) } });
});
