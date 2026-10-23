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

Escalation is an OR-gate: the Q0 answer (fail-up, anything not clearly "nie" counts as yes) or the LLM red flag. A malformed LLM result is an error, never "no flag". Nothing in the LLM output can cancel an escalation.

```mermaid
flowchart TD
    A["Q0 answer"] --> P{"parseYesNo<br/>clearly 'nie' and no 'tak'?"}
    P -->|"no: starts with 'nie'"| Q["Q1..Q4 and summarize"]
    P -->|"yes: anything else"| E
    Q --> S{"parseSummary<br/>valid shape and boolean llm_red_flag?"}
    S -->|"malformed"| X["error screen<br/>EMERGENCY_TEXT, never 'no flag'"]
    S -->|valid| F{"llm_red_flag"}
    F -->|true| E["escalate"]
    F -->|false| N["no escalation<br/>no reassurance text"]
    E --> D["notifyDoctor<br/>+ 112 message"]
    D --> L["latch set<br/>LLM can never cancel;<br/>only Clear resets"]
```
