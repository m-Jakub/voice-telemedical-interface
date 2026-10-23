// Live scenario runner. Usage (repo root): node --env-file=.env app/scripts/run-scenarios.mjs
// Prints only PASS/FAIL/ERROR lines. Never prints the key, summaries or transcripts.
import { readFileSync } from "node:fs";
import { QUESTIONS } from "../src/config.js";
import { parseYesNo, buildAnswers, shouldEscalate } from "../src/logic.js";
import { summarize, GeminiError } from "../src/api/gemini.js";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log("GEMINI_API_KEY missing");
  process.exit(2);
}

// Resolve relative to this file so the cwd does not matter.
const scenarios = JSON.parse(readFileSync(new URL("./scenarios.json", import.meta.url), "utf8"));

let allPass = true;
for (const s of scenarios) {
  try {
    let escalate;
    if (parseYesNo(s.answers.q0) === "yes") {
      escalate = true; // screening yes: no API call
    } else {
      // Same as the app: q0 text first, then q1-q4.
      const answers = buildAnswers(
        QUESTIONS[0].text,
        s.answers.q0,
        [1, 2, 3, 4].map((i) => ({
          questionId: `q${i}`,
          question: QUESTIONS[i].text,
          text: s.answers[`q${i}`] ?? "",
        }))
      );
      const summary = await summarize(key, answers);
      escalate = shouldEscalate("no", summary).escalate;
    }
    if (escalate === s.expectEscalate) {
      console.log(`PASS ${s.id} ${s.name} (escalate=${escalate})`);
    } else {
      allPass = false;
      console.log(`FAIL ${s.id} ${s.name} expected ${s.expectEscalate} got ${escalate}`);
    }
  } catch (err) {
    allPass = false;
    const code = err instanceof GeminiError ? err.code : "UNEXPECTED";
    console.log(`ERROR ${s.id} ${code} ${err.message}`);
  }
}
process.exit(allPass ? 0 : 1);
