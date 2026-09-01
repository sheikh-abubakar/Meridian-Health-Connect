import { useState } from "react";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyForm = { name: "", phone: "", email: "", address: "", insuranceProvider: "", policyNumber: "" };

export function PatientCreateForm({ basePath, headers, initialQuery = "", onBack, onCreated, onViewExisting }) {
  const [form, setForm] = useState({ ...emptyForm, [/\d/.test(initialQuery) ? "phone" : "name"]: initialQuery });
  const [duplicate, setDuplicate] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setDuplicate(null); setError(""); }
  async function create(allowDuplicate = false) {
    setSubmitting(true); setError("");
    try {
      if (!allowDuplicate) {
        const matches = await apiRequest(`${basePath}/search?phone=${encodeURIComponent(form.phone.trim())}`, { headers });
        const exact = matches.patients.find((patient) => patient.phone.trim().toLowerCase() === form.phone.trim().toLowerCase());
        if (exact) { setDuplicate(exact); return; }
      }
      const data = await apiRequest(basePath, { method: "POST", headers, body: JSON.stringify({ ...form, allowDuplicate }) });
      onCreated(data.patient);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  function submit(event) { event.preventDefault(); create(false); }

  return <form className="space-y-5" onSubmit={submit}>
    <Button type="button" size="sm" variant="ghost" className="-ml-2" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to search</Button>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="new-patient-name">Full name</Label><Input id="new-patient-name" value={form.name} onChange={(event) => update("name", event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="new-patient-phone">Phone</Label><Input id="new-patient-phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="new-patient-email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="new-patient-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="new-patient-address">Address</Label><Input id="new-patient-address" value={form.address} onChange={(event) => update("address", event.target.value)} required /></div></div>
    <div className="rounded-md border bg-slate-50 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-teal-700" /> Insurance information</div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-insurance-provider">Provider</Label><Input id="new-insurance-provider" value={form.insuranceProvider} onChange={(event) => update("insuranceProvider", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="new-policy-number">Policy number</Label><Input id="new-policy-number" value={form.policyNumber} onChange={(event) => update("policyNumber", event.target.value)} /></div></div></div>
    {duplicate && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-950">A patient with this phone number already exists: {duplicate.name}</p><p className="mt-1 text-xs text-amber-800">Continue only if this is genuinely a different person.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => onViewExisting(duplicate)}>View existing patient</Button><Button type="button" size="sm" variant="outline" className="border-amber-400 bg-transparent" onClick={() => create(true)} disabled={submitting}>Continue anyway</Button></div></div></div></div>}
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <DialogFooter><Button type="button" variant="outline" onClick={onBack}>Cancel</Button><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={submitting}>{submitting ? "Creating…" : "Create patient"}</Button></DialogFooter>
  </form>;
}
