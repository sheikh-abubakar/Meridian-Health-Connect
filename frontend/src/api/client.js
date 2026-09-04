const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const CACHE_PREFIX = "meridian-api-cache:";
const CACHE_TTL_MS = 120000;
const pendingGets = new Map();
let cacheGeneration = 0;

function requestScope(headers = {}) {
  const authorization = headers.Authorization || headers.authorization || "public";
  return authorization === "public" ? authorization : authorization.slice(-16);
}

function cacheKey(path, headers) {
  return `${CACHE_PREFIX}${requestScope(headers)}:${path}`;
}

function readCache(key) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* Storage can be unavailable or full. */ }
}

export function clearApiCache() {
  cacheGeneration += 1;
  pendingGets.clear();
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* Cache cleanup must never block application actions. */ }
}

export function prefetchApi(path, options = {}) {
  return apiRequest(path, options).catch(() => null);
}

export async function openPdfPreview(path, accessToken) {
  const preview = window.open("about:blank", "_blank");
  if (!preview) throw new Error("Allow pop-ups to preview this PDF");
  preview.opener = null;
  preview.document.title = "Preparing PDF preview";
  preview.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px;color:#334155">Preparing secure PDF preview...</p>';
  try {
    const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || "PDF export failed");
    }
    const url = URL.createObjectURL(await response.blob());
    preview.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    preview.close();
    throw error;
  }
}

export async function apiRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...options.headers };
  const key = cacheKey(path, headers);
  const requestGeneration = cacheGeneration;

  if (method === "GET") {
    const cached = readCache(key);
    if (cached !== null) return cached;
    if (pendingGets.has(key)) return pendingGets.get(key);
  }

  const request = (async () => {
    const response = await fetch(`${API_URL}${path}`, { ...options, method, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || "Request failed");
    if (method === "GET" && requestGeneration === cacheGeneration) writeCache(key, payload.data);
    else clearApiCache();
    return payload.data;
  })();

  if (method !== "GET") return request;
  pendingGets.set(key, request);
  try { return await request; } finally { pendingGets.delete(key); }
}
