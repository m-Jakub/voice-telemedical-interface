import { useEffect, useRef, useState } from "react";
import { QUESTIONS } from "./config.js";
import { parseYesNo, classifyAnswer, buildAnswers, emptySummary, shouldEscalate } from "./logic.js";
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
  // { text, n }: the counter n makes two identical transcripts in a row still refill the field.
  const [transcript, setTranscript] = useState(null);
  const transcriptCount = useRef(0);
  const [q0Unclear, setQ0Unclear] = useState(false); // Q0 answer was not clearly yes/no
  // Ref guards the latch synchronously (state updates are async / StrictMode safe).
  const latchRef = useRef(false);
  // Incremented on Clear; async results from an older session are dropped.
  const sessionRef = useRef(0);
  // Current question index as a ref: handleRecorded may run from a stale closure (recorder callback).
  const qIndexRef = useRef(0);
  // Guards runSummarize against a double click on the last "Dalej" (one API call only).
  const summarizingRef = useRef(false);

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
    summarizingRef.current = false;
    qIndexRef.current = 0;
    setBusy(false);
    setQuestionError(null);
    setErrorMessage("");
    setTranscript(null);
    setQ0Unclear(false);
    clearAlerts();
  }

  function goToQuestion(i) {
    qIndexRef.current = i;
    setQIndex(i);
    setTranscript(null);
    setQ0Unclear(false);
    setQuestionError(null);
    setScreen("question");
  }

  async function runSummarize(list) {
    if (summarizingRef.current) return; // already running: ignore the second click
    summarizingRef.current = true;
    setScreen("summarizing");
    const session = sessionRef.current;
    try {
      const s = await summarize(apiKey, list);
      if (session !== sessionRef.current) return; // cleared meanwhile
      summarizingRef.current = false;
      setSummary(s);
      escalate(shouldEscalate("no", s));
      setScreen("result");
    } catch (err) {
      if (session !== sessionRef.current) return;
      summarizingRef.current = false; // allow retry
      // (Clear resets the flag in clearAll)
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
      // "unclear" never becomes "no": stay on Q0 and let the patient decide with the buttons.
      // The buttons submit "Tak"/"Nie" through this same path; parseYesNo stays the only escalation decision.
      if (classifyAnswer(text) === "unclear") {
        setQ0Unclear(true);
        return;
      }
      setQ0Unclear(false);
      if (parseYesNo(text) === "yes") {
        setSummary(emptySummary());
        escalate({ escalate: true, source: "screening", quote: text });
        setScreen("result");
      } else {
        // Defence in depth: the Q0 text goes first into the answers sent to the LLM.
        setAnswers(buildAnswers(q.text, text, []));
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
    const askedIndex = qIndexRef.current; // question this recording belongs to
    try {
      const res = await transcribe(apiKey, blob);
      if (session !== sessionRef.current) return; // cleared meanwhile
      if (askedIndex !== qIndexRef.current) return; // question changed meanwhile: drop the transcript
      transcriptCount.current += 1;
      setTranscript({ text: res.text || "", n: transcriptCount.current });
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
            unclear={qIndex === 0 && q0Unclear}
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
