import { Reminder } from "../models/Reminder.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const listReminders = asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId, locationId: req.locationId };
  if (req.query.appointmentId) filter.appointmentId = req.query.appointmentId;
  const reminders = await Reminder.find(filter).sort({ scheduledFor: 1 }).lean();
  res.json({ success: true, data: { reminders } });
});
