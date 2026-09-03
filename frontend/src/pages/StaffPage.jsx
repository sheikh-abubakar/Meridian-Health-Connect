import { useEffect, useState } from "react";
import { Plus, ShieldAlert, Trash2, Users } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

const roleLabels = { admin: "Clinic Admin", frontdesk: "Front-desk", doctor: "Doctor", care_coordinator: "Care Coordinator" };
const initialForm = { name: "", email: "", password: "", role: "" };

export function StaffPage() {
  const realtimeRevision = useRealtimeRevision(["staff:created"]);
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [staffToRemove, setStaffToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadStaff() {
      try {
        const data = await apiRequest(`/${tenantSlug}/${locationSlug}/users`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
        if (active) setStaff(data.users);
      } catch (error) {
        if (active) setLoadError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStaff();
    return () => { active = false; };
  }, [locationSlug, realtimeRevision, session.accessToken, tenantSlug]);

  if (session.user.role !== "admin") return <Navigate to={`/${tenantSlug}/${locationSlug}/dashboard`} replace />;

  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function handleOpenChange(nextOpen) { setOpen(nextOpen); if (!nextOpen) { setForm(initialForm); setFormError(""); } }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const data = await apiRequest(`/${tenantSlug}/${locationSlug}/users`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(form),
      });
      setStaff((current) => [...current, data.user]);
      handleOpenChange(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function removeStaff() {
    setRemoving(true); setLoadError("");
    try { await apiRequest(`/${tenantSlug}/${locationSlug}/users/${staffToRemove.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` } }); setStaff((current) => current.filter((member) => member.id !== staffToRemove.id)); setStaffToRemove(null); }
    catch (error) { setLoadError(error.message); setStaffToRemove(null); } finally { setRemoving(false); }
  }

  return <>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-teal-700">Clinic administration</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Staff</h1><p className="mt-2 text-muted-foreground">Manage the care team members who can access this clinic.</p></div><Dialog open={open} onOpenChange={handleOpenChange}><DialogTrigger asChild><Button className="bg-teal-700 hover:bg-teal-800"><Plus className="mr-2 size-4" /> Add Staff</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add staff member</DialogTitle><DialogDescription>Create a tenant-scoped account for a member of your clinic team.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={handleSubmit}><div className="space-y-2"><Label htmlFor="staff-name">Full name</Label><Input id="staff-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required minLength={2} /></div><div className="space-y-2"><Label htmlFor="staff-email">Email address</Label><Input id="staff-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="staff-password">Temporary password</Label><Input id="staff-password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required minLength={8} /><p className="text-xs text-muted-foreground">Minimum 8 characters.</p></div><div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={(value) => updateField("role", value)} required><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent><SelectItem value="doctor">Doctor</SelectItem><SelectItem value="frontdesk">Front-desk</SelectItem><SelectItem value="care_coordinator">Care Coordinator</SelectItem></SelectContent></Select></div>{formError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{formError}</div>}<DialogFooter><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={submitting || !form.role}>{submitting ? "Creating…" : "Create staff"}</Button></DialogFooter></form></DialogContent></Dialog></div>
    {loadError && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}<Card className="mt-8 bg-white shadow-none"><CardContent className="p-0">{loading ? <div className="space-y-3 p-6"><div className="h-4 w-48 animate-pulse rounded bg-slate-200" /><div className="h-12 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded bg-slate-100" /></div> : staff.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="grid size-11 place-items-center rounded-md bg-slate-100 text-slate-500"><Users className="size-5" /></div><p className="mt-4 font-medium">No staff records yet</p><p className="mt-1 text-sm text-muted-foreground">Add the first member of this clinic team.</p></div> : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{staff.map((member) => <TableRow key={member.id}><TableCell className="font-medium">{member.name}</TableCell><TableCell className="text-muted-foreground">{member.email}</TableCell><TableCell><span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{roleLabels[member.role]}</span></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setStaffToRemove(member)}><Trash2 className="mr-2 size-4" /> Remove</Button></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Dialog open={Boolean(staffToRemove)} onOpenChange={(next) => { if (!next && !removing) setStaffToRemove(null); }}><DialogContent><DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-md bg-red-50 text-red-600"><ShieldAlert className="size-5" /></div><DialogTitle>Remove staff access?</DialogTitle><DialogDescription>{staffToRemove?.name} will be removed from this branch and will no longer be able to sign in. Historical appointments and audit records will be preserved.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setStaffToRemove(null)} disabled={removing}>Cancel</Button><Button className="bg-red-600 hover:bg-red-700" onClick={removeStaff} disabled={removing}>{removing ? "Removing…" : "Remove staff"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
