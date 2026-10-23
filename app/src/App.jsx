import { useEffect, useRef, useState } from "react";
import { QUESTIONS } from "./config.js";
import { parseYesNo, emptySummary, shouldEscalate } from "./logic.js";
import { summarize, transcribe } from "./api/gemini.js";
import { notifyDoctor, getAlerts, subscribeAlerts, clearAlerts } from "./notifyDoctor.js";
import Banner from "./components/Banner.jsx";
import ConsentScreen from "./components/ConsentScreen.jsx";
import Question from "./components/Question.jsx";
import ResultScreen from "./components/ResultScreen.jsx";
import ErrorScreen from "./components/ErrorScreen.jsx";

const NO_ESCALATION = { escalate: false, source: null, quote: null };

export default function App() {
  const [screen, setScreen] = useState("consent");
  const [apiKey, setApiKey] = useState(""); // memory only, never persisted or logged
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [escalation, setEscalation] = useState(NO_ESCALATION);
  const [escalated, setEscalated] = useState(false); // latch: false -> true only, Clear resets
  const [alerts, setAlerts] = useState(getAlerts());
  const [busy, setBusy] = useState(false);
  const [questionError, setQuestionError] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState(null);
  // Ref guards the latch synchronously (state updates are async / StrictMode safe).
  const latchRef = useRef(false);
  // Incremented on Clear; async results from an older session are dropped.
  const sessionRef = useRef(0);

  useEffect(() => subscribeAlerts(setAlerts), []);

  // Called from event handlers only. Fires notifyDoctor exactly once per escalation.
  function escalate(esc) {
    setEscalation(esc);
    if (!esc.escalate || latchRef.current) return;
    latchRef.current = true;
    setEscalated(true);
    notifyDoctor({
      id: crypto.randomUUID?.() || String(Date.now()),
      timestamp: new Date().toISOString(),
      source: esc.source,
      quote: esc.quote,
    });
  }

  function clearAll() {
    sessionRef.current += 1;
    setScreen("consent");
    setApiKey("");
    setQIndex(0);
    setAnswers([]);
    setSummary(null);
    setEscalation(NO_ESCALATION);
    setEscalated(false);
    latchRef.current = false;
    setBusy(false);
    setQuestionError(null);
    setErrorMessage("");
    setTranscript(null);
    clearAlerts();
  }

  function goToQuestion(i) {
    setQIndex(i);
    setTranscript(null);
    setQuestionError(null);
    setScreen("question");
  }

  async function runSummarize(list) {
    setScreen("summarizing");
    const session = sessionRef.current;
    try {
      const s = await summarize(apiKey, list);
      if (session !== sessionRef.current) return; // cleared meanwhile
      setSummary(s);
      escalate(shouldEscalate("no", s));
      setScreen("result");
    } catch (err) {
      if (session !== sessionRef.current) return;
      // Answers are kept; no summary shown; notifyDoctor not called.
      setErrorMessage(
        "Nie udało się przygotować podsumowania" + (err && err.code ? ` (${err.code})` : "") + ". Spróbuj ponownie."
      );
      setScreen("error");
    }
  }

  function handleSubmit(text) {
    const q = QUESTIONS[qIndex];
    if (qIndex === 0) {
      if (parseYesNo(text) === "yes") {
        setSummary(emptySummary());
        escalate({ escalate: true, source: "screening", quote: text });
        setScreen("result");
      } else {
        goToQuestion(1);
      }
      return;
    }
    const list = [...answers, { questionId: q.id, question: q.text, text }];
    setAnswers(list);
    if (qIndex < QUESTIONS.length - 1) goToQuestion(qIndex + 1);
    else runSummarize(list);
  }

  async function handleRecorded(blob) {
    setBusy(true);
    setQuestionError(null);
    const session = sessionRef.current;
    try {
      const res = await transcribe(apiKey, blob);
      if (session !== sessionRef.current) return; // cleared meanwhile
      setTranscript(res.text || "");
    } catch (err) {
      if (session !== sessionRef.current) return;
      setQuestionError(
        "Nie udało się rozpoznać nagrania" + (err && err.code ? ` (${err.code})` : "") + ". Wpisz odpowiedź tekstem."
      );
    } finally {
      setBusy(false);
    }
  }

  const q = QUESTIONS[qIndex];

  return (
    <div className="app">
      <Banner />
      <header className="header">
        <h1>Telemedi Voice</h1>
        <button onClick={clearAll}>Wyczyść</button>
      </header>
      <main>
        {screen === "consent" && (
          <ConsentScreen apiKey={apiKey} onKeyChange={setApiKey} onStart={() => goToQuestion(0)} />
        )}
        {screen === "question" && q && (
          <Question
            key={q.id}
            question={q}
            transcript={transcript}
            onSubmit={handleSubmit}
            onRecorded={handleRecorded}
            busy={busy}
            error={questionError}
          />
        )}
        {screen === "summarizing" && <section className="card"><p>Przygotowywanie podsumowania…</p></section>}
        {screen === "result" && summary && (
          <ResultScreen summary={summary} escalation={escalation} alerts={alerts} onClear={clearAll} />
        )}
        {screen === "error" && (
          <ErrorScreen message={errorMessage} onRetry={() => runSummarize(answers)} onClear={clearAll} />
        )}
      </main>
    </div>
  );
}
