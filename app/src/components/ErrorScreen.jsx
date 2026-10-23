import { EMERGENCY_TEXT } from "../config.js";

// Never shows a summary. Emergency text is always present.
export default function ErrorScreen({ message, onRetry, onClear }) {
  return (
    <section className="card">
      <div className="emergency" role="alert">
        <strong>{EMERGENCY_TEXT}</strong>
      </div>
      <p>{message}</p>
      <div className="row">
        <button className="primary" onClick={onRetry}>Spróbuj ponownie</button>
        <button onClick={onClear}>Wyczyść</button>
      </div>
    </section>
  );
}
