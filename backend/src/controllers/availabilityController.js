import { Availability } from "../models/Availability.js";
import { User } from "../models/User.js";
import { validateAvailabilitySlots } from "../services/availabilityService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const setOwnAvailability = asyncHandler(async (req, res) => {
  const slots = validateAvailabilitySlots(req.body.slots);
  const availability = await Availability.findOneAndUpdate(
    { tenantId: req.tenantId, locationId: req.locationId, doctorId: req.user._id },
    { $set: { slots } },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  res.json({ success: true, data: { availability } });
});

export const getDoctorAvailability = asyncHandler(async (req, res) => {
  const doctor = await User.findOne({
    _id: req.params.doctorId,
    tenantId: req.tenantId,
    locationId: req.locationId,
    role: "doctor",
    isActive: { $ne: false },
  }).lean();
  if (!doctor) throw new ApiError(404, "Doctor not found in this location");

  const availability = await Availability.findOne({
    tenantId: req.tenantId,
    locationId: req.locationId,
    doctorId: doctor._id,
  }).lean();

  res.json({
    success: true,
    data: {
      availability: availability || {
        tenantId: req.tenantId,
        locationId: req.locationId,
        doctorId: doctor._id,
        slots: [],
      },
    },
  });
});
