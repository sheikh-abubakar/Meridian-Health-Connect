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
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    address: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

locationSchema.index({ tenantId: 1, slug: 1 }, { unique: true, sparse: true });
locationSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Location = mongoose.model("Location", locationSchema);
