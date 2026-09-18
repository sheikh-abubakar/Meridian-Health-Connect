import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Encounter } from "../models/Encounter.js";
import { Location } from "../models/Location.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { User } from "../models/User.js";
import { notifyFrontDeskForReferral, notifyStaffUsers } from "../services/staffNotificationService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const statuses = ["sent", "received", "scheduled", "completed"];
const scope = (req) => ({ tenantId: req.tenantId });
const objectId = (value, message) => { if (!mongoose.isValidObjectId(value)) throw new ApiError(400, message); return value; };

function sameId(a, b) { return String(a) === String(b); }
function serialize(referral) {
  return {
    id: referral._id, originLocationId: referral.originLocationId?._id || referral.originLocationId, targetLocationId: referral.targetLocationId?._id || referral.targetLocationId,
    originLocation: referral.originLocationId?.name || "Origin branch", targetLocation: referral.targetLocationId?.name || "Target branch",
    patient: referral.patientId ? { id: referral.patientId._id, name: referral.patientId.name, phone: referral.patientId.contact?.phone || "" } : null,
    encounterId: referral.encounterId?._id || referral.encounterId,
    referringDoctor: referral.referringDoctorId ? { id: referral.referringDoctorId._id, name: referral.referringDoctorId.name } : null,
    targetDoctor: referral.targetDoctorId ? { id: referral.targetDoctorId._id, name: referral.targetDoctorId.name } : null,
    reason: referral.reason, urgency: referral.urgency, status: referral.status, consentCaptured: referral.consentCaptured,
    specialistNote: referral.specialistNote || "", createdAt: referral.createdAt, updatedAt: referral.updatedAt,
    statusHistory: (referral.statusHistory || []).map((item) => ({ id: item._id, status: item.status, timestamp: item.timestamp, actor: item.actor ? { id: item.actor._id, name: item.actor.name } : null })),
  };
}

function populate(query) {
  return query
    .populate({ path: "originLocationId", select: "name slug" })
    .populate({ path: "targetLocationId", select: "name slug" })
    .populate({ path: "patientId", select: "name contact" })
    .populate({ path: "referringDoctorId", select: "name" })
    .populate({ path: "targetDoctorId", select: "name" })
    .populate({ path: "statusHistory.actor", select: "name" });
}

async function auditReferral(referral, actorUserId, action) {
  const locations = [...new Set([String(referral.originLocationId), String(referral.targetLocationId)])];
  await AuditLog.create(locations.map((locationId) => ({ tenantId: referral.tenantId, locationId, actorUserId, action, targetType: "Referral", targetId: referral._id })));
}

export const referralOptions = asyncHandler(async (req, res) => {
  const [locations, doctors] = await Promise.all([
    Location.find({ tenantId: req.tenantId }).select("name slug").sort({ name: 1 }).lean(),
    User.find({ tenantId: req.tenantId, role: "doctor", isActive: { $ne: false } }).select("name locationId").lean(),
  ]);
  res.json({ success: true, data: { locations: locations.map((item) => ({ id: item._id, name: item.name, slug: item.slug })), doctors: doctors.map((item) => ({ id: item._id, name: item.name, locationId: item.locationId })) } });
});

export const createReferral = asyncHandler(async (req, res) => {
  const targetLocationId = objectId(req.body.targetLocationId || req.locationId, "Choose a valid target branch");
  const targetDoctorId = objectId(req.body.targetDoctorId, "Choose a valid target doctor");
  const encounterId = objectId(req.body.encounterId, "Choose a valid finalized encounter");
  const reason = String(req.body.reason || "").trim();
  const urgency = String(req.body.urgency || "routine");
  if (reason.length < 3 || reason.length > 3000) throw new ApiError(400, "Referral reason must be 3 to 3,000 characters");
  if (!["routine", "urgent", "emergency"].includes(urgency)) throw new ApiError(400, "Choose a valid urgency");
  const encounter = await Encounter.findOne({ _id: encounterId, tenantId: req.tenantId, locationId: req.locationId, doctorId: req.user._id, status: "finalized" }).lean();
  if (!encounter) throw new ApiError(404, "Finalized encounter not found for this doctor at this branch");
  const targetLocation = await Location.findOne({ _id: targetLocationId, tenantId: req.tenantId }).lean();
  if (!targetLocation) throw new ApiError(403, "Referrals cannot be sent outside this clinic");
  const targetDoctor = await User.findOne({ _id: targetDoctorId, tenantId: req.tenantId, locationId: targetLocation._id, role: "doctor", isActive: { $ne: false } }).lean();
  if (!targetDoctor) throw new ApiError(400, "Choose an active doctor at the selected branch");
  const crossesLocations = !sameId(targetLocation._id, req.locationId);
  if (crossesLocations && req.body.consentCaptured !== true) throw new ApiError(400, "Record patient consent before sending a referral to another branch");
  const now = new Date();
  const referral = await Referral.create({ tenantId: req.tenantId, originLocationId: req.locationId, targetLocationId: targetLocation._id, patientId: encounter.patientId, encounterId: encounter._id, referringDoctorId: req.user._id, targetDoctorId: targetDoctor._id, reason, urgency, consentCaptured: crossesLocations, status: "sent", statusHistory: [{ status: "sent", actor: req.user._id, timestamp: now }] });
  await auditReferral(referral, req.user._id, "referral_created");
  await Promise.all([
    notifyStaffUsers({ tenantId: req.tenantId, locationId: targetLocation._id, recipientUserIds: [targetDoctor._id], type: "referral_received", title: "New referral received", body: `${urgency === "emergency" ? "Emergency" : urgency === "urgent" ? "Urgent" : "Routine"} referral requires your review.`, targetPath: "/my-referrals", targetId: referral._id }),
    notifyFrontDeskForReferral({ referral, targetPath: "/scheduling" }),
  ]);
  const populated = await populate(Referral.findById(referral._id)).lean();
  res.status(201).json({ success: true, data: { referral: serialize(populated) } });
});

export const myReferrals = asyncHandler(async (req, res) => {
  const referrals = await populate(Referral.find({ tenantId: req.tenantId, $or: [{ referringDoctorId: req.user._id, originLocationId: req.locationId }, { targetDoctorId: req.user._id, targetLocationId: req.locationId }] }).sort({ updatedAt: -1 })).lean();
  res.json({ success: true, data: { referrals: referrals.map(serialize) } });
});

// Front-desk owns appointment booking. This worklist includes both local and
// cross-branch referrals addressed to Doctors at the current branch.
export const incomingReferrals = asyncHandler(async (req, res) => {
  const referrals = await populate(Referral.find({ tenantId: req.tenantId, targetLocationId: req.locationId, status: { $in: ["sent", "received"] } }).sort({ urgency: -1, createdAt: -1 })).lean();
  res.json({ success: true, data: { referrals: referrals.map(serialize) } });
});

export const patientReferrals = asyncHandler(async (req, res) => {
  objectId(req.params.patientId, "Invalid patient ID");
  const patient = await Patient.exists({ _id: req.params.patientId, tenantId: req.tenantId });
  if (!patient) throw new ApiError(404, "Patient not found in this clinic");
  const referrals = await populate(Referral.find({ tenantId: req.tenantId, patientId: req.params.patientId, $or: [{ originLocationId: req.locationId }, { targetLocationId: req.locationId }] }).sort({ updatedAt: -1 })).lean();
  res.json({ success: true, data: { referrals: referrals.map(serialize) } });
});

async function receivedReferral(req) {
  objectId(req.params.id, "Invalid referral ID");
  const referral = await Referral.findOne({ _id: req.params.id, tenantId: req.tenantId, targetLocationId: req.locationId, targetDoctorId: req.user._id });
  if (!referral) throw new ApiError(404, "Referral not found in your received referrals");
  return referral;
}

export const updateReferralStatus = asyncHandler(async (req, res) => {
  const referral = await receivedReferral(req);
  const status = String(req.body.status || "");
  const currentIndex = statuses.indexOf(referral.status);
  if (status !== "received" || referral.status !== "sent") throw new ApiError(409, "Doctors can only acknowledge a sent referral. Front-desk schedules the referral through appointment booking.");
  referral.status = status; referral.statusHistory.push({ status, actor: req.user._id, timestamp: new Date() });
  await referral.save(); await auditReferral(referral, req.user._id, "referral_status_updated");
  const populated = await populate(Referral.findById(referral._id)).lean();
  res.json({ success: true, data: { referral: serialize(populated) } });
});

export const closeReferralLoop = asyncHandler(async (req, res) => {
  const referral = await receivedReferral(req);
  if (referral.status !== "scheduled") throw new ApiError(409, "Schedule the referral before recording the specialist response");
  const specialistNote = String(req.body.specialistNote || "").trim();
  if (specialistNote.length < 3 || specialistNote.length > 5000) throw new ApiError(400, "Specialist response must be 3 to 5,000 characters");
  referral.specialistNote = specialistNote; referral.status = "completed"; referral.statusHistory.push({ status: "completed", actor: req.user._id, timestamp: new Date() });
  await referral.save(); await auditReferral(referral, req.user._id, "referral_closed_loop");
  await notifyStaffUsers({ tenantId: req.tenantId, locationId: referral.originLocationId, recipientUserIds: [referral.referringDoctorId], type: "referral_completed", title: "Referral closed-loop response received", body: "The receiving Doctor recorded a specialist response for your referral.", targetPath: "/my-referrals", targetId: referral._id });
  const populated = await populate(Referral.findById(referral._id)).lean();
  res.json({ success: true, data: { referral: serialize(populated) } });
});
