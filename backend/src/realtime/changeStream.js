import mongoose from "mongoose";
import { locationRoom } from "./socketServer.js";

const collections = {
  patients: { insert: "patient:created" },
  appointments: { insert: "appointment:created", update: "appointment:updated", replace: "appointment:updated" },
  encounters: { insert: "encounter:created", update: "encounter:updated", replace: "encounter:updated" },
  careplans: { insert: "careplan:created", update: "careplan:updated", replace: "careplan:updated" },
  tasks: { insert: "task:created", update: "task:updated", replace: "task:updated" },
  availabilities: { insert: "availability:updated", update: "availability:updated", replace: "availability:updated" },
  users: { insert: "staff:created", update: "staff:updated", replace: "staff:updated" },
  auditlogs: { insert: "auditlog:created" },
  recallrequests: { insert: "recallrequest:created", update: "recallrequest:updated", replace: "recallrequest:updated" },
  resources: { insert: "resource:created", update: "resource:updated", replace: "resource:updated" },
  waitlists: { insert: "waitlist:created", delete: "waitlist:removed" },
  reminders: { insert: "reminder:created", update: "reminder:updated", replace: "reminder:updated" },
  specialties: { insert: "specialty:created", update: "specialty:updated", replace: "specialty:updated" },
  visittypes: { insert: "visittype:created", update: "visittype:updated", replace: "visittype:updated" },
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
    if (!config || !document?.tenantId) return;
    let event = config[change.operationType];
    if (change.ns.coll === "encounters" && ["update", "replace"].includes(change.operationType)) event = encounterEvent(change);
    if (!event) return;
    const targets = document.locationId ? [locationRoom(document.tenantId, document.locationId)] : [];
    if (change.ns.coll === "specialties") {
      // Specialties are tenant-wide; notify each connected location only within that tenant.
      for (const [room] of io.sockets.adapter.rooms) if (room.startsWith(`tenant:${document.tenantId}:location:`)) targets.push(room);
    }
    for (const target of targets) io.to(target).emit(event, {
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
