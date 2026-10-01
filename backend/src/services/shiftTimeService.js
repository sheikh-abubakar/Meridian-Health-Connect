export const CLINIC_OFFSET_MS = 5 * 60 * 60 * 1000;
export const clinicDate = (value = new Date()) => new Date(new Date(value).getTime() + CLINIC_OFFSET_MS).toISOString().slice(0, 10);
export const shiftDate = (date, time) => new Date(`${date}T${time}:00+05:00`);
export const addDays = (date, days) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
export const clinicWeekStart = (value = new Date()) => {
  const date = clinicDate(value);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
};
export const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
export const occurrence = (rule, date) => {
  const startAt = shiftDate(date, rule.startTime);
  const endAt = shiftDate(addDays(date, rule.endTime <= rule.startTime ? 1 : 0), rule.endTime);
  return { id: String(rule._id), staffId: String(rule.staffId), date, startTime: rule.startTime, endTime: rule.endTime, startAt, endAt, kind: rule.kind };
};
export const scheduledForDate = (rules, date) => {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const overrides = new Map(rules.filter((rule) => rule.kind === "date" && rule.date === date).map((rule) => [String(rule.staffId), rule]));
  const weekly = rules.filter((rule) => rule.kind === "weekly" && rule.dayOfWeek === weekday && !overrides.has(String(rule.staffId)));
  return [...weekly, ...[...overrides.values()].filter((rule) => !rule.cancelled)].map((rule) => occurrence(rule, date));
};
