import { useEffect, useMemo, useState } from "react";
import { 
  AlertTriangle, 
  BellRing, 
  CalendarDays, 
  CheckCircle2, 
  Clock3, 
  Filter, 
  ListPlus, 
  Plus, 
  Search, 
  Stethoscope, 
  Trash2, 
  UserCheck, 
  UserX, 
  XCircle,
  Building2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { PatientCreateForm } from "@/components/PatientCreateForm";
import { PatientSearchStep } from "@/components/PatientSearchStep";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";
import { dateKey, dayNames, formatClinicDateTime, formatTime12, isAvailableDateTime } from "@/lib/schedule";

const blank = { patientId: "", visitTypeId: "", doctorId: "", resourceId: "none", scheduledAt: "", overrideReason: "" };
const stale = (value) => !value || Date.now() - new Date(value).getTime() > 72 * 60 * 60 * 1000;

const statusTabs = [
  { id: "all", label: "All Visits" },
  { id: "scheduled", label: "Scheduled", variant: "scheduled" },
  { id: "checked_in", label: "Checked In", variant: "checked_in" },
  { id: "completed", label: "Completed", variant: "completed" },
  { id: "cancelled", label: "Cancelled", variant: "cancelled" },
  { id: "no_show", label: "No-Shows", variant: "no_show" },
];

export function SchedulingPage() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision([
    "appointment:created", "appointment:updated", "staff:created", "staff:updated",
    "availability:updated", "resource:created", "visittype:created", "waitlist:created",
    "waitlist:removed", "reminder:created", "reminder:updated"
  ]);

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [resources, setResources] = useState([]);
  const [visitTypes, setVisitTypes] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [availability, setAvailability] = useState([]);

  // UI Filter states
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showWaitlist, setShowWaitlist] = useState(false);

  // Dialog & Booking state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [step, setStep] = useState("search");
  const [booking, setBooking] = useState(blank);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [patient, setPatient] = useState(null);
  const [waitPatient, setWaitPatient] = useState(null);
  const [waitDoctor, setWaitDoctor] = useState("");
  const [waitNote, setWaitNote] = useState("");
  const [scheduledWaitId, setScheduledWaitId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(Date.now());

  useEffect(() => {
    let live = true;
    Promise.all([
      apiRequest(`${root}/appointments`, { headers }),
      apiRequest(`${root}/doctors`, { headers }),
      apiRequest(`${root}/resources`, { headers }),
      apiRequest(`${root}/resources/visit-types`, { headers }),
      apiRequest(`${root}/waitlist`, { headers }),
      apiRequest(`${root}/reminders`, { headers }),
    ])
      .then(([a, d, r, v, w, m]) => {
        if (!live) return;
        setAppointments(a.appointments);
        setDoctors(d.doctors);
        setResources(r.resources);
        setVisitTypes(v.visitTypes);
        setWaitlist(w.waitlist);
        setReminders(m.reminders);
      })
      .catch((requestError) => live && setError(requestError.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [headers, revision, root]);

  useEffect(() => {
    const timer = window.setInterval(() => tick(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!bookingOpen || step !== "details") return undefined;
    const timer = window.setTimeout(() => {
      const inputs = [...document.querySelectorAll('input[type="datetime-local"]')];
      const dateInput = inputs.at(-1);
      if (!dateInput) return;
      dateInput.disabled = !selectedDoctorId;
      let panel = document.getElementById("meridian-doctor-availability");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "meridian-doctor-availability";
        panel.className = "mt-3 rounded-md border bg-slate-50 p-3 text-xs text-slate-700";
        dateInput.parentElement?.appendChild(panel);
      }
      if (!selectedDoctorId) {
        panel.innerHTML = "<p class='text-slate-500'>Select an eligible Doctor to view their published availability.</p>";
        return;
      }
      if (!availability.length) {
        panel.innerHTML = "<p class='font-medium text-amber-700'>This Doctor has not published availability yet.</p>";
        return;
      }
      const rows = availability.map((slot) => `<span>${dayNames[slot.dayOfWeek]}: ${formatTime12(slot.startTime)}–${formatTime12(slot.endTime)}</span>`).join("");
      panel.innerHTML = `<p class='mb-2 font-semibold text-slate-800'>Doctor availability</p><div class='grid gap-1 sm:grid-cols-2'>${rows}</div>`;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [availability, bookingOpen, selectedDoctorId, step]);

  const selectedVisit = visitTypes.find((item) => item.id === booking.visitTypeId);
  const eligibleDoctors = selectedVisit ? doctors.filter((doctor) => doctor.specialties?.some((specialty) => selectedVisit.specialtyIds.includes(specialty.id))) : [];
  const eligibleResources = selectedVisit?.requiredResourceType ? resources.filter((resource) => resource.type === selectedVisit.requiredResourceType) : resources;
  const valid = booking.scheduledAt && selectedDoctorId && isAvailableDateTime(booking.scheduledAt, availability);

  const update = (key, value) => {
    setBooking((current) => ({ ...current, [key]: value }));
    if (key !== "overrideReason") setError("");
  };

  async function loadAvailability(doctorId) {
    const data = await apiRequest(`${root}/availability/${doctorId}`, { headers });
    setAvailability(data.availability.slots);
  }

  function closeBooking(open) {
    setBookingOpen(open);
    if (!open) {
      setStep("search");
      setBooking(blank);
      setSelectedDoctorId("");
      setPatient(null);
      setAvailability([]);
      setScheduledWaitId("");
      setError("");
    }
  }

  function choosePatient(item) {
    setPatient(item);
    update("patientId", item.id);
    setStep("details");
  }

  async function chooseVisit(visitTypeId) {
    update("visitTypeId", visitTypeId);
    update("doctorId", "");
    update("resourceId", "none");
    update("scheduledAt", "");
    setSelectedDoctorId("");
    setAvailability([]);
  }

  async function chooseDoctor(doctorId) {
    setError("");
    setSelectedDoctorId(doctorId);
    setBooking((current) => ({ ...current, doctorId, scheduledAt: "" }));
    try {
      await loadAvailability(doctorId);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function book(event) {
    event.preventDefault();
    if (!valid) return setError("Choose a date and time that fits the selected Doctor's availability.");
    try {
      const data = await apiRequest(`${root}/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...booking, doctorId: selectedDoctorId, resourceId: booking.resourceId === "none" ? undefined : booking.resourceId }),
      });
      setAppointments((current) => [...current, data.appointment].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
      if (scheduledWaitId) {
        await apiRequest(`${root}/waitlist/${scheduledWaitId}`, { method: "DELETE", headers });
        setWaitlist((current) => current.filter((item) => item._id !== scheduledWaitId));
      }
      setNotice(scheduledWaitId ? "Appointment booked and patient removed from waitlist." : "Appointment booked with configured provider, duration and resource rules.");
      closeBooking(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function checkIn(item) {
    try {
      const data = await apiRequest(`${root}/appointments/${item._id}/check-in`, { method: "PATCH", headers });
      setAppointments((current) => current.map((entry) => (entry._id === item._id ? data.appointment : entry)));
      setNotice("Patient checked in and eligibility re-verified.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function cancel(item) {
    const reason = window.prompt("Cancellation reason (required):");
    if (!reason) return;
    try {
      const data = await apiRequest(`${root}/appointments/${item._id}/cancel`, { method: "PATCH", headers, body: JSON.stringify({ reason }) });
      setAppointments((current) => current.map((entry) => (entry._id === item._id ? data.appointment : entry)));
      setNotice("Appointment cancelled. Waiting patients remain available for scheduling.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function noShow(item) {
    if (!window.confirm(`Mark ${item.patientId?.name} as a no-show?`)) return;
    try {
      const data = await apiRequest(`${root}/appointments/${item._id}/no-show`, { method: "PATCH", headers });
      setAppointments((current) => current.map((entry) => (entry._id === item._id ? data.appointment : entry)));
      setNotice("Appointment marked no-show and pending reminders stopped.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addWaitlist(event) {
    event.preventDefault();
    if (!waitDoctor) return setError("Select the preferred Doctor.");
    try {
      const data = await apiRequest(`${root}/waitlist`, { method: "POST", headers, body: JSON.stringify({ patientId: waitPatient.id, doctorId: waitDoctor, note: waitNote }) });
      setWaitlist((current) => [data.entry, ...current]);
      setWaitOpen(false);
      setWaitPatient(null);
      setWaitDoctor("");
      setWaitNote("");
      setNotice("Patient added to the waitlist.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function scheduleWaiting(entry) {
    const person = entry.patientId;
    const doctor = entry.doctorId;
    if (!person?._id || !doctor?._id) return setError("Waitlist record is incomplete.");
    setPatient({ id: person._id, name: person.name });
    setBooking({ ...blank, patientId: person._id, doctorId: doctor._id });
    setScheduledWaitId(entry._id);
    setStep("details");
    setBookingOpen(true);
    try {
      await loadAvailability(doctor._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeWaiting(entry) {
    if (!window.confirm(`Remove ${entry.patientId?.name} from waitlist?`)) return;
    await apiRequest(`${root}/waitlist/${entry._id}`, { method: "DELETE", headers });
    setWaitlist((current) => current.filter((item) => item._id !== entry._id));
    setNotice("Patient removed from waitlist.");
  }

  const reminderText = (id) => reminders.filter((item) => String(item.appointmentId) === String(id)).map((item) => `${item.channel}: ${item.status.replaceAll("_", " ")}`).join(" | ");

  // Status Counts
  const counts = useMemo(() => {
    const map = { all: appointments.length };
    appointments.forEach((item) => {
      map[item.status] = (map[item.status] || 0) + 1;
    });
    return map;
  }, [appointments]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      // Tab filter
      if (activeTab !== "all" && item.status !== activeTab) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const patientName = item.patientId?.name?.toLowerCase() || "";
        const doctorName = item.doctorId?.name?.toLowerCase() || "";
        const visitType = item.visitType?.toLowerCase() || "";
        const resourceName = item.resourceId?.name?.toLowerCase() || "";
        return patientName.includes(q) || doctorName.includes(q) || visitType.includes(q) || resourceName.includes(q);
      }
      return true;
    });
  }, [appointments, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b pb-5">
        <div>
          <p className="text-sm font-semibold tracking-wide uppercase text-teal-700">Front-desk Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Patient Scheduling</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage clinic appointments, arrivals, check-ins, waitlists, and provider resources.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowWaitlist((prev) => !prev)}
            className="relative border-slate-200 hover:bg-slate-50"
          >
            <ListPlus className="mr-2 size-4 text-violet-700" />
            Waitlist
            {waitlist.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                {waitlist.length}
              </span>
            )}
          </Button>

          {/* Waitlist Modal */}
          <Dialog open={waitOpen} onOpenChange={setWaitOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50">
                <Plus className="mr-1.5 size-4" /> Add to Waitlist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Patient to Waitlist</DialogTitle>
                <DialogDescription>Use when the preferred Doctor has no suitable slot available.</DialogDescription>
              </DialogHeader>
              {!waitPatient ? (
                <PatientSearchStep basePath={`${root}/patients`} headers={headers} onSelect={setWaitPatient} onCreate={() => setError("Register patient first, then return here.")} />
              ) : (
                <form className="space-y-4" onSubmit={addWaitlist}>
                  <div className="rounded-lg bg-teal-50/80 p-3.5 border border-teal-100">
                    <p className="text-xs text-teal-700 font-medium">Selected Patient</p>
                    <p className="text-base font-semibold text-teal-950 mt-0.5">{waitPatient.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Doctor</Label>
                    <Select value={waitDoctor} onValueChange={setWaitDoctor}>
                      <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                      <SelectContent>{doctors.map((doctor) => <SelectItem value={doctor.id} key={doctor.id}>{doctor.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preference or Note (optional)</Label>
                    <Input value={waitNote} onChange={(event) => setWaitNote(event.target.value)} placeholder="e.g. Morning preference, urgent consultation" />
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium">Add to Waitlist</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Booking Dialog */}
          <Dialog open={bookingOpen} onOpenChange={closeBooking}>
            <DialogTrigger asChild>
              <Button className="bg-teal-700 hover:bg-teal-800 text-white shadow-sm font-medium">
                <Plus className="mr-1.5 size-4" /> Book Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              {step === "search" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Find Patient for Booking</DialogTitle>
                  </DialogHeader>
                  <PatientSearchStep basePath={`${root}/patients`} headers={headers} onSelect={choosePatient} onCreate={(value) => { setQuery(value); setStep("create"); }} />
                </>
              )}
              {step === "create" && (
                <PatientCreateForm basePath={`${root}/patients`} headers={headers} initialQuery={query} onBack={() => setStep("search")} onCreated={choosePatient} onViewExisting={choosePatient} />
              )}
              {step === "details" && (
                <form className="space-y-4" onSubmit={book}>
                  <DialogHeader>
                    <DialogTitle>{scheduledWaitId ? "Offer Available Slot" : "Book Appointment"}</DialogTitle>
                    <DialogDescription>{scheduledWaitId ? "Select a visit type and valid slot; patient will be removed from waitlist upon booking." : `Booking appointment for ${patient?.name}.`}</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-1.5">
                    <Label>Visit Type</Label>
                    <Select value={booking.visitTypeId} onValueChange={chooseVisit}>
                      <SelectTrigger><SelectValue placeholder="Select visit type" /></SelectTrigger>
                      <SelectContent>{visitTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min</SelectItem>)}</SelectContent>
                    </Select>
                    {!visitTypes.length && <p className="text-xs text-amber-700">Admin must configure visit types in Scheduling Setup before booking.</p>}
                  </div>

                  {selectedVisit && (
                    <div className="rounded-md border border-violet-100 bg-violet-50/70 p-3 text-xs text-violet-900 space-y-1">
                      <p className="font-semibold">{selectedVisit.name} ({selectedVisit.durationMinutes} min)</p>
                      <p>Eligible specialties: {selectedVisit.specialties.map((item) => item.name).join(", ")}</p>
                      <p>Resource rule: {selectedVisit.requiredResourceType ? `Requires ${selectedVisit.requiredResourceType.replaceAll("_", " ")}` : "No resource required"}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Eligible Doctor</Label>
                    <Select value={booking.doctorId} onValueChange={chooseDoctor} disabled={!selectedVisit || Boolean(scheduledWaitId)}>
                      <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                      <SelectContent>{(scheduledWaitId ? doctors.filter((doctor) => doctor.id === booking.doctorId) : eligibleDoctors).map((doctor) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialties?.map((item) => item.name).join(", ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{selectedVisit?.requiredResourceType ? `Required ${selectedVisit.requiredResourceType.replaceAll("_", " ")}` : "Resource (optional)"}</Label>
                    <Select value={booking.resourceId} onValueChange={(value) => update("resourceId", value)} disabled={!selectedVisit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {!selectedVisit?.requiredResourceType && <SelectItem value="none">No resource required</SelectItem>}
                        {eligibleResources.map((resource) => <SelectItem value={resource._id} key={resource._id}>{resource.name} · {resource.type.replaceAll("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" min={`${dateKey()}T00:00`} value={booking.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} disabled={!booking.doctorId} required />
                    <p className={`text-xs ${booking.scheduledAt ? (valid ? "text-emerald-700 font-medium" : "text-red-600 font-medium") : "text-slate-400"}`}>
                      {booking.scheduledAt ? (valid ? "✓ Time slot is within published Doctor availability." : "✕ Outside Doctor availability.") : "Select an eligible Doctor first."}
                    </p>
                  </div>

                  {error.includes("conflict") && (
                    <div className="rounded-md border border-amber-300 bg-amber-50/80 p-3 space-y-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <AlertTriangle className="size-4 text-amber-700" /> Conflict Detection & Explicit Override
                      </p>
                      <Input value={booking.overrideReason} onChange={(event) => update("overrideReason", event.target.value)} placeholder="Enter authorized override reason (required)..." />
                    </div>
                  )}

                  {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

                  <DialogFooter>
                    <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium" disabled={!valid || !booking.visitTypeId || (Boolean(selectedVisit?.requiredResourceType) && booking.resourceId === "none")}>
                      Confirm & Book Appointment
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Global Alerts / Notices */}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-3.5 text-sm font-medium text-emerald-800 flex items-center justify-between shadow-xs">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}
      {error && !bookingOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50/90 p-3.5 text-sm font-medium text-red-800 flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-900 text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}

      {/* Waitlist Drawer / Section */}
      {showWaitlist && (
        <Card className="border-violet-200 bg-violet-50/40 shadow-xs transition-all">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-violet-950">
                <ListPlus className="size-4 text-violet-700" /> Active Clinic Waitlist
              </CardTitle>
              <CardDescription className="text-xs text-violet-800/80">
                Patients waiting for available doctor slots. Click "Schedule" when a slot opens.
              </CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-violet-700 hover:bg-violet-100" onClick={() => setShowWaitlist(false)}>
              <ChevronUp className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {waitlist.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {waitlist.map((entry) => (
                  <div className="flex flex-col justify-between rounded-lg border border-violet-100 bg-white p-3.5 shadow-2xs hover:border-violet-300 transition" key={entry._id}>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{entry.patientId?.name || "Patient"}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                        <Stethoscope className="size-3.5 text-violet-600" /> {entry.doctorId?.name || "Preferred Doctor"}
                      </p>
                      {entry.note && (
                        <p className="mt-1 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                          "{entry.note}"
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t pt-2.5">
                      <Button size="xs" variant="outline" className="text-red-600 hover:bg-red-50 border-slate-200 h-8 px-2.5 text-xs" onClick={() => removeWaiting(entry)}>
                        <Trash2 className="mr-1 size-3" /> Remove
                      </Button>
                      <Button size="xs" className="bg-teal-700 hover:bg-teal-800 text-white h-8 px-3 text-xs font-medium" onClick={() => scheduleWaiting(entry)}>
                        Schedule Slot
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-violet-700 py-2">No patients currently on the waitlist.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Appointments View Controls: Tabs & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Tabs Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {statusTabs.map((tab) => {
              const count = counts[tab.id] || 0;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-teal-700 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Real-time Search Field */}
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, doctor, room..."
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600">
                <XCircle className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Appointments Content Area */}
        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
            <CalendarDays className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No appointments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? `No appointments matching "${searchQuery}"` : `There are no ${activeTab === "all" ? "" : activeTab.replace("_", " ")} appointments recorded.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {filteredAppointments.map((item) => {
              const passed = new Date(item.scheduledAt).getTime() <= Date.now();
              const isStale = item.status === "scheduled" && stale(item.eligibilityCheckedAt);
              const reminderInfo = reminderText(item._id);

              return (
                <div
                  key={item._id}
                  className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-teal-300 hover:shadow-xs"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    
                    {/* Left: Patient & Time Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-sm border border-teal-100">
                        {item.patientId?.name ? item.patientId.name.charAt(0).toUpperCase() : "P"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm tracking-tight">
                            {item.patientId?.name || "Unknown Patient"}
                          </p>
                          <Badge variant={item.status} className="capitalize">
                            {item.status.replace("_", " ")}
                          </Badge>
                          {item.isOverbooked && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Overbooked
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <CalendarDays className="size-3.5 text-teal-700" />
                            {formatClinicDateTime(item.scheduledAt)}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                            {item.visitType} ({item.durationMinutes || 30}m)
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Stethoscope className="size-3.5 text-slate-400" />
                            {item.doctorId?.name || "Provider unassigned"}
                          </span>
                          {item.resourceId && (
                            <span className="flex items-center gap-1">
                              <Building2 className="size-3.5 text-slate-400" />
                              {item.resourceId.name} ({item.resourceId.type?.replaceAll("_", " ")})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Eligibility & Reminder Badges */}
                    <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 min-w-[210px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-500">Eligibility:</span>
                        <Badge variant={item.eligibilityStatus}>{item.eligibilityStatus}</Badge>
                      </div>
                      {isStale && (
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <AlertTriangle className="size-3 shrink-0" /> Re-verify at check-in
                        </p>
                      )}
                      {reminderInfo ? (
                        <p className="flex items-center gap-1 text-[11px] text-slate-500">
                          <BellRing className="size-3 text-teal-600 shrink-0" /> {reminderInfo}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No reminder activity</p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0">
                      {item.status === "scheduled" ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-teal-700 hover:bg-teal-800 text-white font-medium h-8 text-xs"
                            onClick={() => checkIn(item)}
                          >
                            <UserCheck className="mr-1 size-3.5" /> Check in
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 hover:bg-red-50 border-slate-200 h-8 text-xs"
                            onClick={() => cancel(item)}
                          >
                            <XCircle className="mr-1 size-3.5" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!passed}
                            title={passed ? "Mark patient as no-show" : `Available after ${formatClinicDateTime(item.scheduledAt)}`}
                            className="text-amber-700 hover:bg-amber-50 border-slate-200 h-8 text-xs disabled:opacity-50"
                            onClick={() => noShow(item)}
                          >
                            <UserX className="mr-1 size-3.5" /> No-show
                          </Button>
                        </>
                      ) : item.status === "cancelled" ? (
                        <div className="text-right text-xs text-slate-500">
                          <p className="font-medium text-red-700">Cancelled</p>
                          {item.cancellationReason && (
                            <p className="text-[11px] text-slate-500 max-w-[200px] truncate" title={item.cancellationReason}>
                              "{item.cancellationReason}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 capitalize px-2 py-1 bg-slate-100 rounded">
                          {item.status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

