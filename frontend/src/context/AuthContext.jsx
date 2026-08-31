import { useMemo, useState } from "react";
import { apiRequest } from "@/api/client";
import { AuthContext } from "@/context/auth-context";

const storageKey = "meridian-session";

function readStoredSession() {
  try { return JSON.parse(sessionStorage.getItem(storageKey)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  async function login(email, password) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem(storageKey, JSON.stringify(data));
    setSession(data);
    return data;
  }

  function logout() {
    sessionStorage.removeItem(storageKey);
    setSession(null);
  }

  const value = useMemo(() => ({ session, login, logout }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
