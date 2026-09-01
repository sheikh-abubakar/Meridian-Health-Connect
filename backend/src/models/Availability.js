import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false },
);

const availabilitySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slots: { type: [slotSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

availabilitySchema.index(
  { tenantId: 1, locationId: 1, doctorId: 1 },
  { unique: true },
);

export const Availability = mongoose.model("Availability", availabilitySchema);

