import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaskForm({ root, headers, carePlanId, onCreated }) {
  const [form, setForm] = useState({ description: "", assignedToUserId: "", dueDate: "" });
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { apiRequest(`${root}/staff-directory`, { headers }).then((data) => setStaff(data.staff)).catch((requestError) => setError(requestError.message)); }, [headers, root]);
  async function submit(event) { event.preventDefault(); setSaving(true); setError(""); try { const data = await apiRequest(`${root}/tasks`, { method: "POST", headers, body: JSON.stringify({ ...form, carePlanId }) }); setForm({ description: "", assignedToUserId: "", dueDate: "" }); onCreated(data.task); } catch (requestError) { setError(requestError.message); } finally { setSaving(false); } }
  return <form className="space-y-4 rounded-lg border bg-slate-50 p-4" onSubmit={submit}><div className="flex items-center gap-2 text-sm font-semibold"><CalendarPlus className="size-4 text-teal-700" /> Add task</div><div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Follow up with patient…" required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Assign to staff</Label><Select value={form.assignedToUserId} onValueChange={(value) => setForm((current) => ({ ...current, assignedToUserId: value }))}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · {member.role.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required /></div></div>{error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={saving || !form.assignedToUserId}>{saving ? "Assigning…" : "Assign task"}</Button></form>;
}
