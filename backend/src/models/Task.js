import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  carePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "CarePlan", required: true },
  description: { type: String, required: true, trim: true },
  assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ["open", "completed"], default: "open" },
  outcomeNote: { type: String, trim: true, maxlength: 5000 },
  completedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });

taskSchema.index({ tenantId: 1, locationId: 1, assignedToUserId: 1, status: 1, dueDate: 1 });
taskSchema.index({ tenantId: 1, locationId: 1, carePlanId: 1, createdAt: 1 });

export const Task = mongoose.model("Task", taskSchema);
