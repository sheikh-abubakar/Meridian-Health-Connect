import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export function OverviewPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/${tenantSlug}/overview`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((data) => { if (active) setLocations(data.locations); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.accessToken, tenantSlug]);

  if (session.user.role !== "admin") {
    return <Navigate to={`/${tenantSlug}/${session.location?.slug}/dashboard`} replace />;
  }

  return <><p className="text-sm font-medium text-teal-700">Tenant overview</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Choose a branch</h1><p className="mt-2 text-muted-foreground">Review each location and enter its isolated operational workspace.</p>{loading ? <div className="mt-8 grid gap-5 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg border bg-white" />)}</div> : error ? <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <div className="mt-8 grid gap-5 md:grid-cols-2">{locations.map((location) => <Card key={location.id} className="cursor-pointer bg-white shadow-none transition hover:border-teal-300 hover:shadow-panel" role="link" tabIndex={0} onClick={() => navigate(`/${tenantSlug}/${location.slug}/dashboard`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/${tenantSlug}/${location.slug}/dashboard`); }}><CardHeader><div className="flex items-start justify-between gap-4"><div className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-700"><MapPin className="size-5" /></div><ArrowRight className="size-5 text-slate-400" /></div><CardTitle className="pt-3 text-xl">{location.name}</CardTitle><CardDescription>{location.address}</CardDescription></CardHeader><CardContent><div className="flex items-center gap-3 rounded-md bg-slate-50 p-3"><Users className="size-4 text-teal-700" /><div><p className="text-lg font-semibold leading-none">{location.staffCount}</p><p className="mt-1 text-xs text-muted-foreground">Staff members</p></div></div></CardContent></Card>)}</div>}</>;
}

