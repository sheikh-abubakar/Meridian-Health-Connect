import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, clinicDate, clinicWeekStart, scheduledForDate, shiftDate } from "../src/services/shiftTimeService.js";

test("clinic dates and weeks use Pakistan time", () => {
  assert.equal(clinicDate("2026-09-30T20:00:00Z"), "2026-10-01");
  assert.equal(clinicWeekStart("2026-10-01T10:00:00Z"), "2026-09-28");
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
});

test("overnight shifts end on the next local date", () => {
  const [shift] = scheduledForDate([{ _id: "overnight", staffId: "a", kind: "weekly", dayOfWeek: 4, startTime: "21:00", endTime: "05:00" }], "2026-10-01");
  assert.equal(shift.startAt.toISOString(), shiftDate("2026-10-01", "21:00").toISOString());
  assert.equal(shift.endAt.toISOString(), shiftDate("2026-10-02", "05:00").toISOString());
});

test("single-date override replaces or cancels only that person's weekly shift", () => {
  const weekly = { _id: "a-weekly", staffId: "a", kind: "weekly", dayOfWeek: 4, startTime: "09:00", endTime: "14:00" };
  const colleague = { _id: "b-weekly", staffId: "b", kind: "weekly", dayOfWeek: 4, startTime: "09:00", endTime: "14:00" };
  const replacement = { _id: "a-date", staffId: "a", kind: "date", date: "2026-10-01", startTime: "10:00", endTime: "17:00" };
  assert.deepEqual(scheduledForDate([weekly, colleague, replacement], "2026-10-01").map((item) => item.id), ["b-weekly", "a-date"]);
  assert.deepEqual(scheduledForDate([weekly, colleague, { ...replacement, cancelled: true }], "2026-10-01").map((item) => item.id), ["b-weekly"]);
  assert.deepEqual(scheduledForDate([weekly, colleague, replacement], "2026-10-08").map((item) => item.id), ["a-weekly", "b-weekly"]);
});
