import { Appointment } from "../models/Appointment.js";

// Pilot Zero enforced a unique doctor/time index. Phase 1 replaces it with
// application-level, audited conflict controls so approved overbook exceptions
// can exist without weakening tenant/location filters.
export async function ensureSchedulingIndexes() {
  const name = "tenantId_1_locationId_1_doctorId_1_scheduledAt_1";
  const indexes = await Appointment.collection.indexes();
  const existing = indexes.find((index) => index.name === name);
  if (existing?.unique) {
    await Appointment.collection.dropIndex(name);
    await Appointment.collection.createIndex({ tenantId: 1, locationId: 1, doctorId: 1, scheduledAt: 1 });
    console.log("Replaced legacy unique appointment index with audited-overbook index");
  }
}
