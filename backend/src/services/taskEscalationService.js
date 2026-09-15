import { AuditLog } from "../models/AuditLog.js";
import { Location } from "../models/Location.js";
import { Task } from "../models/Task.js";
import { MessageThread } from "../models/MessageThread.js";
import { Message } from "../models/Message.js";
import { locationRoom, userRoom } from "../realtime/socketServer.js";

const dayMs = 24 * 60 * 60 * 1000;
export function taskEscalation(task, settings = {}, now = new Date()) {
  const due = new Date(task.dueDate); const lateMs = now.getTime() - due.getTime();
  const isOverdue = task.status === "open" && lateMs > 0;
  const daysOverdue = isOverdue ? Math.max(0, Math.floor(lateMs / dayMs)) : 0;
  const tier2Days = Number(settings.escalateToCreatorAfterDays ?? 3);
  const tier3Days = Number(settings.flagToAdminAfterDays ?? 5);
  const escalationLevel = !isOverdue ? 0 : lateMs >= tier3Days * dayMs ? 3 : lateMs >= tier2Days * dayMs ? 2 : 1;
  return { isOverdue, daysOverdue, escalationLevel, thresholds: { tier2Days, tier3Days } };
}

export function decorateTask(task, settings, now) { return { ...task, ...taskEscalation(task, settings, now) }; }

export async function processTaskEscalations(io) {
  const now = new Date();
  const locations = await Location.find({}).select("_id tenantId schedulingSettings").lean();
  for (const location of locations) {
    const settings = location.schedulingSettings || {};
    const tasks = await Task.find({ tenantId: location.tenantId, locationId: location._id, status: "open", dueDate: { $lt: now } }).select("description dueDate assignedByUserId assignedToUserId escalationsSent").lean();
    for (const task of tasks) {
      const { escalationLevel, daysOverdue } = taskEscalation(task, settings, now);
      for (const [tier, level] of [["tier2", 2], ["tier3", 3]]) {
        if (escalationLevel < level || task.escalationsSent?.includes(tier)) continue;
        const claimed = await Task.findOneAndUpdate({ _id: task._id, tenantId: location.tenantId, locationId: location._id, status: "open", escalationsSent: { $ne: tier } }, { $addToSet: { escalationsSent: tier } }, { new: true }).lean();
        if (!claimed) continue;
        await AuditLog.create({ tenantId: location.tenantId, locationId: location._id, actorUserId: task.assignedByUserId, action: `task_escalated_${tier}`, targetType: "Task", targetId: task._id });
        const payload = { taskId: String(task._id), tier: level, description: task.description, daysOverdue, assigneeId: String(task.assignedToUserId), creatorId: String(task.assignedByUserId), occurredAt: now.toISOString() };
        if (tier === "tier2") io.to(userRoom(location.tenantId, task.assignedByUserId)).emit("task:escalated", payload);
        if (tier === "tier3") io.to(locationRoom(location.tenantId, location._id)).emit("task:escalated", payload);
      }
    }
  }
  for (const location of locations) {
    const settings = location.schedulingSettings || {}; const expected = Number(settings.patientMessageExpectedResponseHours ?? 24); const admin = Number(settings.patientMessageFlagToAdminAfterHours ?? 48);
    const threads = await MessageThread.find({ tenantId: location.tenantId, locationId: location._id }).lean();
    for (const thread of threads) {
      const latest = await Message.findOne({ threadId: thread._id, tenantId: location.tenantId, locationId: location._id }).sort({ sentAt: -1 }).lean();
      if (!latest || latest.senderType !== "patient") continue;
      const elapsed = Date.now() - new Date(latest.sentAt).getTime();
      for (const [key, hours] of [["staff_due", expected], ["admin_flagged", admin]]) {
        if (elapsed < hours * 3600000 || thread.escalationsSent?.includes(key)) continue;
        const claimed = await MessageThread.findOneAndUpdate({ _id: thread._id, escalationsSent: { $ne: key } }, { $addToSet: { escalationsSent: key } }, { new: true }).lean(); if (!claimed) continue;
        await AuditLog.create({ tenantId: location.tenantId, locationId: location._id, actorPatientId: thread.patientId, action: `patient_message_escalated_${key}`, targetType: "MessageThread", targetId: thread._id });
        const payload = { threadId: String(thread._id), patientId: String(thread.patientId), tier: key, occurredAt: now.toISOString() };
        io.to(locationRoom(location.tenantId, location._id)).emit("message:escalated", payload);
      }
    }
  }
}

export function startTaskEscalationWorker(io) {
  const run = () => processTaskEscalations(io).catch((error) => console.error("Task escalation worker error", error.message));
  run();
  return setInterval(run, 15 * 60 * 1000);
}
