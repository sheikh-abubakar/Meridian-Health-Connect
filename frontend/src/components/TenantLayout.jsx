import { LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MeridianSidebarBrand, SidebarUserCard } from "@/components/MeridianSidebarBrand";
import { useAuth } from "@/context/auth-context";

export function TenantLayout() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen bg-slate-50 text-slate-950"><aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-white md:flex"><MeridianSidebarBrand /><nav className="flex-1 p-3 pt-5"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Organization</p><NavLink to={`/${tenantSlug}/overview`} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm font-medium text-white shadow-[inset_3px_0_0_#2dd4bf]"><span className="grid size-8 place-items-center rounded-md bg-slate-700 text-teal-300"><LayoutDashboard className="size-4" /></span> Overview</NavLink></nav><SidebarUserCard user={session.user} roleLabel="Clinic Admin" /></aside><div className="md:pl-64"><header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="text-sm font-semibold">{session.tenant.name}</p><p className="text-xs text-muted-foreground">All locations overview</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => navigate(`/${tenantSlug}/profile`)}><UserCircle className="mr-2 size-4" /> Profile</Button><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></div></header><main className="p-5 md:p-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main></div></div>;
}
