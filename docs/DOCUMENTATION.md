> **DRAFT — introduction to the documentation.** Written from the design before the code was finished. It MUST be updated after implementation (module names, signatures, test results, model ids, anything verified by the first voice run) before it is treated as final.

# Voice pre-consultation intake: technical documentation

## 1. What the app does

Before a consultation, the patient answers one screening question and four intake questions (Polish UI), by voice or text. Google Gemini transcribes the audio and produces a structured summary for the doctor: chief complaint, duration, medications, allergies and verbatim patient quotes.

It deliberately does NOT: diagnose, rate urgency, prioritise, advise, reassure, store any data, authenticate users, or notify a real doctor (`notifyDoctor` is a MOCK alert panel). It is a prototype, not a medical product. For rationale, rejected options and privacy/production caveats see [README.md](../README.md).

## 2. Quick start

Run from `app/`:

```
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest unit tests
node --env-file=../.env scripts/run-scenarios.mjs   # text-input scenarios against the real API
```

The Gemini key is typed into the UI and kept in memory only. `.env` is gitignored and is used only by the Node scenario script (`GEMINI_API_KEY`). Use fictional data only.

## 3. Architecture overview

Vite + React + plain JavaScript, no backend; the browser calls Gemini directly. Diagrams: [docs/design/architecture-diagram.md](design/architecture-diagram.md) (diagram 1: flow and state machine; diagram 2: module dependencies; diagram 3: escalation decision as an OR-gate). Full design: [docs/design/architecture.md](design/architecture.md).

| Module | Responsibility |
|---|---|
| `src/config.js` | Model ids, API base, questions, texts, timeout |
| `src/logic.js` | Pure logic: `parseYesNo`, prompts, `parseSummary`, `emptySummary`, `shouldEscalate`, `formatSummary` |
| `src/api/gemini.js` | `summarize`, `transcribe`, `GeminiError`, model fallback |
| `src/notifyDoctor.js` | MOCK alerts list with subscribe/clear |
| `src/App.jsx` | Owns all state, escalation latch, calls `notifyDoctor` |
| `src/components/*` | ConsentScreen, Question (with recorder), ResultScreen, ErrorScreen, Banner |
| `scripts/run-scenarios.mjs` | Node run of the fictional scenarios |

## 4. User flow

1. Consent screen: privacy note, key input, start.
2. Q0 screening (voice or text). `parseYesNo` decides.
3. Q0 "yes": escalate at once, intake stops, no LLM call, empty summary.
4. Q0 "no": Q1..Q4. A transcript lands in the text field and can be corrected before submit. Silence gives an empty answer, sent to the LLM as `(brak odpowiedzi)`.
5. `summarize` runs; `shouldEscalate` checks the LLM flag.
6. Result: summary, escalation status, panel "Alerty dla lekarza".
7. Any failure: error screen with the emergency text, answers kept, retry allowed.
8. Clear (any screen) resets everything, including the key.

A banner with the AI disclaimer and 112 is visible on every screen.

## 5. Safety invariants

1. Escalation only goes up: screening "yes" OR LLM red flag. The `escalated` latch goes false to true; only Clear resets it.
2. The LLM never decides Q0 and can never cancel an escalation. `parseYesNo` fails up: only an answer starting with "nie" and without "tak" counts as "no".
3. Errors (network, HTTP, parse, malformed summary) never look like a normal result: error screen with `EMERGENCY_TEXT`, no summary, no `notifyDoctor`.
4. No "all clear" wording anywhere; `formatSummary` never reassures.
5. The API key lives in React state only: not in localStorage, URLs, logs or commits.
6. Nothing is stored or logged (answers, transcripts, raw responses).

## 6. Data shapes

```js
/** Summary */
{ chief_complaint: string, duration: string, medications: string, allergies: string,
  patient_quotes: string[], llm_red_flag: boolean, red_flag_quote: string | null }
// missing text fields -> "nie podano"

/** Answer */
{ questionId: string, question: string, text: string }

/** Alert (MOCK) */
{ id: string, timestamp: string, source: "screening" | "llm" | "both", quote: string | null }
```

`shouldEscalate` returns `{escalate, source, quote}`. Source `"both"` is currently unreachable (a screening "yes" makes no LLM call).

## 7. Gemini integration

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- Headers: `x-goog-api-key` and `content-type: application/json`.
- Models, tried in order: `gemini-3.5-flash`, then `gemini-3.1-flash-lite`. Fall back only on HTTP 503 or timeout. Other errors, or all models failing, throw `GeminiError` (`NETWORK`, `HTTP` or `PARSE`).
- Timeout: 30 s per request (`AbortSignal.timeout`).
- JSON mode: `responseMimeType: "application/json"`; no `responseSchema`. `parseSummary` is the only validator: invalid JSON, a missing or non-boolean `llm_red_flag` is an error, never "no flag".
- `transcribe` sends the transcription prompt plus the audio as `inline_data`. Audio input on these models is NOT yet verified.
- Answers are embedded in the prompt as JSON data, with rules to ignore instructions inside them and to treat negated symptoms as not a flag.

## 8. Testing

- Unit tests (Vitest): `tests/logic.test.js` (parsers, escalation gate, summary formatting) and `tests/gemini.test.js` (mock `fetchImpl`: request shape, header, error codes, key never logged).
- Text-input scenarios on 5 fictional cases ([docs/test-scenarios.md](test-scenarios.md)): simple complaint (no escalation), negation trap (no), hidden red flag in Q1 (yes, via LLM), Q0 "yes" (yes, immediately), incomplete answers (no). Results: not yet run.
- Manual voice run in the browser: not yet done.

## 9. Known limitations

- The red-flag list is illustrative, not clinically validated.
- The LLM may miss a red flag in Q1-Q4; Q0 is the independent second layer. Prompt injection can only suppress the free-text flag.
- No keyword layer (Polish inflection and negation would break it).
- The key is visible in the browser session (no backend); CORS verified only from `http://localhost:5173`.
- Free-tier models may return 503; availability changes.
- `notifyDoctor` is a mock.
- Speech recognition errors are possible; the user must check the transcript.

## 10. To update after implementation

- [ ] Model ids in `MODEL_IDS` still valid and available.
- [ ] Audio input works on the chosen models (first manual voice run).
- [ ] Timeout value and fallback behaviour as implemented.
- [ ] Scenario results (5 scenarios) and unit test results.
- [ ] Final file layout, module names and signatures.
- [ ] README TODOs: setup, screenshots, test results, `speechSynthesis` use.
- [ ] Transcript uncertainty highlighting: confirm whether implemented.
- [ ] Source `"both"` still unreachable.
