# DECISIONS

Dated log of conscious decisions, cuts and rejected options. One-line reasons.

## 2026-10-23

### Scope and product

- Chose pre-consultation intake over triage: a telemedicine service is not an ER, and an unvalidated LLM fed by speech-recognition errors could harm or unfairly prioritise patients.
- The app only prepares the history for the doctor: doctors already take the history themselves.
- Rejected: urgency scoring / queue ordering: unfair or harmful prioritisation, cannot be validated here.
- Rejected: diagnosis, advice, reassurance: outside the purpose and unsafe without validation.
- Rejected: routing to specialty: needs the real specialty list.
- Rejected: standalone emergency detection as the product: highest risk, unvalidatable.
- Rejected: adaptive follow-up questions: more scope and more model risk.
- Rejected: storing data / history: not needed, and avoids holding health data.
- Rejected: authentication: out of scope for a prototype.
- Rejected: ElevenLabs / second provider: one provider is enough.

### Safety

- A fixed screening question (Q0) is asked of every patient: independent of the LLM.
- Escalation only goes up: the LLM may raise a flag but never cancel one.
- Malformed model output is an error, never "no flag": a bad shape must not look like a clean result.
- The summary screen never claims safety ("no red flags" is never shown).
- The error screen always shows the emergency number: a failure must never look like a normal result.
- `notifyDoctor` is a MOCK, fired automatically on escalation: production would integrate with the real on-call workflow, which is unknown here.
- The red-flag list is illustrative, not clinically validated.
- Unclear Q0 answers are never treated as "no": the patient must pick Tak/Nie explicitly.
- Changed from automatic escalation on unclear Q0 to explicit Tak/Nie buttons after a real test where a wrong-microphone recording was transcribed as unrelated text.
- Rejected: regex keyword red-flag layer: Polish inflection, negations ("nie mam duszności") and STT errors make it theatre; documented as a possible next step.
- Residual risk accepted: prompt injection can only suppress the free-text flag; the Q0 layer stays independent.

### Stack and integrations

- Vite + React + JavaScript, no backend: smallest setup for a 1-2 h build.
- Rejected: React Native + Expo: setup cost for a 1-2 h build.
- Rejected: TypeScript: speed on a tiny project.
- Gemini REST called from the browser; CORS preflight verified from localhost:5173 only.
- `responseMimeType` JSON only, no `responseSchema`: `parseSummary` validates the output.
- Models: `MODEL_IDS` = gemini-3.5-flash, then gemini-3.1-flash-lite; fallback on 503, timeout and 429.
- Reason for the fallback: the free tier showed 503 overloads (the same key got 200 from one model and 503 from another at the same time).
- Also seen: gemini-2.5-flash returned 404 for new users, gemini-3.8-flash hung, and 429 quota appeared after repeated scenario runs.
- 30 s timeout per Gemini call: the free tier can hang.
- OpenAI kept as plan B if Gemini is not enough (not built).
- API key typed in the UI, kept in React state only, sent in the `x-goog-api-key` header, never stored or logged: entering the key in the app is a requirement.
- Client-side key is not production-grade (Google advises against it): production needs a backend proxy.
- Health data is special-category under GDPR; the Gemini free tier may use content to improve Google products and humans may review it, so fictional data only; nothing is stored.

### Testing

- Unit tests (Vitest) on pure logic; text-input scenario script on 5 fictional cases; manual voice run. The scenario script and the manual voice runs are separate checks.
- Finding: transcription produced fluent unrelated Polish sentences on recordings with no speech (wrong microphone selected in the browser).
- Finding: synthetic audio test: pure noise through the same code path returned invented text ("Drodzy widzowie,"), while real speech, even very quiet speech in noise, was transcribed correctly.
- Fix: the prompt returns empty text when no clearly audible speech, recorder guards (minimum length, minimum level, playback), explicit Tak/Nie buttons.
- After selecting the right microphone, the full flow produced a correct summary.
- Rejected: Playwright end-to-end microphone tests: time.
- Process: designed with an actor / critic / summarizer pipeline of subagents (Sonnet/Haiku helpers, Opus orchestration); coding by parallel Sonnet agents.

### Cut or postponed

- TTS reading the questions aloud.
- Highlighting uncertain transcript words.
- Message for an empty transcript (no speech captured): the field stays empty with a "check the text" label and no explanation. Postponed: ran out of time.
- Duplicate "112" text in the banner (UI cleanup).
- Clinical validation of the red-flag list and questions.
- Backend proxy with a server-held key.
- Real alert integration.

### Open questions

- What is the real on-call alert channel?
- Does this intake overlap with an existing intake in the real service? (unknown)
- Regulatory status of red-flag detection: needs assessment, no claims made.
- Behaviour on real accents and medical terms: unmeasured.
