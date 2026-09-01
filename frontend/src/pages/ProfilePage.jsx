import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Building2, Eye, EyeOff, LockKeyhole, LogOut, Mail, MapPin, ShieldCheck, UserCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

const roleLabels = { admin: "Clinic Admin", frontdesk: "Front-desk Staff", doctor: "Doctor", care_coordinator: "Care Coordinator" };

export function ProfilePage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [success, setSuccess] = useState("");
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const backPath = session.user.role === "admin" ? `/${tenantSlug}/overview` : `/${tenantSlug}/${session.location.slug}/dashboard`;

  useEffect(() => {
    let active = true;
    apiRequest(`/${tenantSlug}/profile`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((profileData) => { if (active) setData(profileData); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.accessToken, tenantSlug]);

  function update(field, value) { setPasswords((current) => ({ ...current, [field]: value })); setPasswordError(""); setSuccess(""); }
  async function changePassword(event) {
    event.preventDefault(); setPasswordError(""); setSuccess("");
    if (passwords.newPassword !== passwords.confirmPassword) { setPasswordError("New passwords do not match."); return; }
    setSaving(true);
    try { const result = await apiRequest(`/${tenantSlug}/profile/password`, { method: "PATCH", headers, body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) }); setSuccess(result.message); setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" }); }
    catch (requestError) { setPasswordError(requestError.message); } finally { setSaving(false); }
  }
  function signOut() { logout(); navigate("/login", { replace: true }); }
  const initials = data?.profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return <div className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"><button className="flex items-center gap-3 text-left" onClick={() => navigate(backPath)}><div className="grid size-9 place-items-center rounded-md bg-slate-950 text-white"><Building2 className="size-4" /></div><div><p className="text-sm font-semibold">Meridian Health Connect</p><p className="text-xs text-muted-foreground">Profile & Security</p></div></button><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></div></header><main className="mx-auto max-w-6xl px-5 py-8"><Button variant="outline" size="sm" onClick={() => navigate(backPath)}><ArrowLeft className="mr-2 size-4" /> Back to workspace</Button>{loading ? <div className="mt-6 h-96 animate-pulse rounded-xl border bg-white" /> : error ? <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <><section className="relative mt-6 overflow-hidden rounded-xl bg-slate-950 p-7 text-white shadow-panel"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,.35),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(14,116,144,.25),transparent_30%)]" /><div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div className="flex items-center gap-5"><div className="grid size-20 place-items-center rounded-xl border border-white/15 bg-white/10 text-2xl font-semibold backdrop-blur">{initials || <UserCircle />}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight">{data.profile.name}</h1><Badge className="bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-300/30"><BadgeCheck className="mr-1 size-3.5" /> Active account</Badge></div><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Mail className="size-4" />{data.profile.email}</p></div></div><div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"><p className="text-xs uppercase tracking-wider text-slate-400">Access role</p><p className="mt-1 font-medium text-teal-200">{roleLabels[data.profile.role]}</p></div></div></section><div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="bg-white shadow-none"><CardHeader><CardTitle className="text-lg">Workspace identity</CardTitle><CardDescription>Your assigned organization and operating scope.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><Building2 className="size-4" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinic</p><p className="mt-1 font-medium">{data.tenant.name}</p></div></div><div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><MapPin className="size-4" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch scope</p><p className="mt-1 font-medium">{data.location?.name || "All branches"}</p><p className="mt-1 text-xs text-muted-foreground">{data.location?.address || "Tenant-wide administrative access"}</p></div></div><div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><ShieldCheck className="size-4" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p><p className="mt-1 font-medium">{roleLabels[data.profile.role]}</p></div></div></CardContent></Card><Card className="bg-white shadow-none"><CardHeader><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-md bg-slate-950 text-white"><LockKeyhole className="size-5" /></div><div><CardTitle className="text-lg">Password & Security</CardTitle><CardDescription className="mt-1">Confirm your current password before setting a new one.</CardDescription></div></div></CardHeader><CardContent><form className="space-y-4" onSubmit={changePassword}>{["currentPassword", "newPassword", "confirmPassword"].map((field) => <div className="space-y-2" key={field}><Label htmlFor={field}>{field === "currentPassword" ? "Current password" : field === "newPassword" ? "New password" : "Confirm new password"}</Label><div className="relative"><Input id={field} type={showPasswords ? "text" : "password"} value={passwords[field]} onChange={(event) => update(field, event.target.value)} minLength={field === "currentPassword" ? undefined : 8} required className="pr-10" />{field === "currentPassword" && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => setShowPasswords((current) => !current)} aria-label="Toggle password visibility">{showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}</div></div>)}{passwordError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{passwordError}</div>}{success && <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><ShieldCheck className="size-4" />{success}</div>}<Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800" disabled={saving}>{saving ? "Updating…" : "Update password"}</Button></form></CardContent></Card></div></>}</main></div>;
}

