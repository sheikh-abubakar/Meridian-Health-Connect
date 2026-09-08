import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { Specialty } from "../models/Specialty.js";
import { hashPassword } from "../services/passwordService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const creatableRoles = ["doctor", "frontdesk", "care_coordinator"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialtyIds: (user.specialtyIds || []).map((specialty) => specialty._id ? String(specialty._id) : String(specialty)),
    specialties: (user.specialtyIds || []).filter((specialty) => specialty.name).map((specialty) => ({ id: String(specialty._id), name: specialty.name })),
    createdAt: user.createdAt,
  };
}

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    isActive: { $ne: false },
  }).populate({ path: "specialtyIds", select: "name", match: { tenantId: req.tenantId, isActive: { $ne: false } } })
    .sort({ createdAt: 1, name: 1 })
    .lean();

  res.json({ success: true, data: { users: users.map(serializeUser) } });
});

export const createUser = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = String(req.body.role || "");
  const specialtyIds = [...new Set(Array.isArray(req.body.specialtyIds) ? req.body.specialtyIds.map(String) : [])];

  if (name.length < 2) throw new ApiError(400, "Name must be at least 2 characters");
  if (!emailPattern.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  if (!creatableRoles.includes(role)) {
    throw new ApiError(400, "Role must be doctor, frontdesk, or care_coordinator");
  }
  if (role === "doctor" && !specialtyIds.length) throw new ApiError(400, "Choose at least one specialty for a Doctor");
  if (specialtyIds.length) {
    const count = await Specialty.countDocuments({ tenantId: req.tenantId, _id: { $in: specialtyIds }, isActive: { $ne: false } });
    if (count !== specialtyIds.length) throw new ApiError(400, "Every specialty must be active in this tenant");
  }

  const existingUser = await User.exists({
    tenantId: req.tenantId,
    locationId: req.locationId,
    email,
  });
  if (existingUser) throw new ApiError(409, "A staff user with this email already exists");

  const user = await User.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    specialtyIds: role === "doctor" ? specialtyIds : [],
    isActive: true,
  });

  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "user_created",
    targetType: "User",
    targetId: user._id,
  });

  const populated = await User.findById(user._id).populate("specialtyIds", "name").lean();
  res.status(201).json({ success: true, data: { user: serializeUser(populated) } });
});

export const updateUserSpecialties = asyncHandler(async (req, res) => {
  const specialtyIds = [...new Set(Array.isArray(req.body.specialtyIds) ? req.body.specialtyIds.map(String) : [])];
  if (!specialtyIds.length) throw new ApiError(400, "A Doctor must have at least one specialty");
  const count = await Specialty.countDocuments({ tenantId: req.tenantId, _id: { $in: specialtyIds }, isActive: { $ne: false } });
  if (count !== specialtyIds.length) throw new ApiError(400, "Every specialty must be active in this tenant");
  const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId, role: "doctor", isActive: { $ne: false } }, { $set: { specialtyIds } }, { new: true }).populate("specialtyIds", "name").lean();
  if (!user) throw new ApiError(404, "Active Doctor not found in this location");
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "doctor_specialties_updated", targetType: "User", targetId: user._id });
  res.json({ success: true, data: { user: serializeUser(user) } });
});

export const removeUser = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      tenantId: req.tenantId,
      locationId: req.locationId,
      role: { $ne: "admin" },
      isActive: { $ne: false },
    },
    { $set: { isActive: false } },
    { new: true },
  ).lean();
  if (!user) throw new ApiError(404, "Active staff member not found in this location");

  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.locationId,
    actorUserId: req.user._id,
    action: "user_removed",
    targetType: "User",
    targetId: user._id,
  });

  res.json({ success: true, data: { removedUserId: user._id } });
});
