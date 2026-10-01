import { useEffect, useMemo, useState } from "react";
import { Clock3, LogIn, LogOut } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

const time = (value) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", hour12: true, timeZone: "Asia/Karachi" }).format(new Date(value));
export function FrontdeskShiftCard() {
  const { tenantSlug, locationSlug } = useParams(); const { session } = useAuth(); const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["attendance:updated", "shift:scheduled"]);
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => apiRequest(`${root}/shifts/me`, { headers }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [headers, root, revision]);
  async function change(action) { setBusy(true); setError(""); try { await apiRequest(`${root}/shifts/${action}`, { method: "POST", headers }); await load(); window.dispatchEvent(new Event("frontdesk:shift-changed")); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Card className="mt-6 border-teal-200 bg-white shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-semibold"><Clock3 className="size-5 text-teal-700" />My Front-desk shift</p><p className="mt-1 text-sm text-slate-600">{data?.active ? `On duty since ${time(data.active.clockInAt)}` : "You are currently clocked out."}</p>{data?.upcoming?.length > 0 && <p className="mt-1 text-xs text-slate-500">Next planned: {time(data.upcoming[0].startAt)}–{new Intl.DateTimeFormat("en-PK", { timeStyle: "short", hour12: true, timeZone: "Asia/Karachi" }).format(new Date(data.upcoming[0].endAt))}</p>}{data?.active?.plannedStartAt && data.active.lateMinutes > 10 && <p className="mt-1 text-xs font-semibold text-amber-700">Late arrival: {data.active.lateMinutes} minutes</p>}{error && <p className="mt-2 text-sm text-red-700">{error}</p>}</div><Button className={data?.active ? "bg-slate-800" : "bg-teal-700"} disabled={busy || !data} onClick={() => change(data.active ? "clock-out" : "clock-in")}>{data?.active ? <LogOut className="mr-2 size-4" /> : <LogIn className="mr-2 size-4" />}{busy ? "Saving..." : data?.active ? "Clock Out" : "Clock In"}</Button></CardContent></Card>;
}
