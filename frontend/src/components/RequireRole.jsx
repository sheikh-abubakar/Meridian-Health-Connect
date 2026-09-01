import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/auth-context";

export function RequireRole({ roles, children }) {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  if (!roles.includes(session.user.role)) {
    return <Navigate to={`/${tenantSlug}/${locationSlug}/dashboard`} replace />;
  }
  return children;
}

