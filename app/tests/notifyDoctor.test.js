import { describe, it, expect, beforeEach, vi } from "vitest";
import { notifyDoctor, getAlerts, subscribeAlerts, clearAlerts } from "../src/notifyDoctor.js";

const alert = (id = 1) => ({ id, timestamp: "2026-01-01T00:00:00Z", source: "screening", quote: "duszno mi" });

beforeEach(() => {
  clearAlerts();
});

describe("notifyDoctor store", () => {
  it("appends alerts", () => {
    notifyDoctor(alert(1));
    notifyDoctor(alert(2));
    expect(getAlerts().map((a) => a.id)).toEqual([1, 2]);
  });

  it("getAlerts returns a copy: mutating it does not change the store", () => {
    notifyDoctor(alert(1));
    const copy = getAlerts();
    copy[0].quote = "zmienione";
    copy.push(alert(9));
    expect(getAlerts()).toHaveLength(1);
    expect(getAlerts()[0].quote).toBe("duszno mi");
  });

  it("stores a copy of the passed alert", () => {
    const a = alert(1);
    notifyDoctor(a);
    a.quote = "zmienione";
    expect(getAlerts()[0].quote).toBe("duszno mi");
  });

  it("clearAlerts empties the store", () => {
    notifyDoctor(alert());
    clearAlerts();
    expect(getAlerts()).toEqual([]);
  });
});

describe("subscribeAlerts", () => {
  it("notifies on notify and on clear", () => {
    const fn = vi.fn();
    const unsub = subscribeAlerts(fn);
    notifyDoctor(alert(1));
    expect(fn).toHaveBeenLastCalledWith([expect.objectContaining({ id: 1 })]);
    clearAlerts();
    expect(fn).toHaveBeenLastCalledWith([]);
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
  });

  it("unsubscribe stops notifications", () => {
    const fn = vi.fn();
    const unsub = subscribeAlerts(fn);
    unsub();
    notifyDoctor(alert());
    clearAlerts();
    expect(fn).not.toHaveBeenCalled();
  });

  it("notifyDoctor does not throw and still stores/notifies others when a subscriber throws", () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const u1 = subscribeAlerts(bad);
    const u2 = subscribeAlerts(good);
    expect(() => notifyDoctor(alert(1))).not.toThrow();
    expect(getAlerts()).toHaveLength(1);
    expect(good).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });

  it("notifyDoctor does not throw on a non-object alert", () => {
    expect(() => notifyDoctor(undefined)).not.toThrow();
    expect(() => notifyDoctor(null)).not.toThrow();
  });
});
