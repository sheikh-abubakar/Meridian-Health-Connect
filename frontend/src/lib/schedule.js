export const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatClinicDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  }).format(date);
}

export function formatTime12(value) {
  const [hourText, minute = "00"] = String(value || "00:00").split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

export function isAvailableDateTime(value, slots) {
  if (!value || !slots?.length) return false;
  const [datePart, time] = value.split("T");
  const dayOfWeek = new Date(`${datePart}T00:00:00Z`).getUTCDay();
  return slots.some((slot) => slot.dayOfWeek === dayOfWeek && time >= slot.startTime && time < slot.endTime);
}
