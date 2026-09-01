import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Plus, Stethoscope, UserRoundCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { PatientCreateForm } from "@/components/PatientCreateForm";
import { PatientSearchStep } from "@/components/PatientSearchStep";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { dateKey, dayNames, formatClinicDateTime, formatTime12, isAvailableDateTime } from "@/lib/schedule";

const initialForm = { patientId: "", doctorId: "", visitType: "", scheduledAt: "" };
const filters = [{ value: "all", label: "All appointments" }, { value: "today", label: "Today" }, { value: "upcoming", label: "Upcoming" }];

export function SchedulingPage() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingStep, setBookingStep] = useState("patient-search");
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest(`${root}/appointments`, { headers }), apiRequest(`${root}/doctors`, { headers })])
      .then(([appointmentData, doctorData]) => {
        if (!active) return;
        setAppointments(appointmentData.appointments);
        setDoctors(doctorData.doctors);
      }).catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [headers, root]);

  const visibleAppointments = appointments.filter((appointment) => {
    const appointmentDate = appointment.scheduledAt.slice(0, 10);
    if (scheduleFilter === "today") return appointmentDate === dateKey();
    if (scheduleFilter === "upcoming") return appointmentDate >= dateKey();
    return true;
  });
  const validSelection = form.scheduledAt && isAvailableDateTime(form.scheduledAt, availability);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError(""); }
  async function selectDoctor(doctorId) {
    update("doctorId", doctorId); update("scheduledAt", ""); setAvailability([]);
    try { const data = await apiRequest(`${root}/availability/${doctorId}`, { headers }); setAvailability(data.availability.slots); }
    catch (requestError) { setFormError(requestError.message); }
  }
  function changeOpen(next) {
    setOpen(next);
    if (!next) { setForm(initialForm); setAvailability([]); setFormError(""); setBookingStep("patient-search"); setPatientQuery(""); setSelectedPatient(null); }
  }
  function choosePatient(patient) { setSelectedPatient(patient); update("patientId", patient.id); setBookingStep("appointment"); }
  function patientCreated(patient) { choosePatient(patient); }
  async function book(event) {
    event.preventDefault();
    if (!validSelection) { setFormError("Choose a date and time within the doctor's displayed availability."); return; }
    setSubmitting(true); setFormError("");
    try {
      const data = await apiRequest(`${root}/appointments`, { method: "POST", headers, body: JSON.stringify(form) });
      setAppointments((current) => [...current, data.appointment].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
      setScheduleFilter("all");
      setNotice(`Appointment booked for ${formatClinicDateTime(data.appointment.scheduledAt)}.`);
      changeOpen(false);
    } catch (requestError) { setFormError(requestError.message); }
    finally { setSubmitting(false); }
  }
  async function checkIn(id) {
    try {
      const data = await apiRequest(`${root}/appointments/${id}/check-in`, { method: "PATCH", headers });
      setAppointments((current) => current.map((item) => item._id === id ? data.appointment : item));
    } catch (requestError) { setError(requestError.message); }
  }

  return <>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm font-medium text-teal-700">Front-desk operations</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Scheduling</h1><p className="mt-2 text-muted-foreground">View today and upcoming appointments, eligibility, and check-in status.</p></div>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button className="bg-teal-700 hover:bg-teal-800"><Plus className="mr-2 size-4" /> Book Appointment</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{bookingStep === "patient-search" ? "Find patient" : bookingStep === "patient-create" ? "Register and book" : "Book appointment"}</DialogTitle><DialogDescription>{bookingStep === "patient-search" ? "Search for the existing patient record before booking." : bookingStep === "patient-create" ? "Create a new branch patient, then continue with scheduling." : "Book this visit against the selected patient's existing history."}</DialogDescription></DialogHeader>
          {bookingStep === "patient-search" && <PatientSearchStep basePath={`${root}/patients`} headers={headers} onSelect={choosePatient} onCreate={(query) => { setPatientQuery(query); setBookingStep("patient-create"); }} />}
          {bookingStep === "patient-create" && <PatientCreateForm basePath={`${root}/patients`} headers={headers} initialQuery={patientQuery} onBack={() => setBookingStep("patient-search")} onCreated={patientCreated} onViewExisting={choosePatient} />}
          {bookingStep === "appointment" && <form className="space-y-5" onSubmit={book}>
            <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-white text-teal-700"><UserRoundCheck className="size-4" /></span><div><p className="text-sm font-semibold text-teal-950">{selectedPatient?.name}</p><p className="text-xs text-teal-800">{selectedPatient?.phone}</p></div></div><Button type="button" size="sm" variant="ghost" onClick={() => { setBookingStep("patient-search"); setSelectedPatient(null); update("patientId", ""); }}><ArrowLeft className="mr-1 size-3.5" /> Change</Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Doctor</Label><Select value={form.doctorId} onValueChange={selectDoctor}><SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger><SelectContent>{doctors.map((doctor) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="visit-type">Visit type</Label><Input id="visit-type" placeholder="e.g. General consultation" value={form.visitType} onChange={(event) => update("visitType", event.target.value)} required /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="scheduled-at">Date and time</Label><Input id="scheduled-at" type="datetime-local" min={`${dateKey()}T00:00`} value={form.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} disabled={!form.doctorId} required />{form.scheduledAt && <p className={`text-xs ${validSelection ? "text-emerald-700" : "text-red-600"}`}>{validSelection ? "This time is within the doctor's availability." : "This time falls outside the doctor's availability shown below."}</p>}</div>
            </div>
            <div className="rounded-md border bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4 text-teal-700" /> Doctor availability</div>{availability.length ? <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">{availability.map((slot) => <span key={`${slot.dayOfWeek}-${slot.startTime}`}>{dayNames[slot.dayOfWeek]}: {formatTime12(slot.startTime)} - {formatTime12(slot.endTime)}</span>)}</div> : <p className="text-xs text-muted-foreground">Select a doctor to view working hours.</p>}</div>
            {formError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={submitting || !form.patientId || !form.doctorId || !validSelection}>{submitting ? "Booking..." : "Book appointment"}</Button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
    {notice && <div className="mt-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="size-4" />{notice}</div>}
    {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="mt-8 flex flex-wrap items-center gap-2 rounded-lg border bg-white p-1.5 shadow-sm">{filters.map((item) => <Button key={item.value} size="sm" variant={scheduleFilter === item.value ? "default" : "outline"} className={scheduleFilter === item.value ? "bg-teal-700 hover:bg-teal-800" : "border-transparent shadow-none"} onClick={() => setScheduleFilter(item.value)}>{item.label}</Button>)}</div>
    <Card className="mt-4 bg-white shadow-none"><CardContent className="p-0">
      {loading ? <div className="space-y-3 p-6"><div className="h-12 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded bg-slate-100" /></div> : visibleAppointments.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="grid size-12 place-items-center rounded-md bg-teal-50 text-teal-700"><CalendarDays className="size-5" /></div><p className="mt-4 font-medium">No appointments in this view</p><p className="mt-1 text-sm text-muted-foreground">Try another filter or book an appointment within a doctor's working hours.</p></div> : <Table>
        <TableHeader><TableRow><TableHead>Time & patient</TableHead><TableHead>Doctor</TableHead><TableHead>Status</TableHead><TableHead>Eligibility</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
        <TableBody>{visibleAppointments.map((appointment) => <TableRow key={appointment._id}><TableCell><p className="font-medium">{appointment.patientId?.name}</p><p className="text-xs text-muted-foreground">{formatClinicDateTime(appointment.scheduledAt)} · {appointment.visitType}</p></TableCell><TableCell><span className="flex items-center gap-2"><Stethoscope className="size-4 text-teal-700" />{appointment.doctorId?.name}</span></TableCell><TableCell><Badge variant={appointment.status}>{appointment.status.replace("_", " ")}</Badge></TableCell><TableCell><Badge variant={appointment.eligibilityStatus}>{appointment.eligibilityStatus}</Badge></TableCell><TableCell className="text-right">{appointment.status === "scheduled" ? <Button size="sm" variant="outline" onClick={() => checkIn(appointment._id)}>Check In</Button> : <span className="text-xs text-muted-foreground">No action</span>}</TableCell></TableRow>)}</TableBody>
      </Table>}
    </CardContent></Card>
  </>;
}
