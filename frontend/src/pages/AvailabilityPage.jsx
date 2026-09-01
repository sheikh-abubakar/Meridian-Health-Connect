import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSelect } from "@/components/TimeSelect";
import { useAuth } from "@/context/auth-context";
import { dayNames } from "@/lib/schedule";

const defaultDays = dayNames.map((name, dayOfWeek) => ({ name, dayOfWeek, enabled: dayOfWeek >= 1 && dayOfWeek <= 5, startTime: "09:00", endTime: "17:00" }));

export function AvailabilityPage() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const [days, setDays] = useState(defaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const basePath = `/${tenantSlug}/${locationSlug}/availability`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);

  useEffect(() => {
    let active = true;
    apiRequest(`${basePath}/${session.user.id}`, { headers }).then((data) => {
      if (!active || !data.availability.slots.length) return;
      setDays(dayNames.map((name, dayOfWeek) => {
        const slot = data.availability.slots.find((item) => item.dayOfWeek === dayOfWeek);
        return { name, dayOfWeek, enabled: Boolean(slot), startTime: slot?.startTime || "09:00", endTime: slot?.endTime || "17:00" };
      }));
    }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [basePath, headers, session.user.id]);

  function updateDay(index, changes) { setDays((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, ...changes } : day)); }
  async function save() {
    setSaving(true); setError(""); setMessage("");
    try { await apiRequest(basePath, { method: "PUT", headers, body: JSON.stringify({ slots: days.filter((day) => day.enabled).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) }) }); setMessage("Weekly availability saved."); }
    catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  }

  return <><p className="text-sm font-medium text-teal-700">Clinical schedule</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My Availability</h1><p className="mt-2 text-muted-foreground">Set the recurring hours Front-desk can use when booking your appointments.</p><Card className="mt-8 bg-white shadow-none"><CardHeader><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-700"><CalendarClock className="size-5" /></div><div><CardTitle className="text-lg">Weekly working hours</CardTitle><CardDescription className="mt-1">Enable a day and choose its start and end time in AM/PM format.</CardDescription></div></div></CardHeader><CardContent>{loading ? <div className="h-80 animate-pulse rounded-md bg-slate-100" /> : <div className="divide-y rounded-lg border">{days.map((day, index) => <div key={day.name} className="grid items-center gap-3 px-4 py-4 lg:grid-cols-[140px_1fr_auto_1fr]"><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-teal-700" checked={day.enabled} onChange={(event) => updateDay(index, { enabled: event.target.checked })} />{day.name}</label><TimeSelect value={day.startTime} disabled={!day.enabled} onChange={(startTime) => updateDay(index, { startTime })} label={`${day.name} start time`} /><span className="hidden text-sm text-muted-foreground lg:block">to</span><TimeSelect value={day.endTime} disabled={!day.enabled} onChange={(endTime) => updateDay(index, { endTime })} label={`${day.name} end time`} /></div>)}</div>}{error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><Check className="size-4" />{message}</div>}<div className="mt-5 flex justify-end"><Button className="bg-teal-700 hover:bg-teal-800" onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save availability"}</Button></div></CardContent></Card></>;
}
