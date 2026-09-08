import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  preferredStartDate: { type: Date },
  preferredEndDate: { type: Date },
  note: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });
waitlistSchema.index({ tenantId: 1, locationId: 1, doctorId: 1, createdAt: -1 });
waitlistSchema.index({ tenantId: 1, locationId: 1, patientId: 1, doctorId: 1 }, { unique: true });
export const Waitlist = mongoose.model("Waitlist", waitlistSchema);
