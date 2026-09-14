import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { AuditLog } from "../models/AuditLog.js";
import { Location } from "../models/Location.js";
import { Patient } from "../models/Patient.js";
import { Tenant } from "../models/Tenant.js";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../services/passwordService.js";
import { sendPortalInvite } from "../services/portalEmailService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const activationError = () => new ApiError(400, "This activation link is invalid, expired, or has already been used. Please contact your clinic for a new invitation.");
function passwordFrom(req) { const value = String(req.body.password || ""); if (value.length < 8) throw new ApiError(400, "Choose a password with at least 8 characters"); return value; }

export const invitePatientToPortal = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  if (patient.portalActivated) throw new ApiError(409, "This patient already has an active portal account");
  const email = cleanEmail(patient.contact?.email);
  if (!email) throw new ApiError(400, "Add the patient's email address before sending a portal invitation");
  const duplicate = await Patient.findOne({ portalEmail: email, _id: { $ne: patient._id } }).lean();
  if (duplicate) throw new ApiError(409, "This email is already used by a patient portal account");
  const token = crypto.randomBytes(32).toString("hex");
  patient.portalEmail = email; patient.activationToken = token; patient.activationTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await patient.save();
  const tenant = await Tenant.findById(req.tenantId).lean();
  const clinicName = tenant?.name || "Meridian Health";
  try { await sendPortalInvite({ recipient: email, patientName: patient.name, clinicName, activationUrl: `${env.frontendUrl}/portal/activate/${token}` }); }
  catch (error) { patient.activationToken = undefined; patient.activationTokenExpiry = undefined; await patient.save(); throw new ApiError(502, "The invitation email could not be sent. Check the clinic email settings and try again."); }
  await AuditLog.create({ tenantId: req.tenantId, locationId: req.locationId, actorUserId: req.user._id, action: "patient_portal_invite_sent", targetType: "Patient", targetId: patient._id });
  res.json({ success: true, data: { portalActivated: false, invitationSentTo: email } });
});

export const inspectActivation = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ activationToken: req.params.token, activationTokenExpiry: { $gt: new Date() }, portalActivated: false }).select("name").lean();
  if (!patient) throw activationError();
  res.json({ success: true, data: { valid: true, patientName: patient.name } });
});

export const activatePortal = asyncHandler(async (req, res) => {
  const password = passwordFrom(req);
  const patient = await Patient.findOne({ activationToken: req.params.token, activationTokenExpiry: { $gt: new Date() }, portalActivated: false }).select("+passwordHash +activationToken +activationTokenExpiry");
  if (!patient) throw activationError();
  patient.passwordHash = await hashPassword(password); patient.portalActivated = true; patient.activationToken = undefined; patient.activationTokenExpiry = undefined;
  await patient.save();
  await AuditLog.create({ tenantId: patient.tenantId, locationId: patient.locationId, actorPatientId: patient._id, action: "patient_portal_activated", targetType: "Patient", targetId: patient._id });
  res.json({ success: true, data: { activated: true } });
});

export const patientPortalLogin = asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body.email); const password = String(req.body.password || "");
  if (!email || !password) throw new ApiError(400, "Enter your email and password");
  const patient = await Patient.findOne({ portalEmail: email, portalActivated: true }).select("+passwordHash");
  if (!patient || !(await verifyPassword(password, patient.passwordHash))) throw new ApiError(401, "The email or password is not correct");
  const [tenant, location] = await Promise.all([Tenant.findById(patient.tenantId).lean(), Location.findOne({ _id: patient.locationId, tenantId: patient.tenantId }).lean()]);
  if (!tenant || !location) throw new ApiError(401, "This portal account is not available");
  const accessToken = jwt.sign({ tokenType: "patient_portal", patientId: String(patient._id), tenantId: String(patient.tenantId), locationId: String(patient.locationId) }, env.jwtSecret, { subject: String(patient._id), expiresIn: env.jwtExpiresIn });
  await AuditLog.create({ tenantId: patient.tenantId, locationId: patient.locationId, actorPatientId: patient._id, action: "patient_portal_logged_in", targetType: "Patient", targetId: patient._id });
  res.json({ success: true, data: { accessToken, patient: { id: patient._id, name: patient.name }, clinic: { name: tenant.name, branchName: location.name } } });
});

export const patientPortalSession = asyncHandler(async (req, res) => {
  const [tenant, location] = await Promise.all([Tenant.findById(req.tenantId).lean(), Location.findOne({ _id: req.locationId, tenantId: req.tenantId }).lean()]);
  res.json({ success: true, data: { patient: { id: req.portalPatient._id, name: req.portalPatient.name }, clinic: { name: tenant?.name || "Your clinic", branchName: location?.name || "Your branch" } } });
});
