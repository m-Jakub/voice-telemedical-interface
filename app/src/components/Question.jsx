import { useEffect, useRef, useState } from "react";

const MIN_RECORDING_MS = 700; // shorter clips are almost certainly accidental
const MIN_BLOB_BYTES = 1500; // a few hundred ms of opus is already bigger than this
// Peak level 0..1 (max deviation from the 128 midpoint of byte time-domain data).
// 0.01 is roughly -40 dBFS; quiet speech at -33 dB peak was transcribed fine.
const MIN_PEAK = 0.01;

// Voice recorder: records audio and hands a Blob to onBlob. Text fallback lives in Question.
// Clips that are too short, too small or (almost) silent are rejected before any API call.
function Recorder({ onBlob, disabled }) {
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const urlRef = useRef(null);

  // Stops the level sampling, closes the AudioContext and releases the microphone.
  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
    ctxRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function revokeUrl() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }

  // Release the microphone and the playback URL if the component unmounts.
  useEffect(() => () => {
    cleanup();
    revokeUrl();
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

      // Level meter on the same stream: sample the waveform every 100 ms, keep the loudest peak.
      let peak = 0;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        timerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(data);
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        }, 100);
      }

      // Pick the mime explicitly; fall back to the browser default.
      const opts = MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : undefined;
      const rec = new MediaRecorder(stream, opts);
      const chunks = [];
      let startedAt = 0;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const duration = performance.now() - startedAt;
        cleanup();
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (duration < MIN_RECORDING_MS || blob.size < MIN_BLOB_BYTES) {
          setMsg("Nagranie jest za krótkie lub puste. Nagraj ponownie.");
          return;
        }
        if (AudioCtx && peak < MIN_PEAK) {
          setMsg("Mikrofon prawie nic nie nagrał. Sprawdź, czy wybrano właściwy mikrofon, i nagraj ponownie.");
          return;
        }
        revokeUrl();
        urlRef.current = URL.createObjectURL(blob);
        setAudioUrl(urlRef.current);
        onBlob(blob);
      };
      recRef.current = rec;
      startedAt = performance.now();
      rec.start();
      setRecording(true);
    } catch {
      cleanup();
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
      {audioUrl && !recording && (
        <div>
          <p>Odsłuchaj nagranie</p>
          <audio controls src={audioUrl} />
        </div>
      )}
    </div>
  );
}

export default function Question({ question, onSubmit, onRecorded, busy, error, transcript, unclear }) {
  const [text, setText] = useState("");

  // Transcription lands in the field so the user can correct it before submitting.
  // `transcript` is { text, n }; a new object (new n) refills even when the text is identical.
  useEffect(() => {
    if (transcript && typeof transcript.text === "string") setText(transcript.text);
  }, [transcript]);

  // Reset when the question changes.
  useEffect(() => { setText(""); }, [question.id]);

  return (
    <section className="card">
      <h2>{question.text}</h2>
      <Recorder onBlob={onRecorded} disabled={busy} />
      <label htmlFor="answer">Odpowiedź tekstem. Sprawdź, czy tekst zgadza się z tym, co powiedziałeś.</label>
      <textarea
        id="answer"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {busy && <p>Przetwarzanie…</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      {unclear && (
        <div className="warn" role="alert">
          <p>Nie zrozumieliśmy odpowiedzi. Powtórz albo wybierz poniżej.</p>
          <p>Jeśli to nagły przypadek, zadzwoń pod numer alarmowy.</p>
        </div>
      )}
      {question.screening && (
        <div>
          {/* Same submit path as typed answers: App runs parseYesNo on "Tak"/"Nie". */}
          <button onClick={() => onSubmit("Tak")} disabled={busy}>Tak, mam taki objaw</button>{" "}
          <button onClick={() => onSubmit("Nie")} disabled={busy}>Nie, nie mam żadnego z tych objawów</button>
        </div>
      )}
      <button className="primary" onClick={() => onSubmit(text)} disabled={busy}>
        Dalej
      </button>
    </section>
  );
}
