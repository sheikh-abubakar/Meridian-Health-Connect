import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({
    tenantId: req.tenantId,
    locationId: req.locationId,
    role: "doctor",
    isActive: { $ne: false },
  }).select("name email role").sort({ name: 1 }).lean();
  res.json({
    success: true,
    data: { doctors: doctors.map((doctor) => ({ id: doctor._id, name: doctor.name, email: doctor.email })) },
  });
});

export const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ tenantId: req.tenantId, locationId: req.locationId, role: { $in: ["doctor", "frontdesk", "care_coordinator"] }, isActive: { $ne: false } })
    .select("name email role").sort({ role: 1, name: 1 }).lean();
  res.json({ success: true, data: { staff: staff.map((member) => ({ id: member._id, name: member.name, email: member.email, role: member.role })) } });
});
