import mongoose from "mongoose";
const messageThreadSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  lastMessageAt: { type: Date, default: Date.now },
  escalationsSent: { type: [String], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } });
messageThreadSchema.index({ tenantId: 1, locationId: 1, patientId: 1 }, { unique: true });
export const MessageThread = mongoose.model("MessageThread", messageThreadSchema);
