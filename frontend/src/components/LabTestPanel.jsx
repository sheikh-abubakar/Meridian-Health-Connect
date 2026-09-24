import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LabTestPanel({ root, headers, selectedIds, onChange, disabled }) {
  const [tests, setTests] = useState([]); const [error, setError] = useState("");
  useEffect(() => { apiRequest(`${root}/lab/tests`, { headers }).then((data) => setTests(data.tests || [])).catch((e) => setError(e.message)); }, [headers, root]);
  return <Card className="bg-white shadow-none"><CardHeader><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-md bg-cyan-50 text-cyan-700"><FlaskConical className="size-5" /></span><div><CardTitle className="text-lg">Requested lab tests</CardTitle><CardDescription>Optional. Selected tests become patient lab requests when this encounter is finalized.</CardDescription></div></div></CardHeader><CardContent>{error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : tests.length ? <div className="grid gap-3 sm:grid-cols-2">{tests.map((test) => <label key={test.id} className={`rounded-lg border p-3 ${disabled ? "opacity-70" : "cursor-pointer hover:border-cyan-300"}`}><span className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-cyan-700" disabled={disabled} checked={selectedIds.includes(test.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, test.id] : selectedIds.filter((id) => id !== test.id))} /><span><b className="block text-sm">{test.name}</b><span className="mt-1 block text-xs text-slate-500">{test.code} · {test.preparation}</span></span></span></label>)}</div> : <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No active lab tests are configured. Clinic Admin can add them in Lab Setup.</p>}</CardContent></Card>;
}
