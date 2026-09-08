import { AuditLog } from "../models/AuditLog.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Waitlist } from "../models/Waitlist.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const populate = (query, req) => query.populate({ path: "patientId", select: "name contact", match: scope(req) }).populate({ path: "doctorId", select: "name", match: { ...scope(req), role: "doctor" } });

export const listWaitlist = asyncHandler(async (req, res) => {
  const filter = scope(req); if (req.query.doctorId) filter.doctorId = req.query.doctorId;
  const entries = await populate(Waitlist.find(filter).sort({ createdAt: -1 }), req).lean();
  res.json({ success: true, data: { waitlist: entries } });
});
export const addWaitlist = asyncHandler(async (req, res) => {
  const [patient, doctor] = await Promise.all([
    Patient.exists({ _id: req.body.patientId, ...scope(req) }),
    User.exists({ _id: req.body.doctorId, ...scope(req), role: "doctor", isActive: { $ne: false } }),
  ]);
  if (!patient) throw new ApiError(404, "Patient not found in this location"); if (!doctor) throw new ApiError(404, "Doctor not found in this location");
  const note = String(req.body.note || "").trim();
  const entry = await Waitlist.create({ ...scope(req), patientId: req.body.patientId, doctorId: req.body.doctorId, preferredStartDate: req.body.preferredStartDate || undefined, preferredEndDate: req.body.preferredEndDate || undefined, note: note || undefined });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "waitlist_entry_created", targetType: "Waitlist", targetId: entry._id });
  res.status(201).json({ success: true, data: { entry: await populate(Waitlist.findById(entry._id), req).lean() } });
});
export const removeWaitlist = asyncHandler(async (req, res) => {
  const entry = await Waitlist.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  if (!entry) throw new ApiError(404, "Waitlist entry not found in this location");
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "waitlist_entry_removed", targetType: "Waitlist", targetId: entry._id });
  res.json({ success: true, data: { removedId: entry._id } });
});
