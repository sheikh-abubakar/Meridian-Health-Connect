import { createElement, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarCheck2, CalendarDays, CheckCircle2, Clock3, PhoneCall, Stethoscope, UserPlus, UserRound, UsersRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { AdminAnalyticsDashboard } from "@/components/AdminAnalyticsDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { dateKey, formatClinicDateTime } from "@/lib/schedule";
import { MyTasksPage } from "@/pages/MyTasksPage";

const tones = { teal: "bg-teal-50 text-teal-700", blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700" };

function Stat({ label, value, detail, icon, tone }) {
  return <Card className="bg-white shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><span className={`grid size-10 place-items-center rounded-lg ${tones[tone]}`}>{createElement(icon, { className: "size-5" })}</span></div><p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function Action({ icon, title, detail, onClick }) {
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-teal-200 hover:bg-teal-50/50"><span className="grid size-9 place-items-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700">{createElement(icon, { className: "size-4" })}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span><ArrowRight className="size-4 text-slate-400 group-hover:text-teal-700" /></button>;
}

function RoleDashboard({ role }) {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ appointments: [], patients: [], recalls: [], carePlans: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);

  useEffect(() => {
    let active = true;
    const calls = role === "doctor"
      ? [apiRequest(`${root}/appointments`, { headers }), apiRequest(`${root}/my-patients`, { headers }), apiRequest(`${root}/careplans?owningCareTeamMemberId=me`, { headers })]
      : [apiRequest(`${root}/appointments`, { headers }), apiRequest(`${root}/patients`, { headers }), apiRequest(`${root}/recall-requests?status=pending_scheduling`, { headers })];
    Promise.all(calls).then(([appointments, second, third]) => {
      if (!active) return;
      setData(role === "doctor" ? { appointments: appointments.appointments, patients: second.patients, recalls: [], carePlans: third.carePlans } : { appointments: appointments.appointments, patients: second.patients, recalls: third.recallRequests, carePlans: [] });
    }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [headers, role, root]);

  const doctor = role === "doctor";
  const today = dateKey();
  const todays = data.appointments.filter((item) => item.scheduledAt?.slice(0, 10) === today);
  const waiting = todays.filter((item) => item.status === "checked_in");
  const completed = todays.filter((item) => item.status === "completed");
  const upcoming = data.appointments.filter((item) => item.scheduledAt?.slice(0, 10) >= today && item.status !== "completed").slice(0, 5);
  const registeredToday = data.patients.filter((item) => item.createdAt?.slice(0, 10) === today).length;
  const openPlans = data.carePlans.filter((plan) => (plan.taskSummary?.open || 0) > 0).length;
  const stats = doctor ? [
    ["Appointments today", todays.length, "Your schedule in this branch", CalendarDays, "blue"],
    ["Waiting now", waiting.length, "Checked-in patients in your queue", UsersRound, "teal"],
    ["Completed today", completed.length, "Finalized clinical encounters", CheckCircle2, "emerald"],
    ["Care plans to track", openPlans, `${data.carePlans.length} owned care plans`, Activity, "violet"],
  ] : [
    ["Appointments today", todays.length, "All bookings in this branch", CalendarDays, "blue"],
    ["Awaiting check-in", todays.filter((item) => item.status === "scheduled").length, "Scheduled patients to receive", Clock3, "amber"],
    ["Checked in", waiting.length, "Patients handed to clinical queue", CalendarCheck2, "teal"],
    ["Pending recalls", data.recalls.length, `${registeredToday} patients registered today`, PhoneCall, "violet"],
  ];

  return <><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-teal-700">{doctor ? "Clinical workspace" : "Front-desk workspace"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {session.user.name}</h1><p className="mt-2 text-muted-foreground">{doctor ? "Your live clinical workload and care priorities for today." : "Today’s patient flow, booking activity and follow-up handoffs."}</p></div><div className="relative overflow-hidden rounded-xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 px-5 py-3.5 shadow-sm sm:mb-1 sm:min-w-56"><div className="absolute -right-5 -top-6 size-20 rounded-full bg-teal-100/60" /><div className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-teal-700 text-white shadow-sm"><CalendarDays className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">Today</p><p className="mt-0.5 text-sm font-semibold text-slate-900">{new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p></div></div></div></div>
    {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border bg-white" />)}</div> : <><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, detail, icon, tone]) => <Stat key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}</div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_.85fr]"><Card className="bg-white shadow-none"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="flex items-center gap-2 text-lg"><CalendarCheck2 className="size-5 text-teal-700" />{doctor ? "Your upcoming patients" : "Upcoming appointments"}</CardTitle><CardDescription className="mt-1">The next active bookings for this branch.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => navigate(`${root}/${doctor ? "queue" : "scheduling"}`)}>View all <ArrowRight className="ml-1 size-4" /></Button></CardHeader><CardContent>{upcoming.length === 0 ? <div className="rounded-lg border border-dashed bg-slate-50 py-10 text-center"><CalendarDays className="mx-auto size-6 text-slate-400" /><p className="mt-3 text-sm font-medium">No upcoming appointments</p><p className="mt-1 text-xs text-muted-foreground">New bookings will appear here automatically.</p></div> : <div className="divide-y">{upcoming.map((appointment) => <div key={appointment._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><UserRound className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{appointment.patientId?.name}</p><p className="truncate text-xs text-muted-foreground">{formatClinicDateTime(appointment.scheduledAt)} · {appointment.visitType}</p></div><Badge variant={appointment.status}>{appointment.status.replace("_", " ")}</Badge></div>)}</div>}</CardContent></Card>
        <div className="space-y-5"><Card className="bg-white shadow-none"><CardHeader><CardTitle className="text-lg">Quick actions</CardTitle><CardDescription>Your most-used workflows.</CardDescription></CardHeader><CardContent className="space-y-2">{doctor ? <><Action icon={Stethoscope} title="Open My Queue" detail={`${waiting.length} patients waiting`} onClick={() => navigate(`${root}/queue`)} /><Action icon={Clock3} title="Manage availability" detail="Set your clinic working hours" onClick={() => navigate(`${root}/availability`)} /><Action icon={UserRound} title="Open My Patients" detail="Review longitudinal history" onClick={() => navigate(`${root}/my-patients`)} /></> : <><Action icon={UserPlus} title="Find or add patient" detail="Search before creating a record" onClick={() => navigate(`${root}/patients`)} /><Action icon={CalendarDays} title="Book appointment" detail="Choose doctor and available slot" onClick={() => navigate(`${root}/scheduling`)} /><Action icon={PhoneCall} title="Handle recall requests" detail={`${data.recalls.length} pending follow-ups`} onClick={() => navigate(`${root}/recall-requests`)} /></>}</CardContent></Card>{!doctor && data.recalls.length > 0 && <Card className="border-amber-200 bg-amber-50 shadow-none"><CardContent className="p-4 text-sm text-amber-900"><strong>Follow-up attention:</strong> {data.recalls.length} recall request{data.recalls.length === 1 ? " is" : "s are"} waiting for a slot.</CardContent></Card>}</div>
      </div></>}
  </>;
}

export function DashboardPage() {
  const { session } = useAuth();
  if (session.user.role === "admin") return <AdminAnalyticsDashboard />;
  if (session.user.role === "care_coordinator") return <MyTasksPage />;
  return <RoleDashboard role={session.user.role} />;
}
