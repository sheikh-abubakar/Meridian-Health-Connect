import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
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
    createdAt: user.createdAt,
  };
}

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1, name: 1 })
    .lean();

  res.json({ success: true, data: { users: users.map(serializeUser) } });
});

export const createUser = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = String(req.body.role || "");

  if (name.length < 2) throw new ApiError(400, "Name must be at least 2 characters");
  if (!emailPattern.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  if (!creatableRoles.includes(role)) {
    throw new ApiError(400, "Role must be doctor, frontdesk, or care_coordinator");
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

  res.status(201).json({ success: true, data: { user: serializeUser(user) } });
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
