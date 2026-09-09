import mongoose from "mongoose";

const templateFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 80 },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ["short_text", "long_text", "number", "date", "select", "checkbox"], required: true },
  required: { type: Boolean, default: false },
  options: [{ type: String, trim: true, maxlength: 100 }],
  order: { type: Number, required: true, min: 0 },
}, { _id: false });

const encounterTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  targetType: { type: String, enum: ["visit_type", "specialty"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  fields: { type: [templateFieldSchema], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: true } });

encounterTemplateSchema.index({ tenantId: 1, locationId: 1, targetType: 1, targetId: 1 }, { unique: true });
export const EncounterTemplate = mongoose.model("EncounterTemplate", encounterTemplateSchema);
