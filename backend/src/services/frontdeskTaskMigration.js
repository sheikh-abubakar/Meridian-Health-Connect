import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";

export async function migrateLegacyFrontdeskTasks() {
  const staff = await User.find({ role: "frontdesk" }).select("_id tenantId locationId").lean();
  let converted = 0;
  for (const member of staff) {
    const filter = { tenantId: member.tenantId, locationId: member.locationId, assignedToUserId: member._id, type: "general", status: "open", assignmentScope: { $exists: false } };
    const tasks = await Task.find(filter).select("_id").lean();
    for (const task of tasks) {
      const changed = await Task.findOneAndUpdate({ ...filter, _id: task._id }, { $set: { assignmentScope: "frontdesk_shared" } });
      if (!changed) continue;
      converted += 1;
      await AuditLog.create({ tenantId: member.tenantId, locationId: member.locationId, action: "task_migrated_to_frontdesk_queue", targetType: "Task", targetId: task._id });
    }
  }
  if (converted) console.log(`Moved ${converted} open Front-desk general tasks into the shared queue`);
}
