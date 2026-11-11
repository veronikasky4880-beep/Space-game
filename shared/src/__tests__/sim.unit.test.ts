import { describe, it, expect } from "vitest";
import { createPRNG, parseClientMessage } from "../index.js";

describe("Simulation & Determinism Unit Tests", () => {
  it("PRNG with same seed produces deterministic sequence", () => {
    const rng1 = createPRNG(98765);
    const rng2 = createPRNG(98765);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it("parseClientMessage accepts valid JSON input message", () => {
    const validJson = JSON.stringify({
      type: "input",
      seq: 42,
      thrust: true,
      turn: -1,
      fire: false,
    });
    const res = parseClientMessage(validJson);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.type).toBe("input");
    }
  });

  it("parseClientMessage rejects invalid structure without crashing", () => {
    const invalidJson = JSON.stringify({ type: "input", seq: "not-a-number" });
    const res = parseClientMessage(invalidJson);
    expect(res.success).toBe(false);
  });
});