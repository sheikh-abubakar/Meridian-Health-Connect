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
    schedulingSettings: {
      maxOverbookSlotsPerDoctorPerDay: { type: Number, default: 0, min: 0, max: 20 },
      reminderRules: {
        type: [{ channel: { type: String, enum: ["sms", "email", "voice"], required: true }, offsetHours: { type: Number, required: true, min: 0, max: 8760 } }],
        default: () => [{ channel: "sms", offsetHours: 48 }, { channel: "email", offsetHours: 24 }],
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

locationSchema.index({ tenantId: 1, slug: 1 }, { unique: true, sparse: true });
locationSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Location = mongoose.model("Location", locationSchema);
