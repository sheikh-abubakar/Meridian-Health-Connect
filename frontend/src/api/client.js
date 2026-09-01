const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "Request failed");
  return payload.data;
}
