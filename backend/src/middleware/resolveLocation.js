import { Location } from "../models/Location.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const resolveLocation = asyncHandler(async (req, _res, next) => {
  const location = await Location.findOne({
    tenantId: req.tenantId,
    slug: req.params.locationSlug,
  }).lean();
  if (!location) throw new ApiError(404, "Location not found for this tenant");

  req.locationId = location._id;
  req.location = location;
  next();
});

