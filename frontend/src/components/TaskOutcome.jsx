import { MessageSquareText } from "lucide-react";

const dateLabel = (value) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(value));

export function TaskOutcome({ task }) {
  if (task.status !== "completed" || !task.outcomeNote) return null;
  return <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-teal-700" /><span><span className="font-medium text-slate-600">Note:</span> {task.outcomeNote} — completed by {task.assignedToUserId?.name || "Staff member"}{task.completedAt ? `, ${dateLabel(task.completedAt)}` : ""}</span></p>;
}
