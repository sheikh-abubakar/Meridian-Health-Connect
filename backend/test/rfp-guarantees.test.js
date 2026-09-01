import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Appointment } from "../src/models/Appointment.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { CarePlan } from "../src/models/CarePlan.js";
import { Encounter } from "../src/models/Encounter.js";
import { Location } from "../src/models/Location.js";
import { Patient } from "../src/models/Patient.js";
import { Tenant } from "../src/models/Tenant.js";
import { User } from "../src/models/User.js";

const testDbName = `meridian_test_${process.pid}_${Date.now().toString(36)}`;
let server;
let baseUrl;
let fixtures;

function token(user, tenant) {
  return jwt.sign({ tenantId: String(tenant._id), role: user.role }, env.jwtSecret, { subject: String(user._id), expiresIn: "1h" });
}

async function request(path, { user, tenant, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${token(user, tenant)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  return { status: response.status, body: payload };
}

async function requestPdf(path, { user, tenant }) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    headers: { Authorization: `Bearer ${token(user, tenant)}` },
  });
  return { status: response.status, contentType: response.headers.get("content-type"), bytes: Buffer.from(await response.arrayBuffer()) };
}

async function staff(tenantId, locationId, name, role) {
  return User.create({ tenantId, locationId, name, email: `${name.toLowerCase().replaceAll(" ", ".")}@test.invalid`, passwordHash: "not-used-in-api-tests", role, isActive: true });
}

async function patient(tenantId, locationId, name, phone) {
  return Patient.create({ tenantId, locationId, name, contact: { phone }, address: "Test address" });
}

before(async () => {
  assert.match(testDbName, /^meridian_test_\d+_[a-z0-9]+$/, "Refusing to use a non-test database name");
  assert.ok(env.mongodbUri, "MONGODB_URI or TEST_MONGODB_URI is required for isolated tests");
  assert.ok(env.jwtSecret, "JWT_SECRET is required for API tests");
  await mongoose.connect(process.env.TEST_MONGODB_URI || env.mongodbUri, { dbName: testDbName });

  const [city, green] = await Tenant.create([{ name: "City Care", slug: "city-care" }, { name: "Green Valley", slug: "green-valley" }]);
  const [gulberg, dha, greenMain] = await Location.create([
    { tenantId: city._id, name: "Gulberg", slug: "gulberg", address: "Gulberg" },
    { tenantId: city._id, name: "DHA", slug: "dha", address: "DHA" },
    { tenantId: green._id, name: "Green Main", slug: "main", address: "Green Valley" },
  ]);
  const cityAdmin = await User.create({ tenantId: city._id, name: "City Admin", email: "admin@city.test", passwordHash: "unused", role: "admin", isActive: true });
  const cityFrontdesk = await staff(city._id, gulberg._id, "City Frontdesk", "frontdesk");
  const dhaFrontdesk = await staff(city._id, dha._id, "DHA Frontdesk", "frontdesk");
  const cityDoctor = await staff(city._id, gulberg._id, "City Doctor", "doctor");
  const cityCoordinator = await staff(city._id, gulberg._id, "City Coordinator", "care_coordinator");
  const dhaDoctor = await staff(city._id, dha._id, "DHA Doctor", "doctor");
  const greenFrontdesk = await staff(green._id, greenMain._id, "Green Frontdesk", "frontdesk");
  const gulbergPatient = await patient(city._id, gulberg._id, "Gulberg Patient", "03000000001");
  const dhaPatient = await patient(city._id, dha._id, "DHA Patient", "03000000002");
  const greenPatient = await patient(green._id, greenMain._id, "Green Patient", "03000000003");
  fixtures = { city, green, gulberg, dha, greenMain, cityAdmin, cityFrontdesk, dhaFrontdesk, cityDoctor, cityCoordinator, dhaDoctor, greenFrontdesk, gulbergPatient, dhaPatient, greenPatient };
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState === 1) {
    assert.match(mongoose.connection.name, /^meridian_test_\d+_[a-z0-9]+$/, "Refusing to drop a non-test database");
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } else if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
});

test("tenant isolation blocks guessed cross-tenant reads and writes", async () => {
  const f = fixtures;
  const read = await request(`/green-valley/main/patients/${f.greenPatient._id}`, { user: f.cityFrontdesk, tenant: f.city });
  assert.equal(read.status, 403);
  assert.match(read.body.error.message, /tenant/i);
  const beforeCount = await Patient.countDocuments({ tenantId: f.green._id });
  const write = await request("/green-valley/main/patients", { user: f.cityFrontdesk, tenant: f.city, method: "POST", body: { name: "Injected Patient", phone: "0999", address: "Wrong tenant" } });
  assert.equal(write.status, 403);
  assert.equal(await Patient.countDocuments({ tenantId: f.green._id }), beforeCount);
  const users = await request("/green-valley/main/users", { user: f.cityAdmin, tenant: f.city });
  assert.equal(users.status, 403);
});

test("location isolation hides Gulberg data from DHA and rejects cross-location access", async () => {
  const f = fixtures;
  const blocked = await request("/city-care/dha/patients", { user: f.cityFrontdesk, tenant: f.city });
  assert.equal(blocked.status, 403);
  const dhaList = await request("/city-care/dha/patients", { user: f.dhaFrontdesk, tenant: f.city });
  assert.equal(dhaList.status, 200);
  assert.deepEqual(dhaList.body.data.patients.map((item) => item.name), ["DHA Patient"]);
  assert.ok(!dhaList.body.data.patients.some((item) => item.id === String(f.gulbergPatient._id)));
});

test("role guards reject Front-desk clinical/admin actions and Admin operational actions", async () => {
  const f = fixtures;
  assert.equal((await request("/city-care/gulberg/encounters", { user: f.cityFrontdesk, tenant: f.city, method: "POST", body: { appointmentId: new mongoose.Types.ObjectId() } })).status, 403);
  assert.equal((await request("/city-care/gulberg/audit-logs", { user: f.cityFrontdesk, tenant: f.city })).status, 403);
  assert.equal((await request("/city-care/gulberg/patients", { user: f.cityAdmin, tenant: f.city, method: "POST", body: { name: "Admin Patient", phone: "0555", address: "Forbidden" } })).status, 403);
  assert.equal((await request("/city-care/gulberg/appointments", { user: f.cityAdmin, tenant: f.city, method: "POST", body: {} })).status, 403);
});

test("appointment workflow enforces scheduled to checked-in to completed order", async () => {
  const f = fixtures;
  const appointment = await Appointment.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, visitType: "State machine", scheduledAt: new Date("2030-01-07T10:00:00Z"), eligibilityStatus: "verified", createdBy: f.cityFrontdesk._id });
  const premature = await request("/city-care/gulberg/encounters", { user: f.cityDoctor, tenant: f.city, method: "POST", body: { appointmentId: appointment._id } });
  assert.equal(premature.status, 404);
  const checkedIn = await request(`/city-care/gulberg/appointments/${appointment._id}/check-in`, { user: f.cityFrontdesk, tenant: f.city, method: "PATCH" });
  assert.equal(checkedIn.status, 200);
  const started = await request("/city-care/gulberg/encounters", { user: f.cityDoctor, tenant: f.city, method: "POST", body: { appointmentId: appointment._id } });
  assert.equal(started.status, 201);
  const encounterId = started.body.data.encounter._id;
  await request(`/city-care/gulberg/encounters/${encounterId}`, { user: f.cityDoctor, tenant: f.city, method: "PATCH", body: { symptoms: "Headache", observations: "Stable", diagnosis: "Tension headache" } });
  assert.equal((await request(`/city-care/gulberg/encounters/${encounterId}/finalize`, { user: f.cityDoctor, tenant: f.city, method: "PATCH" })).status, 200);
  assert.equal((await Appointment.findById(appointment._id).lean()).status, "completed");
  assert.equal((await request(`/city-care/gulberg/appointments/${appointment._id}/check-in`, { user: f.cityFrontdesk, tenant: f.city, method: "PATCH" })).status, 409);
});

test("finalized encounter notes are immutable while amendments append", async () => {
  const f = fixtures;
  const appointment = await Appointment.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, visitType: "Immutable note", scheduledAt: new Date("2030-01-08T10:00:00Z"), status: "completed", eligibilityStatus: "verified", createdBy: f.cityFrontdesk._id });
  const encounter = await Encounter.create({ tenantId: f.city._id, locationId: f.gulberg._id, appointmentId: appointment._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, notes: { symptoms: "Original symptoms", observations: "Original observations", diagnosis: "Original diagnosis" }, status: "finalized", finalizedAt: new Date() });
  const edit = await request(`/city-care/gulberg/encounters/${encounter._id}`, { user: f.cityDoctor, tenant: f.city, method: "PATCH", body: { diagnosis: "Overwritten" } });
  assert.equal(edit.status, 409);
  const amended = await request(`/city-care/gulberg/encounters/${encounter._id}/amend`, { user: f.cityDoctor, tenant: f.city, method: "POST", body: { text: "Follow-up clarification" } });
  assert.equal(amended.status, 201);
  const persisted = await Encounter.findById(encounter._id).lean();
  assert.equal(persisted.notes.diagnosis, "Original diagnosis");
  assert.equal(persisted.amendments.length, 1);
  assert.equal(persisted.amendments[0].text, "Follow-up clarification");
});

test("record exports produce PDFs, enforce role guards, and create audit evidence", async () => {
  const f = fixtures;
  const appointment = await Appointment.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, visitType: "Export verification", scheduledAt: new Date("2030-01-11T10:00:00Z"), status: "completed", eligibilityStatus: "verified", createdBy: f.cityFrontdesk._id });
  const encounter = await Encounter.create({ tenantId: f.city._id, locationId: f.gulberg._id, appointmentId: appointment._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, notes: { symptoms: "Recorded symptom", observations: "Recorded observation", diagnosis: "Clinician diagnosis" }, status: "finalized", finalizedAt: new Date() });

  const frontdeskProfile = await request(`/city-care/gulberg/patients/${f.gulbergPatient._id}`, { user: f.cityFrontdesk, tenant: f.city });
  const administrativeEncounter = frontdeskProfile.body.data.encounters.find((item) => item._id === String(encounter._id));
  assert.ok(administrativeEncounter.appointmentId.scheduledAt);
  assert.equal(administrativeEncounter.notes, undefined);
  assert.equal(administrativeEncounter.aiSummary, undefined);
  assert.equal(administrativeEncounter.amendments, undefined);

  const clinical = await requestPdf(`/city-care/gulberg/encounters/${encounter._id}/export`, { user: f.cityDoctor, tenant: f.city });
  assert.equal(clinical.status, 200);
  assert.match(clinical.contentType, /^application\/pdf/);
  assert.equal(clinical.bytes.subarray(0, 4).toString(), "%PDF");
  assert.equal((await request(`/city-care/gulberg/encounters/${encounter._id}/export`, { user: f.cityFrontdesk, tenant: f.city })).status, 403);

  const administrative = await requestPdf(`/city-care/gulberg/patients/${f.gulbergPatient._id}/export`, { user: f.cityFrontdesk, tenant: f.city });
  assert.equal(administrative.status, 200);
  assert.match(administrative.contentType, /^application\/pdf/);
  assert.equal(administrative.bytes.subarray(0, 4).toString(), "%PDF");
  assert.equal(await AuditLog.countDocuments({ action: "encounter_exported", targetId: encounter._id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: "patient_history_exported", targetId: f.gulbergPatient._id }), 1);
});

test("task assignment rejects patients and cross-location users but accepts local staff", async () => {
  const f = fixtures;
  const appointment = await Appointment.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, visitType: "Task validation", scheduledAt: new Date("2030-01-09T10:00:00Z"), status: "completed", eligibilityStatus: "verified", createdBy: f.cityFrontdesk._id });
  const encounter = await Encounter.create({ tenantId: f.city._id, locationId: f.gulberg._id, appointmentId: appointment._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, status: "finalized", finalizedAt: new Date() });
  const plan = await CarePlan.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, encounterId: encounter._id, createdByDoctorId: f.cityDoctor._id, goal: "Validate assignments", targetMeasure: "One valid task", reviewCadence: "Weekly", owningCareTeamMemberId: f.cityDoctor._id, history: [{ change: "Created", actor: f.cityDoctor._id, reason: "Test" }] });
  const payload = { carePlanId: plan._id, description: "Call patient", dueDate: "2030-02-01" };
  const patientAssignee = await request("/city-care/gulberg/tasks", { user: f.cityDoctor, tenant: f.city, method: "POST", body: { ...payload, assignedToUserId: f.gulbergPatient._id } });
  assert.equal(patientAssignee.status, 400); assert.match(patientAssignee.body.error.message, /patients cannot be assigned/i);
  assert.equal((await request("/city-care/gulberg/tasks", { user: f.cityDoctor, tenant: f.city, method: "POST", body: { ...payload, assignedToUserId: f.dhaDoctor._id } })).status, 400);
  assert.equal((await request("/city-care/gulberg/tasks", { user: f.cityDoctor, tenant: f.city, method: "POST", body: { ...payload, assignedToUserId: f.cityCoordinator._id } })).status, 201);
});

test("care plan updates require a reason and append version history", async () => {
  const f = fixtures;
  const appointment = await Appointment.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, visitType: "Versioning", scheduledAt: new Date("2030-01-10T10:00:00Z"), status: "completed", eligibilityStatus: "verified", createdBy: f.cityFrontdesk._id });
  const encounter = await Encounter.create({ tenantId: f.city._id, locationId: f.gulberg._id, appointmentId: appointment._id, patientId: f.gulbergPatient._id, doctorId: f.cityDoctor._id, status: "finalized", finalizedAt: new Date() });
  const plan = await CarePlan.create({ tenantId: f.city._id, locationId: f.gulberg._id, patientId: f.gulbergPatient._id, encounterId: encounter._id, createdByDoctorId: f.cityDoctor._id, goal: "Versioned goal", targetMeasure: "Old target", reviewCadence: "Monthly", owningCareTeamMemberId: f.cityDoctor._id, history: [{ change: "Care plan created", actor: f.cityDoctor._id, reason: "Initial" }] });
  assert.equal((await request(`/city-care/gulberg/careplans/${plan._id}`, { user: f.cityDoctor, tenant: f.city, method: "PATCH", body: { targetMeasure: "New target" } })).status, 400);
  const updated = await request(`/city-care/gulberg/careplans/${plan._id}`, { user: f.cityDoctor, tenant: f.city, method: "PATCH", body: { targetMeasure: "New target", reason: "Clinical progress" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.carePlan.targetMeasure, "New target");
  assert.equal(updated.body.data.carePlan.history.length, 2);
  assert.match(updated.body.data.carePlan.history[1].change, /Old target/);
  assert.equal(updated.body.data.carePlan.history[1].reason, "Clinical progress");
});
