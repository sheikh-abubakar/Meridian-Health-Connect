import mongoose from "mongoose";
const messageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageThread", required: true, index: true },
  senderType: { type: String, enum: ["patient", "staff"], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  sentAt: { type: Date, default: Date.now },
  readAt: { type: Date },
}, { versionKey: false });
messageSchema.index({ tenantId: 1, locationId: 1, threadId: 1, sentAt: 1 });
export const Message = mongoose.model("Message", messageSchema);
