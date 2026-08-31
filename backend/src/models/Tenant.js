import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Tenant = mongoose.model("Tenant", tenantSchema);

