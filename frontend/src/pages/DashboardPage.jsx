import { CalendarDays, ClipboardCheck } from "lucide-react";
import { AdminAnalyticsDashboard } from "@/components/AdminAnalyticsDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { MyTasksPage } from "@/pages/MyTasksPage";

export function DashboardPage() {
  const { session } = useAuth();
  if (session.user.role === "admin") return <AdminAnalyticsDashboard />;
  if (session.user.role === "care_coordinator") return <MyTasksPage />;
  const content = {
    frontdesk: { eyebrow: "Front-desk workspace", title: `Welcome, ${session.user.name}`, description: "Coordinate patient registration, booking, and check-in.", icon: CalendarDays, cardTitle: "Today's operations" },
    doctor: { eyebrow: "Clinical workspace", title: `Welcome, ${session.user.name}`, description: "Set your working hours and review checked-in patients.", icon: ClipboardCheck, cardTitle: "Your clinical queue" },
  }[session.user.role];
  const Icon = content.icon;

  return (
    <><p className="text-sm font-medium text-teal-700">{content.eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{content.title}</h1><p className="mt-2 text-muted-foreground">{content.description}</p><Card className="mt-8 max-w-2xl bg-white shadow-none"><CardHeader><div className="mb-2 grid size-10 place-items-center rounded-md bg-teal-50 text-teal-700"><Icon className="size-5" /></div><CardTitle className="text-lg">{content.cardTitle}</CardTitle><CardDescription>Only the workflows permitted for your role and current location appear in navigation.</CardDescription></CardHeader><CardContent><div className="rounded-md border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">Tenant and branch isolation are active for this workspace.</div></CardContent></Card></>
  );
}
