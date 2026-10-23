# Architecture critic review

Note: the [PROJECT] section of CLAUDE.md is still empty in the file I read; I used the safety rules from the brief instead.

## 1. Problems

1. **Q0 is free text in the scenarios, not a button.** Scenarios 1-5 feed Q0 as sentences ("Nie, nic z tych rzeczy...", "Tak, mam dusznosc..."). The actor has no yes/no interpreter. Needed: a deterministic `parseYesNo`; anything not clearly "nie" counts as yes (fail-safe up). The LLM must not decide Q0.
2. **Scenario 4 contradiction.** Actor lets the user "continue to intake" after a screening yes. The scenario says intake must stop and Q1-Q4 are not asked. Stop; do not call the LLM; summary fields are all "not stated"; the Q0 answer is the escalation reason.
3. **Summary failure after screening "no".** Actor shows an error screen (good) but does not say what it contains. It must show the 112 text, keep the answers, and allow retry. It must not show a "normal" result and must not call notifyDoctor (the LLM said nothing).
4. **Malformed JSON, flag missing or not boolean.** Any invalid shape is an error, never "no flag". A string "true" counts as true (fail up). A missing `llm_red_flag` is invalid. `red_flag_quote` is optional text.
5. **Prompt "when in doubt set true" vs scenario 2 (negation trap).** The prompt must also say that denied symptoms ("nie mam dusznosci") are not a flag. Without it the scenario fails.
6. **Prompt injection.** Send answers as `JSON.stringify` data inside delimiters. Injection can only suppress the free-text flag; the screening layer stays independent. Residual risk: document it in DECISIONS.md, do not build a keyword layer (it would break scenario 2).
7. **Language constant.** Actor says "nie podano" in the prompt and "not stated" elsewhere. Pin one constant `NOT_STATED = "nie podano"`. The scenario script and tests compare against it.
8. **Silence (scenario 5).** Empty transcript must become `text: ""` and be sent as "(brak odpowiedzi)", not cause an error.
9. **Over-engineering.** `buildAlert`, `summaryExcerpt`, `uncertain[]` highlights, a separate ErrorScreen, EmergencyBox, DoctorAlerts and Banner files, a 4-way alert source, and a script that parses the markdown file. Too much for 50 minutes.
10. **Browser-only assumptions.** `gemini.js` must not use `import.meta.env`, `FileReader` or `Blob.arrayBuffer` in a way that breaks Node. Use `Buffer`/`btoa` guarded.

## 2. Cuts

- Merge `prompts`, `parseSummary`, `escalation`, `summaryText` and `parseYesNo` into ONE `src/logic.js` (fewer imports to agree on).
- Drop `uncertain`, TTS, `buildAlert`, DoctorAlerts as a separate file (render alerts inline in App).
- Banner, EmergencyBox and ErrorScreen become small inline pieces in `App.jsx`/`Screens.jsx`.
- Scenario script reads `scripts/scenarios.json` (hand-copied answers + expected `escalate`), not the markdown.
- The user may use text input as a fallback to voice everywhere (needed for scenarios anyway).

## 3. PINNED INTERFACES (all under `app/src/`, ES modules, plain JS)

```js
// config.js
export const MODEL_ID;            // string, e.g. "gemini-2.5-flash" (UNSURE: verify with one real call)
export const API_BASE;            // "https://generativelanguage.googleapis.com/v1beta"
export const NOT_STATED = "nie podano";
export const NO_ANSWER = "(brak odpowiedzi)";
export const QUESTIONS;           // [{id:"q0",text,screening:true},{id:"q1",text},...q4]; texts verbatim from scenarios
export const EMERGENCY_TEXT;      // "Zadzwon pod numer alarmowy 112 teraz."
export const DISCLAIMER_TEXT;     // "To asystent AI, nie lekarz. ..." (no reassurance)

// logic.js  (pure, no fetch, no React)
/** @typedef {{chief_complaint:string,duration:string,medications:string,allergies:string,patient_quotes:string[],llm_red_flag:boolean,red_flag_quote:string|null}} Summary */
/** @typedef {{questionId:string,question:string,text:string}} Answer */
export function parseYesNo(text)            // -> "yes"|"no"; "no" only if text matches /^\s*nie\b/i and has no "tak"; else "yes"
export function buildTranscriptionPrompt()  // -> string
export function buildSummaryPrompt(answers) // Answer[] -> string (answers embedded as JSON data, includes negation + injection rules)
export const SUMMARY_SCHEMA;                // Gemini responseSchema object
export function parseSummary(rawText)       // -> {ok:true,summary:Summary}|{ok:false,error:string}; never throws; missing text fields -> NOT_STATED; extra fields dropped; llm_red_flag must be boolean or "true"/"false"
export function emptySummary()              // -> Summary with all NOT_STATED, llm_red_flag:false (used for scenario 4)
export function shouldEscalate(screening, summary) // screening:"yes"|"no", summary:Summary|null -> {escalate:boolean, source:"screening"|"llm"|"both"|null, quote:string|null}
export function formatSummary(summary)      // Summary -> string for the doctor; never contains "no red flags"/"brak"-style reassurance

// api/gemini.js  (works in browser and Node 18+; global fetch)
/** @param {string} apiKey @param {Answer[]} answers @param {{fetchImpl?:Function,signal?:AbortSignal}} [opts] */
export async function summarize(apiKey, answers, opts) // -> Promise<Summary> (already parsed via parseSummary). Throws GeminiError{code:"NETWORK"|"HTTP"|"PARSE",message}. Header x-goog-api-key. Never logs key/body.
export async function transcribe(apiKey, blob, opts)   // blob:Blob(audio) -> Promise<{text:string}>; "" if silent. Throws GeminiError. Browser only (MediaRecorder blob).
export class GeminiError extends Error { code }

// notifyDoctor.js  (MOCK)
/** @typedef {{id:string,timestamp:string,source:"screening"|"llm"|"both",quote:string|null}} Alert */
export function notifyDoctor(alert)   // Alert -> void; appends to module list, notifies subscribers; no throw
export function getAlerts()           // -> Alert[] (copy)
export function subscribeAlerts(fn)   // fn(Alert[]) -> unsubscribe function
export function clearAlerts()         // -> void

// Components (default exports, App.jsx owns all state)
// <ConsentScreen apiKey onKeyChange onStart/>      <Banner/> (always visible, DISCLAIMER_TEXT + 112)
// <Question question:{id,text} onSubmit(text:string) onRecorded(blob) busy:boolean error:string|null/>  // voice + text fallback; Recorder inside
// <ResultScreen summary:Summary escalation:{escalate,source,quote} alerts:Alert[] onClear/>
// <ErrorScreen message onRetry onClear/>  // always renders EMERGENCY_TEXT
```

Escalation latch: `escalated` only goes false -> true; reset only by Clear. `notifyDoctor` is called from App on the transition (once per escalation), not on a click. UNSURE: whether `gemini-2.5-flash` accepts `audio/webm` inline; confirm with one early call.

## 4. Task split and order

0. **Scaffold** (orchestrator, first): package.json, vite/vitest config, index.html, empty files with the exports above as stubs.
1. **Task A** owns `config.js`, `logic.js`, `tests/logic.test.js` (scenarios 1-5 as logic cases, parseSummary malformed cases, parseYesNo, shouldEscalate OR-gate).
2. **Task B** owns `api/gemini.js`, `notifyDoctor.js`, `scripts/run-scenarios.mjs`, `scripts/scenarios.json`, `tests/gemini.test.js` (mock `fetchImpl`). Run script early against the real API.
3. **Task C** owns `main.jsx`, `App.jsx`, `components/*`, `styles.css`.

A, B and C run in parallel against the stubs. Integration: tests green, script on 5 scenarios, one manual voice run.
