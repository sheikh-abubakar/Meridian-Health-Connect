import mongoose from "mongoose";
import { AttendanceSession } from "../models/AttendanceSession.js";
import { AuditLog } from "../models/AuditLog.js";
import { ShiftSchedule } from "../models/ShiftSchedule.js";
import { User } from "../models/User.js";
import { addDays, clinicDate, clinicWeekStart, scheduledForDate, shiftDate, validDate, validTime } from "../services/shiftTimeService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const scope = (req) => ({ tenantId: req.tenantId, locationId: req.locationId });
const sessionView = (session, now = new Date()) => ({ id: session._id, staffId: session.staffId, clockInAt: session.clockInAt, clockOutAt: session.clockOutAt, plannedDate: session.plannedDate, plannedStartAt: session.plannedStartAt, plannedEndAt: session.plannedEndAt, workedMinutes: Math.max(0, Math.round(((session.clockOutAt || now) - session.clockInAt) / 60000)), lateMinutes: session.plannedStartAt ? Math.max(0, Math.floor((session.clockInAt - session.plannedStartAt) / 60000)) : null, extraMinutes: session.plannedEndAt ? Math.max(0, Math.floor(((session.clockOutAt || now) - session.plannedEndAt) / 60000)) : null });
const shiftView = (rule) => ({ id: rule._id, staffId: rule.staffId, kind: rule.kind, dayOfWeek: rule.dayOfWeek, date: rule.date, startTime: rule.startTime, endTime: rule.endTime, cancelled: rule.cancelled });
const periodMinutes = (session, from, to, now) => Math.max(0, Math.round((Math.min(new Date(session.clockOutAt || now).getTime(), to.getTime()) - Math.max(new Date(session.clockInAt).getTime(), from.getTime())) / 60000));

export const listShiftSchedule = asyncHandler(async (req, res) => {
  const filter = { ...scope(req), ...(req.user.role === "frontdesk" ? { staffId: req.user._id } : {}) };
  const rules = await ShiftSchedule.find(filter).sort({ kind: 1, dayOfWeek: 1, date: 1 }).lean();
  res.json({ success: true, data: { rules: rules.map(shiftView) } });
});

export const saveShiftSchedule = asyncHandler(async (req, res) => {
  const { staffId, kind, dayOfWeek, date, startTime, endTime } = req.body;
  const cancelled = req.body.cancelled === true;
  if (!mongoose.isValidObjectId(staffId)) throw new ApiError(400, "Choose a valid Front-desk member");
  const staff = await User.exists({ _id: staffId, ...scope(req), role: "frontdesk", isActive: { $ne: false } });
  if (!staff) throw new ApiError(400, "Front-desk member is not active in this branch");
  if (!["weekly", "date"].includes(kind)) throw new ApiError(400, "Choose weekly or single-date shift");
  if (kind === "weekly" && (!Number.isInteger(Number(dayOfWeek)) || Number(dayOfWeek) < 0 || Number(dayOfWeek) > 6 || cancelled)) throw new ApiError(400, "Choose a valid weekday");
  if (kind === "date" && !validDate(date)) throw new ApiError(400, "Choose a valid date");
  if (!cancelled && (!validTime(startTime) || !validTime(endTime) || startTime === endTime)) throw new ApiError(400, "Choose valid and different start/end times");
  const key = { ...scope(req), staffId, kind, ...(kind === "weekly" ? { dayOfWeek: Number(dayOfWeek) } : { date }) };
  const rule = await ShiftSchedule.findOneAndUpdate(key, { $set: { ...key, cancelled, startTime: cancelled ? undefined : startTime, endTime: cancelled ? undefined : endTime, updatedBy: req.user._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "frontdesk_shift_scheduled", targetType: "ShiftSchedule", targetId: rule._id });
  res.json({ success: true, data: { rule: shiftView(rule) } });
});

export const deleteShiftSchedule = asyncHandler(async (req, res) => {
  const rule = await ShiftSchedule.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  if (!rule) throw new ApiError(404, "Shift rule not found in this branch");
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "frontdesk_shift_rule_removed", targetType: "ShiftSchedule", targetId: rule._id });
  res.json({ success: true, data: { removedId: rule._id } });
});

export const myShift = asyncHandler(async (req, res) => {
  const now = new Date(); const today = clinicDate(now);
  const [rules, active, latest] = await Promise.all([
    ShiftSchedule.find({ ...scope(req), staffId: req.user._id }).lean(),
    AttendanceSession.findOne({ ...scope(req), staffId: req.user._id, clockOutAt: null }).lean(),
    AttendanceSession.findOne({ ...scope(req), staffId: req.user._id }).sort({ clockInAt: -1 }).lean(),
  ]);
  const upcoming = [today, addDays(today, 1), addDays(today, 2)].flatMap((date) => scheduledForDate(rules, date)).filter((shift) => shift.startAt > now).sort((a, b) => a.startAt - b.startAt);
  res.json({ success: true, data: { active: active ? sessionView(active, now) : null, latest: latest ? sessionView(latest, now) : null, upcoming } });
});

export const clockIn = asyncHandler(async (req, res) => {
  const now = new Date(); const today = clinicDate(now);
  const rules = await ShiftSchedule.find({ ...scope(req), staffId: req.user._id }).lean();
  const candidates = [addDays(today, -1), today, addDays(today, 1)].flatMap((date) => scheduledForDate(rules, date))
    .filter((shift) => now >= new Date(shift.startAt.getTime() - 2 * 3600000) && now < shift.endAt)
    .sort((a, b) => Math.abs(now - a.startAt) - Math.abs(now - b.startAt));
  const planned = candidates[0];
  try {
    const session = await AttendanceSession.create({ ...scope(req), staffId: req.user._id, clockInAt: now, clockOutAt: null, plannedDate: planned?.date || null, plannedStartAt: planned?.startAt || null, plannedEndAt: planned?.endAt || null });
    await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "frontdesk_clocked_in", targetType: "AttendanceSession", targetId: session._id });
    res.status(201).json({ success: true, data: { session: sessionView(session, now) } });
  } catch (error) { if (error?.code === 11000) throw new ApiError(409, "You are already clocked in"); throw error; }
});

export const clockOut = asyncHandler(async (req, res) => {
  const now = new Date();
  const session = await AttendanceSession.findOneAndUpdate({ ...scope(req), staffId: req.user._id, clockOutAt: null }, { $set: { clockOutAt: now } }, { new: true });
  if (!session) throw new ApiError(409, "Clock in before clocking out");
  await AuditLog.create({ ...scope(req), actorUserId: req.user._id, action: "frontdesk_clocked_out", targetType: "AttendanceSession", targetId: session._id });
  res.json({ success: true, data: { session: sessionView(session, now) } });
});

export const attendanceReport = asyncHandler(async (req, res) => {
  const now = new Date(); const today = clinicDate(now);
  const weekStart = req.query.weekStart || clinicWeekStart(now);
  if (!validDate(weekStart) || clinicWeekStart(shiftDate(weekStart, "12:00")) !== weekStart) throw new ApiError(400, "Choose a Monday for the report week");
  const weekEnd = addDays(weekStart, 7);
  const from = shiftDate(weekStart, "00:00"); const to = shiftDate(weekEnd, "00:00");
  const todayFrom = shiftDate(today, "00:00"); const todayTo = shiftDate(addDays(today, 1), "00:00");
  const [staff, rules, sessions] = await Promise.all([
    User.find({ ...scope(req), role: "frontdesk", isActive: { $ne: false } }).select("name email").sort({ name: 1 }).lean(),
    ShiftSchedule.find(scope(req)).lean(),
    AttendanceSession.find({ ...scope(req), clockInAt: { $lt: to }, $or: [{ clockOutAt: null }, { clockOutAt: { $gt: from } }] }).sort({ clockInAt: 1 }).lean(),
  ]);
  const shifts = Array.from({ length: 7 }, (_, day) => scheduledForDate(rules, addDays(weekStart, day))).flat();
  const rows = staff.map((member) => {
    const ownSessions = sessions.filter((session) => String(session.staffId) === String(member._id));
    const ownShifts = shifts.filter((shift) => shift.staffId === String(member._id));
    const weekMinutes = ownSessions.reduce((sum, session) => sum + periodMinutes(session, from, to, now), 0);
    const todayMinutes = ownSessions.reduce((sum, session) => sum + periodMinutes(session, todayFrom, todayTo, now), 0);
    return { id: member._id, name: member.name, email: member.email, weekMinutes, todayMinutes,
      sessions: ownSessions.map((session) => sessionView(session, now)),
      shifts: ownShifts.map((shift) => ({ ...shift, absent: shift.endAt < now && !ownSessions.some((session) => new Date(session.clockInAt) < shift.endAt && new Date(session.clockOutAt || now) > shift.startAt) })) };
  });
  res.json({ success: true, data: { weekStart, weekEnd, today, graceMinutes: 10, staff: rows } });
});

export const coverageStatus = asyncHandler(async (req, res) => {
  const now = new Date(); const today = clinicDate(now);
  const [rules, active] = await Promise.all([
    ShiftSchedule.find(scope(req)).lean(),
    AttendanceSession.find({ ...scope(req), clockOutAt: null }).select("staffId").lean(),
  ]);
  const scheduled = [addDays(today, -1), today].flatMap((date) => scheduledForDate(rules, date)).filter((shift) => shift.startAt <= now && now < shift.endAt);
  const activeStaff = await User.countDocuments({ ...scope(req), role: "frontdesk", isActive: { $ne: false }, _id: { $in: active.map((item) => item.staffId) } });
  res.json({ success: true, data: { gap: scheduled.length > 0 && activeStaff === 0, expectedStaff: scheduled.length, activeStaff } });
});
