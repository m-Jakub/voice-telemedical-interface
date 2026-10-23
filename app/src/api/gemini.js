// Gemini REST client (browser and Node 18+). Never logs the key, prompts, bodies or responses.
import { MODEL_IDS, API_BASE, NO_ANSWER, REQUEST_TIMEOUT_MS } from "../config.js";
import { buildSummaryPrompt, buildTranscriptionPrompt, parseSummary } from "../logic.js";

export class GeminiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeminiError";
    this.code = code; // "NETWORK" | "HTTP" | "PARSE"
  }
}

// Combine the per-request timeout with the caller's optional abort signal.
function makeSignal(userSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!userSignal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([timeout, userSignal]);
  return timeout; // very old runtime: user abort is still checked before each attempt
}

// Send one request, trying models in order. Falls back only on HTTP 503 or timeout.
async function callGemini(apiKey, parts, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json" },
  });
  let lastError = null;

  for (const model of MODEL_IDS) {
    if (opts.signal && opts.signal.aborted) throw new GeminiError("NETWORK", "Request aborted");
    let res;
    try {
      res = await fetchImpl(`${API_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body,
        signal: makeSignal(opts.signal),
      });
    } catch (err) {
      const userAborted = opts.signal && opts.signal.aborted;
      if (err && err.name === "TimeoutError" && !userAborted) {
        lastError = new GeminiError("NETWORK", "Request timed out");
        continue; // try next model
      }
      throw new GeminiError("NETWORK", userAborted ? "Request aborted" : "Network error");
    }
    if (res.status === 503) {
      lastError = new GeminiError("HTTP", "HTTP 503");
      continue;
    }
    if (!res.ok) throw new GeminiError("HTTP", `HTTP ${res.status}`);

    let data;
    try {
      data = await res.json();
    } catch {
      throw new GeminiError("PARSE", "Response is not valid JSON");
    }
    const resParts = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts;
    const text = Array.isArray(resParts)
      ? resParts.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("")
      : "";
    if (!text) throw new GeminiError("PARSE", "Response has no text");
    return text;
  }
  throw lastError || new GeminiError("NETWORK", "No model available");
}

export async function summarize(apiKey, answers, opts = {}) {
  // Empty or whitespace-only answers are sent as an explicit "no answer" marker.
  const mapped = answers.map((a) => ({
    ...a,
    text: a.text && a.text.trim() ? a.text : NO_ANSWER,
  }));
  const text = await callGemini(apiKey, [{ text: buildSummaryPrompt(mapped) }], opts);
  const parsed = parseSummary(text);
  if (!parsed.ok) throw new GeminiError("PARSE", "Summary has invalid shape");
  return parsed.summary;
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  if (typeof Buffer !== "undefined") return Buffer.from(buf).toString("base64");
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000; // chunked to avoid call-stack limits
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function transcribe(apiKey, blob, opts = {}) {
  const data = await blobToBase64(blob);
  const parts = [
    { text: buildTranscriptionPrompt() },
    { inline_data: { mime_type: blob.type || "audio/webm", data } },
  ];
  const raw = await callGemini(apiKey, parts, opts);
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new GeminiError("PARSE", "Transcription is not valid JSON");
  }
  const text = obj && typeof obj.text === "string" ? obj.text.trim() : "";
  return { text };
}
