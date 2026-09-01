import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { Encounter } from "../models/Encounter.js";
import { Patient } from "../models/Patient.js";
import { Task } from "../models/Task.js";
import { renderEncounterPdf, renderVisitHistoryPdf } from "../services/pdfExportService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });

export const exportEncounter = asyncHandler(async (req, res) => {
  const match = scope(req);
  const encounter = await Encounter.findOne({ _id: req.params.id, ...match, status: "finalized" })
    .select("patientId appointmentId doctorId notes aiSummary status finalizedAt amendments")
    .populate({ path: "patientId", select: "name contact address", match })
    .populate({ path: "appointmentId", select: "scheduledAt visitType status", match })
    .populate({ path: "doctorId", select: "name", match })
    .populate({ path: "amendments.actor", select: "name", match })
    .lean();
  if (!encounter?.patientId || !encounter.appointmentId) throw new ApiError(404, "Finalized encounter not found in this location");

  const carePlans = await CarePlan.find({ encounterId: encounter._id, patientId: encounter.patientId._id, ...match })
    .select("goal targetMeasure reviewCadence")
    .sort({ createdAt: 1 })
    .lean();
  const tasks = await Task.find({ carePlanId: { $in: carePlans.map((plan) => plan._id) }, ...match })
    .select("carePlanId description status outcomeNote completedAt dueDate")
    .sort({ createdAt: 1 })
    .lean();
  const tasksByPlan = new Map();
  for (const task of tasks) tasksByPlan.set(String(task.carePlanId), [...(tasksByPlan.get(String(task.carePlanId)) || []), task]);

  await AuditLog.create({ ...match, actorUserId: req.user._id, action: "encounter_exported", targetType: "Encounter", targetId: encounter._id });
  renderEncounterPdf(res, {
    tenant: req.tenant,
    location: req.location,
    encounter,
    linkedCarePlans: carePlans,
    tasksByPlan,
    exportedBy: req.user.name,
  });
});

export const exportPatientVisitHistory = asyncHandler(async (req, res) => {
  const match = scope(req);
  // Administrative export deliberately queries no Encounter, clinical-note, care-plan-detail, or Task models.
  const patient = await Patient.findOne({ _id: req.params.id, ...match })
    .select("name contact address")
    .lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const appointments = await Appointment.find({ patientId: patient._id, ...match })
    .select("scheduledAt visitType doctorId status")
    .populate({ path: "doctorId", select: "name", match })
    .sort({ scheduledAt: -1 })
    .lean();

  await AuditLog.create({ ...match, actorUserId: req.user._id, action: "patient_history_exported", targetType: "Patient", targetId: patient._id });
  renderVisitHistoryPdf(res, {
    tenant: req.tenant,
    location: req.location,
    patient,
    appointments,
    exportedBy: req.user.name,
  });
});
