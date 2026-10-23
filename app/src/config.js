export const MODEL_IDS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"]; // tried in order; next one is used on HTTP 503, HTTP 429 or timeout
export const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const NOT_STATED = "nie podano";
export const NO_ANSWER = "(brak odpowiedzi)";

// Texts are verbatim from docs/test-scenarios.md
export const QUESTIONS = [
  {
    id: "q0",
    text: "Czy masz teraz silny ból w klatce piersiowej, duszność, opadnięty kącik ust lub osłabienie ręki, problemy z mówieniem, silne krwawienie albo myśli o zrobieniu sobie krzywdy?",
    screening: true,
  },
  { id: "q1", text: "Co Ci dolega?" },
  { id: "q2", text: "Od kiedy masz te objawy?" },
  { id: "q3", text: "Jakie leki przyjmujesz?" },
  { id: "q4", text: "Czy masz na coś alergię?" },
];

export const EMERGENCY_TEXT =
  "Zadzwoń teraz pod numer alarmowy (112 w UE, za granicą lokalny numer alarmowy).";
export const REQUEST_TIMEOUT_MS = 30000;
export const DISCLAIMER_TEXT =
  "To asystent AI, nie lekarz. Nie stawia diagnozy i nie ocenia pilności. W nagłym przypadku zadzwoń pod numer 112.";
