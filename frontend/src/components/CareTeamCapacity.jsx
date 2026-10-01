import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, UsersRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

const roleLabels = { admin: "Clinic Admin", doctor: "Doctor", care_coordinator: "Care Coordinator", frontdesk: "Front-desk", lab_attendant: "Lab Attendant" };
export function CareTeamCapacity() {
  const { tenantSlug, locationSlug } = useParams(); const { session } = useAuth(); const navigate = useNavigate();
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["staff:created", "staff:updated", "task:created", "task:updated", "careplan:created", "careplan:updated", "referral:created", "referral:updated", "monitoringreading:created", "monitoringreading:updated", "monitoringenrollment:created", "monitoringenrollment:updated", "assignedform:created", "assignedform:updated", "message:created"]);
  const [data, setData] = useState({ staff: [], frontdeskSharedOpenTasks: 0 });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); apiRequest(`${root}/staff-workload`, { headers }).then((result) => { if (active) setData(result); }).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [root, headers, revision]);
  return <Card className="mt-6 bg-white shadow-none"><CardHeader><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-700"><UsersRound className="size-5" /></span><div><CardTitle className="text-lg">Care Team Capacity</CardTitle><CardDescription className="mt-1">Live workload signals by staff member in this branch.</CardDescription></div></div></CardHeader><CardContent>
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="h-32 animate-pulse rounded-lg bg-slate-100" /> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3"><span className="font-medium text-teal-950">Front-desk shared queue</span><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-teal-900">{data.frontdeskSharedOpenTasks || 0} open general tasks</span></div>
      {data.staff?.length ? <div className="divide-y rounded-xl border">{data.staff.map((member) => <div key={member.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-48"><p className="font-semibold text-slate-900">{member.name}</p><p className="mt-1 text-xs text-muted-foreground">{roleLabels[member.role] || member.role}</p></div><div className="flex flex-1 flex-wrap gap-2">{member.workload.length ? member.workload.map((metric) => metric.drillDown ? <button key={metric.key} type="button" onClick={() => navigate(`${root}/tasks?assignedToUserId=${metric.drillDown.assigneeId}`)} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-900 hover:border-teal-400"><strong>{metric.count}</strong> {metric.label}<ArrowUpRight className="size-3" /></button> : <span key={metric.key} className={`rounded-full px-2.5 py-1.5 text-xs ${metric.count ? "bg-slate-100 font-medium text-slate-800" : "bg-slate-50 text-slate-400"}`}><strong>{metric.count}</strong> {metric.label}</span>) : <span className="rounded-full bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400">0 tracked workload signals</span>}</div></div>)}</div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><Activity className="mx-auto mb-2 size-5" />No active staff in this branch.</div>}
    </>}
  </CardContent></Card>;
}
