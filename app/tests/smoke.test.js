import { test, expect } from "vitest";
import * as config from "../src/config.js";

// Scaffold smoke test: pinned config names exist.
test("config exports pinned names", () => {
  expect(config.MODEL_IDS).toEqual(["gemini-3.5-flash", "gemini-3.1-flash-lite"]);
  expect(config.REQUEST_TIMEOUT_MS).toBe(30000);
});
