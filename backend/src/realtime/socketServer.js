import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env, isAllowedOrigin } from "../config/env.js";
import { Location } from "../models/Location.js";
import { User } from "../models/User.js";
import { Patient } from "../models/Patient.js";

export const locationRoom = (tenantId, locationId) => `tenant:${tenantId}:location:${locationId}`;
export const userRoom = (tenantId, userId) => `tenant:${tenantId}:user:${userId}`;
export const patientRoom = (tenantId, patientId) => `tenant:${tenantId}:patient:${patientId}`;

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(isAllowedOrigin(origin) ? null : new Error("Origin is not allowed by CORS"), isAllowedOrigin(origin));
      },
      methods: ["GET", "POST"],
    },
  });
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(String(socket.handshake.auth?.token || ""), env.jwtSecret);
      if (payload.tokenType === "patient_portal") {
        const patient = await Patient.findOne({ _id: payload.patientId, tenantId: payload.tenantId, locationId: payload.locationId, portalActivated: true }).lean();
        if (!patient) throw new Error("Patient portal access denied");
        socket.data.patientId = String(patient._id); socket.data.tenantId = String(patient.tenantId); socket.data.locationId = String(patient.locationId);
        socket.join(patientRoom(patient.tenantId, patient._id));
        return next();
      }
      const user = await User.findOne({ _id: payload.sub, tenantId: payload.tenantId, isActive: { $ne: false } }).lean();
      if (!user) throw new Error("User account not found");
      let locationId = user.locationId;
      if (user.role === "admin") {
        const slug = String(socket.handshake.auth?.locationSlug || "");
        const location = await Location.findOne({ tenantId: user.tenantId, slug }).select("_id").lean();
        if (!location) throw new Error("Location access denied");
        locationId = location._id;
      }
      if (!locationId) throw new Error("Location access denied");
      socket.data.userId = String(user._id);
      socket.data.tenantId = String(user.tenantId);
      socket.data.locationId = String(locationId);
      socket.join(locationRoom(user.tenantId, locationId));
      socket.join(userRoom(user.tenantId, user._id));
      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });
  return io;
}
