import mongoose from "mongoose";

const shiftScheduleSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["weekly", "date"], required: true },
  dayOfWeek: { type: Number, min: 0, max: 6 },
  date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  cancelled: { type: Boolean, default: false },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

shiftScheduleSchema.index({ tenantId: 1, locationId: 1, staffId: 1, kind: 1, dayOfWeek: 1 }, { unique: true, partialFilterExpression: { kind: "weekly" } });
shiftScheduleSchema.index({ tenantId: 1, locationId: 1, staffId: 1, kind: 1, date: 1 }, { unique: true, partialFilterExpression: { kind: "date" } });
export const ShiftSchedule = mongoose.model("ShiftSchedule", shiftScheduleSchema);
