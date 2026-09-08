import { User } from "../models/User.js";
import { VisitType } from "../models/VisitType.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listDoctors = asyncHandler(async (req, res) => {
  const filter = {
    tenantId: req.tenantId,
    locationId: req.locationId,
    role: "doctor",
    isActive: { $ne: false },
  };
  if (req.query.visitTypeId) {
    const visitType = await VisitType.findOne({ _id: req.query.visitTypeId, tenantId: req.tenantId, locationId: req.locationId, isActive: { $ne: false } }).lean();
    if (!visitType) throw new ApiError(404, "Visit type not found in this location");
    filter.specialtyIds = { $in: visitType.specialtyIds };
  }
  const doctors = await User.find(filter).select("name email role specialtyIds").populate({ path: "specialtyIds", select: "name", match: { tenantId: req.tenantId, isActive: { $ne: false } } }).sort({ name: 1 }).lean();
  res.json({
    success: true,
    data: { doctors: doctors.map((doctor) => ({ id: doctor._id, name: doctor.name, email: doctor.email, specialties: (doctor.specialtyIds || []).filter((item) => item?.name).map((item) => ({ id: item._id, name: item.name })) })) },
  });
});

export const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ tenantId: req.tenantId, locationId: req.locationId, role: { $in: ["doctor", "frontdesk", "care_coordinator"] }, isActive: { $ne: false } })
    .select("name email role").sort({ role: 1, name: 1 }).lean();
  res.json({ success: true, data: { staff: staff.map((member) => ({ id: member._id, name: member.name, email: member.email, role: member.role })) } });
});
