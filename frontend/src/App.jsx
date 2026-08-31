import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RequireTenantSession } from "@/components/RequireTenantSession";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { StaffPage } from "@/pages/StaffPage";

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/:tenantSlug/login" element={<Navigate to="/login" replace />} /><Route path="/:tenantSlug" element={<RequireTenantSession />}><Route element={<AppLayout />}><Route path="dashboard" element={<DashboardPage />} /><Route path="staff" element={<StaffPage />} /></Route></Route><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
}
