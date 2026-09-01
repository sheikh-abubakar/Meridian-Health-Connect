import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export const GROQ_SUMMARY_MODEL = "openai/gpt-oss-120b";

export async function generateClinicalSummary(notes) {
  let response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.groqApiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: GROQ_SUMMARY_MODEL,
        temperature: 0.2,
        max_completion_tokens: 500,
        messages: [
          { role: "system", content: "Produce a concise, neutral clinical summary using only the supplied structured encounter notes. Do not invent facts, recommendations, medications, tests, or diagnoses. Preserve uncertainty. Return plain text only. This is a draft for mandatory clinician review and explicit acceptance; it must never imply autonomous clinical authority." },
          { role: "user", content: `Symptoms:\n${notes.symptoms || "Not documented"}\n\nObservations:\n${notes.observations || "Not documented"}\n\nDiagnosis:\n${notes.diagnosis || "Not documented"}` },
        ],
      }),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new ApiError(504, "AI summary request timed out. You can continue and finalize without AI assistance.");
    throw new ApiError(503, "AI summary service is temporarily unavailable. You can continue and finalize without AI assistance.");
  }
  if (response.status === 429) throw new ApiError(429, "AI summary rate limit reached. Please try again later or continue without AI assistance.");
  if (!response.ok) throw new ApiError(502, "Groq could not generate a summary. You can continue and finalize without AI assistance.");
  let payload;
  try { payload = await response.json(); } catch { throw new ApiError(502, "Groq returned an unreadable response. You can continue without AI assistance."); }
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ApiError(502, "Groq returned an empty summary. You can continue without AI assistance.");
  return { text, model: GROQ_SUMMARY_MODEL, generatedAt: new Date() };
}
