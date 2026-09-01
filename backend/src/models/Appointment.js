import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visitType: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "completed", "cancelled"],
      default: "scheduled",
    },
    eligibilityStatus: { type: String, enum: ["verified", "pending"], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

appointmentSchema.index(
  { tenantId: 1, locationId: 1, doctorId: 1, scheduledAt: 1 },
  { unique: true },
);
appointmentSchema.index({ tenantId: 1, locationId: 1, scheduledAt: 1, status: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);

