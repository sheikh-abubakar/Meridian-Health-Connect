import { CalendarDays, Heart, LogOut, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { clearPortalSession, readPortalSession } from "@/portal/portal-session";

const ComingSoon = ({ icon: Icon, title, description }) => <section className="rounded-2xl border bg-white p-6 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="size-6" /></span><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-lg leading-7 text-slate-600">{description}</p><p className="mt-5 text-base font-semibold text-teal-800">Coming soon</p></section>;
export function PortalDashboardPage() {
  const session = readPortalSession(); const navigate = useNavigate(); const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { if (!session?.accessToken) return; apiRequest("/patient-portal/session", { headers: { Authorization: `Bearer ${session.accessToken}` } }).then(setData).catch((e) => { setError(e.message); clearPortalSession(); }); }, [session?.accessToken]);
  if (!session?.accessToken) return <Navigate to="/portal/login" replace />;
  function signOut() { clearPortalSession(); navigate("/portal/login", { replace: true }); }
  if (!data && !error) return <main className="grid min-h-screen place-items-center bg-teal-50 text-lg text-slate-600">Loading your portal…</main>;
  if (error) return <Navigate to="/portal/login" replace />;
  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><Heart className="size-5" /></span><div className="min-w-0"><p className="truncate text-base font-bold">{data.clinic.name}</p><p className="truncate text-sm text-slate-600">{data.clinic.branchName}</p></div></div><button className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-semibold text-teal-800 hover:bg-teal-50" onClick={signOut}><LogOut className="size-5" />Sign out</button></div></header><div className="mx-auto max-w-3xl px-5 py-9 sm:px-8 sm:py-12"><p className="text-lg font-semibold text-teal-700">Your patient portal</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Hello, {data.patient.name}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Welcome to your secure space for staying connected with your care team.</p><div className="mt-9 space-y-5"><ComingSoon icon={CalendarDays} title="Upcoming appointments" description="Your upcoming visits will appear here." /><ComingSoon icon={MessageCircle} title="Messages" description="Secure messages from your care team will appear here." /><ComingSoon icon={Heart} title="Care plan" description="Your care goals and next steps will appear here." /></div></div></main>;
}
