import { ApiError } from "../utils/ApiError.js";

export function authorizeLocationAccess(req, _res, next) {
  const isTenantAdmin = req.user?.role === "admin";
  const isAssignedLocation = req.user?.locationId?.toString() === req.locationId.toString();
  if (!isTenantAdmin && !isAssignedLocation) {
    return next(new ApiError(403, "Access denied for this location"));
  }
  next();
}

