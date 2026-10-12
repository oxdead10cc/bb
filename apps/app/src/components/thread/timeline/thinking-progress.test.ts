import { describe, expect, it } from "vitest";
import {
  describeThinkingProgress,
  formatThinkingTokens,
} from "./thinking-progress";

describe("describeThinkingProgress", () => {
  it("shows nothing before the first token estimate", () => {
    expect(
      describeThinkingProgress({ startedAt: 0, updatedAt: 5_000 }),
    ).toBeNull();
    expect(
      describeThinkingProgress({
        estimatedTokens: 0,
        startedAt: 0,
        updatedAt: 5_000,
      }),
    ).toBeNull();
  });

  it("shows the count, the expected total and the rate", () => {
    expect(
      describeThinkingProgress({
        estimatedTokens: 1_420,
        expectedTokens: 3_100,
        startedAt: 0,
        updatedAt: 20_000,
      }),
    ).toBe("1.4k / ~3.1k tok · 71 tok/s");
  });

  it("drops an expected total the count has already passed", () => {
    expect(
      describeThinkingProgress({
        estimatedTokens: 900,
        expectedTokens: 800,
        startedAt: 0,
        updatedAt: 10_000,
      }),
    ).toBe("900 tok · 90 tok/s");
  });

  it("waits a second before it reports a rate", () => {
    expect(
      describeThinkingProgress({
        estimatedTokens: 40,
        startedAt: 0,
        updatedAt: 500,
      }),
    ).toBe("40 tok");
  });
});

describe("formatThinkingTokens", () => {
  it("keeps one decimal in compact form", () => {
    expect(formatThinkingTokens(24)).toBe("24");
    expect(formatThinkingTokens(1_420)).toBe("1.4k");
    expect(formatThinkingTokens(12_000)).toBe("12k");
  });
});
