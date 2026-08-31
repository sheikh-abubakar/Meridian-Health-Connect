import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export function DashboardPage() {
  const { session } = useAuth();

  return (
    <><p className="text-sm font-medium text-teal-700">Workspace overview</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {session.user.name}</h1><p className="mt-2 text-muted-foreground">Your clinic foundation is connected and ready.</p><Card className="mt-8 max-w-2xl bg-white shadow-none"><CardHeader><CardTitle className="text-lg">Tenant workspace</CardTitle><CardDescription>Authentication and tenant-scoped access are active.</CardDescription></CardHeader><CardContent><div className="rounded-md border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">Use the navigation to manage the workflows available to your role.</div></CardContent></Card></>
  );
}
