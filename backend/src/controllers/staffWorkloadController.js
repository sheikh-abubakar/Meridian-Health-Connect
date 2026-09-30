import { AssignedForm } from "../models/AssignedForm.js";
import { CarePlan } from "../models/CarePlan.js";
import { Location } from "../models/Location.js";
import { Message } from "../models/Message.js";
import { MonitoringEnrollment } from "../models/MonitoringEnrollment.js";
import { MonitoringReading } from "../models/MonitoringReading.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cadenceDays = (value) => {
  const cadence = String(value || "").toLowerCase();
  const amount = Number(cadence.match(/\d+/)?.[0] || 1);
  if (cadence.includes("day")) return amount;
  if (cadence.includes("week")) return amount * 7;
  if (cadence.includes("month")) return amount * 30;
  if (cadence.includes("quarter")) return 90;
  return 30;
};

const countBy = (values, key) => values.reduce((counts, value) => {
  const id = String(value[key] || "");
  if (id) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}, new Map());

export const getStaffWorkload = asyncHandler(async (req, res) => {
  const scope = { tenantId: req.tenantId, locationId: req.locationId };
  const now = new Date();
  const location = await Location.findOne({ _id: req.locationId, tenantId: req.tenantId }).select("schedulingSettings").lean();
  const responseCutoff = new Date(now.getTime() - (location?.schedulingSettings?.patientMessageExpectedResponseHours ?? 24) * 3600000);
  const adherenceCutoff = new Date(now.getTime() - (location?.schedulingSettings?.monitoringAdherenceAfterDays ?? 5) * 86400000);

  const [staff, activeEnrollments, openTasks, carePlans, openReferrals, pendingForms, overduePatientThreads] = await Promise.all([
    User.find({ ...scope, isActive: { $ne: false } }).select("name email role").sort({ role: 1, name: 1 }).lean(),
    MonitoringEnrollment.find({ ...scope, status: "active" }).select("_id enrolledByDoctorId createdAt").lean(),
    Task.find({ ...scope, status: "open" }).select("assignedToUserId").lean(),
    CarePlan.find(scope).select("owningCareTeamMemberId reviewCadence createdAt history.timestamp").lean(),
    Referral.find({ tenantId: req.tenantId, targetLocationId: req.locationId, status: { $in: ["sent", "received"] } }).select("targetDoctorId status").lean(),
    AssignedForm.countDocuments({ ...scope, status: "pending" }),
    Message.aggregate([
      { $match: scope },
      { $sort: { threadId: 1, sentAt: -1 } },
      { $group: { _id: "$threadId", latest: { $first: "$$ROOT" } } },
      { $match: { "latest.senderType": "patient", "latest.sentAt": { $lte: responseCutoff } } },
      { $count: "count" },
    ]),
  ]);

  const enrollmentIds = activeEnrollments.map((item) => item._id);
  const latestReadings = enrollmentIds.length ? await MonitoringReading.aggregate([
    { $match: { ...scope, enrollmentId: { $in: enrollmentIds } } },
    { $sort: { enrollmentId: 1, recordedAt: -1 } },
    { $group: { _id: "$enrollmentId", latest: { $first: "$$ROOT" } } },
  ]) : [];
  const unacknowledgedAlerts = enrollmentIds.length ? await MonitoringReading.find({ ...scope, enrollmentId: { $in: enrollmentIds }, isOutOfRange: true, acknowledgedAlert: false }).select("enrollmentId").lean() : [];

  const enrollmentById = new Map(activeEnrollments.map((item) => [String(item._id), item]));
  const latestByEnrollment = new Map(latestReadings.map((item) => [String(item._id), item.latest]));
  const alertsByDoctor = new Map();
  for (const alert of unacknowledgedAlerts) {
    const owner = enrollmentById.get(String(alert.enrollmentId))?.enrolledByDoctorId;
    if (owner) alertsByDoctor.set(String(owner), (alertsByDoctor.get(String(owner)) || 0) + 1);
  }
  const adherenceNeedingOutreach = activeEnrollments.filter((enrollment) => {
    const latest = latestByEnrollment.get(String(enrollment._id));
    return !latest || new Date(latest.recordedAt) < adherenceCutoff;
  }).length;
  const carePlansReviewDue = countBy(carePlans.filter((plan) => {
    const latestChange = plan.history?.at(-1)?.timestamp || plan.createdAt;
    return now.getTime() - new Date(latestChange).getTime() >= cadenceDays(plan.reviewCadence) * 86400000;
  }), "owningCareTeamMemberId");
  const tasksByAssignee = countBy(openTasks, "assignedToUserId");
  const receivedReferralsByDoctor = countBy(openReferrals.filter((referral) => referral.status === "received"), "targetDoctorId");
  const referralsAwaitingBooking = openReferrals.length;
  const messagesPastResponseTime = overduePatientThreads[0]?.count || 0;

  const workloadFor = (member) => {
    const id = String(member._id);
    if (member.role === "doctor") return [
      { key: "monitoring_alerts", label: "open monitoring alerts", count: alertsByDoctor.get(id) || 0 },
      { key: "referrals", label: "pending referrals", count: receivedReferralsByDoctor.get(id) || 0 },
      { key: "care_plans", label: "care plans review due", count: carePlansReviewDue.get(id) || 0 },
    ];
    if (member.role === "care_coordinator") return [
      { key: "tasks", label: "open tasks", count: tasksByAssignee.get(id) || 0, drillDown: { type: "tasks", assigneeId: id } },
      { key: "monitoring_adherence", label: "monitoring outreach", count: adherenceNeedingOutreach },
      { key: "messages", label: "messages past response time", count: messagesPastResponseTime },
    ];
    if (member.role === "frontdesk") return [
      { key: "forms", label: "pending consent forms", count: pendingForms },
      { key: "referrals", label: "referrals awaiting booking", count: referralsAwaitingBooking },
    ];
    return [];
  };

  res.json({ success: true, data: { staff: staff.map((member) => ({ id: member._id, name: member.name, email: member.email, role: member.role, workload: workloadFor(member) })) } });
});
