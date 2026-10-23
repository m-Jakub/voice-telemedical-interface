// MOCK: this does NOT contact a real doctor. It only keeps an in-memory list of alerts
// and notifies UI subscribers. Alert = {id, timestamp, source, quote}.
let alerts = [];
const subscribers = new Set();

function notifyAll() {
  for (const fn of [...subscribers]) {
    try {
      fn(getAlerts());
    } catch {
      // a broken subscriber must never break the alert flow
    }
  }
}

export function notifyDoctor(alert) {
  try {
    alerts.push({ ...alert });
    notifyAll();
  } catch {
    // never throws
  }
}

export function getAlerts() {
  return alerts.map((a) => ({ ...a }));
}

export function subscribeAlerts(fn) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function clearAlerts() {
  alerts = [];
  notifyAll();
}
