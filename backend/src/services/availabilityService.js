import { ApiError } from "../utils/ApiError.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const clinicDateTimePattern = /^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/;
const clinicUtcOffset = "+05:00"; // Meridian's current Pakistan clinic deployment (Asia/Karachi).

export function validateAvailabilitySlots(rawSlots) {
  if (!Array.isArray(rawSlots)) throw new ApiError(400, "Availability slots must be an array");

  const slots = rawSlots.map((slot) => ({
    dayOfWeek: Number(slot.dayOfWeek),
    startTime: String(slot.startTime || ""),
    endTime: String(slot.endTime || ""),
  }));

  for (const slot of slots) {
    if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      throw new ApiError(400, "Each availability day must be between 0 and 6");
    }
    if (!timePattern.test(slot.startTime) || !timePattern.test(slot.endTime)) {
      throw new ApiError(400, "Availability times must use HH:mm format");
    }
    if (slot.startTime >= slot.endTime) {
      throw new ApiError(400, "Availability start time must be before end time");
    }
  }

  const sorted = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
      throw new ApiError(400, "Availability slots cannot overlap");
    }
  }
  return sorted;
}

export function parseClinicDateTime(value) {
  const match = String(value || "").match(clinicDateTimePattern);
  if (!match) throw new ApiError(400, "scheduledAt must use YYYY-MM-DDTHH:mm clinic-local format");

  const [, datePart, time] = match;
  const scheduledAt = new Date(`${datePart}T${time}:00.000${clinicUtcOffset}`);
  const clinicDay = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(scheduledAt.getTime()) || Number.isNaN(clinicDay.getTime())) {
    throw new ApiError(400, "Enter a valid appointment date and time");
  }

  return { scheduledAt, dayOfWeek: clinicDay.getUTCDay(), time };
}

export function isWithinAvailability(slots, dayOfWeek, time) {
  return slots.some((slot) => (
    slot.dayOfWeek === dayOfWeek
    && time >= slot.startTime
    && time < slot.endTime
  ));
}

export function isRangeWithinAvailability(slots, dayOfWeek, startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = (hours * 60) + minutes + Number(durationMinutes);
  if (endMinutes > 24 * 60) return false;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return slots.some((slot) => slot.dayOfWeek === dayOfWeek && startTime >= slot.startTime && endTime <= slot.endTime);
}
