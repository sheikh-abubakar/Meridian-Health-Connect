import {
  Bell,
  CalendarDays,
  ChevronLeft,
  Heart,
  LogOut,
  MessageCircle,
  Plus,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiRequest } from "@/api/client";
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
    [notifications, setNotifications] = useState([]),
    [notificationsOpen, setNotificationsOpen] = useState(false);
  const load = () =>
    Promise.all([
      apiRequest("/patient-portal/session", { headers }),
      apiRequest("/patient-portal/appointments", { headers }),
      apiRequest("/patient-portal/messages", { headers }),
    ]).then(([profile, visits, messages]) => {
      setData(profile);
      setAppointments(visits);
      setChat(messages);
    });
  useEffect(() => {
    if (session?.accessToken)
      load().catch((e) => {
        setError(e.message);
        clearPortalSession();
      });
  }, [session?.accessToken, revision]);
  useEffect(() => { const receive = ({ detail }) => { const message = detail.payload?.document; if (detail.event === "message:created" && message?.senderType === "staff") setNotifications((current) => [{ id: String(message._id), body: message.body }, ...current].slice(0, 20)); }; window.addEventListener("meridian:realtime", receive); return () => window.removeEventListener("meridian:realtime", receive); }, []);
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
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-teal-700 text-white">
              <Heart />
            </span>
            <div>
              <b>{data.clinic.name}</b>
              <p className="text-sm text-slate-500">{data.clinic.branchName}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-3"><button className="relative grid size-10 place-items-center rounded-lg border text-teal-800" aria-label="Care team message notifications" onClick={() => setNotificationsOpen((value) => !value)}><Bell className="size-5" />{notifications.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{notifications.length}</span>}</button>{notificationsOpen && <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border bg-white shadow-xl"><div className="flex items-center justify-between border-b p-3"><b className="text-sm">Care team replies</b><button className="text-xs text-teal-700" onClick={() => setNotifications([])}>Clear</button></div>{notifications.length ? notifications.map((item) => <button key={item.id} className="block w-full border-b p-3 text-left hover:bg-teal-50" onClick={() => { setNotifications((current) => current.filter((entry) => entry.id !== item.id)); setNotificationsOpen(false); setView("chat"); }}><p className="text-sm font-semibold">New reply from care team</p><p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.body}</p></button>) : <p className="p-4 text-center text-sm text-slate-500">No new replies.</p>}</div>}
          <button
            onClick={() => {
              clearPortalSession();
              navigate("/portal/login");
            }}
            className="flex items-center gap-2 font-semibold text-teal-800"
          >
            <LogOut className="size-5" />
            Sign out
          </button></div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-9">
        {view === "chat" ? (
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
                  {options.visitTypes.map((x) => (
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
                      setBooking({ ...booking, date: e.target.value, time: "" })
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
                <p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>
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
            <p className="font-semibold text-teal-700">Your patient portal</p>
            <h1 className="mt-2 text-3xl font-bold">
              Hello, {data.patient.name}
            </h1>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <button
                onClick={openBooking}
                className="min-h-28 rounded-2xl bg-teal-700 p-5 text-left text-white"
              >
                <CalendarDays />
                <b className="mt-3 block text-lg">Book an appointment</b>
                <span className="text-sm text-teal-100">
                  Choose an approved available time
                </span>
              </button>
              <button
                onClick={() => setView("chat")}
                className="min-h-28 rounded-2xl border bg-white p-5 text-left"
              >
                <MessageCircle className="text-teal-700" />
                <b className="mt-3 block text-lg">Messages</b>
                <span className="text-sm text-slate-500">
                  Talk securely with your care team
                </span>
              </button>
            </div>
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
    </main>
  );
}
