import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

export function OverdueTasksPage() {
  const { tenantSlug, locationSlug } = useParams(); const navigate = useNavigate(); const { session } = useAuth(); const root = `/${tenantSlug}/${locationSlug}`; const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]); const revision = useRealtimeRevision(["task:created", "task:updated"]);
  const [tasks, setTasks] = useState([]); const [error, setError] = useState("");
  useEffect(() => { apiRequest(`${root}/tasks/critical`, { headers }).then((data) => setTasks(data.tasks || [])).catch((e) => setError(e.message)); }, [headers, revision, root]);
  return <><Button variant="outline" size="sm" onClick={() => navigate(`${root}/dashboard`)}><ArrowLeft className="mr-2 size-4" />Dashboard</Button><div className="mt-5"><p className="text-sm font-medium text-amber-700">Escalation review</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><AlertTriangle className="size-7 text-amber-600" />Critically overdue tasks</h1><p className="mt-2 text-muted-foreground">Open tasks that have passed this branch’s Tier 3 threshold.</p></div>{error && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Card className="mt-8 bg-white shadow-none"><CardHeader><CardTitle>Tasks requiring Admin attention</CardTitle><CardDescription>Only Tier-3 escalated work appears here.</CardDescription></CardHeader><CardContent>{tasks.length ? <div className="divide-y">{tasks.map((task) => <div key={task._id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{task.description}</p><p className="mt-1 text-sm text-muted-foreground">Patient: {task.carePlanId?.patientId?.name || "Unavailable"} · Care plan: {task.carePlanId?.goal || "Unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Assigned to {task.assignedToUserId?.name || "Unavailable"} · Due {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(task.dueDate))}</p></div><Badge className="w-fit border-amber-300 bg-amber-50 text-amber-800"><CalendarClock className="mr-1 size-3.5" />{task.daysOverdue} days overdue</Badge></div>)}</div> : <p className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">No critically overdue tasks in this branch.</p>}</CardContent></Card></>;
}
