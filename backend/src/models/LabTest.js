import mongoose from "mongoose";

const labTestSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  preparation: { type: String, trim: true, maxlength: 1000, default: "No special preparation required." },
  collectionDurationMinutes: { type: Number, min: 15, max: 120, default: 30 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
labTestSchema.index({ tenantId: 1, locationId: 1, code: 1 }, { unique: true });
labTestSchema.index({ tenantId: 1, locationId: 1, isActive: 1, name: 1 });
export const LabTest = mongoose.model("LabTest", labTestSchema);
