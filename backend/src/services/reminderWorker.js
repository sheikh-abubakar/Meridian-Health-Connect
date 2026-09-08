import { AuditLog } from "../models/AuditLog.js";
import { env } from "../config/env.js";
import { Appointment } from "../models/Appointment.js";
import { Location } from "../models/Location.js";
import { Patient } from "../models/Patient.js";
import { Reminder } from "../models/Reminder.js";
import { appointmentReminderText, MoceanSmsError, normalizePhoneForSms, sendMoceanSms } from "./moceanSmsService.js";

const retryDelayMs = 5 * 60 * 1000;
const maxAttempts = 3;

async function setReminder(reminderId, values) {
  return Reminder.findOneAndUpdate({ _id: reminderId, status: "sending" }, { $set: values }, { new: true }).lean();
}

async function audit(reminder, action) {
  await AuditLog.create({
    tenantId: reminder.tenantId,
    locationId: reminder.locationId,
    actorUserId: reminder.actorUserId,
    action,
    targetType: "Appointment",
    targetId: reminder.appointmentId,
  });
}

async function processSmsReminder(candidate) {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: candidate._id, status: "scheduled" },
    { $set: { status: "sending", detail: "Submitting SMS reminder to provider." }, $inc: { attemptCount: 1 } },
    { new: true },
  ).lean();
  if (!reminder) return;

  const [appointment, patient, location] = await Promise.all([
    Appointment.findOne({ _id: reminder.appointmentId, tenantId: reminder.tenantId, locationId: reminder.locationId }).lean(),
    Patient.findOne({ _id: reminder.patientId, tenantId: reminder.tenantId, locationId: reminder.locationId }).lean(),
    Location.findOne({ _id: reminder.locationId, tenantId: reminder.tenantId }).lean(),
  ]);
  if (!appointment || appointment.status !== "scheduled") {
    await setReminder(reminder._id, { status: "cancelled", detail: "SMS reminder cancelled because appointment is no longer scheduled." });
    return;
  }
  if (patient?.communicationPreferences?.smsOptOut) {
    const updated = await setReminder(reminder._id, { status: "skipped_opt_out", detail: "Patient opted out of SMS reminders." });
    if (updated) await audit(updated, "reminder_sms_skipped_opt_out");
    return;
  }
  const phone = normalizePhoneForSms(patient?.contact?.phone);
  if (!phone) {
    const updated = await setReminder(reminder._id, { status: "skipped_invalid_contact", detail: "SMS was not sent because the patient phone number is invalid." });
    if (updated) await audit(updated, "reminder_sms_invalid_contact");
    return;
  }

  try {
    const result = await sendMoceanSms({
      to: phone,
      text: appointmentReminderText({ locationName: location?.name || "Meridian Health", visitType: appointment.visitType, scheduledAt: appointment.scheduledAt }),
    });
    const now = new Date();
    const updated = await setReminder(reminder._id, { status: "submitted", provider: "mocean", providerMessageId: result.messageId, submittedAt: now, sentAt: now, detail: "SMS accepted by Mocean; awaiting delivery receipt." });
    if (updated) await audit(updated, "reminder_sms_submitted");
  } catch (error) {
    const retry = error instanceof MoceanSmsError && error.retryable && reminder.attemptCount < maxAttempts;
    const updated = await setReminder(reminder._id, retry
      ? { status: "scheduled", scheduledFor: new Date(Date.now() + retryDelayMs), detail: "SMS provider was unavailable; retry scheduled." }
      : { status: "failed", provider: "mocean", providerErrorCode: error?.code || undefined, detail: `SMS was not sent: ${error?.message || "Provider error."}` });
    if (updated && !retry) await audit(updated, "reminder_sms_failed");
  }
}

export async function processDueReminders() {
  // A deployment without provider credentials must leave scheduled reminders untouched.
  if (!env.moceanSmsEnabled) return;
  const due = await Reminder.find({ channel: "sms", status: "scheduled", scheduledFor: { $lte: new Date() } }).sort({ scheduledFor: 1 }).limit(100).lean();
  for (const reminder of due) await processSmsReminder(reminder);
}

export function startReminderWorker() {
  const run = () => processDueReminders().catch((error) => console.error("Reminder worker error", error.message));
  run();
  return setInterval(run, 60000);
}
