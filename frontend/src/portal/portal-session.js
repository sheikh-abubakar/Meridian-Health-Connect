const key = "meridian-patient-portal-session";
export function readPortalSession() { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
export function savePortalSession(session) { sessionStorage.setItem(key, JSON.stringify(session)); }
export function clearPortalSession() { sessionStorage.removeItem(key); }
