import mongoose from "mongoose";

export const userRoles = ["admin", "frontdesk", "doctor", "care_coordinator"];

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoles, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, locationId: 1, role: 1 });

export const User = mongoose.model("User", userSchema);
