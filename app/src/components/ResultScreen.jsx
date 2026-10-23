import { EMERGENCY_TEXT } from "../config.js";
import { formatSummary } from "../logic.js";

const REASONS = {
  screening: "odpowiedź na pytanie przesiewowe",
  llm: "sygnał wykryty w odpowiedziach",
  both: "odpowiedź przesiewowa i sygnał wykryty w odpowiedziach",
};

export default function ResultScreen({ summary, escalation, alerts, onClear }) {
  return (
    <section className="card">
      {escalation.escalate && (
        <div className="emergency" role="alert">
          <strong>{EMERGENCY_TEXT}</strong>
          <p>
            Powód: {REASONS[escalation.source] || "sygnał alarmowy"}
            {escalation.quote ? <> — „{escalation.quote}”</> : null}
          </p>
        </div>
      )}

      <h2>Podsumowanie dla lekarza</h2>
      <pre className="summary">{formatSummary(summary)}</pre>
      {!escalation.escalate && <p>Podsumowanie zostanie przekazane lekarzowi.</p>}

      <h3>Alerty dla lekarza</h3>
      <p className="muted">(symulacja — MOCK, nikt nie jest powiadamiany)</p>
      {alerts.length === 0 ? (
        <p className="muted">Brak alertów.</p>
      ) : (
        <ul className="alerts">
          {alerts.map((a) => (
            <li key={a.id}>
              <div>{a.timestamp}</div>
              <div>Źródło: {a.source}</div>
              {a.quote && <div>„{a.quote}”</div>}
            </li>
          ))}
        </ul>
      )}

      <button onClick={onClear}>Wyczyść</button>
    </section>
  );
}
