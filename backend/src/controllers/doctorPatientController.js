import { Encounter } from "../models/Encounter.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listMyPatients = asyncHandler(async (req, res) => {
  const encounters = await Encounter.find({ tenantId: req.tenantId, locationId: req.locationId, doctorId: req.user._id, status: "finalized" })
    .select("patientId finalizedAt notes.diagnosis")
    .populate({ path: "patientId", select: "name contact address", match: { tenantId: req.tenantId, locationId: req.locationId } })
    .sort({ finalizedAt: -1 }).lean();
  const patients = new Map();
  for (const encounter of encounters) {
    if (!encounter.patientId) continue;
    const id = String(encounter.patientId._id);
    const existing = patients.get(id);
    if (!existing) patients.set(id, { id: encounter.patientId._id, name: encounter.patientId.name, phone: encounter.patientId.contact?.phone || "", address: encounter.patientId.address, lastEncounterAt: encounter.finalizedAt, lastDiagnosis: encounter.notes?.diagnosis || "", finalizedEncounterCount: 1 });
    else existing.finalizedEncounterCount += 1;
  }
  res.json({ success: true, data: { patients: [...patients.values()] } });
});
