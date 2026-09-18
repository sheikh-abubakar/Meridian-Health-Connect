import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const present = (item) => ({ id: item._id, type: item.type, title: item.title, body: item.body, targetPath: item.targetPath, targetId: item.targetId, createdAt: item.createdAt, readAt: item.readAt });

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ tenantId: req.tenantId, locationId: req.locationId, recipientUserId: req.user._id, readAt: null }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ success: true, data: { notifications: notifications.map(present) } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, locationId: req.locationId, recipientUserId: req.user._id, readAt: null }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) throw new ApiError(404, "Notification not found");
  res.json({ success: true, data: { notification: present(notification) } });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ tenantId: req.tenantId, locationId: req.locationId, recipientUserId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true, data: { cleared: true } });
});
