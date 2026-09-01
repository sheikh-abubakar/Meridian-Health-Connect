import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const standardMinutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function parseTime(value) {
  const [hourText = "09", minute = "00"] = String(value || "09:00").split(":");
  const hour24 = Number(hourText);
  return {
    hour: String(hour24 % 12 || 12),
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function toTime24(hour, minute, period) {
  let hour24 = Number(hour) % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function TimeSelect({ value, onChange, disabled = false, label }) {
  const parsed = parseTime(value);
  const minutes = standardMinutes.includes(parsed.minute)
    ? standardMinutes
    : [...standardMinutes, parsed.minute].sort();
  function update(changes) {
    const next = { ...parsed, ...changes };
    onChange(toTime24(next.hour, next.minute, next.period));
  }

  return <div className="grid min-w-0 flex-1 grid-cols-[1fr_1fr_1.15fr] gap-2" aria-label={label}>
    <Select value={parsed.hour} onValueChange={(hour) => update({ hour })} disabled={disabled}><SelectTrigger aria-label={`${label} hour`}><SelectValue /></SelectTrigger><SelectContent>{hours.map((hour) => <SelectItem value={hour} key={hour}>{hour}</SelectItem>)}</SelectContent></Select>
    <Select value={parsed.minute} onValueChange={(minute) => update({ minute })} disabled={disabled}><SelectTrigger aria-label={`${label} minute`}><SelectValue /></SelectTrigger><SelectContent>{minutes.map((minute) => <SelectItem value={minute} key={minute}>{minute}</SelectItem>)}</SelectContent></Select>
    <Select value={parsed.period} onValueChange={(period) => update({ period })} disabled={disabled}><SelectTrigger aria-label={`${label} period`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent></Select>
  </div>;
}

