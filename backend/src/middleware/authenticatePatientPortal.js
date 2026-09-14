import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Patient } from "../models/Patient.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticatePatientPortal = asyncHandler(async (req, _res, next) => {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Please sign in to continue");
  let payload;
  try { payload = jwt.verify(authorization.slice(7), env.jwtSecret); } catch { throw new ApiError(401, "Your session has expired. Please sign in again."); }
  if (payload.tokenType !== "patient_portal" || !payload.patientId || !payload.tenantId || !payload.locationId) throw new ApiError(403, "This portal session is not valid");
  const patient = await Patient.findOne({ _id: payload.patientId, tenantId: payload.tenantId, locationId: payload.locationId, portalActivated: true }).lean();
  if (!patient) throw new ApiError(401, "Your portal account is not available");
  req.portalPatient = patient; req.tenantId = patient.tenantId; req.locationId = patient.locationId;
  next();
});
