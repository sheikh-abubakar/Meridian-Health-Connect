import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

locationSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Location = mongoose.model("Location", locationSchema);

