import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { Location } from "../models/Location.js";
import { User } from "../models/User.js";

export const locationRoom = (tenantId, locationId) => `tenant:${tenantId}:location:${locationId}`;

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.frontendUrl, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(String(socket.handshake.auth?.token || ""), env.jwtSecret);
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
      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });
  return io;
}
