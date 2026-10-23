> **DRAFT — updated to repo state a255031 (2026-10-23).** Some items in section 10 are still open (manual verification of the newest build, final README review); treat it as final only when they are checked.

# Voice pre-consultation intake: technical documentation

## 1. What the app does

Before a consultation, the patient answers one screening question and four intake questions (Polish UI), by voice or text. Google Gemini transcribes the audio and produces a structured summary for the doctor: chief complaint, duration, medications, allergies and verbatim patient quotes.

It deliberately does NOT: diagnose, rate urgency, prioritise, advise, reassure, store any data, authenticate users, or notify a real doctor (`notifyDoctor` is a MOCK alert panel). It is a prototype, not a medical product. For rationale, rejected options and privacy/production caveats see [README.md](../README.md).

## 2. Quick start

Requires Node 20.6+. Run `npm install` inside `app/` (from the repo root, `npm --prefix app install` may fail on Windows with ENOENT). Then, from the repo root:

```
npm --prefix app run dev     # http://localhost:5173
npm --prefix app test        # Vitest unit tests
npm --prefix app run build
node --env-file=.env app/scripts/run-scenarios.mjs   # text-input scenarios against the real API
```

The Gemini key is typed into the UI and kept in memory only. `.env` is gitignored and is used only by the Node scenario script (`GEMINI_API_KEY`). Use fictional data only.

## 3. Architecture overview

Vite + React + plain JavaScript, no backend; the browser calls Gemini directly. Diagrams: [docs/design/architecture-diagram.md](design/architecture-diagram.md) (diagram 1: flow and state machine; diagram 2: module dependencies; diagram 3: escalation decision as an OR-gate). Full design: [docs/design/architecture.md](design/architecture.md).

| Module | Responsibility |
|---|---|
| `src/config.js` | Model ids, API base, questions, texts, timeout |
| `src/logic.js` | Pure logic: `parseYesNo`, `classifyAnswer`, `buildAnswers`, `buildTranscriptionPrompt`, `buildSummaryPrompt`, `parseSummary`, `emptySummary`, `shouldEscalate`, `formatSummary` |
| `src/api/gemini.js` | `summarize`, `transcribe`, `GeminiError`, model fallback |
| `src/notifyDoctor.js` | MOCK alerts list with subscribe/clear |
| `src/App.jsx` | Owns all state, escalation latch, calls `notifyDoctor` |
| `src/components/*` | ConsentScreen, Question (with recorder), ResultScreen, ErrorScreen, Banner |
| `scripts/run-scenarios.mjs` | Node run of the fictional scenarios |

## 4. User flow

1. Consent screen: privacy note, key input, start.
2. Q0 screening (voice or text). `classifyAnswer` returns "yes", "no" or "unclear". Tak/Nie buttons are always visible, with a hint to answer briefly "Tak" or "Nie".
3. Q0 "yes" (whole word "tak"): escalate at once, intake stops, no LLM call, empty summary.
4. Q0 "no" (only a bare "Nie."): Q1..Q4. Q0 "unclear" (any other answer): the patient stays on Q0, sees "Nie zrozumieliśmy odpowiedzi. Powtórz albo wybierz poniżej." and the explicit buttons "Tak, mam taki objaw" / "Nie, nie mam żadnego z tych objawów". Price: a natural longer denial needs one click; no guessing from free text.
5. A transcript lands in the text field and can be corrected before submit; the last recording can be played back. Silence gives an empty answer, sent to the LLM as `(brak odpowiedzi)`. `buildAnswers` includes the Q0 answer in the data sent to the model.
6. `summarize` runs (a second call is blocked on double click); `shouldEscalate` checks the LLM flag.
7. Result: summary, escalation status, panel "Alerty dla lekarza".
8. Any failure: error screen with the emergency text, answers kept, retry allowed.
9. Clear (any screen) resets everything, including the key.

A banner with the AI disclaimer and a single red bold 112 is visible on every screen.

Recorder guards: explicit `audio/webm;codecs=opus` when supported; recordings shorter than 0.7 s, tiny blobs, or with near-zero signal (peak below about -40 dBFS) are not sent ("Nagranie jest za krótkie lub puste…" / "Mikrofon prawie nic nie nagrał. Sprawdź, czy wybrano właściwy mikrofon…"). A recording result that arrives after the question changed is dropped. The transcription prompt returns empty text when there is no clearly audible human speech.

## 5. Safety invariants

1. Escalation only goes up: screening "yes" OR LLM red flag. The `escalated` latch goes false to true; only Clear resets it.
2. The LLM never decides Q0 and can never cancel an escalation. `parseYesNo` fails up: anything that is not a bare "nie" counts as yes. `classifyAnswer` adds the "unclear" state for the patient flow (stay on Q0, explicit buttons); it never turns a longer answer into "no".
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
- Models, tried in order: `gemini-3.5-flash`, then `gemini-3.1-flash-lite`. Fall back to the next model on HTTP 503, 429 or timeout. Other errors, or all models failing, throw `GeminiError` (`NETWORK`, `HTTP` or `PARSE`).
- Timeout: 30 s per request (`AbortSignal.timeout`).
- JSON mode: `responseMimeType: "application/json"`; no `responseSchema`. `parseSummary` is the only validator: invalid JSON, a missing or non-boolean `llm_red_flag` is an error, never "no flag".
- `transcribe` sends the transcription prompt plus the audio as `inline_data`. Audio input worked in the manual voice run with the correct microphone (transcription and summary correct); the newest build is not yet re-tested by hand.
- Answers are embedded in the prompt as JSON data, with rules to ignore instructions inside them and to treat negated symptoms as not a flag. An explicit denial ("no allergies") gives "brak"; "I don't know / don't remember" gives "nie podano".

## 8. Testing

- Unit tests (Vitest), 114 passing in 5 files at a255031: `tests/logic.test.js` (parsers, Q0 classification, escalation gate, prompts, summary formatting), `tests/gemini.test.js` (mock `fetchImpl`: request shape, header, error codes, fallback, base64, key never logged), `tests/summary-safety.test.js` (summary parsing and no-reassurance invariants), `tests/notifyDoctor.test.js`, `tests/smoke.test.js`. The race guards have no automated tests.
- Text-input scenarios on 5 fictional cases ([docs/test-scenarios.md](test-scenarios.md)): simple complaint (no escalation), negation trap (no), hidden red flag in Q1 (yes, via LLM), Q0 "yes" (yes, immediately), incomplete answers (no). Latest run: 5/5 PASS (one sample, PASS/FAIL only; fields not yet read).
- Manual voice run: earlier failures were a wrong microphone; with the right one the flow worked. The newest build is not yet tried by hand. Details in [TESTING.md](TESTING.md).

## 9. Known limitations

- The red-flag list is illustrative, not clinically validated.
- The LLM may miss a red flag in Q1-Q4; Q0 is the independent second layer. Prompt injection can only suppress the free-text flag.
- No keyword layer (Polish inflection and negation would break it).
- The key is visible in the browser session (no backend); CORS verified only from `http://localhost:5173`.
- Free-tier models may return 503; availability changes.
- `notifyDoctor` is a mock.
- Speech recognition errors are possible; the user must check the transcript.

## 10. To update after implementation

- [x] Model ids in `MODEL_IDS` (`gemini-3.5-flash`, `gemini-3.1-flash-lite`) work in the scenario runs; availability may change.
- [x] Audio input works on the chosen models (manual run with the correct microphone).
- [x] Timeout (30 s) and fallback (503, 429, timeout) as implemented.
- [x] Scenario results (5/5 PASS) and unit test results (114 passing).
- [x] File layout, module names and signatures (`classifyAnswer`, `buildAnswers` added).
- [ ] README: setup and tests filled; screenshots still TODO, final review TODO.
- [x] Transcript uncertainty highlighting and TTS: not built (cut).
- [x] Source `"both"` still unreachable.
- [ ] Manual test of the newest build (Q0 changes, recorder guards, wrong or muted microphone, single 112, race guards).
- [ ] Read the scenario 2 and 5 summaries to confirm the allergy / "nie wiem" prompt change.
