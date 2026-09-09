import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { EncounterTemplateManager } from "@/components/EncounterTemplateManager";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

export function ClinicalTemplatesPage() {
  const { tenantSlug, locationSlug } = useParams(); const { session } = useAuth(); const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["encountertemplate:created", "encountertemplate:updated", "visittype:created", "specialty:created"]);
  const [visitTypes, setVisitTypes] = useState([]); const [specialties, setSpecialties] = useState([]); const [error, setError] = useState("");
  useEffect(() => { let active = true; Promise.all([apiRequest(`${root}/resources/visit-types`, { headers }), apiRequest(`${root}/resources/specialties`, { headers })]).then(([visitData, specialtyData]) => { if (!active) return; setVisitTypes(visitData.visitTypes || []); setSpecialties(specialtyData.specialties || []); }).catch((requestError) => active && setError(requestError.message)); return () => { active = false; }; }, [headers, revision, root]);
  return <div className="space-y-6"><div><p className="text-sm font-medium text-teal-700">Scheduling setup</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight"><ClipboardList className="size-7 text-violet-700" />Clinical Templates</h1><p className="mt-2 text-muted-foreground">Define structured encounter documentation by visit type, with specialty templates as a fallback.</p></div>{error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<EncounterTemplateManager root={root} headers={headers} visitTypes={visitTypes} specialties={specialties} revision={revision} /></div>;
}
