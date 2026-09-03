import mongoose from "mongoose";
import { locationRoom } from "./socketServer.js";

const collections = {
  patients: { insert: "patient:created" },
  appointments: { insert: "appointment:created", update: "appointment:updated", replace: "appointment:updated" },
  encounters: { insert: "encounter:created", update: "encounter:updated", replace: "encounter:updated" },
  careplans: { insert: "careplan:created", update: "careplan:updated", replace: "careplan:updated" },
  tasks: { insert: "task:created", update: "task:updated", replace: "task:updated" },
  availabilities: { insert: "availability:updated", update: "availability:updated", replace: "availability:updated" },
  users: { insert: "staff:created" },
  auditlogs: { insert: "auditlog:created" },
  recallrequests: { insert: "recallrequest:created", update: "recallrequest:updated", replace: "recallrequest:updated" },
};

function encounterEvent(change) {
  const fields = change.updateDescription?.updatedFields || {};
  if (fields.status === "finalized") return "encounter:finalized";
  if (Object.keys(fields).some((key) => key === "amendments" || key.startsWith("amendments."))) return "encounter:amended";
  return "encounter:updated";
}

export function startRealtimeChangeStream(io) {
  const stream = mongoose.connection.db.watch([], { fullDocument: "updateLookup" });
  stream.on("change", (change) => {
    const config = collections[change.ns?.coll];
    const document = change.fullDocument;
    if (!config || !document?.tenantId || !document?.locationId) return;
    let event = config[change.operationType];
    if (change.ns.coll === "encounters" && ["update", "replace"].includes(change.operationType)) event = encounterEvent(change);
    if (!event) return;
    io.to(locationRoom(document.tenantId, document.locationId)).emit(event, {
      id: String(document._id),
      tenantId: String(document.tenantId),
      locationId: String(document.locationId),
      patientId: document.patientId ? String(document.patientId) : undefined,
      document,
      occurredAt: new Date().toISOString(),
    });
  });
  stream.on("error", (error) => console.error("Realtime change stream error", error.message));
  return stream;
}
