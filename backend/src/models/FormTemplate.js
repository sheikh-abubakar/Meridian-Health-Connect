import mongoose from "mongoose";

const formFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["static_text", "checkbox", "short_text", "yes_no", "signature"],
    },
    label: { type: String, required: true, trim: true, maxlength: 500 },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const formTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    fields: { type: [formFieldSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

formTemplateSchema.index({ tenantId: 1, locationId: 1, name: 1 }, { unique: true });

export const FormTemplate = mongoose.model("FormTemplate", formTemplateSchema);
