import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true, enum: ["appointment_booked", "referral_received", "referral_booking_needed", "referral_scheduled", "referral_completed"] },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
  targetPath: { type: String, required: true, trim: true, maxlength: 500 },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ tenantId: 1, locationId: 1, recipientUserId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
