# TODO (later)

## UI
- [x] Duplicate "112": single red bold 112 in the banner now (done, visual check in the browser still open).

## Code
- [x] Treat HTTP 429 like 503 in `app/src/api/gemini.js` (done, with a test).
- [ ] Verify audio input (`audio/webm`) on the chosen models in a real browser run with the newest build; check Polish quality.
- [x] Two recordings in a row that give the same text now refill the field.
- [x] Test for the browser base64 branch.
- [ ] Optional: component tests for the race guards (stale recording result, double click on the last "Dalej").

## Verification
- [ ] Confirm the allergy / "nie wiem" summaries (scenarios 2 and 5) by reading the outputs, not only PASS/FAIL.
- [ ] Manual test of the newest build (Q0 changes, recorder guards, single 112), including a wrong or muted microphone.
- [ ] Screenshots for the README.

## Docs
- [x] Update `docs/DOCUMENTATION.md` after implementation (done for a255031; remaining items are in its checklist).
- [x] Fill README run commands and test results.
- [ ] README: screenshots and final review.
- [x] `DECISIONS.md` exists.

## Cut for now
- [ ] Highlighting uncertain transcript words, TTS reading the questions aloud.
