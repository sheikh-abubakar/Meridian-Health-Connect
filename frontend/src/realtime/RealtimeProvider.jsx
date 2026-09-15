import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { clearApiCache } from "@/api/client";
import { useAuth } from "@/context/auth-context";
import { RealtimeContext } from "@/realtime/realtime-context";
import { readPortalSession } from "@/portal/portal-session";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "").replace(/\/$/, "");
export function RealtimeProvider({ children }) {
  const { session } = useAuth(); const { pathname } = useLocation(); const [status, setStatus] = useState("disconnected"); const portalSession = readPortalSession();
  const locationSlug = pathname.split("/").filter(Boolean)[1] || "";
  useEffect(() => {
    const portal = pathname.startsWith("/portal") && portalSession?.accessToken;
    if ((!portal && (!session?.accessToken || !locationSlug || ["overview", "profile"].includes(locationSlug))) || (pathname.startsWith("/portal") && !portal)) { setStatus("disconnected"); return undefined; }
    setStatus("connecting");
    const socket = io(SOCKET_URL, { auth: { token: portal ? portalSession.accessToken : session.accessToken, locationSlug }, reconnection: true, reconnectionDelay: 700, reconnectionDelayMax: 5000 });
    socket.on("connect", () => setStatus("connected")); socket.on("disconnect", () => setStatus("disconnected")); socket.on("connect_error", () => setStatus("disconnected"));
    socket.onAny((event, payload) => { clearApiCache(); window.dispatchEvent(new CustomEvent("meridian:realtime", { detail: { event, payload } })); });
    return () => socket.disconnect();
  }, [locationSlug, pathname, portalSession?.accessToken, session?.accessToken]);
  const value = useMemo(() => ({ status }), [status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
