# Testing

All patient data used in testing is fictional. Nothing here is clinical validation.

## 1. Test approach

| Layer | What it covers | How to run |
|---|---|---|
| Unit tests (Vitest) | Pure logic and the API module with a mocked `fetch` | `npm --prefix app test` |
| Automated text run | 5 fictional scenarios sent as text to the real Gemini API | `node --env-file=.env app/scripts/run-scenarios.mjs` (from repo root) |
| Manual voice run | Real microphone, real browser, real transcription | `npm --prefix app run dev`, open http://localhost:5173, read the answers from `docs/test-scenarios.md` |

Notes:
- The scenario script prints only PASS/FAIL/ERROR lines. It never prints the key, transcripts or summaries.
- In the manual run the API key is typed into the UI. Use fictional data only.
- The 5 scenarios and their expected outcomes are in `docs/test-scenarios.md`.

## 2. What the unit tests pin

At commit a255031 (2026-10-23) the suite is green: 114 passing in 5 files (logic 45, gemini 23, summary-safety 37, notifyDoctor 8, smoke 1); `npm --prefix app run build` succeeds. The count may change later. Test files: `logic.test.js`, `summary-safety.test.js`, `gemini.test.js`, `notifyDoctor.test.js`, `smoke.test.js`. The two race guards (stale recording result, double click on the last "Dalej") have no automated tests.

| Invariant | Where |
|---|---|
| Escalation only goes up: screening "yes" or LLM flag escalates; a summary flag of false never cancels a screening "yes" (OR-gate truth table) | `shouldEscalate` tests |
| `parseYesNo` / `classifyAnswer` fail towards escalation: only a bare "Nie." is "no"; "nie" followed by a symptom, doubt, empty or odd input is not "no"; a whole-word "tak" wins even after "nie" | `logic.test.js` |
| Malformed model output is an error, never "no flag": invalid JSON, non-object, missing or non-boolean `llm_red_flag` (only true/false or "true"/"false") | `parseSummary` tests, `gemini.test.js` (PARSE) |
| Extra fields dropped, wrong-typed fields become "not stated" or null | `parseSummary` tests |
| No reassurance wording: formatted output has no all-clear line and no "no flag" statement | `formatSummary` tests |
| Prompt injection handling: answers embedded only as JSON-encoded data; prompt tells the model to ignore instructions in data and that denied symptoms are not a flag | prompt tests |
| Transcription prompt: verbatim Polish, empty text for non-speech, never invent words | `buildTranscriptionPrompt` tests |
| Key never logged and never in error messages | `gemini.test.js` |
| Model fallback on 503, 429 and timeout; all models failing gives an error; caller abort does not fall back; fetch TypeError maps to NETWORK | `gemini.test.js` |
| Browser base64 branch (no `Buffer`, `btoa`) equals the Node result for audio larger than one chunk | `gemini.test.js` |
| Empty answers become NO_ANSWER in the prompt; silence gives empty transcript | `gemini.test.js` |
| Mock `notifyDoctor`: stores copies, subscribers can throw without breaking it, clear works | `notifyDoctor.test.js` |
| Scenarios 1 to 5 as logic-only cases | `logic.test.js` |

## 3. Automated text scenarios (real API)

The observations below come from the first run (8 API calls, no 503 or 429), before the prompt and Q0 changes. After the latest changes the script was run once more (a255031): all 5 scenarios PASS. That script prints only PASS/FAIL, so the summary fields of that run were not read (TODO). One run is one sample; the model is not deterministic. Scenario 1 now uses a bare "Nie." as the Q0 answer (see section 5).

| # | Scenario | Escalate | Observed output | Remarks |
|---|---|---|---|---|
| 1 | Sore throat and fever | no (PASS) | Complaint "Ból gardła i gorączka (około 38,5°C)"; duration "Od dwóch dni (od wczoraj gorączka jest wyższa)"; occasional paracetamol; allergies none | Spoken "trzydzieści osiem i pół" correctly normalised to 38,5°C, nothing invented |
| 2 | Negation trap | no (PASS) | Complaint "Kaszel i katar", flag false | Negated "duszność" and "ból w klatce" did not trigger. Allergies came out "Nie podano" although the patient denied them (inaccuracy) |
| 3 | Hidden red flag | yes (PASS) | `llm_red_flag` true, quote "ściska mnie w klatce piersiowej" | Q0 was "Nie."; second layer caught it. The quote covers only the chest part (escalation is correct) |
| 4 | Screening yes | yes (PASS) | Immediate escalation, no API call | Q1 to Q4 not asked |
| 5 | Incomplete answers | no (PASS) | Duration and medications copied verbatim ("Nie pamiętam, nie wiem, dawno już.") | Inconsistent: should be "nie podano" |

Agreed semantics: patient denial = "brak"; "I don't know" = "nie podano". The prompt change for scenarios 2 and 5 has been applied; the resulting fields are not yet confirmed by reading the outputs (TODO). The "Observed output" column above is from before the change.

## 4. The manual voice test (2026-10-23)

| Step | Time (local) | What happened |
|---|---|---|
| 1 | about 15:56 | Scenario 1, Q0 (a clear denial) read into the browser. Result: escalation, reason "odpowiedź na pytanie przesiewowe — „I to tak po cichutku”", all summary fields "nie podano", one alert in the "Alerty dla lekarza" mock panel (source: screening). The transcript was a fluent Polish sentence unrelated to the speech. The app fails towards escalation (anything not a clear "nie" counts as "yes"), so the safety behaviour worked as designed; the transcription did not. |
| 2 | about 16:00 | Same procedure. Transcript "Głowa mi pęka od tego hałasu." Escalated again. Red recording dot visible, about 3 s of speech. The tester's assessment: the model "hallucinates completely". |
| 3 | after | Investigation 1 (read-only). Synthetic Polish speech (Windows TTS) as WAV through the app's `transcribe()`: exact transcript ("Nie, nic z tych rzeczy. Czuję się po prostu chory."), parser returned "no". 3 s of digital silence and 3 s of low noise returned an empty string. Not covered yet: browser audio format (webm/opus) and a real microphone. |
| 4 | after | Investigation 2 (read-only). The `btoa` branch reproduced in Node without `Buffer` matched the reference for 0 to 1 MB and all 256 byte values. TTS speech converted with ffmpeg to MediaRecorder-like WebM/Opus (mime `audio/webm;codecs=opus`) was transcribed exactly ("Od trzech dni boli mnie gardło i mam gorączkę."), also at about -33 dB peak in pink noise. But 3 s of low pink noise alone in WebM returned invented text ("Drodzy widzowie,"), the same failure mode as the two observed outputs. The original transcription prompt covered only "silent or unintelligible" audio, not noise. Conclusion: code and format were fine; the recording most likely held no usable speech and the model invented text for noise. |
| 5 | after | Root cause confirmed by the user: the wrong microphone was selected in the browser. With the correct one the flow worked end to end: summary "Dolegliwość: Ból gardła i gorączka; Od kiedy: Dwa dni; Leki: Paracetamol doraźnie; Alergie: Brak", four patient quotes, no alerts (correct for a non-alarming case). A voice-dictation tool on the same machine can occupy the microphone; that was a suspected factor, unconfirmed. |
| 6 | after | Response (commit ea3cee7): stricter transcription prompt (empty text unless clearly audible human speech; never guess); recorder guards (minimum length 0.7 s, minimum signal level, explicit `audio/webm;codecs=opus`, playback of the last recording); an unclear Q0 answer no longer proceeds silently, the patient repeats or picks explicit "Tak"/"Nie" buttons; 429 falls back to the next model like 503; unit test for the base64 browser branch. |

### How to reproduce the microphone failure safely (TODO verify manually)
Pick a wrong input device, or mute the microphone in the OS, and record. Expected with the current build: a message such as "Mikrofon prawie nic nie nagrał. Sprawdź, czy wybrano właściwy mikrofon…" (near-zero signal, peak below about -40 dBFS) or "Nagranie jest za krótkie lub puste…" (under 0.7 s), and nothing sent to the model, not invented text. Implemented; not yet verified in the browser.

## 5. Defects found by testing

| Defect | Found by | Status |
|---|---|---|
| Scenario 1 Q1 said "chyba jakieś trzy osiemnaście" (meant about 38.5 °C, meaningless) | Human review of the test data | Fixed to "trzydzieści osiem i pół" in `docs/test-scenarios.md` and `app/scripts/scenarios.json` |
| Transcription invented fluent text for noise or near-silence | Manual voice test, then synthetic reproduction | Mitigated in ea3cee7 (prompt, recorder guards). Re-check manually (TODO) |
| Unclear Q0 answer proceeded silently | Manual voice test | Fixed in ea3cee7 |
| 429 (quota) did not fall back to next model | Review | Fixed in ea3cee7 |
| Same text recorded twice did not refill the field | Manual use | Fixed in ea3cee7 |
| Q0 answer starting with "nie" classified "no" even with a symptom ("Nie, ale mam duszność", "Nie, ale chcę się zabić", "nie, krwawię mocno") and for "Nie wiem"; Q0 text never reached the model, so the second layer could not catch it | Adversarial read-only review (probes on pure functions, no API) | Real bug. Fixed: only a bare "Nie." counts as "no"; other answers are "unclear" and need an explicit button; Q0 text is added to the model input. Covered by unit tests (114 passing at a255031) |
| Scenario 1 Q0 was a long denial ("Nie, nic z tych rzeczy...") | Consequence of the Q0 fix | Test data changed to a bare "Nie." because the requirement changed: only a bare "Nie." is accepted automatically. This is not a weakened test; a longer denial now correctly needs a button click |
| Double click on the last "Dalej" could start two summarize calls | Adversarial review | Guard implemented (second call blocked). No automated test; manual check TODO |
| A recording finishing after the patient moved on could fill the next question's field | Adversarial review | Guard implemented (stale result dropped when the question changed). No automated test; manual check TODO |
| Empty transcript (no speech captured) shows an empty field under "check that the text matches what you said", with no explanation; the user does not know what to do | Manual voice test | NOT fixed: ran out of time. Needs an explicit "no speech detected, record again or type the answer" message |
| Duplicate "112" in the banner | Review | Fixed: single red bold 112 in the banner, one 112 in the emergency box. Visual check in the browser TODO |
| Allergies "nie podano" after a denial; verbatim "I don't know" copied into fields | Automated scenarios 2 and 5 | Prompt change applied (denial gives "brak", "nie wiem" gives "nie podano"). Scenarios 5/5 PASS afterwards, but the fields were not read: confirm (TODO) |

Also confirmed by the review: `parseSummary` rejects anything but boolean or "true"/"false" flags, `formatSummary` adds no all-clear wording, the escalation latch fires `notifyDoctor` once, and Clear invalidates in-flight requests.

## 6. Lessons and limits

Lessons:
- A fail-up design hides transcription faults: unrelated text looked like a safe escalation. Check the transcript, not just the outcome.
- The model invents fluent text for noise. The prompt must say what to do with non-speech, and the app should guard before calling the model.
- Test data written by an agent needs human reading.
- Synthetic audio proves the pipeline, not the microphone.

Not covered:
- Real accents, dialects, fast or hesitant speech.
- Medical terms and drug names in speech.
- Clinical validity of the red-flag judgement (the scenarios are not clinical validation).
- Concurrency in a real browser (races were found by code review, not by browser tests).
- Only one microphone and one browser were tried.
- The model's output varies between runs; 8 calls are a small sample.

## 7. TODO

- [x] `npm --prefix app test` green after the Q0 and race fixes: 114 passing at a255031.
- [x] Re-run `run-scenarios.mjs` after the prompt change: 5/5 PASS (one run, PASS/FAIL only).
- [ ] Read the summaries of scenarios 2 and 5 to confirm "brak" / "nie podano" as agreed.
- [x] "Nie, ale mam duszność", "Nie wiem" and similar need confirmation (unit tests). Manual check of the Q0 buttons and hint in the browser still TODO.
- [ ] Confirm the double-click guard on the last "Dalej" and the stale-recording guard by hand (optional: component tests).
- [ ] Add a clear message when the transcript is empty (no speech captured); not done, ran out of time.
- [ ] Confirm a single "112" in the banner visually.
- [ ] Verify the wrong or muted microphone message (see section 4).
- [ ] Manual test of the newest build (Q0 changes, recorder guards, single 112).
- [ ] Manual voice run of all 5 scenarios with the correct microphone; record transcription errors.
- [ ] Check whether a dictation tool occupying the microphone affects recording.
- [ ] Try a second browser and microphone.
