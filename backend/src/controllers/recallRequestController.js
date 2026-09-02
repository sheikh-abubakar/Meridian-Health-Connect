import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { AuditLog } from "../models/AuditLog.js";
import { RecallRequest } from "../models/RecallRequest.js";
import { bookAppointment } from "../services/appointmentBookingService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const populateRecall = (query, req) => query
  .populate({ path: "patientId", select: "name contact", match: scope(req) })
  .populate({ path: "doctorId", select: "name email", match: { ...scope(req), role: "doctor" } })
  .populate({ path: "requestedByUserId", select: "name role", match: scope(req) })
  .populate({ path: "carePlanId", select: "goal", match: scope(req) });

export const listRecallRequests = asyncHandler(async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.status) {
    const status = String(req.query.status);
    if (!["pending_scheduling", "scheduled", "cancelled"].includes(status)) throw new ApiError(400, "Invalid recall request status");
    filter.status = status;
  }
  const recallRequests = await populateRecall(RecallRequest.find(filter).sort({ createdAt: -1 }), req).lean();
  res.json({ success: true, data: { recallRequests } });
});

export const scheduleRecallRequest = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let appointmentId;
  try {
    await session.withTransaction(async () => {
      const recall = await RecallRequest.findOne({ _id: req.params.id, status: "pending_scheduling", ...scope(req) }).session(session);
      if (!recall) throw new ApiError(404, "Pending recall request not found in this location");
      const appointment = await bookAppointment({
        tenantId: req.tenantId,
        locationId: req.locationId,
        actorUserId: req.user._id,
        payload: { ...req.body, patientId: recall.patientId, doctorId: recall.doctorId },
        session,
      });
      recall.status = "scheduled";
      recall.appointmentId = appointment._id;
      await recall.save({ session });
      appointmentId = appointment._id;
      await AuditLog.create([{ ...scope(req), actorUserId: req.user._id, action: "recall_request_scheduled", targetType: "RecallRequest", targetId: recall._id }], { session });
    });
  } finally {
    await session.endSession();
  }

  const [recallRequest, appointment] = await Promise.all([
    populateRecall(RecallRequest.findOne({ _id: req.params.id, ...scope(req) }), req).lean(),
    Appointment.findOne({ _id: appointmentId, ...scope(req) }).populate({ path: "patientId", select: "name contact", match: scope(req) }).populate({ path: "doctorId", select: "name email", match: scope(req) }).lean(),
  ]);
  res.status(201).json({ success: true, data: { recallRequest, appointment } });
});
