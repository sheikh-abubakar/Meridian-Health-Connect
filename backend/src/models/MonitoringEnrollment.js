import mongoose from "mongoose";

const targetRangeSchema = new mongoose.Schema({
  min: { type: Number }, max: { type: Number },
  systolicMin: { type: Number }, systolicMax: { type: Number },
  diastolicMin: { type: Number }, diastolicMax: { type: Number },
}, { _id: false });

const monitoringEnrollmentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  enrolledByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["blood_pressure", "blood_sugar", "weight", "pulse_oximeter"], required: true },
  targetRange: { type: targetRangeSchema, required: true },
  status: { type: String, enum: ["active", "completed"], default: "active", index: true },
  lastReviewedAt: { type: Date, default: Date.now },
  reviewReminderSentFor: { type: Date, default: null },
  adherenceReminderSentFor: { type: Date, default: null },
  closingNote: { type: String, default: null, trim: true, maxlength: 3000 },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });
monitoringEnrollmentSchema.index({ tenantId: 1, locationId: 1, patientId: 1, status: 1 });
export const MonitoringEnrollment = mongoose.model("MonitoringEnrollment", monitoringEnrollmentSchema);
