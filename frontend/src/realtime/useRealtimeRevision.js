import { useEffect, useState } from "react";
export function useRealtimeRevision(events) {
  const [revision, setRevision] = useState(0); const key = events.join("|");
  useEffect(() => { const accepted = new Set(key.split("|")); const listener = ({ detail }) => { if (accepted.has(detail.event)) setRevision((value) => value + 1); }; window.addEventListener("meridian:realtime", listener); return () => window.removeEventListener("meridian:realtime", listener); }, [key]);
  return revision;
}
