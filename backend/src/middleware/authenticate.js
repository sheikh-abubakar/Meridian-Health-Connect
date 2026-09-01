import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(authorization.slice(7), env.jwtSecret);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  if (payload.tenantId !== req.tenantId.toString()) {
    throw new ApiError(403, "Access denied for this tenant");
  }

  const user = await User.findOne({
    _id: payload.sub,
    tenantId: req.tenantId,
    isActive: { $ne: false },
  }).lean();
  if (!user) throw new ApiError(401, "User account not found");

  req.user = user;
  next();
});
