import { useEffect, useState } from "react";
import { Search, UserRound, UserRoundPlus } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function visitLabel(value) {
  if (!value) return "No previous visit";
  return `Last visit ${new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(value))}`;
}

export function PatientSearchStep({ basePath, headers, onSelect, onCreate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); setSearching(false); return undefined; }
    const timer = setTimeout(async () => {
      setSearching(true); setError("");
      try {
        const key = /\d/.test(value) ? "phone" : "name";
        const data = await apiRequest(`${basePath}/search?${key}=${encodeURIComponent(value)}`, { headers });
        setResults(data.patients);
      } catch (requestError) { setError(requestError.message); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [basePath, headers, query]);

  return <div className="space-y-4">
    <div className="space-y-2"><Label htmlFor="patient-search">Search by phone or name</Label><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input id="patient-search" className="pl-9" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Phone number or patient name" /></div><p className="text-xs text-muted-foreground">Phone is the most reliable way to find an existing record.</p></div>
    {searching && <div className="h-20 animate-pulse rounded-lg bg-slate-100" />}
    {!searching && results.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-slate-50 p-2">{results.map((patient) => <button type="button" key={patient.id} onClick={() => onSelect(patient)} className="flex w-full items-center gap-3 rounded-md border bg-white p-3 text-left transition hover:border-teal-300 hover:bg-teal-50"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700"><UserRound className="size-4" /></span><span className="min-w-0 flex-1"><span className="block font-medium">{patient.name}</span><span className="block text-xs text-muted-foreground">{patient.phone} · {visitLabel(patient.lastVisitAt)}</span></span><span className="text-xs font-medium text-teal-700">Select</span></button>)}</div>}
    {!searching && query.trim().length >= 2 && results.length === 0 && !error && <div className="rounded-lg border border-dashed bg-slate-50 p-5 text-center"><UserRound className="mx-auto size-5 text-slate-400" /><p className="mt-2 text-sm font-medium">No matching patient found</p><p className="mt-1 text-xs text-muted-foreground">Check the spelling or register a new record.</p></div>}
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="border-t pt-4"><Button type="button" variant="outline" className="w-full" onClick={() => onCreate(query)}><UserRoundPlus className="mr-2 size-4" /> Add a new patient anyway</Button></div>
  </div>;
}
