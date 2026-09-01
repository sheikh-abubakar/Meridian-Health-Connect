import { AuditLog } from "../models/AuditLog.js";
import { Location } from "../models/Location.js";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../services/passwordService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getProfile = asyncHandler(async (req, res) => {
  const location = req.user.locationId
    ? await Location.findOne({ _id: req.user.locationId, tenantId: req.tenantId }).lean()
    : null;

  res.json({
    success: true,
    data: {
      profile: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
      tenant: { id: req.tenant._id, name: req.tenant.name, slug: req.tenant.slug },
      location: location
        ? { id: location._id, name: location.name, slug: location.slug, address: location.address }
        : null,
    },
  });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }
  if (newPassword.length < 8) throw new ApiError(400, "New password must be at least 8 characters");
  if (currentPassword === newPassword) throw new ApiError(400, "New password must be different from current password");

  const user = await User.findOne({
    _id: req.user._id,
    tenantId: req.tenantId,
    isActive: { $ne: false },
  }).select("+passwordHash");
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await AuditLog.create({
    tenantId: req.tenantId,
    locationId: req.user.locationId,
    actorUserId: req.user._id,
    action: "password_updated",
    targetType: "User",
    targetId: req.user._id,
  });

  res.json({ success: true, data: { message: "Password updated successfully" } });
});

