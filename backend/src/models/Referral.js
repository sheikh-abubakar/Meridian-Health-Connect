import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ["sent", "received", "scheduled", "completed"], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorPatientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  timestamp: { type: Date, default: Date.now, immutable: true },
}, { _id: true });

const referralSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  originLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  targetLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  encounterId: { type: mongoose.Schema.Types.ObjectId, ref: "Encounter", required: true },
  referringDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  targetDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 3000 },
  urgency: { type: String, enum: ["routine", "urgent", "emergency"], default: "routine" },
  status: { type: String, enum: ["sent", "received", "scheduled", "completed"], default: "sent", index: true },
  consentCaptured: { type: Boolean, default: false },
  specialistNote: { type: String, default: null, trim: true, maxlength: 5000 },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true });

referralSchema.index({ tenantId: 1, targetLocationId: 1, targetDoctorId: 1, status: 1, createdAt: -1 });
referralSchema.index({ tenantId: 1, originLocationId: 1, patientId: 1, createdAt: -1 });

export const Referral = mongoose.model("Referral", referralSchema);
