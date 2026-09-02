import mongoose from "mongoose";

const recallRequestSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  carePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "CarePlan", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, unique: true },
  requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timeframe: { type: String, enum: ["1_week", "2_weeks", "1_month"], required: true },
  note: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ["pending_scheduling", "scheduled", "cancelled"], default: "pending_scheduling" },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
}, { timestamps: { createdAt: true, updatedAt: false } });

recallRequestSchema.index({ tenantId: 1, locationId: 1, status: 1, createdAt: -1 });

export const RecallRequest = mongoose.model("RecallRequest", recallRequestSchema);
