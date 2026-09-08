import mongoose from "mongoose";

const specialtySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

specialtySchema.index({ tenantId: 1, name: 1 }, { unique: true });
export const Specialty = mongoose.model("Specialty", specialtySchema);
