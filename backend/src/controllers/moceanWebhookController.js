import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AuditLog } from "../models/AuditLog.js";
import { Reminder } from "../models/Reminder.js";

function validSecret(value) {
  const expected = Buffer.from(String(env.moceanDlrWebhookSecret || ""));
  const received = Buffer.from(String(value || ""));
  return expected.length > 0 && expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

const receiptState = { "1": "delivered", "2": "failed", "3": "expired" };

export async function receiveMoceanDeliveryReceipt(req, res) {
  if (!validSecret(req.params.secret)) return res.sendStatus(404);
  const messageId = String(req.body?.["mocean-msgid"] || req.query?.["mocean-msgid"] || "").trim();
  const providerStatus = String(req.body?.["mocean-dlr-status"] || req.query?.["mocean-dlr-status"] || "").trim();
  const errorCode = String(req.body?.["mocean-error-code"] || req.query?.["mocean-error-code"] || "").trim();
  if (!messageId || !receiptState[providerStatus]) return res.sendStatus(200);

  const status = receiptState[providerStatus];
  const update = {
    status,
    providerStatus,
    providerErrorCode: errorCode || undefined,
    deliveredAt: status === "delivered" ? new Date() : undefined,
    detail: status === "delivered" ? "SMS delivered to the recipient handset." : `SMS ${status}${errorCode ? ` (provider code ${errorCode})` : ""}.`,
  };
  const reminder = await Reminder.findOneAndUpdate(
    { provider: "mocean", providerMessageId: messageId, status: "submitted" },
    { $set: update },
    { new: true },
  ).lean();
  if (reminder) {
    await AuditLog.create({
      tenantId: reminder.tenantId,
      locationId: reminder.locationId,
      actorUserId: reminder.actorUserId,
      action: status === "delivered" ? "reminder_sms_delivered" : "reminder_sms_failed",
      targetType: "Appointment",
      targetId: reminder.appointmentId,
    }).catch(() => undefined);
  }
  return res.sendStatus(200);
}
