export default function ConsentScreen({ apiKey, onKeyChange, onStart }) {
  return (
    <section className="card">
      <h2>Wywiad przed wizytą</h2>
      <p>
        Odpowiedzi (tekst oraz nagrania głosowe) są wysyłane do Google Gemini API w celu
        transkrypcji i przygotowania podsumowania dla lekarza. Do testów używaj wyłącznie
        danych fikcyjnych.
      </p>
      <p>Klucz API jest przechowywany tylko w pamięci tej karty i znika po jej zamknięciu lub po kliknięciu „Wyczyść”.</p>
      <label htmlFor="apikey">Klucz Gemini API</label>
      <input
        id="apikey"
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(e) => onKeyChange(e.target.value)}
      />
      <button className="primary" onClick={onStart} disabled={!apiKey.trim()}>
        Start
      </button>
    </section>
  );
}
