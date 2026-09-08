import { env } from "../config/env.js";

const MOCEAN_SMS_URL = "https://rest.moceanapi.com/rest/2/sms";

export class MoceanSmsError extends Error {
  constructor(message, { retryable = false, code = "" } = {}) {
    super(message);
    this.retryable = retryable;
    this.code = String(code || "");
  }
}

export function normalizePhoneForSms(value, defaultCountryCode = env.moceanDefaultCountryCode) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && defaultCountryCode) digits = `${defaultCountryCode}${digits.slice(1)}`;
  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

function callbackUrl() {
  if (!env.moceanDlrPublicUrl || !env.moceanDlrWebhookSecret) return "";
  return `${env.moceanDlrPublicUrl}/${encodeURIComponent(env.moceanDlrWebhookSecret)}`;
}

export function appointmentReminderText({ locationName, visitType, scheduledAt }) {
  const when = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short", hour12: true,
  }).format(new Date(scheduledAt));
  return `${locationName}: reminder for your ${visitType} on ${when}. Please contact the clinic if you need assistance.`;
}

export async function sendMoceanSms({ to, text }) {
  if (!env.moceanSmsEnabled) throw new MoceanSmsError("SMS delivery is disabled by server configuration.");
  const dlrUrl = callbackUrl();
  if (!dlrUrl) throw new MoceanSmsError("SMS delivery receipt callback is not configured.");

  const body = new URLSearchParams({
    "mocean-from": env.moceanSmsFrom,
    "mocean-to": to,
    "mocean-text": text,
    "mocean-dlr-mask": "1",
    "mocean-dlr-url": dlrUrl,
    "mocean-resp-format": "json",
  });

  let response;
  try {
    response = await fetch(MOCEAN_SMS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.moceanApiToken}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new MoceanSmsError("Could not reach SMS provider.", { retryable: true, code: error?.name });
  }

  let payload = null;
  try { payload = await response.json(); } catch { /* provider response is handled below */ }
  const result = payload?.messages?.[0];
  if (!response.ok || !result || Number(result.status) !== 0 || !result.msgid) {
    const detail = result?.err_msg || payload?.err_msg || `Provider request failed (${response.status}).`;
    throw new MoceanSmsError(detail, { retryable: response.status >= 500 || response.status === 429, code: result?.status || response.status });
  }
  return { messageId: String(result.msgid) };
}

