import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, ClipboardCheck, ClipboardClock, HeartHandshake, LayoutDashboard, LogOut, MapPin, Stethoscope, UserCircle, UserRound, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const roleLabels = { admin: "Clinic Admin", frontdesk: "Front-desk Staff", doctor: "Doctor", care_coordinator: "Care Coordinator" };

export function AppLayout() {
  const { tenantSlug, locationSlug } = useParams();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/${tenantSlug}/${locationSlug}/context`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then((data) => { if (active) setLocation(data.location); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [locationSlug, session.accessToken, tenantSlug]);

  const navigation = [
    { label: "Dashboard", to: `/${tenantSlug}/${locationSlug}/dashboard`, icon: LayoutDashboard, visible: true },
    { label: "Staff", to: `/${tenantSlug}/${locationSlug}/staff`, icon: Users, visible: session.user.role === "admin" },
    { label: "Patients", to: `/${tenantSlug}/${locationSlug}/patients`, icon: UserRound, visible: session.user.role === "frontdesk" },
    { label: "Scheduling", to: `/${tenantSlug}/${locationSlug}/scheduling`, icon: CalendarDays, visible: session.user.role === "frontdesk" },
    { label: "My Availability", to: `/${tenantSlug}/${locationSlug}/availability`, icon: ClipboardClock, visible: session.user.role === "doctor" },
    { label: "My Queue", to: `/${tenantSlug}/${locationSlug}/queue`, icon: Stethoscope, visible: session.user.role === "doctor" },
    { label: "My Patients", to: `/${tenantSlug}/${locationSlug}/my-patients`, icon: UserRound, visible: session.user.role === "doctor" },
    { label: "My Care Plans", to: `/${tenantSlug}/${locationSlug}/my-care-plans`, icon: HeartHandshake, visible: ["doctor", "care_coordinator"].includes(session.user.role) },
    { label: "My Tasks", to: `/${tenantSlug}/${locationSlug}/tasks`, icon: ClipboardCheck, visible: session.user.role === "care_coordinator" },
  ];

  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-slate-950 text-white md:block">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><div className="grid size-9 place-items-center rounded-md bg-teal-500"><Building2 className="size-4" /></div><div><p className="text-sm font-semibold">Meridian Health</p><p className="text-xs text-slate-400">Pilot Zero</p></div></div>
      <nav className="space-y-1 p-3">{session.user.role === "admin" && <NavLink to={`/${tenantSlug}/overview`} className="mb-3 flex items-center gap-3 border-b border-slate-800 px-3 pb-3 pt-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="size-4" /> Switch branch</NavLink>}{navigation.filter((item) => item.visible).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-900 hover:text-white", isActive && "bg-slate-800 text-white")}><item.icon className="size-4 text-teal-400" />{item.label}</NavLink>)}</nav>
    </aside>
    <div className="md:pl-64">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="flex items-center gap-2 text-sm font-semibold">{session.tenant.name}<span className="text-slate-300">—</span><span className="flex items-center gap-1.5 text-teal-700"><MapPin className="size-3.5" />{location?.name || "Loading branch…"}</span></p><p className="text-xs text-muted-foreground">{roleLabels[session.user.role]}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => navigate(`/${tenantSlug}/profile`)}><UserCircle className="mr-2 size-4" /> Profile</Button><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></div></header>
      <main className="p-5 md:p-8"><div className="mx-auto max-w-6xl">{error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <Outlet context={{ location }} />}</div></main>
    </div>
  </div>;
}
