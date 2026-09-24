import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  fileName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now, immutable: true },
}, { _id: false });

const labOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  encounterId: { type: mongoose.Schema.Types.ObjectId, ref: "Encounter", required: true, index: true },
  requestedByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  labTestId: { type: mongoose.Schema.Types.ObjectId, ref: "LabTest", required: true },
  testName: { type: String, required: true, trim: true },
  testCode: { type: String, required: true, trim: true },
  preparation: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["requested", "booked", "arrived", "sample_collected", "report_available", "no_show", "cancelled"], default: "requested", index: true },
  scheduledAt: { type: Date, default: null },
  labAttendantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  arrivedAt: { type: Date, default: null },
  collectedAt: { type: Date, default: null },
  report: { type: reportSchema, default: null },
  reportUploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
labOrderSchema.index({ tenantId: 1, locationId: 1, patientId: 1, createdAt: -1 });
labOrderSchema.index({ tenantId: 1, locationId: 1, labAttendantId: 1, scheduledAt: 1 });
export const LabOrder = mongoose.model("LabOrder", labOrderSchema);
