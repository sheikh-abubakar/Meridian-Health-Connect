import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    name: { type: String, required: true, trim: true },
    contact: {
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    address: { type: String, required: true, trim: true },
    insuranceInfo: {
      provider: { type: String, trim: true },
      policyNumber: { type: String, trim: true },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

patientSchema.index({ tenantId: 1, locationId: 1, createdAt: -1 });
patientSchema.index({ tenantId: 1, locationId: 1, "contact.phone": 1 });
patientSchema.index({ tenantId: 1, locationId: 1, name: 1 });

export const Patient = mongoose.model("Patient", patientSchema);
