import mongoose from "mongoose";

const visitTypeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  specialtyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Specialty", required: true }],
  durationMinutes: { type: Number, required: true, min: 5, max: 480 },
  requiredResourceType: { type: String, enum: ["room", "equipment", "telehealth_link", null], default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

visitTypeSchema.index({ tenantId: 1, locationId: 1, name: 1 }, { unique: true });
export const VisitType = mongoose.model("VisitType", visitTypeSchema);
