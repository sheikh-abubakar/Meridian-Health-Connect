import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

export function FrontdeskCoverageCard() {
  const { tenantSlug, locationSlug } = useParams(); const { session } = useAuth(); const navigate = useNavigate();
  const root = `/${tenantSlug}/${locationSlug}`; const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["attendance:updated", "shift:scheduled"]);
  const [coverage, setCoverage] = useState(null);
  useEffect(() => { let active = true; const load = () => apiRequest(`${root}/shifts/coverage`, { headers }).then((data) => { if (active) setCoverage(data); }).catch(() => {}); load(); const timer = setInterval(load, 60000); return () => { active = false; clearInterval(timer); }; }, [root, headers, revision]);
  if (!coverage) return null;
  return <button type="button" onClick={() => navigate(`${root}/shifts`)} className={`mt-5 flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${coverage.gap ? "border-amber-300 bg-amber-50 hover:border-amber-500" : "border-teal-200 bg-teal-50/60 hover:border-teal-400"}`}><span className="flex items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${coverage.gap ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>{coverage.gap ? <AlertTriangle className="size-5" /> : <Clock3 className="size-5" />}</span><span><span className="block font-semibold">{coverage.gap ? "Front-desk coverage gap" : "Front-desk coverage"}</span><span className="mt-1 block text-sm">{coverage.activeStaff} clocked in · {coverage.expectedStaff} scheduled now</span></span></span><span className="text-sm font-semibold">View attendance</span></button>;
}
