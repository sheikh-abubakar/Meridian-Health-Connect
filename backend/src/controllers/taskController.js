import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { CarePlan } from "../models/CarePlan.js";
import { Patient } from "../models/Patient.js";
import { RecallRequest } from "../models/RecallRequest.js";
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
  const type = String(req.body.type || "general").trim();
  if (!["general", "outreach"].includes(type)) throw new ApiError(400, "Task type must be general or outreach");
  const task = await Task.create({ ...scope(req), carePlanId: carePlan._id, description, assignedToUserId: assignee._id, assignedByUserId: req.user._id, dueDate, type });
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
  if (task.type === "outreach") throw new ApiError(400, "Outreach tasks must be completed by recording an outreach outcome");
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

export const recordTaskOutcome = asyncHandler(async (req, res) => {
  const outcome = String(req.body.outcome || "").trim();
  if (!["agreed", "declined", "unreachable"].includes(outcome)) throw new ApiError(400, "Outcome must be agreed, declined, or unreachable");
  const timeframe = String(req.body.timeframe || "").trim();
  const note = String(req.body.note || "").trim();
  if (note.length > 5000) throw new ApiError(400, "Outcome note cannot exceed 5000 characters");
  if (outcome === "agreed") {
    if (!["1_week", "2_weeks", "1_month"].includes(timeframe)) throw new ApiError(400, "Select a valid follow-up timeframe");
    if (!note) throw new ApiError(400, "A coordinator note is required when the patient agrees to follow-up");
  }

  const session = await mongoose.startSession();
  let recallRequest = null;
  try {
    await session.withTransaction(async () => {
      const task = await Task.findOne({ _id: req.params.taskId, assignedToUserId: req.user._id, ...scope(req) }).session(session);
      if (!task) throw new ApiError(404, "Task assigned to you was not found in this location");
      if (task.type !== "outreach") throw new ApiError(400, "Outcomes can only be recorded for outreach tasks");
      if (task.status === "completed") throw new ApiError(409, "This outreach task already has a recorded outcome");

      task.outcome = outcome;
      task.status = "completed";
      task.outcomeNote = note || undefined;
      task.completedAt = new Date();
      await task.save({ session });
      await AuditLog.create([{ ...scope(req), actorUserId: req.user._id, action: "task_outcome_recorded", targetType: "Task", targetId: task._id }], { session });

      if (outcome === "agreed") {
        const carePlan = await CarePlan.findOne({ _id: task.carePlanId, ...scope(req) }).session(session).lean();
        if (!carePlan) throw new ApiError(404, "Linked care plan was not found in this location");
        const patient = await Patient.findOne({ _id: carePlan.patientId, ...scope(req) }).session(session).lean();
        if (!patient) throw new ApiError(404, "Linked patient was not found in this location");
        const doctor = await User.findOne({ _id: carePlan.createdByDoctorId, ...scope(req), role: "doctor", isActive: { $ne: false } }).session(session).lean();
        if (!doctor) throw new ApiError(400, "The care plan's doctor is not active in this location");
        [recallRequest] = await RecallRequest.create([{ tenantId: req.tenantId, locationId: patient.locationId, patientId: patient._id, carePlanId: carePlan._id, doctorId: doctor._id, sourceTaskId: task._id, requestedByUserId: req.user._id, timeframe, note, status: "pending_scheduling" }], { session });
        await AuditLog.create([{ ...scope(req), actorUserId: req.user._id, action: "recall_request_created", targetType: "RecallRequest", targetId: recallRequest._id }], { session });
      }
    });
  } finally {
    await session.endSession();
  }

  const task = await populateTask(Task.findOne({ _id: req.params.taskId, ...scope(req) }), req).lean();
  res.json({ success: true, data: { task, recallRequest } });
});
