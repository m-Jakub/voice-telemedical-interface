// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { summarize, transcribe, GeminiError } from "../src/api/gemini.js";
import { MODEL_IDS, API_BASE, NO_ANSWER } from "../src/config.js";
import {
  notifyDoctor, getAlerts, subscribeAlerts, clearAlerts,
} from "../src/notifyDoctor.js";

const KEY = "TEST_KEY_123";

const goodSummary = {
  chief_complaint: "bol gardla",
  duration: "2 dni",
  medications: "paracetamol",
  allergies: "brak",
  patient_quotes: ["boli mnie gardlo"],
  llm_red_flag: false,
  red_flag_quote: null,
};

const answers = [
  { questionId: "q1", question: "Co Ci dolega?", text: "Boli mnie gardlo" },
  { questionId: "q2", question: "Od kiedy?", text: "   " },
];

// Response-like object for a Gemini reply carrying the given candidate text.
function okResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}
function statusResponse(status) {
  return { ok: false, status, json: async () => ({ error: "secret body" }) };
}

afterEach(() => vi.restoreAllMocks());

describe("summarize", () => {
  it("sends the expected request and returns the parsed summary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(goodSummary)));
    const summary = await summarize(KEY, answers, { fetchImpl });
    expect(summary.llm_red_flag).toBe(false);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API_BASE}/models/${MODEL_IDS[0]}:generateContent`);
    expect(init.method).toBe("POST");
    expect(init.headers["x-goog-api-key"]).toBe(KEY);
    expect(init.headers["content-type"]).toBe("application/json");
    expect(url).not.toContain(KEY);
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].parts).toHaveLength(1);
    expect(typeof body.contents[0].parts[0].text).toBe("string");
  });

  it("replaces an empty answer with NO_ANSWER in the prompt", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(goodSummary)));
    await summarize(KEY, answers, { fetchImpl });
    const prompt = JSON.parse(fetchImpl.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toContain(NO_ANSWER);
  });

  it("falls back to the second model on 503", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(statusResponse(503))
      .mockResolvedValueOnce(okResponse(JSON.stringify(goodSummary)));
    await summarize(KEY, answers, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${API_BASE}/models/${MODEL_IDS[1]}:generateContent`);
  });

  it("throws HTTP when all models return 503", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(statusResponse(503));
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "HTTP" });
    expect(fetchImpl).toHaveBeenCalledTimes(MODEL_IDS.length);
  });

  it("falls back to the second model on 429", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(okResponse(JSON.stringify(goodSummary)));
    await summarize(KEY, answers, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${API_BASE}/models/${MODEL_IDS[1]}:generateContent`);
  });

  it("throws GeminiError HTTP when all models return 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(statusResponse(429));
    const err = await summarize(KEY, answers, { fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.code).toBe("HTTP");
    expect(fetchImpl).toHaveBeenCalledTimes(MODEL_IDS.length);
  });

  it("falls back on timeout and throws NETWORK when all time out", async () => {
    const timeoutErr = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    const fetchImpl = vi.fn().mockRejectedValue(timeoutErr);
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "NETWORK" });
    expect(fetchImpl).toHaveBeenCalledTimes(MODEL_IDS.length);
  });

  it.each([400, 401])("HTTP %i throws HTTP without fallback", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(statusResponse(status));
    const err = await summarize(KEY, answers, { fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.code).toBe("HTTP");
    expect(err.message).toBe(`HTTP ${status}`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps a fetch TypeError to NETWORK without fallback", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "NETWORK" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when the caller aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    await expect(summarize(KEY, answers, { fetchImpl, signal: controller.signal }))
      .rejects.toMatchObject({ code: "NETWORK" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws PARSE when the candidate text is not JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("not json"));
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "PARSE" });
  });

  it("throws PARSE when llm_red_flag is missing", async () => {
    const { llm_red_flag, ...noFlag } = goodSummary;
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(noFlag)));
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "PARSE" });
  });

  it("throws PARSE when the response has no candidates", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(summarize(KEY, answers, { fetchImpl })).rejects.toMatchObject({ code: "PARSE" });
  });

  it("never logs the key and never puts it in error messages", async () => {
    const spies = ["log", "error", "warn", "info", "debug"].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const cases = [
      vi.fn().mockResolvedValue(statusResponse(401)),
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      vi.fn().mockResolvedValue(okResponse("not json")),
    ];
    for (const fetchImpl of cases) {
      const err = await summarize(KEY, answers, { fetchImpl }).catch((e) => e);
      expect(err.message).not.toContain(KEY);
      expect(err.message).not.toContain("secret body");
    }
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(KEY);
      }
    }
    // gemini.js should not log at all
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("transcribe", () => {
  it("sends inline_data with mime type and base64 audio, returns trimmed text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ text: "  Boli mnie gardlo  " })));
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/ogg" });
    const result = await transcribe(KEY, blob, { fetchImpl });
    expect(result).toEqual({ text: "Boli mnie gardlo" });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    const parts = body.contents[0].parts;
    expect(typeof parts[0].text).toBe("string");
    expect(parts[1].inline_data.mime_type).toBe("audio/ogg");
    expect(parts[1].inline_data.data).toBe(Buffer.from([1, 2, 3, 4]).toString("base64"));
  });

  it("defaults the mime type to audio/webm", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ text: "x" })));
    await transcribe(KEY, new Blob([new Uint8Array([9])]), { fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe("audio/webm");
  });

  it("returns empty text for silence or missing text", async () => {
    const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const silent = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ text: "" })));
    expect(await transcribe(KEY, blob, { fetchImpl: silent })).toEqual({ text: "" });
    const missing = vi.fn().mockResolvedValue(okResponse("{}"));
    expect(await transcribe(KEY, blob, { fetchImpl: missing })).toEqual({ text: "" });
  });

  it("btoa branch (no Buffer) gives the same base64 for audio larger than one chunk", async () => {
    const bytes = new Uint8Array(40000).map((_, i) => i % 256); // > 0x8000, covers every byte value
    const expected = Buffer.from(bytes).toString("base64"); // computed before Buffer is hidden
    vi.stubGlobal("Buffer", undefined);
    try {
      const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ text: "x" })));
      await transcribe(KEY, new Blob([bytes], { type: "audio/webm" }), { fetchImpl });
      const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
      expect(body.contents[0].parts[1].inline_data.data).toBe(expected);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws PARSE on invalid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("plain words"));
    const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(transcribe(KEY, blob, { fetchImpl })).rejects.toMatchObject({ code: "PARSE" });
  });
});

describe("notifyDoctor (mock)", () => {
  const alert = { id: "a1", timestamp: "2026-10-23T10:00:00Z", source: "llm", quote: "ucisk w klatce" };

  afterEach(() => clearAlerts());

  it("adds alerts and returns copies", () => {
    notifyDoctor(alert);
    const list = getAlerts();
    expect(list).toEqual([alert]);
    list.push({ id: "x" });
    list[0].id = "changed";
    expect(getAlerts()).toEqual([alert]);
  });

  it("notifies subscribers, supports unsubscribe and survives throwing subscribers", () => {
    const fn = vi.fn();
    const unsubscribe = subscribeAlerts(fn);
    const unsubscribeBad = subscribeAlerts(() => { throw new Error("boom"); });
    expect(() => notifyDoctor(alert)).not.toThrow();
    expect(fn).toHaveBeenCalledWith([alert]);
    unsubscribe();
    unsubscribeBad();
    notifyDoctor(alert);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clearAlerts empties the list and notifies", () => {
    notifyDoctor(alert);
    const fn = vi.fn();
    const unsubscribe = subscribeAlerts(fn);
    clearAlerts();
    expect(getAlerts()).toEqual([]);
    expect(fn).toHaveBeenCalledWith([]);
    unsubscribe();
  });
});
