import { useEffect, useMemo, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { PatientCreateForm } from "@/components/PatientCreateForm";
import { PatientSearchStep } from "@/components/PatientSearchStep";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";

export function PatientsPage() {
  const { tenantSlug, locationSlug } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("search");
  const [initialQuery, setInitialQuery] = useState("");
  const basePath = `/${tenantSlug}/${locationSlug}/patients`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const profilePath = (id) => `/${tenantSlug}/${locationSlug}/patients/${id}`;

  useEffect(() => {
    let active = true;
    apiRequest(basePath, { headers }).then((data) => { if (active) setPatients(data.patients); }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [basePath, headers]);

  function changeOpen(next) { setOpen(next); if (!next) { setStep("search"); setInitialQuery(""); } }
  function view(patient) { changeOpen(false); navigate(profilePath(patient.id)); }
  function created(patient) { setPatients((current) => [patient, ...current]); view(patient); }

  return <><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-teal-700">Patient access</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Patients</h1><p className="mt-2 text-muted-foreground">Find the existing record first to keep every visit in one history.</p></div><Dialog open={open} onOpenChange={changeOpen}><DialogTrigger asChild><Button className="bg-teal-700 hover:bg-teal-800"><Plus className="mr-2 size-4" /> Add Patient</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{step === "search" ? "Find patient" : "Register new patient"}</DialogTitle><DialogDescription>{step === "search" ? "Search this branch before creating another patient record." : "No record selected. Enter the new patient's details."}</DialogDescription></DialogHeader>{step === "search" ? <PatientSearchStep basePath={basePath} headers={headers} onSelect={view} onCreate={(query) => { setInitialQuery(query); setStep("create"); }} /> : <PatientCreateForm basePath={basePath} headers={headers} initialQuery={initialQuery} onBack={() => setStep("search")} onCreated={created} onViewExisting={view} />}</DialogContent></Dialog></div>
    <Card className="mt-8 bg-white shadow-none"><CardContent className="p-0">{loading ? <div className="space-y-3 p-6"><div className="h-12 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded bg-slate-100" /></div> : error ? <div className="p-8 text-center text-sm text-red-700">{error}</div> : patients.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="grid size-12 place-items-center rounded-md bg-teal-50 text-teal-700"><UserRound className="size-5" /></div><p className="mt-4 font-medium">No patients registered</p><p className="mt-1 text-sm text-muted-foreground">Search first, then add the first patient for this branch.</p></div> : <Table><TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Contact</TableHead><TableHead>Insurance</TableHead></TableRow></TableHeader><TableBody>{patients.map((patient) => <TableRow key={patient.id} className="cursor-pointer" onClick={() => navigate(profilePath(patient.id))}><TableCell><p className="font-medium text-teal-800">{patient.name}</p><p className="text-xs text-muted-foreground">{patient.address}</p></TableCell><TableCell><p>{patient.phone}</p><p className="text-xs text-muted-foreground">{patient.email || "No email"}</p></TableCell><TableCell>{patient.insuranceProvider ? <><p>{patient.insuranceProvider}</p><p className="text-xs text-muted-foreground">{patient.policyNumber || "No policy number"}</p></> : <span className="text-muted-foreground">Not provided</span>}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
  </>;
}
