import { Location } from "../models/Location.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTenantOverview = asyncHandler(async (req, res) => {
  const [locations, staffCounts] = await Promise.all([
    Location.find({ tenantId: req.tenantId }).sort({ name: 1 }).lean(),
    User.aggregate([
      { $match: { tenantId: req.tenantId, locationId: { $exists: true } } },
      { $group: { _id: "$locationId", staffCount: { $sum: 1 } } },
    ]),
  ]);

  const countsByLocation = new Map(
    staffCounts.map((entry) => [entry._id.toString(), entry.staffCount]),
  );

  res.json({
    success: true,
    data: {
      tenant: { id: req.tenant._id, name: req.tenant.name, slug: req.tenant.slug },
      locations: locations.map((location) => ({
        id: location._id,
        name: location.name,
        slug: location.slug,
        address: location.address,
        staffCount: countsByLocation.get(location._id.toString()) || 0,
      })),
    },
  });
});

export const getLocationContext = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      tenant: { id: req.tenant._id, name: req.tenant.name, slug: req.tenant.slug },
      location: {
        id: req.location._id,
        name: req.location.name,
        slug: req.location.slug,
        address: req.location.address,
      },
    },
  });
});

