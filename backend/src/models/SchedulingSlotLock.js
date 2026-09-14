import mongoose from "mongoose";

// One document represents one occupied calendar minute for a doctor or resource.
// The unique index is the final, database-enforced protection against double booking.
const schedulingSlotLockSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  capacityKey: { type: String, required: true },
  slotAt: { type: Date, required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

schedulingSlotLockSchema.index({ tenantId: 1, locationId: 1, capacityKey: 1, slotAt: 1 }, { unique: true });
schedulingSlotLockSchema.index({ tenantId: 1, locationId: 1, appointmentId: 1 });

export const SchedulingSlotLock = mongoose.model("SchedulingSlotLock", schedulingSlotLockSchema);
