import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RequireTenantSession } from "@/components/RequireTenantSession";
import { RequireRole } from "@/components/RequireRole";
import { TenantLayout } from "@/components/TenantLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { EncounterPage } from "@/pages/EncounterPage";
import { AvailabilityPage } from "@/pages/AvailabilityPage";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { PatientsPage } from "@/pages/PatientsPage";
import { PatientProfilePage } from "@/pages/PatientProfilePage";
import { ProfilePage } from "@/pages/ProfilePage";
import { QueuePage } from "@/pages/QueuePage";
import { SchedulingPage } from "@/pages/SchedulingPage";
import { StaffPage } from "@/pages/StaffPage";
import { MyPatientsPage } from "@/pages/MyPatientsPage";
import { MyTasksPage } from "@/pages/MyTasksPage";
import { MyCarePlansPage } from "@/pages/MyCarePlansPage";
import { AuditLogPage } from "@/pages/AuditLogPage";

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/:tenantSlug/login" element={<Navigate to="/login" replace />} /><Route path="/:tenantSlug" element={<RequireTenantSession />}><Route path="profile" element={<ProfilePage />} /><Route element={<TenantLayout />}><Route path="overview" element={<OverviewPage />} /></Route><Route path=":locationSlug" element={<AppLayout />}><Route path="dashboard" element={<DashboardPage />} /><Route path="staff" element={<RequireRole roles={["admin"]}><StaffPage /></RequireRole>} /><Route path="audit-log" element={<RequireRole roles={["admin"]}><AuditLogPage /></RequireRole>} /><Route path="patients" element={<RequireRole roles={["frontdesk"]}><PatientsPage /></RequireRole>} /><Route path="patients/:patientId" element={<RequireRole roles={["frontdesk", "doctor", "care_coordinator"]}><PatientProfilePage /></RequireRole>} /><Route path="scheduling" element={<RequireRole roles={["frontdesk"]}><SchedulingPage /></RequireRole>} /><Route path="recall-requests" element={<RequireRole roles={["frontdesk"]}><SchedulingPage recallOnly /></RequireRole>} /><Route path="availability" element={<RequireRole roles={["doctor"]}><AvailabilityPage /></RequireRole>} /><Route path="queue" element={<RequireRole roles={["doctor"]}><QueuePage /></RequireRole>} /><Route path="my-patients" element={<RequireRole roles={["doctor"]}><MyPatientsPage /></RequireRole>} /><Route path="my-care-plans" element={<RequireRole roles={["doctor", "care_coordinator"]}><MyCarePlansPage /></RequireRole>} /><Route path="tasks" element={<RequireRole roles={["care_coordinator"]}><MyTasksPage /></RequireRole>} /><Route path="encounters/:encounterId" element={<RequireRole roles={["doctor"]}><EncounterPage /></RequireRole>} /></Route></Route><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
}
