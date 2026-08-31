import { Tenant } from "../models/Tenant.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const resolveTenant = asyncHandler(async (req, _res, next) => {
  const tenant = await Tenant.findOne({ slug: req.params.tenantSlug }).lean();
  if (!tenant) throw new ApiError(404, "Tenant not found");

  req.tenantId = tenant._id;
  req.tenant = tenant;
  next();
});

