import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function utcDayBounds() {
  const date = new Date().toISOString().slice(0, 10);
  return {
    start: new Date(`${date}T00:00:00.000Z`),
    end: new Date(`${date}T23:59:59.999Z`),
  };
}

export const getLocationAnalytics = asyncHandler(async (req, res) => {
  const scope = { tenantId: req.tenantId, locationId: req.locationId };
  const { start, end } = utcDayBounds();

  const [patientTotal, patientToday, appointmentStatuses, doctors, completedTotals, completedToday] = await Promise.all([
    Patient.countDocuments(scope),
    Patient.countDocuments({ ...scope, createdAt: { $gte: start, $lte: end } }),
    Appointment.aggregate([
      { $match: { ...scope, scheduledAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    User.find({ ...scope, role: "doctor", isActive: { $ne: false } })
      .select("name email")
      .sort({ name: 1 })
      .lean(),
    Appointment.aggregate([
      { $match: { ...scope, status: "completed" } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: { ...scope, status: "completed", scheduledAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(appointmentStatuses.map((entry) => [entry._id, entry.count]));
  const totalByDoctor = new Map(completedTotals.map((entry) => [entry._id.toString(), entry.count]));
  const todayByDoctor = new Map(completedToday.map((entry) => [entry._id.toString(), entry.count]));

  res.json({
    success: true,
    data: {
      patients: { today: patientToday, total: patientTotal },
      appointmentsToday: {
        scheduled: statusCounts.scheduled || 0,
        checkedIn: statusCounts.checked_in || 0,
        completed: statusCounts.completed || 0,
      },
      doctors: doctors.map((doctor) => ({
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        completedToday: todayByDoctor.get(doctor._id.toString()) || 0,
        completedTotal: totalByDoctor.get(doctor._id.toString()) || 0,
      })),
    },
  });
});

