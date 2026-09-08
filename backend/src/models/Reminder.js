import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  channel: { type: String, enum: ["sms", "email", "voice"], required: true },
  scheduledFor: { type: Date, required: true },
  status: { type: String, enum: ["scheduled", "sent", "skipped_opt_out", "cancelled"], default: "scheduled" },
  sentAt: { type: Date },
  detail: { type: String, trim: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
reminderSchema.index({ tenantId: 1, locationId: 1, appointmentId: 1, channel: 1 }, { unique: true });
reminderSchema.index({ status: 1, scheduledFor: 1 });
export const Reminder = mongoose.model("Reminder", reminderSchema);
