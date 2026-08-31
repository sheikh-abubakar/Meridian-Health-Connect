import { ApiError } from "../utils/ApiError.js";

export function authorizeRoles(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission for this action"));
    }
    next();
  };
}

