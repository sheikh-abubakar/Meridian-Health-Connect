import assert from "node:assert/strict";
import test from "node:test";
import { appointmentReminderText, normalizePhoneForSms } from "../src/services/moceanSmsService.js";
import { parseClinicDateTime } from "../src/services/availabilityService.js";

test("SMS phone normalization handles Pakistani and international numbers safely", () => {
  assert.equal(normalizePhoneForSms("0300 123 4567"), "923001234567");
  assert.equal(normalizePhoneForSms("+92 300 1234567"), "923001234567");
  assert.equal(normalizePhoneForSms("0044 7700 900123"), "447700900123");
  assert.equal(normalizePhoneForSms("not a phone"), null);
  assert.equal(normalizePhoneForSms("123"), null);
});

test("SMS reminder text contains appointment logistics but no clinical content", () => {
  const text = appointmentReminderText({ locationName: "DHA Branch", visitType: "General consultation", scheduledAt: "2030-01-02T10:00:00.000Z" });
  assert.match(text, /DHA Branch/);
  assert.match(text, /General consultation/);
  assert.match(text, /contact the clinic/i);
});

test("clinic-local booking time is converted from Pakistan time instead of being treated as UTC", () => {
  const parsed = parseClinicDateTime("2026-09-08T19:17");
  assert.equal(parsed.scheduledAt.toISOString(), "2026-09-08T14:17:00.000Z");
  assert.equal(parsed.dayOfWeek, 2);
});
