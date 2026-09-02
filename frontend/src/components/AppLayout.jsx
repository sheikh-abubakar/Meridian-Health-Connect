import { createElement, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ClipboardCheck, ClipboardClock, HeartHandshake, LayoutDashboard, LogOut, MapPin, PhoneCall, ScrollText, Stethoscope, UserCircle, UserRound, Users } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, prefetchApi } from "@/api/client";
import { MeridianSidebarBrand, SidebarUserCard } from "@/components/MeridianSidebarBrand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const roleLabels = { admin: "Clinic Admin", frontdesk: "Front-desk Staff", doctor: "Doctor", care_coordinator: "Care Coordinator" };

export function AppLayout() {
  const { tenantSlug, locationSlug } = useParams();
  const navigate = useNavigate();
  const route = useLocation();
  const { session, logout } = useAuth();
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const root = `/${tenantSlug}/${locationSlug}`;
    apiRequest(`${root}/context`, { headers }).then((data) => {
      if (active) setLocation(data.location);
      const paths = {
        admin: [`${root}/analytics`, `${root}/users`, `${root}/audit-logs`],
        frontdesk: [`${root}/patients`, `${root}/appointments`, `${root}/doctors`, `${root}/recall-requests?status=pending_scheduling`],
        doctor: [`${root}/availability/${session.user.id}`, `${root}/appointments?status=checked_in`, `${root}/my-patients`, `${root}/careplans?owningCareTeamMemberId=me`],
        care_coordinator: [`${root}/tasks?assignedToUserId=me`, `${root}/careplans?owningCareTeamMemberId=me`],
      };
      for (const path of paths[session.user.role] || []) prefetchApi(path, { headers });
    }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [locationSlug, session.accessToken, session.user.id, session.user.role, tenantSlug]);

  useEffect(() => { setMobileOpen(false); }, [route.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [mobileOpen]);

  const root = `/${tenantSlug}/${locationSlug}`;
  const navigation = [
    ["Dashboard", "Workspace", `${root}/dashboard`, LayoutDashboard, true],
    ["Staff", "Management", `${root}/staff`, Users, session.user.role === "admin"],
    ["Audit Log", "Management", `${root}/audit-log`, ScrollText, session.user.role === "admin"],
    ["Patients", "Operations", `${root}/patients`, UserRound, session.user.role === "frontdesk"],
    ["Scheduling", "Operations", `${root}/scheduling`, CalendarDays, session.user.role === "frontdesk"],
    ["Recall Requests", "Operations", `${root}/recall-requests`, PhoneCall, session.user.role === "frontdesk"],
    ["My Availability", "Clinical", `${root}/availability`, ClipboardClock, session.user.role === "doctor"],
    ["My Queue", "Clinical", `${root}/queue`, Stethoscope, session.user.role === "doctor"],
    ["My Patients", "Clinical", `${root}/my-patients`, UserRound, session.user.role === "doctor"],
    ["My Care Plans", "Care coordination", `${root}/my-care-plans`, HeartHandshake, ["doctor", "care_coordinator"].includes(session.user.role)],
    ["My Tasks", "Care coordination", `${root}/tasks`, ClipboardCheck, session.user.role === "care_coordinator"],
  ].filter((item) => item[4]);
  const groups = [...new Set(navigation.map((item) => item[1]))];
  const sidebar = <><MeridianSidebarBrand /><nav className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4">{session.user.role === "admin" && <NavLink to={`/${tenantSlug}/overview`} className="mb-5 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-medium text-slate-300"><span className="grid size-7 place-items-center rounded-md bg-slate-800 text-teal-300"><ArrowLeft className="size-3.5" /></span>Switch branch</NavLink>}{groups.map((group) => <section key={group} className="mb-5"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group}</p><div className="space-y-1">{navigation.filter((item) => item[1] === group).map(([label, , to, icon]) => <NavLink key={to} to={to} className={({ isActive }) => cn("group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white", isActive && "border-slate-700 bg-slate-800 text-white shadow-[inset_3px_0_0_#2dd4bf]")}>{({ isActive }) => <><span className={cn("grid size-8 place-items-center rounded-md bg-slate-900 text-slate-400 group-hover:text-teal-300", isActive && "bg-slate-700 text-teal-300")}>{createElement(icon, { className: "size-4" })}</span>{label}</>}</NavLink>)}</div></section>)}</nav><SidebarUserCard user={session.user} roleLabel={roleLabels[session.user.role]} /></>;

  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-white md:flex">{sidebar}</aside>
    <button type="button" aria-label="Close navigation" className={cn("fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-300 md:hidden", mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")} onClick={() => setMobileOpen(false)} />
    <aside aria-label="Mobile navigation" className={cn("fixed inset-y-0 left-0 z-50 flex w-[min(82vw,18rem)] flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-out md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>{sidebar}</aside>
    <div className="min-w-0 md:pl-64">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b bg-white/95 px-3 py-2 backdrop-blur md:px-8"><div className="flex min-w-0 items-center gap-2"><button type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)} className="relative grid size-10 shrink-0 place-items-center rounded-lg border bg-white text-slate-700 shadow-sm md:hidden"><span className={cn("absolute h-0.5 w-5 rounded bg-current transition duration-300", mobileOpen ? "rotate-45" : "-translate-y-1.5")} /><span className={cn("absolute h-0.5 w-5 rounded bg-current transition duration-200", mobileOpen ? "scale-x-0 opacity-0" : "scale-x-100")} /><span className={cn("absolute h-0.5 w-5 rounded bg-current transition duration-300", mobileOpen ? "-rotate-45" : "translate-y-1.5")} /></button><div className="min-w-0"><p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold"><span className="truncate">{session.tenant.name}</span><span className="hidden text-slate-300 sm:inline">—</span><span className="hidden shrink-0 items-center gap-1 text-teal-700 sm:flex"><MapPin className="size-3.5" />{location?.name || "Loading branch…"}</span></p><p className="truncate text-xs text-muted-foreground"><span className="sm:hidden">{location?.name ? `${location.name} · ` : ""}</span>{roleLabels[session.user.role]}</p></div></div><div className="flex shrink-0 gap-1.5"><Button variant="outline" size="sm" className="size-9 px-0 sm:w-auto sm:px-3" aria-label="Profile" onClick={() => navigate(`/${tenantSlug}/profile`)}><UserCircle className="size-4 sm:mr-2" /><span className="hidden sm:inline">Profile</span></Button><Button variant="outline" size="sm" className="size-9 px-0 sm:w-auto sm:px-3" aria-label="Sign out" onClick={signOut}><LogOut className="size-4 sm:mr-2" /><span className="hidden sm:inline">Sign out</span></Button></div></header>
      <main className="min-w-0 p-4 sm:p-5 md:p-8"><div className="mx-auto min-w-0 max-w-6xl">{error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <Outlet context={{ location }} />}</div></main>
    </div>
  </div>;
}
