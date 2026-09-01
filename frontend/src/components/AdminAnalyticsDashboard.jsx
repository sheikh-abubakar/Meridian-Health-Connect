import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarClock, ClipboardCheck, Stethoscope, UserRoundCheck, Users } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";

const statDefinitions = [
  { key: "scheduled", label: "Scheduled today", icon: CalendarClock, tone: "bg-blue-50 text-blue-700" },
  { key: "checkedIn", label: "Checked in", icon: CalendarCheck2, tone: "bg-teal-50 text-teal-700" },
  { key: "completed", label: "Completed today", icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-700" },
];

export function AdminAnalyticsDashboard() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/${tenantSlug}/${locationSlug}/analytics`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then((data) => { if (active) setAnalytics(data); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [locationSlug, session.accessToken, tenantSlug]);

  return <><p className="text-sm font-medium text-teal-700">Location intelligence</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Operational overview</h1><p className="mt-2 text-muted-foreground">Read-only performance and activity metrics for this branch.</p>{error ? <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : !analytics ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-lg border bg-white" />)}</div> : <><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="bg-white shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">Registered patients</p><p className="mt-3 text-3xl font-semibold tracking-tight">{analytics.patients.total}</p></div><div className="grid size-10 place-items-center rounded-md bg-violet-50 text-violet-700"><Users className="size-5" /></div></div><div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground"><UserRoundCheck className="size-4 text-teal-700" /><span className="font-semibold text-slate-900">{analytics.patients.today}</span> registered today</div></CardContent></Card>{statDefinitions.map((stat) => { const Icon = stat.icon; return <Card key={stat.key} className="bg-white shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{stat.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{analytics.appointmentsToday[stat.key]}</p></div><div className={`grid size-10 place-items-center rounded-md ${stat.tone}`}><Icon className="size-5" /></div></div><p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Current branch · today</p></CardContent></Card>; })}</section><Card className="mt-6 bg-white shadow-none"><CardHeader><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-700"><Stethoscope className="size-5" /></div><div><CardTitle className="text-lg">Doctor activity</CardTitle><CardDescription className="mt-1">Completed patient visits by active doctor.</CardDescription></div></div></CardHeader><CardContent className="p-0">{analytics.doctors.length === 0 ? <div className="px-6 py-12 text-center"><p className="font-medium">No active doctors</p><p className="mt-1 text-sm text-muted-foreground">Add a Doctor from Staff management to begin tracking activity.</p></div> : <Table><TableHeader><TableRow><TableHead>Doctor</TableHead><TableHead>Completed today</TableHead><TableHead>Completed total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{analytics.doctors.map((doctor) => <TableRow key={doctor.id}><TableCell><p className="font-medium">{doctor.name}</p><p className="text-xs text-muted-foreground">{doctor.email}</p></TableCell><TableCell className="font-semibold">{doctor.completedToday}</TableCell><TableCell className="font-semibold">{doctor.completedTotal}</TableCell><TableCell><Badge variant="verified">Active</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><p className="mt-3 text-xs text-muted-foreground">Completed-visit totals currently use completed appointments. They will reconcile to finalized encounters when Step 6 is implemented.</p></>}</>;
}

