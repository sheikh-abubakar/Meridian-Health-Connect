import { AuditLog } from "../models/AuditLog.js";
import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { Reminder } from "../models/Reminder.js";

export async function processDueReminders() {
  const due = await Reminder.find({ status: "scheduled", scheduledFor: { $lte: new Date() } }).limit(100);
  for (const reminder of due) {
    const [appointment, patient] = await Promise.all([
      Appointment.findOne({ _id: reminder.appointmentId, tenantId: reminder.tenantId, locationId: reminder.locationId }).lean(),
      Patient.findOne({ _id: reminder.patientId, tenantId: reminder.tenantId, locationId: reminder.locationId }).lean(),
    ]);
    if (!appointment || appointment.status !== "scheduled") {
      await Reminder.updateOne({ _id: reminder._id, status: "scheduled" }, { $set: { status: "cancelled", detail: "Reminder cancelled because appointment is no longer scheduled." } });
      continue;
    }
    const optedOut = Boolean(patient?.communicationPreferences?.[`${reminder.channel}OptOut`]);
    const result = await Reminder.updateOne({ _id: reminder._id, status: "scheduled" }, { $set: optedOut ? { status: "skipped_opt_out", detail: `Patient opted out of ${reminder.channel} reminders.` } : { status: "sent", sentAt: new Date(), detail: `Simulated ${reminder.channel} reminder sent to patient contact.` } });
    if (result.modifiedCount && !optedOut) await AuditLog.create({ tenantId: reminder.tenantId, locationId: reminder.locationId, actorUserId: appointment.createdBy, action: "reminder_simulated_sent", targetType: "Appointment", targetId: appointment._id });
  }
}

export function startReminderWorker() {
  const run = () => processDueReminders().catch((error) => console.error("Reminder worker error", error.message));
  run();
  return setInterval(run, 60000);
}
