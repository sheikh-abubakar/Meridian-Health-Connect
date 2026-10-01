import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clockInAt: { type: Date, required: true, immutable: true },
  clockOutAt: { type: Date, default: null },
  plannedDate: { type: String, default: null },
  plannedStartAt: { type: Date, default: null },
  plannedEndAt: { type: Date, default: null },
}, { timestamps: true });

attendanceSessionSchema.index({ staffId: 1, clockOutAt: 1 }, { name: "one_open_attendance_per_staff", unique: true, partialFilterExpression: { clockOutAt: null } });
export const AttendanceSession = mongoose.model("AttendanceSession", attendanceSessionSchema);
