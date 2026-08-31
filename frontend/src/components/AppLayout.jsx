import { Building2, LayoutDashboard, LogOut, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const roleLabels = { admin: "Clinic Admin", frontdesk: "Front-desk Staff", doctor: "Doctor", care_coordinator: "Care Coordinator" };

export function AppLayout() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const navigation = [
    { label: "Overview", to: `/${tenantSlug}/dashboard`, icon: LayoutDashboard, visible: true },
    { label: "Staff", to: `/${tenantSlug}/staff`, icon: Users, visible: session.user.role === "admin" },
  ];

  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-slate-950 text-white md:block">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><div className="grid size-9 place-items-center rounded-md bg-teal-500"><Building2 className="size-4" /></div><div><p className="text-sm font-semibold">Meridian Health</p><p className="text-xs text-slate-400">Pilot Zero</p></div></div>
      <nav className="space-y-1 p-3">{navigation.filter((item) => item.visible).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-900 hover:text-white", isActive && "bg-slate-800 text-white")}><item.icon className="size-4 text-teal-400" />{item.label}</NavLink>)}</nav>
    </aside>
    <div className="md:pl-64">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="text-sm font-semibold">{session.tenant.name}</p><p className="text-xs text-muted-foreground">{roleLabels[session.user.role]}</p></div><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></header>
      <main className="p-5 md:p-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main>
    </div>
  </div>;
}

