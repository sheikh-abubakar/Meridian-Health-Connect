import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const empty = { description: "", assignedToUserId: "", dueDate: "", type: "general" };
export function TaskForm({ root, headers, carePlanId, onCreated }) {
  const [form, setForm] = useState(empty);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { apiRequest(`${root}/staff-directory`, { headers }).then((data) => setStaff(data.staff || [])).catch((requestError) => setError(requestError.message)); }, [headers, root]);
  const shared = form.assignedToUserId === "frontdesk_shared";
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = await apiRequest(`${root}/tasks`, { method: "POST", headers, body: JSON.stringify({ ...form, assignmentScope: shared ? "frontdesk_shared" : "personal", assignedToUserId: shared ? null : form.assignedToUserId, carePlanId }) });
      setForm(empty); onCreated(data.task);
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  }
  return <form className="space-y-4 rounded-lg border bg-slate-50 p-4" onSubmit={submit}>
    <div className="flex items-center gap-2 text-sm font-semibold"><CalendarPlus className="size-4 text-teal-700" /> Add task</div>
    <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Follow up with patient" required /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Assign to staff or queue</Label><Select value={form.assignedToUserId} onValueChange={(value) => setForm({ ...form, assignedToUserId: value, type: value === "frontdesk_shared" ? "general" : form.type })}><SelectTrigger><SelectValue placeholder="Choose an assignee" /></SelectTrigger><SelectContent><SelectItem value="frontdesk_shared">Front-desk shared queue</SelectItem>{staff.filter((member) => member.role !== "frontdesk").map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required /></div></div>
    {!shared && <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm"><input type="checkbox" checked={form.type === "outreach"} onChange={(event) => setForm({ ...form, type: event.target.checked ? "outreach" : "general" })} className="size-4 accent-teal-700" />Patient outreach task (record an outcome)</label>}
    {shared && <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">Any clocked-in Front-desk member at this branch can complete this general task.</p>}
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={saving || !form.assignedToUserId}>{saving ? "Assigning..." : "Assign task"}</Button>
  </form>;
}
