import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visitType: { type: String, required: true, trim: true },
    visitTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "VisitType" },
    durationMinutes: { type: Number, required: true, default: 30, min: 5, max: 480 },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "completed", "cancelled", "no_show"],
      default: "scheduled",
    },
    eligibilityStatus: { type: String, enum: ["verified", "pending"], required: true },
    eligibilityCheckedAt: { type: Date, required: true, default: Date.now },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    cancelledAt: { type: Date },
    noShowAt: { type: Date },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", index: true },
    isOverbooked: { type: Boolean, default: false },
    override: {
      reason: { type: String, trim: true, maxlength: 1000 },
      conflictTypes: [{ type: String, enum: ["doctor", "resource"] }],
      conflictingAppointmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Appointment" }],
      actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

appointmentSchema.index({ tenantId: 1, locationId: 1, scheduledAt: 1, status: 1 });
appointmentSchema.index({ tenantId: 1, locationId: 1, resourceId: 1, scheduledAt: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
