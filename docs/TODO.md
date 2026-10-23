# TODO (later)

## UI
- [ ] Empty transcript (no speech captured) is confusing: the field stays empty under the label "Sprawdź, czy tekst zgadza się z tym, co powiedziałeś.", but nothing says that no speech was detected. A user who is sure they spoke does not know what to do. Needed: an explicit message when the transcript comes back empty (for example "Nie wykryto mowy. Nagraj ponownie albo wpisz odpowiedź tekstem."), and no "check the text" label next to an empty field. Not done: ran out of time.
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
