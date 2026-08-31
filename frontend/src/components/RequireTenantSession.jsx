import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/context/auth-context";

export function RequireTenantSession() {
  const { tenantSlug } = useParams();
  const { session } = useAuth();
  if (!session || session.tenant.slug !== tenantSlug) return <Navigate to="/login" replace />;
  return <Outlet />;
}

