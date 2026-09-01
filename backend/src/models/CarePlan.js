import mongoose from "mongoose";

const historySchema = new mongoose.Schema({
  change: { type: String, required: true, trim: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now, immutable: true },
  reason: { type: String, required: true, trim: true },
}, { _id: true });

const carePlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  encounterId: { type: mongoose.Schema.Types.ObjectId, ref: "Encounter", required: true },
  createdByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  goal: { type: String, required: true, trim: true },
  targetMeasure: { type: String, required: true, trim: true },
  reviewCadence: { type: String, required: true, trim: true },
  owningCareTeamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  history: { type: [historySchema], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } });

carePlanSchema.index({ tenantId: 1, locationId: 1, patientId: 1, createdAt: -1 });
carePlanSchema.index({ tenantId: 1, locationId: 1, encounterId: 1 });

export const CarePlan = mongoose.model("CarePlan", carePlanSchema);
