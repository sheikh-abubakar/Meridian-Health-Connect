import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ClipboardCheck, ClipboardClock, HeartHandshake, LayoutDashboard, LogOut, MapPin, PhoneCall, ScrollText, Stethoscope, UserCircle, UserRound, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { apiRequest, prefetchApi } from "@/api/client";
import { Button } from "@/components/ui/button";
import { MeridianSidebarBrand, SidebarUserCard } from "@/components/MeridianSidebarBrand";
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
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const root = `/${tenantSlug}/${locationSlug}`;
    apiRequest(`/${tenantSlug}/${locationSlug}/context`, {
      headers,
    }).then((data) => {
      if (active) setLocation(data.location);
      const pathsByRole = {
        admin: [`${root}/analytics`, `${root}/users`, `${root}/audit-logs`],
        frontdesk: [`${root}/patients`, `${root}/appointments`, `${root}/doctors`, `${root}/recall-requests?status=pending_scheduling`],
        doctor: [`${root}/availability/${session.user.id}`, `${root}/appointments?status=checked_in`, `${root}/my-patients`, `${root}/careplans?owningCareTeamMemberId=me`],
        care_coordinator: [`${root}/tasks?assignedToUserId=me`, `${root}/careplans?owningCareTeamMemberId=me`],
      };
      for (const path of pathsByRole[session.user.role] || []) prefetchApi(path, { headers });
    })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [locationSlug, session.accessToken, session.user.id, session.user.role, tenantSlug]);

  const navigation = [
    { label: "Dashboard", group: "Workspace", to: `/${tenantSlug}/${locationSlug}/dashboard`, icon: LayoutDashboard, visible: true },
    { label: "Staff", group: "Management", to: `/${tenantSlug}/${locationSlug}/staff`, icon: Users, visible: session.user.role === "admin" },
    { label: "Audit Log", group: "Management", to: `/${tenantSlug}/${locationSlug}/audit-log`, icon: ScrollText, visible: session.user.role === "admin" },
    { label: "Patients", group: "Operations", to: `/${tenantSlug}/${locationSlug}/patients`, icon: UserRound, visible: session.user.role === "frontdesk" },
    { label: "Scheduling", group: "Operations", to: `/${tenantSlug}/${locationSlug}/scheduling`, icon: CalendarDays, visible: session.user.role === "frontdesk" },
    { label: "Recall Requests", group: "Operations", to: `/${tenantSlug}/${locationSlug}/recall-requests`, icon: PhoneCall, visible: session.user.role === "frontdesk" },
    { label: "My Availability", group: "Clinical", to: `/${tenantSlug}/${locationSlug}/availability`, icon: ClipboardClock, visible: session.user.role === "doctor" },
    { label: "My Queue", group: "Clinical", to: `/${tenantSlug}/${locationSlug}/queue`, icon: Stethoscope, visible: session.user.role === "doctor" },
    { label: "My Patients", group: "Clinical", to: `/${tenantSlug}/${locationSlug}/my-patients`, icon: UserRound, visible: session.user.role === "doctor" },
    { label: "My Care Plans", group: "Care coordination", to: `/${tenantSlug}/${locationSlug}/my-care-plans`, icon: HeartHandshake, visible: ["doctor", "care_coordinator"].includes(session.user.role) },
    { label: "My Tasks", group: "Care coordination", to: `/${tenantSlug}/${locationSlug}/tasks`, icon: ClipboardCheck, visible: session.user.role === "care_coordinator" },
  ];

  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-white shadow-[12px_0_35px_-28px_rgba(15,23,42,.7)] md:flex">
      <MeridianSidebarBrand />
      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4">{session.user.role === "admin" && <NavLink to={`/${tenantSlug}/overview`} className="mb-5 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"><span className="grid size-7 place-items-center rounded-md bg-slate-800 text-teal-300"><ArrowLeft className="size-3.5" /></span> Switch branch</NavLink>}{[...new Set(navigation.filter((item) => item.visible).map((item) => item.group))].map((group) => <section key={group} className="mb-5"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group}</p><div className="space-y-1">{navigation.filter((item) => item.visible && item.group === group).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-900 hover:text-white", isActive && "border-slate-700 bg-slate-800 text-white shadow-[inset_3px_0_0_#2dd4bf]")}>{({ isActive }) => <><span className={cn("grid size-8 place-items-center rounded-md bg-slate-900 text-slate-400 transition group-hover:text-teal-300", isActive && "bg-slate-700 text-teal-300")}><item.icon className="size-4" /></span><span>{item.label}</span></>}</NavLink>)}</div></section>)}</nav>
      <SidebarUserCard user={session.user} roleLabel={roleLabels[session.user.role]} />
    </aside>
    <div className="md:pl-64">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="flex items-center gap-2 text-sm font-semibold">{session.tenant.name}<span className="text-slate-300">—</span><span className="flex items-center gap-1.5 text-teal-700"><MapPin className="size-3.5" />{location?.name || "Loading branch…"}</span></p><p className="text-xs text-muted-foreground">{roleLabels[session.user.role]}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => navigate(`/${tenantSlug}/profile`)}><UserCircle className="mr-2 size-4" /> Profile</Button><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></div></header>
      <main className="p-5 md:p-8"><div className="mx-auto max-w-6xl">{error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <Outlet context={{ location }} />}</div></main>
    </div>
  </div>;
}
