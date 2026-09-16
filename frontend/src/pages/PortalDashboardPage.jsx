import {
  Bell,
  CalendarPlus,
  ClipboardList,
  CalendarDays,
  ChevronLeft,
  Download,
  Heart,
  Home,
  History,
  LogOut,
  MessageCircle,
  Menu,
  Plus,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiRequest, openPdfPreview } from "@/api/client";
import { clearPortalSession, readPortalSession } from "@/portal/portal-session";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";
const stamp = (value) =>
  new Intl.DateTimeFormat("en-PK", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi",
  }).format(new Date(value));
const displayTime = (value) => {
  const [h, m] = String(value || "")
    .split(":")
    .map(Number);
  return Number.isInteger(h)
    ? `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
    : value;
};
const status = (value) =>
  ({
    scheduled: "Scheduled",
    checked_in: "Checked in",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "Missed visit",
  })[value] || value;
function Visits({ items }) {
  return (
    <div className="space-y-3">
      {items.length ? (
        items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <p className="font-bold">{item.visitType}</p>
            <p className="mt-2 text-slate-700">{stamp(item.scheduledAt)}</p>
            <p className="mt-1 text-sm text-slate-500">
              With {item.doctor} · {status(item.status)}
            </p>
          </article>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed bg-white p-7 text-center text-slate-500">
          No appointments to show.
        </p>
      )}
    </div>
  );
}
function Chat({ messages, onSend, sending, expected }) {
  const [body, setBody] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    onSend(body).then(() => setBody(""));
  }
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-gradient-to-r from-teal-700 to-teal-600 p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-white/15">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <h2 className="font-bold">Messages with your care team</h2>
            <p className="text-sm text-teal-50">Secure clinic communication</p>
          </div>
        </div>
      </div>
      <div className="max-h-[440px] min-h-64 space-y-4 overflow-y-auto bg-slate-50 p-5">
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.senderType === "patient" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${m.senderType === "patient" ? "rounded-br-md bg-teal-700 text-white" : "rounded-bl-md bg-white text-slate-800"}`}
              >
                <p>{m.body}</p>
                <p
                  className={`mt-1 text-[11px] ${m.senderType === "patient" ? "text-teal-100" : "text-slate-400"}`}
                >
                  {m.senderType === "patient" ? "You" : "Care team"} ·{" "}
                  {stamp(m.sentAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="grid min-h-56 place-items-center text-center text-slate-500">
            <div>
              <MessageCircle className="mx-auto size-9 text-teal-300" />
              <p className="mt-3 font-medium">Start a secure conversation</p>
              <p className="mt-1 text-sm">
                Your care team will receive your message live.
              </p>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="border-t bg-white p-4">
        <textarea
          className="min-h-24 w-full resize-none rounded-xl border bg-slate-50 p-3 text-base outline-none focus:border-teal-600"
          maxLength="4000"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message to the care team…"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            We typically respond within {expected} hours.
          </p>
          <button
            disabled={sending || !body.trim()}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 font-bold text-white disabled:opacity-50"
          >
            <Send className="size-4" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
export function PortalDashboardPage() {
  const session = readPortalSession();
  const navigate = useNavigate();
  const headers = useMemo(
    () =>
      session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {},
    [session?.accessToken],
  );
  const revision = useRealtimeRevision([
    "message:created",
    "appointment:created",
  ]);
  const [data, setData] = useState(null),
    [appointments, setAppointments] = useState({ upcoming: [], past: [] }),
    [carePlans, setCarePlans] = useState({ enabled: false, carePlans: [] }),
    [chat, setChat] = useState({ messages: [], expectedResponseHours: 24 }),
    [view, setView] = useState("home"),
    [options, setOptions] = useState(null),
    [booking, setBooking] = useState({
      visitTypeId: "",
      doctorId: "",
      date: "",
      time: "",
    }),
    [times, setTimes] = useState([]),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [notifications, setNotifications] = useState([]),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const load = () =>
    Promise.all([
      apiRequest("/patient-portal/session", { headers }),
      apiRequest("/patient-portal/appointments", { headers }),
      apiRequest("/patient-portal/messages", { headers }),
      apiRequest("/patient-portal/care-plans", { headers }),
    ]).then(([profile, visits, messages, plans]) => {
      setData(profile);
      setAppointments(visits);
      setChat(messages);
      setCarePlans(plans);
    });
  useEffect(() => {
    if (session?.accessToken)
      load().catch((e) => {
        setError(e.message);
        clearPortalSession();
      });
  }, [session?.accessToken, revision]);
  useEffect(() => {
    const receive = ({ detail }) => {
      const message = detail.payload?.document;
      if (detail.event === "message:created" && message?.senderType === "staff")
        setNotifications((current) =>
          [{ id: String(message._id), body: message.body }, ...current].slice(
            0,
            20,
          ),
        );
    };
    window.addEventListener("meridian:realtime", receive);
    return () => window.removeEventListener("meridian:realtime", receive);
  }, []);
  useEffect(() => {
    if (booking.visitTypeId && booking.doctorId && booking.date)
      apiRequest(
        `/patient-portal/booking-options?visitTypeId=${booking.visitTypeId}&doctorId=${booking.doctorId}&date=${booking.date}`,
        { headers },
      )
        .then((x) => setTimes(x.availableTimes || []))
        .catch((e) => setError(e.message));
    else setTimes([]);
  }, [booking.visitTypeId, booking.doctorId, booking.date, headers]);
  if (!session?.accessToken) return <Navigate to="/portal/login" replace />;
  if (!data)
    return (
      <main className="grid min-h-screen place-items-center bg-teal-50">
        Loading your portal…
      </main>
    );
  const visit = options?.visitTypes.find((x) => x.id === booking.visitTypeId),
    doctors = visit
      ? options.doctors.filter((d) =>
          d.specialtyIds.some((id) => visit.specialtyIds.includes(id)),
        )
      : [];
  async function openBooking() {
    setError("");
    setOptions(
      await apiRequest("/patient-portal/booking-options", { headers }),
    );
    setBooking({ visitTypeId: "", doctorId: "", date: "", time: "" });
    setView("book");
  }
  async function book() {
    try {
      await apiRequest("/patient-portal/appointments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          visitTypeId: booking.visitTypeId,
          doctorId: booking.doctorId,
          scheduledAt: `${booking.date}T${booking.time}`,
        }),
      });
      await load();
      setView("home");
    } catch (e) {
      setError(e.message);
    }
  }
  async function send(body) {
    setSending(true);
    setError("");
    try {
      await apiRequest("/patient-portal/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ body }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  async function exportRecords() {
    setExporting(true);
    setExportError("");
    try {
      await openPdfPreview("/patient-portal/export", session.accessToken);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 p-5 text-white shadow-2xl transition-transform md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 pb-5">
          <span className="grid size-10 place-items-center rounded-xl bg-teal-600">
            <Heart className="size-5" />
          </span>
          <div>
            <b>Patient Portal</b>
            <p className="text-xs text-slate-400">{data.patient.name}</p>
          </div>
        </div>
        <nav className="mt-6 space-y-2">
          {[
            ["home", Home, "Home"],
            ["book", CalendarPlus, "Book appointment"],
            ["chat", MessageCircle, "Messages"],
            ["past", History, "Past visits"],
            ...(carePlans.enabled
              ? [["plans", ClipboardList, "Care plans"]]
              : []),
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => {
                if (key === "book") openBooking();
                else setView(key);
                setMobileMenuOpen(false);
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${view === key ? "bg-teal-600 text-white" : "text-slate-200 hover:bg-slate-800"}`}
            >
              <span className="grid size-8 place-items-center rounded-md bg-white/10">
                <Icon className="size-4" />
              </span>
              {label}
            </button>
          ))}
        </nav>
        <p className="mt-auto text-xs leading-5 text-slate-400">
          For urgent or emergency care, contact your local emergency service.
        </p>
      </aside>
      <div className="min-w-0 md:pl-64">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open portal menu"
                className="grid size-10 place-items-center rounded-lg border md:hidden"
              >
                <Menu className="size-5" />
              </button>
              <span className="grid size-11 place-items-center rounded-xl bg-teal-700 text-white">
                <Heart />
              </span>
              <div>
                <b>{data.clinic.name}</b>
                <p className="text-sm text-slate-500">
                  {data.clinic.branchName}
                </p>
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <button
                className="relative grid size-10 place-items-center rounded-lg border text-teal-800"
                aria-label="Care team message notifications"
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Bell className="size-5" />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b p-3">
                    <b className="text-sm">Care team replies</b>
                    <button
                      className="text-xs text-teal-700"
                      onClick={() => setNotifications([])}
                    >
                      Clear
                    </button>
                  </div>
                  {notifications.length ? (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        className="block w-full border-b p-3 text-left hover:bg-teal-50"
                        onClick={() => {
                          setNotifications((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          );
                          setNotificationsOpen(false);
                          setView("chat");
                        }}
                      >
                        <p className="text-sm font-semibold">
                          New reply from care team
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                          {item.body}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="p-4 text-center text-sm text-slate-500">
                      No new replies.
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  clearPortalSession();
                  navigate("/portal/login");
                }}
                className="flex items-center gap-2 font-semibold text-teal-800"
              >
                <LogOut className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-5 py-9">
          {view === "plans" ? (
            <>
              <h1 className="text-3xl font-bold">Your care plans</h1>
              <p className="mt-2 text-slate-600">
                Follow your agreed care goals and progress.
              </p>
              <div className="mt-6 space-y-4">
                {carePlans.carePlans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-teal-700">
                      Your goal
                    </p>
                    <h2 className="mt-1 text-xl font-bold">{plan.goal}</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-teal-50 p-3">
                        <p className="text-xs text-slate-500">Target</p>
                        <p className="mt-1 font-medium">{plan.targetMeasure}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Review schedule
                        </p>
                        <p className="mt-1 font-medium">{plan.reviewCadence}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm">
                      <strong>
                        {plan.progress.completed} of {plan.progress.total}
                      </strong>{" "}
                      follow-ups completed
                    </p>
                  </article>
                ))}
              </div>
            </>
          ) : view === "chat" ? (
            <>
              <button
                onClick={() => setView("home")}
                className="flex min-h-11 items-center gap-1 font-semibold text-teal-800"
              >
                <ChevronLeft />
                Back to portal
              </button>
              <h1 className="mt-4 text-3xl font-bold">Messages</h1>
              <p className="mt-2 text-slate-600">
                Ask your care team a non-emergency question.
              </p>
              <div className="mt-6">
                <Chat
                  messages={chat.messages}
                  onSend={send}
                  sending={sending}
                  expected={chat.expectedResponseHours}
                />
              </div>
            </>
          ) : view === "past" ? (
            <>
              <button
                onClick={() => setView("home")}
                className="flex min-h-11 items-center gap-1 font-semibold text-teal-800"
              >
                <ChevronLeft />
                Back
              </button>
              <h1 className="mt-4 text-3xl font-bold">Past visits</h1>
              <div className="mt-6">
                <Visits items={appointments.past} />
              </div>
            </>
          ) : view === "book" ? (
            <>
              <button
                onClick={() => setView("home")}
                className="flex min-h-11 items-center gap-1 font-semibold text-teal-800"
              >
                <ChevronLeft />
                Back
              </button>
              <h1 className="mt-4 text-3xl font-bold">Book an appointment</h1>
              <div className="mt-6 space-y-5 rounded-2xl border bg-white p-6">
                <label className="block font-bold">
                  Visit type
                  <select
                    className="mt-2 min-h-12 w-full rounded-xl border p-3"
                    value={booking.visitTypeId}
                    onChange={(e) =>
                      setBooking({
                        visitTypeId: e.target.value,
                        doctorId: "",
                        date: "",
                        time: "",
                      })
                    }
                  >
                    <option value="">Choose a visit</option>
                    {(options?.visitTypes || []).map((x) => (
                      <option value={x.id} key={x.id}>
                        {x.name} · {x.durationMinutes} minutes
                      </option>
                    ))}
                  </select>
                </label>
                {visit && (
                  <label className="block font-bold">
                    Clinician
                    <select
                      className="mt-2 min-h-12 w-full rounded-xl border p-3"
                      value={booking.doctorId}
                      onChange={(e) =>
                        setBooking({
                          ...booking,
                          doctorId: e.target.value,
                          date: "",
                          time: "",
                        })
                      }
                    >
                      <option value="">Choose a clinician</option>
                      {doctors.map((x) => (
                        <option value={x.id} key={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {booking.doctorId && (
                  <label className="block font-bold">
                    Date
                    <input
                      className="mt-2 min-h-12 w-full rounded-xl border p-3"
                      min={new Date().toISOString().slice(0, 10)}
                      type="date"
                      value={booking.date}
                      onChange={(e) =>
                        setBooking({
                          ...booking,
                          date: e.target.value,
                          time: "",
                        })
                      }
                    />
                  </label>
                )}
                {booking.date && (
                  <label className="block font-bold">
                    Available time
                    <select
                      className="mt-2 min-h-12 w-full rounded-xl border p-3"
                      value={booking.time}
                      onChange={(e) =>
                        setBooking({ ...booking, time: e.target.value })
                      }
                    >
                      <option value="">Choose a time</option>
                      {times.map((x) => (
                        <option value={x} key={x}>
                          {displayTime(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {error && (
                  <p className="rounded-xl bg-red-50 p-4 text-red-800">
                    {error}
                  </p>
                )}
                <button
                  onClick={book}
                  disabled={!booking.time}
                  className="min-h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-50"
                >
                  Confirm appointment
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="font-semibold text-teal-700">
                    Your patient portal
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">
                    Hello, {data.patient.name}
                  </h1>
                </div>
                <button
                  onClick={exportRecords}
                  disabled={exporting}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 font-bold text-teal-800 shadow-sm transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:cursor-wait disabled:opacity-60"
                >
                  <Download className="size-5" />
                  {exporting ? "Preparing records..." : "Download My Records"}
                </button>
              </div>
              {exportError && (
                <p
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  role="alert"
                >
                  {exportError}
                </p>
              )}
              <section
                className="mt-7 grid gap-4 md:grid-cols-2"
                aria-label="At a glance"
              >
                <article className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                      <CalendarDays className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-teal-700">
                        Next appointment
                      </p>
                      <p className="text-sm text-slate-500">
                        Your next scheduled clinic visit
                      </p>
                    </div>
                  </div>
                  {appointments.upcoming[0] ? (
                    <>
                      <p className="mt-5 font-bold">
                        {appointments.upcoming[0].visitType}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {stamp(appointments.upcoming[0].scheduledAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        With {appointments.upcoming[0].doctor}
                      </p>
                    </>
                  ) : (
                    <p className="mt-5 text-sm leading-6 text-slate-600">
                      You do not have an upcoming appointment. Use{" "}
                      <strong>Book appointment</strong> in the menu when you are
                      ready.
                    </p>
                  )}
                </article>
                {carePlans.enabled && carePlans.carePlans.length > 0 && (
                  <button
                    onClick={() => setView("plans")}
                    className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
                        <ClipboardList className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-violet-700">
                          Care plan progress
                        </p>
                        <p className="text-sm text-slate-500">
                          Tap to view your care plans
                        </p>
                      </div>
                    </div>
                    <p className="mt-5 font-bold">
                      {carePlans.carePlans[0].goal}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      <strong>
                        {carePlans.carePlans[0].progress.completed} of{" "}
                        {carePlans.carePlans[0].progress.total}
                      </strong>{" "}
                      follow-ups completed
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{
                          width: `${carePlans.carePlans[0].progress.total ? (carePlans.carePlans[0].progress.completed / carePlans.carePlans[0].progress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </button>
                )}
              </section>
              <section className="mt-9">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Upcoming appointments</h2>
                  <button
                    onClick={() => setView("past")}
                    className="font-semibold text-teal-800"
                  >
                    Past visits
                  </button>
                </div>
                <div className="mt-4">
                  <Visits items={appointments.upcoming} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
