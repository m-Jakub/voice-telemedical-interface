import { useEffect, useRef, useState } from "react";

// Voice recorder: records audio and hands a Blob to onBlob. Text fallback lives in Question.
function Recorder({ onBlob, disabled }) {
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setMsg(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMsg("Nagrywanie nie jest dostępne w tej przeglądarce. Wpisz odpowiedź tekstem.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onBlob(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMsg("Brak dostępu do mikrofonu. Wpisz odpowiedź tekstem.");
    }
  }

  function stop() {
    setRecording(false);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  return (
    <div>
      {recording ? (
        <button onClick={stop}>Zatrzymaj</button>
      ) : (
        <button onClick={start} disabled={disabled}>Nagraj odpowiedź</button>
      )}
      {recording && <span className="rec"> ● nagrywanie…</span>}
      {msg && <p className="warn">{msg}</p>}
    </div>
  );
}

export default function Question({ question, onSubmit, onRecorded, busy, error, transcript }) {
  const [text, setText] = useState("");

  // Transcription lands in the field so the user can correct it before submitting.
  useEffect(() => {
    if (typeof transcript === "string") setText(transcript);
  }, [transcript]);

  // Reset when the question changes.
  useEffect(() => { setText(""); }, [question.id]);

  return (
    <section className="card">
      <h2>{question.text}</h2>
      <Recorder onBlob={onRecorded} disabled={busy} />
      <label htmlFor="answer">Odpowiedź tekstem</label>
      <textarea
        id="answer"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {busy && <p>Przetwarzanie…</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      <button className="primary" onClick={() => onSubmit(text)} disabled={busy}>
        Dalej
      </button>
    </section>
  );
}
