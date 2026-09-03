import { useEffect, useState } from "react";
import { Clock3, Stethoscope } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";
import { formatClinicDateTime } from "@/lib/schedule";

export function QueuePage() {
  const { tenantSlug, locationSlug } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const realtimeRevision = useRealtimeRevision(["appointment:created", "appointment:updated", "encounter:finalized"]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest(`/${tenantSlug}/${locationSlug}/appointments?status=checked_in`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then((data) => {
      if (active) setAppointments(data.appointments);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [locationSlug, realtimeRevision, session.accessToken, tenantSlug]);

  async function startEncounter(appointmentId) {
    setStartingId(appointmentId); setError("");
    try {
      const data = await apiRequest(`/${tenantSlug}/${locationSlug}/encounters`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ appointmentId }),
      });
      navigate(`/${tenantSlug}/${locationSlug}/encounters/${data.encounter._id}`);
    } catch (requestError) {
      setError(requestError.message); setStartingId(null);
    }
  }

  return <>
    <p className="text-sm font-medium text-teal-700">Clinical arrivals</p>
    <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Queue</h1>
    <p className="mt-2 text-muted-foreground">All patients currently checked in for you in this branch, ordered by appointment time.</p>
    {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card className="mt-8 bg-white shadow-none"><CardContent className="p-0">
      {loading ? <div className="space-y-3 p-6"><div className="h-12 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded bg-slate-100" /></div> : appointments.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="grid size-12 place-items-center rounded-md bg-teal-50 text-teal-700"><Stethoscope className="size-5" /></div><p className="mt-4 font-medium">No checked-in patients</p><p className="mt-1 text-sm text-muted-foreground">New arrivals appear here as soon as Front-desk checks them in, regardless of appointment date.</p></div> : <Table>
        <TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Appointment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Encounter</TableHead></TableRow></TableHeader>
        <TableBody>{appointments.map((appointment) => <TableRow key={appointment._id}><TableCell className="font-medium">{appointment.patientId?.name}</TableCell><TableCell><p>{appointment.visitType}</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3" />{formatClinicDateTime(appointment.scheduledAt)}</p></TableCell><TableCell><Badge variant="checked_in">checked in</Badge></TableCell><TableCell className="text-right"><Button size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => startEncounter(appointment._id)} disabled={startingId === appointment._id}>{startingId === appointment._id ? "Opening…" : "Start Encounter"}</Button></TableCell></TableRow>)}</TableBody>
      </Table>}
    </CardContent></Card>
  </>;
}
