import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ["room", "equipment", "telehealth_link"], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
resourceSchema.index({ tenantId: 1, locationId: 1, name: 1 }, { unique: true });
export const Resource = mongoose.model("Resource", resourceSchema);
