# TODO (later)

## UI
- [ ] Duplicate "112": the yellow banner ends with "call 112", and a red emergency box repeats it. Remove the 112 from the yellow text and keep only the red one.

## Code
- [ ] Treat HTTP 429 like 503 in `app/src/api/gemini.js`: try the next model in `MODEL_IDS` (limits may be per model), add a test. (Approved 2026-10-23, to do after the manual voice test so the live page is not reloaded mid-test.)
- [ ] Verify audio input (`audio/webm`) on the chosen models in a real browser run; check Polish quality.
- [ ] Two recordings in a row that give the same text do not refill the field.

## Docs
- [ ] Update `docs/DOCUMENTATION.md` after implementation (see its checklist).
- [ ] Fill README TODOs: run commands, screenshots, test results, TTS yes/no.
- [ ] `DECISIONS.md`: cuts and rejected options, free-tier model instability, OpenAI as plan B if Gemini is not enough.

## Cut for now
- [ ] Highlighting uncertain transcript words, TTS reading the questions aloud.
