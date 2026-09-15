import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Plus,
  Settings2,
  Stethoscope,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";
const newVisit = () => ({
  name: "",
  durationMinutes: 20,
  specialtyIds: [],
  requiredResourceType: "none",
});
export function ResourcesPage() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${session.accessToken}` }),
    [session.accessToken],
  );
  const revision = useRealtimeRevision([
    "resource:created",
    "resource:updated",
    "specialty:created",
    "visittype:created",
    "visittype:updated",
    "location:updated",
  ]);
  const [resources, setResources] = useState([]),
    [specialties, setSpecialties] = useState([]),
    [visitTypes, setVisitTypes] = useState([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [settings, setSettings] = useState({
    maxOverbookSlotsPerDoctorPerDay: 0,
    reminderHours: 5 / 60,
    escalateToCreatorAfterDays: 3,
    flagToAdminAfterDays: 5,
    selfSchedulingBlackouts: [],
    patientMessageExpectedResponseHours: 24,
    patientMessageFlagToAdminAfterHours: 48,
  });
  const [blackout, setBlackout] = useState({ startDate: "", endDate: "" }),
    [specialty, setSpecialty] = useState(""),
    [resource, setResource] = useState({ name: "", type: "room" }),
    [visit, setVisit] = useState(newVisit());
  const [specialtyOpen, setSpecialtyOpen] = useState(false),
    [resourceOpen, setResourceOpen] = useState(false),
    [visitOpen, setVisitOpen] = useState(false);
  useEffect(() => {
    Promise.all([
      apiRequest(`${root}/resources`, { headers }),
      apiRequest(`${root}/resources/specialties`, { headers }),
      apiRequest(`${root}/resources/visit-types`, { headers }),
      apiRequest(`${root}/context`, { headers }),
    ])
      .then(([r, s, v, c]) => {
        setResources(r.resources);
        setSpecialties(s.specialties);
        setVisitTypes(v.visitTypes);
        const p = c.location.schedulingSettings || {};
        setSettings({
          maxOverbookSlotsPerDoctorPerDay:
            p.maxOverbookSlotsPerDoctorPerDay || 0,
          reminderHours:
            p.reminderRules?.find((x) => x.channel === "sms")?.offsetHours ??
            5 / 60,
          escalateToCreatorAfterDays: p.escalateToCreatorAfterDays ?? 3,
          flagToAdminAfterDays: p.flagToAdminAfterDays ?? 5,
          selfSchedulingBlackouts: p.selfSchedulingBlackouts || [],
          patientMessageExpectedResponseHours:
            p.patientMessageExpectedResponseHours ?? 24,
          patientMessageFlagToAdminAfterHours:
            p.patientMessageFlagToAdminAfterHours ?? 48,
        });
      })
      .catch((e) => setError(e.message));
  }, [headers, revision, root]);
  async function addSpecialty(e) {
    e.preventDefault();
    try {
      const d = await apiRequest(`${root}/resources/specialties`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: specialty }),
      });
      setSpecialties((x) => [...x, d.specialty]);
      setSpecialty("");
      setSpecialtyOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function addResource(e) {
    e.preventDefault();
    try {
      const d = await apiRequest(`${root}/resources`, {
        method: "POST",
        headers,
        body: JSON.stringify(resource),
      });
      setResources((x) => [...x, d.resource]);
      setResource({ name: "", type: "room" });
      setResourceOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function addVisit(e) {
    e.preventDefault();
    try {
      const d = await apiRequest(`${root}/resources/visit-types`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...visit,
          durationMinutes: Number(visit.durationMinutes),
          requiredResourceType:
            visit.requiredResourceType === "none"
              ? null
              : visit.requiredResourceType,
        }),
      });
      setVisitTypes((x) => [...x, d.visitType]);
      setVisit(newVisit());
      setVisitOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function toggle(item, enabled) {
    try {
      const d = await apiRequest(`${root}/resources/visit-types/${item.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ patientSelfSchedulingEnabled: enabled }),
      });
      setVisitTypes((items) =>
        items.map((x) => (x.id === item.id ? d.visitType : x)),
      );
      setNotice(
        `${item.name} is ${enabled ? "available" : "not available"} for patient self-scheduling.`,
      );
    } catch (e) {
      setError(e.message);
    }
  }
  function addBlackout() {
    if (
      !blackout.startDate ||
      !blackout.endDate ||
      blackout.endDate < blackout.startDate
    ) {
      setError("Enter a valid blackout start and end date.");
      return;
    }
    setSettings((v) => ({
      ...v,
      selfSchedulingBlackouts: [...v.selfSchedulingBlackouts, blackout],
    }));
    setBlackout({ startDate: "", endDate: "" });
  }
  async function save(e) {
    e.preventDefault();
    try {
      await apiRequest(`${root}/resources/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          maxOverbookSlotsPerDoctorPerDay: Number(
            settings.maxOverbookSlotsPerDoctorPerDay,
          ),
          reminderRules: [
            { channel: "sms", offsetHours: Number(settings.reminderHours) },
          ],
          escalateToCreatorAfterDays: Number(
            settings.escalateToCreatorAfterDays,
          ),
          flagToAdminAfterDays: Number(settings.flagToAdminAfterDays),
          selfSchedulingBlackouts: settings.selfSchedulingBlackouts,
          patientMessageExpectedResponseHours: Number(
            settings.patientMessageExpectedResponseHours,
          ),
          patientMessageFlagToAdminAfterHours: Number(
            settings.patientMessageFlagToAdminAfterHours,
          ),
        }),
      });
      setNotice(
        "Scheduling safeguards, blackout dates, and task escalation thresholds were saved.",
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">
            Clinic administration
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Scheduling setup</h1>
          <p className="mt-2 text-muted-foreground">
            Configure visit types, resources, safeguards and patient online
            booking.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={specialtyOpen} onOpenChange={setSpecialtyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Stethoscope className="mr-2 size-4" />
                Add specialty
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add specialty</DialogTitle>
              </DialogHeader>
              <form onSubmit={addSpecialty} className="space-y-4">
                <Input
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology"
                />
                <DialogFooter>
                  <Button className="bg-teal-700">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-700">
                <Plus className="mr-2 size-4" />
                Add visit type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add visit type</DialogTitle>
              </DialogHeader>
              <form onSubmit={addVisit} className="space-y-4">
                <Input
                  required
                  placeholder="Name"
                  value={visit.name}
                  onChange={(e) => setVisit({ ...visit, name: e.target.value })}
                />
                <Input
                  required
                  type="number"
                  min="5"
                  max="480"
                  value={visit.durationMinutes}
                  onChange={(e) =>
                    setVisit({ ...visit, durationMinutes: e.target.value })
                  }
                />
                <div className="space-y-2">
                  <Label>Eligible specialties</Label>
                  {specialties.map((i) => (
                    <label className="flex gap-2 text-sm" key={i.id}>
                      <input
                        type="checkbox"
                        checked={visit.specialtyIds.includes(i.id)}
                        onChange={(e) =>
                          setVisit({
                            ...visit,
                            specialtyIds: e.target.checked
                              ? [...visit.specialtyIds, i.id]
                              : visit.specialtyIds.filter((id) => id !== i.id),
                          })
                        }
                      />
                      {i.name}
                    </label>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    disabled={!visit.specialtyIds.length}
                    className="bg-teal-700"
                  >
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {notice && (
        <p className="mt-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mr-2 inline size-4" />
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider specialties</CardTitle>
            <CardDescription>
              Used to determine eligible doctors.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {specialties.map((i) => (
              <span
                key={i.id}
                className="rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-800"
              >
                {i.name}
              </span>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2">
              <ClipboardList className="size-5 text-teal-700" />
              Visit types
            </CardTitle>
            <CardDescription>
              Only explicitly enabled types appear in the patient portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {visitTypes.map((i) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                key={i.id}
              >
                <div>
                  <b>{i.name}</b>{" "}
                  <span className="text-sm text-muted-foreground">
                    · {i.durationMinutes} min
                  </span>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-teal-800">
                  <input
                    type="checkbox"
                    checked={Boolean(i.patientSelfSchedulingEnabled)}
                    onChange={(e) => toggle(i, e.target.checked)}
                  />
                  Available for patient self-scheduling
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2">
              <Boxes className="size-5 text-teal-700" />
              Branch resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 size-4" />
                  Add resource
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add resource</DialogTitle>
                </DialogHeader>
                <form onSubmit={addResource} className="space-y-4">
                  <Input
                    required
                    value={resource.name}
                    onChange={(e) =>
                      setResource({ ...resource, name: e.target.value })
                    }
                    placeholder="Resource name"
                  />
                  <Select
                    value={resource.type}
                    onValueChange={(type) => setResource({ ...resource, type })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="telehealth_link">
                        Telehealth link
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <DialogFooter>
                    <Button className="bg-teal-700">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <div className="mt-4 space-y-2">
              {resources.map((i) => (
                <p key={i._id} className="rounded-lg border p-3 text-sm">
                  {i.name} · {i.type.replaceAll("_", " ")}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex gap-2">
              <Settings2 className="size-5 text-violet-700" />
              Scheduling safeguards
            </CardTitle>
            <CardDescription>
              Staff booking is never blocked by patient portal blackout dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>Max overbook slots per doctor per day</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min="0"
                  value={settings.maxOverbookSlotsPerDoctorPerDay}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxOverbookSlotsPerDoctorPerDay: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>SMS reminder (hours before visit)</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min="0"
                  value={settings.reminderHours}
                  onChange={(e) =>
                    setSettings({ ...settings, reminderHours: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Escalate to task creator after (days overdue)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="1"
                    value={settings.escalateToCreatorAfterDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        escalateToCreatorAfterDays: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Flag to Admin after (days overdue)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="1"
                    value={settings.flagToAdminAfterDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flagToAdminAfterDays: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <Label>Patient Messaging</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set how quickly the clinic should respond before escalations
                  begin.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Expected response time (hours)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min="1"
                      value={settings.patientMessageExpectedResponseHours}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          patientMessageExpectedResponseHours: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Flag to Admin after (hours unanswered)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min="1"
                      value={settings.patientMessageFlagToAdminAfterHours}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          patientMessageFlagToAdminAfterHours: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <Label>Patient self-scheduling blackout windows</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first and last date to block. Patients cannot book on
                  any date within that inclusive range; Front-desk scheduling is
                  unaffected.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="blackout-start">
                      Start date (first blocked day)
                    </Label>
                    <Input
                      id="blackout-start"
                      type="date"
                      value={blackout.startDate}
                      onChange={(e) =>
                        setBlackout({ ...blackout, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="blackout-end">
                      End date (last blocked day)
                    </Label>
                    <Input
                      id="blackout-end"
                      type="date"
                      value={blackout.endDate}
                      onChange={(e) =>
                        setBlackout({ ...blackout, endDate: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    className="w-full sm:col-span-2"
                    type="button"
                    variant="outline"
                    onClick={addBlackout}
                  >
                    Add blackout window
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {settings.selfSchedulingBlackouts.map((i, index) => (
                    <div
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                      key={`${i.startDate}-${i.endDate}-${index}`}
                    >
                      <span>
                        {i.startDate} to {i.endDate}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((v) => ({
                            ...v,
                            selfSchedulingBlackouts:
                              v.selfSchedulingBlackouts.filter(
                                (_, n) => n !== index,
                              ),
                          }))
                        }
                        className="text-red-600"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="bg-teal-700">Save scheduling rules</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
