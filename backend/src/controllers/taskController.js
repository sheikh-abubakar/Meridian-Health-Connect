import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const populateTask = (query, req) => query.populate({ path: "assignedToUserId", select: "name role email", match: scope(req) }).populate({ path: "assignedByUserId", select: "name role", match: scope(req) }).populate({ path: "carePlanId", select: "goal patientId", match: scope(req), populate: { path: "patientId", select: "name contact", match: scope(req) } });

export const createTask = asyncHandler(async (req, res) => {
  const carePlan = await CarePlan.findOne({ _id: req.body.carePlanId, ...scope(req) }).lean();
  if (!carePlan) throw new ApiError(404, "Care plan not found in this location");
  const assignee = await User.findOne({ _id: req.body.assignedToUserId, ...scope(req), role: { $in: ["doctor", "frontdesk", "care_coordinator"] }, isActive: { $ne: false } }).lean();
  if (!assignee) throw new ApiError(400, "Task assignee must be an active staff user in this location; patients cannot be assigned tasks");
  const description = String(req.body.description || "").trim();
  if (!description) throw new ApiError(400, "Task description is required");
  const dueDate = new Date(req.body.dueDate);
  if (Number.isNaN(dueDate.getTime())) throw new ApiError(400, "Enter a valid due date");
  const task = await Task.create({ ...scope(req), carePlanId: carePlan._id, description, assignedToUserId: assignee._id, assignedByUserId: req.user._id, dueDate });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "task_created", targetType: "Task", targetId: task._id });
  const result = await populateTask(Task.findOne({ _id: task._id, ...scope(req) }), req).lean();
  res.status(201).json({ success: true, data: { task: result } });
});

export const listTasks = asyncHandler(async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.assignedToUserId) {
    if (req.query.assignedToUserId === "me") filter.assignedToUserId = req.user._id;
    else {
      if (String(req.query.assignedToUserId) !== String(req.user._id) && !["doctor", "admin"].includes(req.user.role)) throw new ApiError(403, "You can only view your own assigned tasks");
      filter.assignedToUserId = req.query.assignedToUserId;
    }
  }
  const tasks = await populateTask(Task.find(filter).sort({ status: -1, dueDate: 1 }), req).lean();
  res.json({ success: true, data: { tasks } });
});

export const completeTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, assignedToUserId: req.user._id, ...scope(req) });
  if (!task) throw new ApiError(404, "Open task assigned to you was not found in this location");
  if (task.status === "completed") throw new ApiError(409, "Task is already completed");
  const outcomeNote = String(req.body.outcomeNote || "").trim();
  if (outcomeNote.length > 5000) throw new ApiError(400, "Outcome note cannot exceed 5000 characters");
  task.status = "completed";
  task.outcomeNote = outcomeNote || undefined;
  task.completedAt = new Date();
  await task.save();
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "task_completed", targetType: "Task", targetId: task._id });
  const result = await populateTask(Task.findOne({ _id: task._id, ...scope(req) }), req).lean();
  res.json({ success: true, data: { task: result } });
});
