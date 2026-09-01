import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Tenant } from "../models/Tenant.js";
import { Location } from "../models/Location.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { verifyPassword } from "../services/passwordService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function createLoginResponse(user, tenant, location = null) {
  const accessToken = jwt.sign(
    { tenantId: tenant._id.toString(), role: user.role },
    env.jwtSecret,
    { subject: user._id.toString(), expiresIn: env.jwtExpiresIn },
  );

  return {
    accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug },
    location: location
      ? { id: location._id, name: location.name, slug: location.slug }
      : null,
  };
}

function readCredentials(req) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) throw new ApiError(400, "Email and password are required");
  return { email, password };
}

export const discoverTenantAndLogin = asyncHandler(async (req, res) => {
  const { email, password } = readCredentials(req);

  // This is the sole pre-tenant lookup. All post-login application data
  // remains scoped to the tenant carried by the verified access token.
  const matchingUsers = await User.find({ email, isActive: { $ne: false } }).limit(2).select("+passwordHash");
  if (matchingUsers.length !== 1) {
    throw new ApiError(401, "Invalid credentials or clinic could not be uniquely resolved");
  }

  const [user] = matchingUsers;
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid credentials or clinic could not be uniquely resolved");
  }

  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) throw new ApiError(401, "Invalid credentials or clinic could not be uniquely resolved");
  const location = user.locationId
    ? await Location.findOne({ _id: user.locationId, tenantId: tenant._id }).lean()
    : null;

  await AuditLog.create({ tenantId: tenant._id, locationId: location?._id, actorUserId: user._id, action: "user_logged_in", targetType: "User", targetId: user._id });

  res.json({ success: true, data: createLoginResponse(user, tenant, location) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = readCredentials(req);

  const user = await User.findOne({
    email,
    tenantId: req.tenantId,
    isActive: { $ne: false },
  }).select("+passwordHash");
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const location = user.locationId
    ? await Location.findOne({ _id: user.locationId, tenantId: req.tenantId }).lean()
    : null;
  await AuditLog.create({ tenantId: req.tenantId, locationId: location?._id, actorUserId: user._id, action: "user_logged_in", targetType: "User", targetId: user._id });
  res.json({ success: true, data: createLoginResponse(user, req.tenant, location) });
});

export const getSession = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      tenant: { id: req.tenant._id, name: req.tenant.name, slug: req.tenant.slug },
    },
  });
});
