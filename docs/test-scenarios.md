# Test scenarios: Polish voice pre-consultation intake

**All patient data in this document is fictional.** The five cases are written only for
testing the software (intake flow, red-flag escalation, summary fields). They are **not**
clinical validation and must not be used to judge medical correctness.

Questions asked by the app (in Polish):

- **Q0** (red-flag screening, yes/no): "Czy masz teraz silny ból w klatce piersiowej, duszność, opadnięty kącik ust lub osłabienie ręki, problemy z mówieniem, silne krwawienie albo myśli o zrobieniu sobie krzywdy?"
- **Q1** "Co Ci dolega?"
- **Q2** "Od kiedy masz te objawy?"
- **Q3** "Jakie leki przyjmujesz?"
- **Q4** "Czy masz na coś alergię?"

Expected summary fields: chief complaint, duration, medications, allergies. Write
"not stated" where the patient gave no usable answer.

---

## How to use

**Text mode (automated tests).** The test feeds each answer string as text input, in
order, starting with Q0. After each answer the app must either ask the next question or
escalate. If the app escalates, the test stops feeding answers. Compare the escalation
flag and the summary fields with the EXPECTED block.

**Voice mode (manual tests).** The tester reads the Polish answers aloud, as the patient
would, into the microphone. Read them in a natural, slightly hesitant way, and do not
spell out punctuation. Check that speech recognition produces text close enough to the
script to reach the same outcome. For a silent answer (scenario 5, Q4), stay silent until
the app's timeout, or move on if the app has no timeout. Record any transcription error
that changes the outcome.

---

## Scenario 1: Simple common complaint, no escalation

Sore throat and fever for 2 days. Nothing alarming.

| Question | Answer (Polish, as dictated) |
|---|---|
| Q0 | "Nie." |
| Q1 | "Boli mnie gardło i mam gorączkę, chyba jakieś trzydzieści osiem i pół." |
| Q2 | "Od dwóch dni, od wczoraj gorączka jest wyższa." |
| Q3 | "Nie biorę nic na stałe, tylko czasem paracetamol." |
| Q4 | "Nie, nie mam alergii." |

**EXPECTED**
- Escalate: **no**
- Chief complaint: sore throat and fever
- Duration: 2 days
- Medications: occasional paracetamol (no regular medication)
- Allergies: none reported

---

## Scenario 2: Negation trap, no escalation

The patient uses words from the red-flag list ("duszność", "ból w klatce") only to deny
them. The app must not treat the mentions as symptoms.

| Question | Answer (Polish, as dictated) |
|---|---|
| Q0 | "Nie." |
| Q1 | "Mam kaszel i katar, ale nie mam duszności ani bólu w klatce piersiowej, oddycham normalnie." |
| Q2 | "Od trzech dni." |
| Q3 | "Biorę tylko syrop na kaszel, nic więcej." |
| Q4 | "Nie, nie mam żadnych alergii, nie znam żadnych uczuleń." |

**EXPECTED**
- Escalate: **no**. The negated words ("nie mam duszności", "nie mam bólu w klatce")
  must not trigger escalation on their own.
- Chief complaint: cough and runny nose
- Duration: 3 days
- Medications: cough syrup (name not stated)
- Allergies: none reported

---

## Scenario 3: Hidden red flag in the free-text answer, escalate

Q0 is answered "nie", but the complaint in Q1 describes a possible cardiac emergency.
The screening question was answered no, so the LLM check on the free-text answers must
raise the flag.

| Question | Answer (Polish, as dictated) |
|---|---|
| Q0 | "Nie." |
| Q1 | "Od godziny ściska mnie w klatce piersiowej i drętwieje mi lewa ręka." |
| Q2 | "Od około godziny, nagle się zaczęło." |
| Q3 | "Biorę tabletki na nadciśnienie, nazwy nie znam." |
| Q4 | "Nie, nie mam alergii." |

**EXPECTED**
- Escalate: **yes**. Reason: the LLM flag on Q1 (chest pressure plus left arm numbness)
  overrides the negative Q0. Q0 alone was "no", so this checks the second safety layer.
- Chief complaint: chest pressure and left arm numbness, started about 1 hour ago
- Duration: about 1 hour (sudden onset)
- Medications: blood pressure tablets (name not stated)
- Allergies: none reported

---

## Scenario 4: Screening answered yes, immediate escalation

The intake must stop after Q0.

| Question | Answer (Polish, as dictated) |
|---|---|
| Q0 | "Tak, mam duszność, ciężko mi oddychać." |
| Q1–Q4 | Not sent. The intake must not ask them. |

**EXPECTED**
- Escalate: **yes, immediately after Q0**. The app must not ask Q1–Q4.
- Chief complaint: not stated (intake stopped before Q1). Record the Q0 answer as the
  escalation reason.
- Duration: not stated
- Medications: not stated
- Allergies: not stated

---

## Scenario 5: Incomplete answers, no escalation

Vague or missing answers. The patient does not know the medication names, the duration or
the allergies, and stays silent on Q4. The app must not escalate for this, and must record
the missing fields as "not stated".

| Question | Answer (Polish, as dictated) |
|---|---|
| Q0 | "Nie." |
| Q1 | "Boli mnie brzuch, takie tępe bóle, zwłaszcza po jedzeniu." |
| Q2 | "Nie pamiętam, nie wiem, dawno już." |
| Q3 | "Nie wiem, nie pamiętam nazw leków." |
| Q4 | (silence, no answer) |

**EXPECTED**
- Escalate: **no**
- Chief complaint: dull abdominal pain, worse after eating
- Duration: not stated
- Medications: not stated
- Allergies: not stated (no answer given)
