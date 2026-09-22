import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

export async function notifyStaffUsers({ tenantId, locationId, recipientUserIds, type, title, body, targetPath, targetId, session = null }) {
  const uniqueRecipients = [...new Set((recipientUserIds || []).filter(Boolean).map(String))];
  if (!uniqueRecipients.length) return [];
  const docs = uniqueRecipients.map((recipientUserId) => ({ tenantId, locationId, recipientUserId, type, title, body, targetPath, targetId }));
  return Notification.insertMany(docs, { session: session || undefined, ordered: true });
}

export async function notifyPatient({ tenantId, locationId, patientId, type, title, body, targetPath, targetId, session = null }) {
  if (!patientId) return null;
  const [notification] = await Notification.insertMany([{ tenantId, locationId, recipientPatientId: patientId, type, title, body, targetPath, targetId }], { session: session || undefined, ordered: true });
  return notification;
}

export async function notifyFrontDeskForReferral({ referral, targetPath, session = null }) {
  const staff = await User.find({ tenantId: referral.tenantId, locationId: referral.targetLocationId, role: "frontdesk", isActive: { $ne: false } }).select("_id").session(session || null).lean();
  return notifyStaffUsers({ tenantId: referral.tenantId, locationId: referral.targetLocationId, recipientUserIds: staff.map((user) => user._id), type: "referral_booking_needed", title: "Referral needs appointment booking", body: `Referral for a patient is waiting for scheduling with the receiving Doctor.`, targetPath: targetPath || "/scheduling", targetId: referral._id, session });
}
