# Architecture diagrams

Visual companion to `architecture.md`. If the two disagree, `architecture.md` wins.

## 1. Flow and state machine

The app moves from consent through the Q0 screening question. A screening "yes" escalates at once with no LLM call; otherwise Q1..Q4 are collected and summarized. Any API failure leads to an error screen with `EMERGENCY_TEXT` and a retry. The escalation latch only goes false to true, and `notifyDoctor` fires automatically on that transition.

```mermaid
flowchart TD
    Consent["consent<br/>privacy note, key input, start"]
    Q0["Q0 screening<br/>voice or text, parseYesNo"]
    Q14["Q1..Q4<br/>voice or text"]
    Summ["summarizing<br/>summarize(apiKey, answers)"]
    Esc["ESCALATE<br/>latch: false to true<br/>source screening, empty summary"]
    Check{"shouldEscalate<br/>llm_red_flag?"}
    Notify["notifyDoctor(alert)<br/>automatic, once, no patient click"]
    Result["result<br/>summary, escalation status,<br/>panel 'Alerty dla lekarza'"]
    Err["error<br/>EMERGENCY_TEXT, answers kept"]

    Consent -->|start| Q0
    Q0 -->|"yes (no LLM call)"| Esc
    Q0 -->|no| Q14
    Q14 -->|submit| Summ
    Summ --> Check
    Check -->|"flag true: latch"| Esc
    Check -->|"no flag"| Result
    Esc --> Notify
    Notify --> Result

    Q14 -.->|"NETWORK / HTTP / PARSE"| Err
    Summ -.->|"NETWORK / HTTP / PARSE"| Err
    Err -->|retry| Q14
    Err -->|"retry (summarize)"| Summ

    Result -->|Clear| Consent
    Err -->|Clear| Consent
    Q0 -->|Clear| Consent
    Q14 -->|Clear| Consent
```

## 2. Module diagram

`App.jsx` owns all state and uses pure logic from `logic.js` and the fetch layer in `api/gemini.js`, which falls back between models. The doctor-alert mock feeds the alerts panel. Tests and the scenario script point at the logic and API modules.

```mermaid
flowchart LR
    subgraph UI["React UI"]
        App["App.jsx<br/>owns all state, latch"]
        Comp["components<br/>ConsentScreen, Question,<br/>ResultScreen, ErrorScreen, Banner"]
    end

    Logic["logic.js<br/>pure: parseYesNo, parseSummary,<br/>shouldEscalate, prompts"]
    Gemini["api/gemini.js<br/>fetch: summarize, transcribe<br/>MODEL_IDS fallback"]
    Cfg["config.js<br/>MODEL_IDS, texts, timeout"]
    Notify["notifyDoctor.js<br/>MOCK"]
    Panel["panel 'Alerty dla lekarza'<br/>in ResultScreen"]
    API[("Gemini API")]

    App --> Comp
    App --> Logic
    App --> Gemini
    App -->|"on escalation"| Notify
    Notify -->|"subscribeAlerts / alerts prop"| Panel
    Comp --> Panel
    Gemini -->|"gemini-3.5-flash,<br/>then gemini-3.1-flash-lite<br/>on 503 or timeout"| API
    Gemini --> Logic
    Logic --> Cfg
    Gemini --> Cfg
    Comp --> Cfg

    TL["tests/logic.test.js"] -.->|tests| Logic
    TG["tests/gemini.test.js<br/>mock fetchImpl"] -.->|tests| Gemini
    Scen["scripts/run-scenarios.mjs<br/>Node, GEMINI_API_KEY from env"] -.->|"calls"| Gemini
    Scen -.->|"calls"| Logic
```

## 3. Escalation decision

Escalation is an OR-gate. In every gate, "Tak" (Yes) always means "danger signal present" and "Nie" (No) always means "no signal from this check". Gate 1 asks about the patient's reported symptom in Q0; anything other than a clear denial (unclear or ambiguous answer) counts as a reported symptom, because `parseYesNo` fails towards escalation. Gate 2 asks about the LLM red flag, and only after the summary. If the LLM flag is false, the summary is shown without any "all clear" claim. Gate 3 checks the model response: a malformed or incomplete result is an error screen with the 112 message, never treated as "no flag". Once escalated, nothing in the LLM output can cancel it; only Clear resets the latch.

```mermaid
flowchart TD
    A["Q0 answer from patient"] --> G1{"Gate 1<br/>Pacjent zgłasza objaw alarmowy<br/>w pytaniu przesiewowym Q0?"}
    G1 -->|"Tak (also unclear or ambiguous answer:<br/>parseYesNo fails towards escalation)"| E
    G1 -->|"Nie (clear denial only)"| Q["Q1..Q4 and summarize"]
    Q --> G3{"Gate 3<br/>Odpowiedź modelu uszkodzona<br/>lub niekompletna?"}
    G3 -->|"Tak"| X["error screen<br/>112 message, never treated as 'no flag'"]
    G3 -->|"Nie"| G2{"Gate 2<br/>Podsumowanie wskazuje objaw alarmowy<br/>(llm_red_flag = true)?"}
    G2 -->|"Tak"| E["ESCALATE"]
    G2 -->|"Nie"| N["Podsumowanie dla lekarza,<br/>bez oceny bezpieczeństwa"]
    E --> D["notifyDoctor (automatic, mock)<br/>+ 112 message"]
    D --> L["latch set<br/>LLM can never cancel;<br/>only Clear resets"]
```
