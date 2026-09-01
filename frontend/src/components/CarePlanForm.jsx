import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const empty = { goal: "", targetMeasure: "", reviewCadence: "", owningCareTeamMemberId: "" };
const roleLabel = { doctor: "Doctor", frontdesk: "Front-desk", care_coordinator: "Care Coordinator" };

export function CarePlanForm({ root, headers, encounterId, onCreated }) {
  const [form, setForm] = useState(empty);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { apiRequest(`${root}/staff-directory`, { headers }).then((data) => setStaff(data.staff.filter((member) => ["doctor", "care_coordinator"].includes(member.role)))).catch((requestError) => setError(requestError.message)); }, [headers, root]);
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setError(""); }
  async function submit(event) {
    event.preventDefault(); setSubmitting(true); setError("");
    try { const data = await apiRequest(`${root}/careplans`, { method: "POST", headers, body: JSON.stringify({ ...form, encounterId }) }); setForm(empty); onCreated(data.carePlan); }
    catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }
  return <form className="space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="care-goal">Care goal</Label><Textarea id="care-goal" className="min-h-24" value={form.goal} onChange={(event) => update("goal", event.target.value)} placeholder="What outcome should the care team help the patient achieve?" required /></div><div className="space-y-2"><Label htmlFor="target-measure">Target measure</Label><Input id="target-measure" value={form.targetMeasure} onChange={(event) => update("targetMeasure", event.target.value)} placeholder="e.g. BP below 130/80" required /></div><div className="space-y-2"><Label htmlFor="review-cadence">Review cadence</Label><Input id="review-cadence" value={form.reviewCadence} onChange={(event) => update("reviewCadence", event.target.value)} placeholder="e.g. Every 2 weeks" required /></div><div className="space-y-2 sm:col-span-2"><Label>Owning care-team member</Label><Select value={form.owningCareTeamMemberId} onValueChange={(value) => update("owningCareTeamMemberId", value)}><SelectTrigger><SelectValue placeholder="Select active staff member" /></SelectTrigger><SelectContent>{staff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · {roleLabel[member.role]}</SelectItem>)}</SelectContent></Select></div></div>{error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800" disabled={submitting || !form.owningCareTeamMemberId}><HeartHandshake className="mr-2 size-4" />{submitting ? "Creating care plan…" : "Create Care Plan"}</Button></form>;
}
