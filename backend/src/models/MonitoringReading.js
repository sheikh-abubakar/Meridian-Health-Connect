import mongoose from "mongoose";

const valueSchema = new mongoose.Schema({ number: Number, systolic: Number, diastolic: Number }, { _id: false });
const assessmentIssueSchema = new mongoose.Schema({ component: String, direction: { type: String, enum: ["low", "high"] }, value: Number, minimum: Number, maximum: Number }, { _id: false });
const monitoringReadingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "MonitoringEnrollment", required: true, index: true },
  value: { type: valueSchema, required: true }, note: { type: String, trim: true, maxlength: 1000, default: "" },
  recordedAt: { type: Date, required: true }, source: { type: String, enum: ["manual_entry"], default: "manual_entry" },
  isOutOfRange: { type: Boolean, default: false }, acknowledgedAlert: { type: Boolean, default: true }, acknowledgementNote: { type: String, trim: true, maxlength: 2000, default: "" }, acknowledgedAt: { type: Date, default: null }, acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  statusText: { type: String, default: "Within target" }, assessmentIssues: { type: [assessmentIssueSchema], default: [] },
}, { timestamps: true });
monitoringReadingSchema.index({ tenantId: 1, locationId: 1, enrollmentId: 1, recordedAt: -1 });
export const MonitoringReading = mongoose.model("MonitoringReading", monitoringReadingSchema);
