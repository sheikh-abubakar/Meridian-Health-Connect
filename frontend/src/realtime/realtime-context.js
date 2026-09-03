import { createContext, useContext } from "react";
export const RealtimeContext = createContext({ status: "disconnected" });
export const useRealtimeStatus = () => useContext(RealtimeContext);
