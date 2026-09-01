import { useEffect, useMemo, useState } from "react";
import { ChevronRight, History, Search, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";

export function MyPatientsPage() {
  const { tenantSlug, locationSlug } = useParams(); const navigate = useNavigate(); const { session } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const [patients, setPatients] = useState([]); const [query, setQuery] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiRequest(`/${tenantSlug}/${locationSlug}/my-patients`, { headers }).then((data) => setPatients(data.patients)).catch((requestError) => setError(requestError.message)); }, [headers, locationSlug, tenantSlug]);
  const visible = patients.filter((patient) => `${patient.name} ${patient.phone}`.toLowerCase().includes(query.toLowerCase()));
  return <><p className="text-sm font-medium text-teal-700">Longitudinal care</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My Patients</h1><p className="mt-2 text-muted-foreground">Patients with at least one encounter you finalized in this branch.</p><div className="relative mt-6 max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or phone" /></div>{error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<Card className="mt-6 bg-white shadow-none"><CardContent className="p-0">{visible.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><UserRound className="size-7 text-slate-400" /><p className="mt-3 font-medium">No finalized patient encounters yet</p></div> : <div className="divide-y">{visible.map((patient) => <button type="button" key={patient.id} onClick={() => navigate(`/${tenantSlug}/${locationSlug}/patients/${patient.id}`)} className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700"><UserRound className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{patient.name}</span><span className="mt-1 block text-xs text-muted-foreground">{patient.phone} · {patient.lastDiagnosis || "No diagnosis summary"}</span></span><span className="flex items-center gap-1 text-xs text-muted-foreground"><History className="size-3.5" />{patient.finalizedEncounterCount} encounter{patient.finalizedEncounterCount === 1 ? "" : "s"}</span><ChevronRight className="size-4 text-slate-400" /></button>)}</div>}</CardContent></Card></>;
}
