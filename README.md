# Voice pre-consultation intake (DRAFT)

A personal project exploring voice as an interface in telemedicine. Before a consultation, the patient answers a few fixed questions by voice. Google Gemini transcribes the answers and produces a structured summary for the doctor, including the patient's verbatim quotes. The AI does not assess urgency, prioritise, diagnose, advise treatment or reassure. It only prepares the conversation.

Stack: Vite + React + JavaScript, no backend. This is a prototype and not a medical product.

## Why this problem

The idea started from triage: long waits in an emergency department just to answer a few questions. But a telemedicine service is not an ER. Triage decides urgency and order, and an unvalidated LLM fed by speech-recognition errors could harm patients or prioritise them unfairly. So the project does pre-consultation intake instead. Doctors already take the history; this prepares it.

## Considered and rejected

- AI triage / urgency scoring: unfair or harmful prioritisation risk, cannot be validated here.
- Routing to a specialty: needs a real specialty list.
- Standalone emergency detection as the product: highest risk, unvalidatable.
- Regex keyword red-flag detection: Polish inflection, negations ("nie mam duszności") and STT errors would make it theatre. A possible next step.
- Adaptive follow-up questions: more scope and more model risk.
- Storing data / history: not needed, and avoids holding health data.
- Authentication: out of scope for a prototype.
- ElevenLabs / second provider: one provider is enough.
- React Native / Expo: setup cost on Windows for a 1-2 hour build.
- TypeScript: speed for a tiny project.
- Automated end-to-end mic tests (Playwright): time.

## Safety design

- A fixed red-flag screening question is asked of every patient. The list is ILLUSTRATIVE and NOT clinically validated: severe chest pain, breathlessness, stroke signs, heavy bleeding, thoughts of self-harm.
- Escalation only goes up: screening "yes" OR an LLM flag escalates. The LLM can never cancel an escalation.
- On escalation the app shows "call the emergency number (112 in the EU; local number abroad)" and automatically sends an alert into the system. In this prototype that is a MOCK alert panel; production needs integration with the real clinical system.
- The app never displays "no red flags". It says "not a safety clearance".
- Errors never look like a normal summary.
- The transcript is editable and the patient is asked to check it against what they said. The last recording can be played back. Highlighting of uncertain words was cut.
- Recordings that are too short, empty or near-silent are not sent to the model; the transcription prompt returns empty text when no clear human speech is audible.

## Behaviour worth knowing

- Screening question (Q0): only a bare "Nie." counts as "no". "Tak" escalates. Any other answer ("Nie, nic z tych rzeczy", "Nie wiem", "Nie, ale mam duszność", unrelated text) is "unclear": the patient stays on Q0 and is asked to repeat or to press an explicit "Tak, mam taki objaw" / "Nie, nie mam żadnego z tych objawów" button.
- Price of this rule: a natural longer denial needs one button click. This is deliberate; the app does not guess from free text. The escalation parser still fails up (anything that is not a bare "nie" counts as yes).
- The Q0 answer text is also sent to the model as part of the data (defence in depth).
- The mock alert panel "Alerty dla lekarza" is the only "notification"; nothing real is sent.
- Known gap (not done, ran out of time): when a recording is sent but the transcript comes back empty (no speech captured), the answer field stays empty under the label "Sprawdź, czy tekst zgadza się z tym, co powiedziałeś." and no message says that nothing was detected. This is unintuitive: a user who believes they spoke does not know what to do next. The fix is an explicit "no speech detected, record again or type the answer" message. Recordings that are too short or near-silent are already caught before sending; this case is different (audio was sent, the transcript is empty).

## API key and privacy

- The Gemini API key is typed into the UI. It is kept in memory only, sent in the `x-goog-api-key` header, and never stored or logged.
- Google advises against client-side keys in production. For testing, use a dedicated key restricted to the Gemini API.
- Health data is special-category data under GDPR. The Gemini FREE tier may use content to improve Google products, and humans may review it. Use fictional data only.
- Nothing is stored and no identifiers are collected.

## Production caveats

- Backend proxy with a server-held key.
- Paid tier or Vertex AI with no-training terms; data processing agreement; EU data residency.
- Clinical sign-off on the red-flag list and the questions.
- Possible medical-device regulatory review (would need assessment).
- Integration of alerts with the real on-call workflow.
- Evaluation on real speech (accents, medical terms).

## Setup and run

Prerequisites: Node 20.6+ and a Gemini API key of your own.

1. Install dependencies inside the `app/` folder: `npm install`. (`npm --prefix app install` from the repo root may fail on Windows with ENOENT; running it inside `app/` works.)
2. From the repo root: `npm --prefix app run dev`, then open http://localhost:5173.
3. Paste your Gemini API key into the field on the first screen. It is kept in memory only. Use fictional data only.

Build: `npm --prefix app run build`. The `.env` file (gitignored, `GEMINI_API_KEY`) is used only by the Node scenario script.

## Screenshots

TODO (not taken yet)

## Testing approach

Three layers (details and observations in [docs/TESTING.md](docs/TESTING.md)):

- Unit tests (Vitest) on pure logic, the API module with mocked `fetch`, and the mock notifier: `npm --prefix app test`.
- Automated text-input runs on 5 fictional cases against the real Gemini API ([docs/test-scenarios.md](docs/test-scenarios.md)): `node --env-file=.env app/scripts/run-scenarios.mjs` from the repo root.
- Manual voice run in a real browser.

Results as of 2026-10-23, commit a255031:

- Unit tests: 114 passing in 5 files. The build succeeds.
- Scenarios: one run, all 5 PASS (the script prints PASS/FAIL only; the model is not deterministic, so one run is one sample). The summary fields after the latest prompt change are not yet inspected.
- Manual voice: earlier runs failed because of a wrong microphone; with the right one the full flow gave a correct summary. The newest build has not yet been tried by hand (TODO).

## More documentation

- [DECISIONS.md](DECISIONS.md): cuts and rejected options with reasons.
- [docs/TESTING.md](docs/TESTING.md): test approach, results, defects, limits.
- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md): technical documentation.
- `docs/design/`: architecture and diagrams.

## AI services used

- Google Gemini: transcription and summary. Models are tried in order (`gemini-3.5-flash`, then `gemini-3.1-flash-lite`); the next one is used on HTTP 503, 429 or timeout.
- Text-to-speech (reading questions aloud) was cut; it is not used.
