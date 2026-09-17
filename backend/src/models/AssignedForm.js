import mongoose from "mongoose";

const formSnapshotFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const assignedFormSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    formTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "FormTemplate", required: true },
    // A point-in-time copy preserves the exact wording and field order that
    // the patient was asked to acknowledge, even if an Admin edits a template.
    templateSnapshot: {
      // Optional only for assignments created before Batch 5b. New assignments
      // always receive a snapshot; old records safely fall back to the template.
      name: { type: String, trim: true },
      fields: { type: [formSnapshotFieldSchema], default: [] },
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now, immutable: true },
    status: { type: String, enum: ["pending", "completed"], default: "pending", index: true },
    // Batch 5b will populate these only after the patient completes the form.
    responses: { type: mongoose.Schema.Types.Mixed, default: {} },
    signedAt: { type: Date, default: null },
    signatureData: { type: String, default: null },
    signatureIpAddress: { type: String, default: null, maxlength: 128 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

assignedFormSchema.index({ tenantId: 1, locationId: 1, patientId: 1, assignedAt: -1 });

export const AssignedForm = mongoose.model("AssignedForm", assignedFormSchema);
