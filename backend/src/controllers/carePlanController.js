import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { Encounter } from "../models/Encounter.js";
import { Patient } from "../models/Patient.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
function populated(query, req) {
  const match = scope(req);
  return query.populate({ path: "createdByDoctorId", select: "name role", match })
    .populate({ path: "owningCareTeamMemberId", select: "name role email", match })
    .populate({ path: "history.actor", select: "name role", match });
}
function text(body, field, label) {
  const value = String(body[field] || "").trim();
  if (!value) throw new ApiError(400, `${label} is required`);
  if (value.length > 2000) throw new ApiError(400, `${label} cannot exceed 2000 characters`);
  return value;
}

export const createCarePlan = asyncHandler(async (req, res) => {
  const encounter = await Encounter.findOne({ _id: req.body.encounterId, ...scope(req), status: "finalized" }).lean();
  if (!encounter) throw new ApiError(404, "Finalized encounter not found in this location");
  const patient = await Patient.exists({ _id: encounter.patientId, ...scope(req) });
  if (!patient) throw new ApiError(404, "Encounter patient not found in this location");
  const owner = await User.findOne({ _id: req.body.owningCareTeamMemberId, ...scope(req), role: { $in: ["doctor", "care_coordinator"] }, isActive: { $ne: false } }).lean();
  if (!owner) throw new ApiError(400, "Owning care-team member must be active staff in this location");
  const values = { goal: text(req.body, "goal", "Goal"), targetMeasure: text(req.body, "targetMeasure", "Target measure"), reviewCadence: text(req.body, "reviewCadence", "Review cadence") };
  const plan = await CarePlan.create({ ...scope(req), patientId: encounter.patientId, encounterId: encounter._id, createdByDoctorId: req.user._id, owningCareTeamMemberId: owner._id, ...values, history: [{ change: "Care plan created", actor: req.user._id, reason: "Initial care plan" }] });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "care_plan_created", targetType: "CarePlan", targetId: plan._id });
  const result = await populated(CarePlan.findOne({ _id: plan._id, ...scope(req) }), req).lean();
  res.status(201).json({ success: true, data: { carePlan: result } });
});

export const updateCarePlan = asyncHandler(async (req, res) => {
  const plan = await CarePlan.findOne({ _id: req.params.id, owningCareTeamMemberId: req.user._id, ...scope(req) });
  if (!plan) throw new ApiError(404, "Care plan owned by you was not found in this location");
  const reason = text(req.body, "reason", "Change reason");
  const changes = [];
  for (const [field, label] of [["goal", "Goal"], ["targetMeasure", "Target measure"], ["reviewCadence", "Review cadence"]]) {
    if (Object.hasOwn(req.body, field)) {
      const value = text(req.body, field, label);
      if (value !== plan[field]) { changes.push(`${label}: “${plan[field]}” → “${value}”`); plan[field] = value; }
    }
  }
  if (!changes.length) throw new ApiError(400, "Provide at least one changed care-plan field");
  plan.history.push({ change: changes.join("; "), actor: req.user._id, reason });
  await plan.save();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "care_plan_updated", targetType: "CarePlan", targetId: plan._id });
  const result = await populated(CarePlan.findOne({ _id: plan._id, ...scope(req) }), req).lean();
  res.json({ success: true, data: { carePlan: result } });
});

export const listPatientCarePlans = asyncHandler(async (req, res) => {
  const patient = await Patient.exists({ _id: req.params.patientId, ...scope(req) });
  if (!patient) throw new ApiError(404, "Patient not found in this location");
  const plans = await populated(CarePlan.find({ patientId: req.params.patientId, ...scope(req) }).sort({ createdAt: -1 }), req).lean();
  const tasks = await Task.find({ carePlanId: { $in: plans.map((plan) => plan._id) }, ...scope(req) })
    .populate({ path: "assignedToUserId", select: "name role", match: scope(req) }).sort({ dueDate: 1 }).lean();
  const byPlan = new Map();
  for (const task of tasks) { const key = String(task.carePlanId); byPlan.set(key, [...(byPlan.get(key) || []), task]); }
  res.json({ success: true, data: { carePlans: plans.map((plan) => ({ ...plan, tasks: byPlan.get(String(plan._id)) || [] })) } });
});

export const listOwnedCarePlans = asyncHandler(async (req, res) => {
  if (req.query.owningCareTeamMemberId !== "me") throw new ApiError(400, "Use owningCareTeamMemberId=me to list your owned care plans");
  const plans = await populated(CarePlan.find({ owningCareTeamMemberId: req.user._id, ...scope(req) })
    .populate({ path: "patientId", select: "name contact", match: scope(req) })
    .sort({ createdAt: -1 }), req).lean();
  const tasks = await Task.find({ carePlanId: { $in: plans.map((plan) => plan._id) }, ...scope(req) })
    .populate({ path: "assignedToUserId", select: "name role", match: scope(req) }).sort({ dueDate: 1 }).lean();
  const byPlan = new Map();
  for (const task of tasks) { const key = String(task.carePlanId); byPlan.set(key, [...(byPlan.get(key) || []), task]); }
  res.json({ success: true, data: { carePlans: plans.map((plan) => { const linkedTasks = byPlan.get(String(plan._id)) || []; return { ...plan, tasks: linkedTasks, taskSummary: { open: linkedTasks.filter((task) => task.status === "open").length, completed: linkedTasks.filter((task) => task.status === "completed").length, total: linkedTasks.length } }; }) } });
});
