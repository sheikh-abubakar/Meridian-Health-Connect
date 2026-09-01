import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Encounter } from "../models/Encounter.js";
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
  const trendStart = new Date(start);
  trendStart.setUTCDate(trendStart.getUTCDate() - 6);

  const [patientTotal, patientToday, appointmentStatuses, appointmentStatusTotals, doctors, completedTotals, completedToday, appointmentTrend] = await Promise.all([
    Patient.countDocuments(scope),
    Patient.countDocuments({ ...scope, createdAt: { $gte: start, $lte: end } }),
    Appointment.aggregate([
      { $match: { ...scope, scheduledAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: scope },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    User.find({ ...scope, role: "doctor", isActive: { $ne: false } })
      .select("name email")
      .sort({ name: 1 })
      .lean(),
    Encounter.aggregate([
      { $match: { ...scope, status: "finalized" } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
    ]),
    Encounter.aggregate([
      { $match: { ...scope, status: "finalized", finalizedAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: { ...scope, scheduledAt: { $gte: trendStart, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledAt", timezone: "UTC" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(appointmentStatuses.map((entry) => [entry._id, entry.count]));
  const totalStatusCounts = Object.fromEntries(appointmentStatusTotals.map((entry) => [entry._id, entry.count]));
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
      appointmentsByStatus: {
        scheduled: totalStatusCounts.scheduled || 0,
        checkedIn: totalStatusCounts.checked_in || 0,
        completed: totalStatusCounts.completed || 0,
      },
      appointmentsLast7Days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(trendStart);
        date.setUTCDate(date.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        const match = appointmentTrend.find((entry) => entry._id === key);
        return { date: key, count: match?.count || 0 };
      }),
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
