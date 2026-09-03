import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { io as createClient } from "socket.io-client";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Availability } from "../src/models/Availability.js";
import { Location } from "../src/models/Location.js";
import { Patient } from "../src/models/Patient.js";
import { Tenant } from "../src/models/Tenant.js";
import { User } from "../src/models/User.js";
import { startRealtimeChangeStream } from "../src/realtime/changeStream.js";
import { createSocketServer } from "../src/realtime/socketServer.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const connect = (url, auth) => new Promise((resolve, reject) => {
  const socket = createClient(url, { auth, transports: ["websocket"], reconnection: false });
  socket.once("connect", () => resolve(socket));
  socket.once("connect_error", reject);
});

test("socket authentication and rooms isolate location events", async () => {
  const dbName = `meridian_realtime_test_${process.pid}_${Date.now().toString(36)}`;
  assert.match(dbName, /^meridian_realtime_test_/);
  await mongoose.connect(process.env.TEST_MONGODB_URI || env.mongodbUri, { dbName });
  const [tenantA, tenantB] = await Tenant.create([{ name: "Socket A", slug: "socket-a" }, { name: "Socket B", slug: "socket-b" }]);
  const [locationA, locationB] = await Location.create([{ tenantId: tenantA._id, name: "A Main", slug: "main", address: "A" }, { tenantId: tenantB._id, name: "B Main", slug: "main", address: "B" }]);
  const [userA, userB] = await User.create([{ tenantId: tenantA._id, locationId: locationA._id, name: "User A", email: "a@socket.test", passwordHash: "unused", role: "frontdesk" }, { tenantId: tenantB._id, locationId: locationB._id, name: "User B", email: "b@socket.test", passwordHash: "unused", role: "frontdesk" }]);
  const token = (user, tenant) => jwt.sign({ tenantId: String(tenant._id), role: user.role }, env.jwtSecret, { subject: String(user._id), expiresIn: "5m" });
  const server = createServer(app); const io = createSocketServer(server); const stream = startRealtimeChangeStream(io);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let socketA; let socketB;
  try {
    await assert.rejects(connect(url, { token: "invalid", locationSlug: "main" }), /Invalid or expired/);
    [socketA, socketB] = await Promise.all([connect(url, { token: token(userA, tenantA), locationSlug: "main" }), connect(url, { token: token(userB, tenantB), locationSlug: "main" })]);
    let leaked = false; socketB.on("patient:created", () => { leaked = true; });
    const received = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Timed out waiting for scoped event")), 7000); socketA.once("patient:created", (payload) => { clearTimeout(timer); resolve(payload); }); });
    const patient = await Patient.create({ tenantId: tenantA._id, locationId: locationA._id, name: "Scoped Patient", contact: { phone: "03000000000" }, address: "Test" });
    const payload = await received; await wait(350);
    assert.equal(payload.id, String(patient._id)); assert.equal(payload.tenantId, String(tenantA._id)); assert.equal(payload.locationId, String(locationA._id)); assert.equal(leaked, false);

    let staffLeaked = false; socketB.on("staff:created", () => { staffLeaked = true; });
    const staffReceived = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Timed out waiting for staff event")), 7000); socketA.once("staff:created", (eventPayload) => { clearTimeout(timer); resolve(eventPayload); }); });
    const doctor = await User.create({ tenantId: tenantA._id, locationId: locationA._id, name: "New Doctor", email: "doctor@socket.test", passwordHash: "unused", role: "doctor" });
    const staffPayload = await staffReceived; await wait(150);
    assert.equal(staffPayload.id, String(doctor._id)); assert.equal(staffLeaked, false);

    let availabilityLeaked = false; socketB.on("availability:updated", () => { availabilityLeaked = true; });
    const availabilityReceived = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Timed out waiting for availability event")), 7000); socketA.once("availability:updated", (eventPayload) => { clearTimeout(timer); resolve(eventPayload); }); });
    const doctorAvailability = await Availability.create({ tenantId: tenantA._id, locationId: locationA._id, doctorId: doctor._id, slots: [{ dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }] });
    const availabilityPayload = await availabilityReceived; await wait(350);
    assert.equal(availabilityPayload.id, String(doctorAvailability._id)); assert.equal(availabilityPayload.document.slots[0].startTime, "09:00"); assert.equal(availabilityLeaked, false);
  } finally {
    socketA?.disconnect(); socketB?.disconnect(); await stream.close(); await new Promise((resolve) => io.close(resolve)); await new Promise((resolve) => server.close(resolve));
    assert.match(mongoose.connection.name, /^meridian_realtime_test_/); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
