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
- The transcript is editable, and uncertain words are highlighted. Uncertainty is model self-reported, not calibrated.

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

TODO: fill in after the final build (install, `.env`/key handling, dev server, test commands).

## Screenshots

TODO

## Testing approach

- Unit tests (Vitest) on pure logic.
- Automated text-input runs on fictional cases (`docs/test-scenarios.md`).
- Manual voice run.

Results: TODO

## AI services used

- Google Gemini: transcription and summary.
- Browser `speechSynthesis`: TODO (confirm whether used).
