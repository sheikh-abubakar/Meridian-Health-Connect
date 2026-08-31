import { useState } from "react";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

export function LoginPage() {
  const navigate = useNavigate();
  const { session, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (session?.tenant?.slug) return <Navigate to={`/${session.tenant.slug}/dashboard`} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const authenticatedSession = await login(email, password);
      navigate(`/${authenticatedSession.tenant.slug}/dashboard`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,.28),transparent_36%),radial-gradient(circle_at_80%_70%,rgba(14,116,144,.20),transparent_34%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-teal-500"><Building2 className="size-5" /></div>
          <div><p className="font-semibold">Meridian Health Connect</p><p className="text-xs text-slate-400">Pilot Zero</p></div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-teal-300">Clinical operations, connected</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">A clear, secure workspace for every care team.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Access is isolated by clinic and protected by role-based permissions.</p>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-slate-400"><ShieldCheck className="size-4 text-teal-400" /> Tenant-scoped access</div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-slate-200 bg-white">
          <CardHeader className="space-y-2 pb-5">
            <div className="mb-3 grid size-11 place-items-center rounded-md bg-teal-50 text-teal-700 lg:hidden"><Building2 className="size-5" /></div>
            <CardTitle>Sign in to your clinic</CardTitle>
            <CardDescription>Use your Meridian staff account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@clinic.com" required /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              <Button className="w-full bg-teal-700 hover:bg-teal-800" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<ArrowRight className="ml-2 size-4" /></Button>
            </form>
            <p className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">Your clinic workspace will be selected securely after sign-in.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
