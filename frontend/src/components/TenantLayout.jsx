import { Building2, LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export function TenantLayout() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  function signOut() { logout(); navigate("/login", { replace: true }); }

  return <div className="min-h-screen bg-slate-50 text-slate-950"><aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-slate-950 text-white md:block"><div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><div className="grid size-9 place-items-center rounded-md bg-teal-500"><Building2 className="size-4" /></div><div><p className="text-sm font-semibold">Meridian Health</p><p className="text-xs text-slate-400">Pilot Zero</p></div></div><nav className="p-3"><NavLink to={`/${tenantSlug}/overview`} className="flex items-center gap-3 rounded-md bg-slate-800 px-3 py-2.5 text-sm text-white"><LayoutDashboard className="size-4 text-teal-400" /> Overview</NavLink></nav></aside><div className="md:pl-64"><header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8"><div><p className="text-sm font-semibold">{session.tenant.name}</p><p className="text-xs text-muted-foreground">All locations overview</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => navigate(`/${tenantSlug}/profile`)}><UserCircle className="mr-2 size-4" /> Profile</Button><Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</Button></div></header><main className="p-5 md:p-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main></div></div>;
}
