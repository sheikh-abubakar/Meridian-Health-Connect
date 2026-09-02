import { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

function MeridianMark({ compact = false }) {
  return <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_12px_35px_rgba(13,148,136,.22)] backdrop-blur-xl ${compact ? "size-11 rounded-xl" : "size-12 rounded-2xl"}`}><div className="absolute inset-1 rounded-[inherit] bg-gradient-to-br from-teal-300/30 via-teal-500/25 to-cyan-700/25" /><div className="relative grid size-7 place-items-center rounded-lg border border-teal-200/40 bg-teal-400/20 text-white"><Building2 className="size-4" strokeWidth={2.2} /></div><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-teal-200 shadow-[0_0_10px_rgba(153,246,228,.9)]" /></div>;
}

export function LoginPage() {
  const navigate = useNavigate(); const { session, login } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  if (session?.tenant?.slug) { const destination = session.user.role === "admin" ? `/${session.tenant.slug}/overview` : `/${session.tenant.slug}/${session.location?.slug}/dashboard`; return <Navigate to={destination} replace />; }
  async function handleSubmit(event) { event.preventDefault(); setError(""); setSubmitting(true); try { const authenticatedSession = await login(email, password); const destination = authenticatedSession.user.role === "admin" ? `/${authenticatedSession.tenant.slug}/overview` : `/${authenticatedSession.tenant.slug}/${authenticatedSession.location.slug}/dashboard`; navigate(destination, { replace: true }); } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); } }

  return <main className="relative grid h-dvh min-h-0 overflow-hidden bg-slate-50 lg:grid-cols-[1.08fr_0.92fr]">
    <section className="relative hidden min-h-0 overflow-hidden bg-slate-950 p-9 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(20,184,166,.28),transparent_30%),radial-gradient(circle_at_84%_76%,rgba(14,116,144,.22),transparent_35%)]" /><div className="absolute -left-24 top-[28%] size-72 rounded-full border border-white/[.06] bg-white/[.025] backdrop-blur-3xl" /><div className="absolute -right-28 bottom-16 size-96 rounded-full border border-teal-300/[.08] bg-teal-400/[.035] backdrop-blur-3xl" />
      <div className="relative flex items-center gap-4"><MeridianMark /><div><p className="text-base font-semibold tracking-tight">Meridian Health Connect</p><p className="mt-0.5 text-xs text-slate-400">Connected clinical operations</p></div></div>
      <div className="relative max-w-xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/15 bg-teal-300/[.07] px-3 py-1.5 text-xs font-medium text-teal-200 backdrop-blur-md"><ShieldCheck className="size-3.5" /> Secure clinical workspace</div><h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.025em] xl:text-[2.75rem]">One connected workspace for every care team.</h1><p className="mt-4 max-w-lg text-base leading-7 text-slate-300">Coordinate patients, appointments and longitudinal care with clear role-based access across every clinic location.</p><div className="mt-6 grid max-w-lg gap-3 text-sm text-slate-300 sm:grid-cols-2"><p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-teal-300" /> Tenant-isolated records</p><p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-teal-300" /> Role-aware workflows</p></div></div>
      <div className="relative flex items-center gap-2 text-xs text-slate-400"><LockKeyhole className="size-4 text-teal-400" /> Protected access for authorized clinic staff</div>
    </section>

    <section className="relative flex min-h-0 items-center justify-center overflow-hidden p-4 sm:p-7 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(13,148,136,.08),transparent_25%),linear-gradient(rgba(15,118,110,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,.025)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px]" />
      <div className="relative w-full max-w-[450px]">
        <div className="mb-4 flex items-center gap-3 lg:hidden"><div className="rounded-2xl bg-slate-950 p-1"><MeridianMark compact /></div><div><p className="font-semibold">Meridian Health Connect</p><p className="text-xs text-muted-foreground">Connected clinical operations</p></div></div>
        <Card className="overflow-hidden border-white/80 bg-white/90 shadow-[0_30px_80px_-35px_rgba(15,23,42,.35)] backdrop-blur-xl"><div className="h-1 bg-gradient-to-r from-teal-700 via-teal-500 to-cyan-500" /><CardHeader className="space-y-1.5 px-7 pb-4 pt-6 sm:px-8"><div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700"><ShieldCheck className="size-3.5" /> Staff access</div><CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle><CardDescription className="text-sm leading-5">Sign in with your Meridian staff account. Your clinic and role will be resolved securely.</CardDescription></CardHeader>
          <CardContent className="px-7 pb-6 sm:px-8"><form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5"><Label htmlFor="email">Email address</Label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="h-11 bg-slate-50/80 pl-10 transition focus-visible:bg-white" id="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@clinic.com" required autoFocus /></div></div>
            <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><span className="text-[11px] text-muted-foreground">Case-sensitive</span></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="h-11 bg-slate-50/80 pl-10 pr-12 transition focus-visible:bg-white" id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} required /><button type="button" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <Eye className="password-eye-open size-[18px]" /> : <EyeOff className="password-eye-closed size-[18px]" />}</button></div></div>
            {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{error}</div>}
            <Button className="group h-11 w-full bg-teal-700 text-sm font-semibold shadow-[0_10px_25px_-12px_rgba(15,118,110,.8)] transition hover:bg-teal-800 hover:shadow-[0_13px_30px_-12px_rgba(15,118,110,.9)]" type="submit" disabled={submitting}>{submitting ? "Signing you in…" : "Sign in securely"}<ArrowRight className={`ml-2 size-4 transition-transform ${submitting ? "translate-x-1" : "group-hover:translate-x-1"}`} /></Button>
          </form><div className="mt-5 flex items-center justify-center gap-2 border-t pt-4 text-center text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5 text-teal-700" /> Clinic workspace selected automatically after sign-in</div></CardContent>
        </Card>
        <p className="mt-3 text-center text-[11px] text-slate-400">Authorized use only · Meridian Health Connect</p>
      </div>
    </section>
  </main>;
}
