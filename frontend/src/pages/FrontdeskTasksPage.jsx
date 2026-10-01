import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { FrontdeskShiftCard } from "@/components/FrontdeskShiftCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

export function FrontdeskTasksPage() {
  const { tenantSlug, locationSlug } = useParams(); const { session } = useAuth(); const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["task:created", "task:updated", "attendance:updated"]);
  const [tasks, setTasks] = useState([]); const [onDuty, setOnDuty] = useState(false); const [notes, setNotes] = useState({}); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const load = () => Promise.all([apiRequest(`${root}/tasks`, { headers }), apiRequest(`${root}/shifts/me`, { headers })]).then(([taskData, shiftData]) => { setTasks(taskData.tasks || []); setOnDuty(Boolean(shiftData.active)); }).catch((e) => setError(e.message));
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [headers, root, revision]);
  useEffect(() => { window.addEventListener("frontdesk:shift-changed", load); return () => window.removeEventListener("frontdesk:shift-changed", load); }, [headers, root]);
  async function complete(task) { setBusy(task._id); setError(""); try { await apiRequest(`${root}/tasks/${task._id}/complete`, { method: "PATCH", headers, body: JSON.stringify({ outcomeNote: notes[task._id] || "" }) }); await load(); } catch (e) { setError(e.message); } finally { setBusy(""); } }
  const open = tasks.filter((task) => task.status === "open" && task.assignmentScope === "frontdesk_shared");
  return <div><p className="text-sm font-semibold text-teal-700">Front-desk operations</p><h1 className="mt-1 text-3xl font-bold">Shared task queue</h1><p className="mt-2 text-slate-600">General tasks for this branch. Any clocked-in Front-desk member can finish them.</p><FrontdeskShiftCard />{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 space-y-3">{open.length ? open.map((task) => <Card key={task._id} className="bg-white shadow-none"><CardContent className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"><div><p className="font-semibold">{task.description}</p><p className="mt-1 text-sm text-slate-600">{task.carePlanId?.patientId?.name || "Patient"} · Due {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(task.dueDate))}</p>{task.isOverdue && <span className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Overdue</span>}</div><div className="flex flex-col gap-2 sm:flex-row"><Input className="sm:w-64" placeholder="Outcome note (optional)" maxLength={5000} value={notes[task._id] || ""} onChange={(e) => setNotes({ ...notes, [task._id]: e.target.value })} /><Button className="bg-teal-700" disabled={!onDuty || busy === task._id} onClick={() => complete(task)}><ClipboardCheck className="mr-2 size-4" />{busy === task._id ? "Saving..." : "Mark complete"}</Button></div></CardContent></Card>) : <Card><CardContent className="p-10 text-center text-slate-500">No open Front-desk tasks.</CardContent></Card>}</div>{!onDuty && open.length > 0 && <p className="mt-3 text-sm text-amber-700">Clock in before completing a task.</p>}</div>;
}
