import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  channel: { type: String, enum: ["sms", "email", "voice"], required: true },
  scheduledFor: { type: Date, required: true },
  status: { type: String, enum: ["scheduled", "sending", "submitted", "delivered", "failed", "expired", "skipped_opt_out", "skipped_invalid_contact", "cancelled"], default: "scheduled" },
  sentAt: { type: Date },
  submittedAt: { type: Date },
  deliveredAt: { type: Date },
  provider: { type: String, enum: ["mocean"] },
  providerMessageId: { type: String, trim: true, index: true },
  providerStatus: { type: String, trim: true },
  providerErrorCode: { type: String, trim: true },
  attemptCount: { type: Number, default: 0, min: 0 },
  detail: { type: String, trim: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
reminderSchema.index({ tenantId: 1, locationId: 1, appointmentId: 1, channel: 1 }, { unique: true });
reminderSchema.index({ status: 1, scheduledFor: 1 });
reminderSchema.index({ provider: 1, providerMessageId: 1 }, { sparse: true });
export const Reminder = mongoose.model("Reminder", reminderSchema);
