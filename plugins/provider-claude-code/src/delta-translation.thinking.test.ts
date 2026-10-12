import { describe, expect, it } from "vitest";
import {
  createClaudeDeltaHarness,
  ITEM_ID_PATTERN,
} from "./delta-test-harness.js";
import { createThinkingTokenHistory } from "./thinking-estimate.js";

function thinkingTokens(estimated: number) {
  return {
    type: "system",
    subtype: "thinking_tokens",
    estimated_tokens: estimated,
    estimated_tokens_delta: 1,
    uuid: `frame-${estimated}`,
    session_id: "sess-1",
  };
}

function assistantThinking(thinking: string, model = "claude-opus-5-5") {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      model,
      content: [{ type: "thinking", thinking, signature: "sig" }],
    },
    session_id: "sess-1",
  };
}

function streamThinking(thinking: string) {
  return {
    type: "stream_event",
    event: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "thinking_delta", thinking },
    },
    session_id: "sess-1",
  };
}

function startedTurnHarness(
  history = createThinkingTokenHistory(),
): ReturnType<typeof createClaudeDeltaHarness> {
  const harness = createClaudeDeltaHarness({
    thinkingTokenHistory: history,
    progressThrottleMs: 0,
  });
  harness.acceptInput("creq_23456789af");
  return harness;
}

describe("Claude thinking token estimates", () => {
  it("shows redacted thinking as a reasoning item with a live token count", () => {
    const harness = startedTurnHarness();

    const first = harness.translate(thinkingTokens(24));
    const started = first.find((event) => event.type === "item/started");
    expect(started).toMatchObject({
      type: "item/started",
      item: { type: "reasoning" },
    });
    const itemId =
      started?.type === "item/started" ? started.item.id : undefined;
    expect(itemId).toMatch(ITEM_ID_PATTERN);
    expect(first).toContainEqual(
      expect.objectContaining({
        type: "item/reasoning/progress",
        itemId,
        estimatedTokens: 24,
      }),
    );

    const second = harness.translate(thinkingTokens(310));
    expect(second.filter((event) => event.type === "item/started")).toEqual(
      [],
    );
    expect(second).toContainEqual(
      expect.objectContaining({
        type: "item/reasoning/progress",
        itemId,
        estimatedTokens: 310,
      }),
    );

    const closed = harness.translate(assistantThinking(""));
    expect(closed).toContainEqual(
      expect.objectContaining({
        type: "item/completed",
        item: expect.objectContaining({ type: "reasoning", id: itemId }),
      }),
    );
  });

  it("keeps streamed summary text in the item the token count opened", () => {
    const harness = startedTurnHarness();

    const opened = harness.translate(thinkingTokens(10));
    const started = opened.find((event) => event.type === "item/started");
    const itemId =
      started?.type === "item/started" ? started.item.id : undefined;

    const streamed = harness.translate(streamThinking("Checking the plan."));
    expect(streamed.filter((event) => event.type === "item/started")).toEqual(
      [],
    );
    expect(streamed).toContainEqual(
      expect.objectContaining({ type: "item/reasoning/textDelta", itemId }),
    );

    const closed = harness.translate(assistantThinking("Checking the plan."));
    const completions = closed.filter(
      (event) => event.type === "item/completed",
    );
    expect(completions).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          type: "reasoning",
          id: itemId,
          content: ["Checking the plan."],
        }),
      }),
    ]);
  });

  it("opens a new item for the next thinking block", () => {
    const harness = startedTurnHarness();

    harness.translate(thinkingTokens(400));
    harness.translate(assistantThinking(""));

    const next = harness.translate(thinkingTokens(12));
    expect(next).toContainEqual(
      expect.objectContaining({
        type: "item/started",
        item: expect.objectContaining({ type: "reasoning" }),
      }),
    );
  });

  it("estimates the total from finished blocks of the same model", () => {
    const history = createThinkingTokenHistory();
    for (let index = 1; index <= 40; index += 1) {
      history.record("claude-opus-5-5", index * 100);
    }
    const harness = startedTurnHarness(history);
    harness.translate(thinkingTokens(5));
    harness.translate(assistantThinking("Warm-up."));

    const events = harness.translate(thinkingTokens(1_000));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "item/reasoning/progress",
        estimatedTokens: 1_000,
        expectedTokens: 2_500,
      }),
    );
  });

  it("records each closed block for later estimates", () => {
    const history = createThinkingTokenHistory();
    const harness = startedTurnHarness(history);
    for (let block = 1; block <= 20; block += 1) {
      harness.translate(thinkingTokens(block));
      harness.translate(thinkingTokens(block * 50));
      harness.translate(assistantThinking(""));
    }

    expect(history.expected("claude-opus-5-5", 0)).toBe(500);
  });
});

describe("thinking token history", () => {
  it("needs enough longer blocks before it estimates", () => {
    const history = createThinkingTokenHistory();
    for (let index = 1; index <= 19; index += 1) {
      history.record("model-a", index * 10);
    }
    expect(history.expected("model-a", 0)).toBeUndefined();
    history.record("model-a", 200);
    expect(history.expected("model-a", 0)).toBe(100);
    expect(history.expected("model-a", 50)).toBeUndefined();
  });

  it("falls back to every model when this one has too few samples", () => {
    const history = createThinkingTokenHistory();
    for (let index = 1; index <= 30; index += 1) {
      history.record("model-a", index * 10);
    }
    history.record("model-b", 5);
    expect(history.expected("model-b", 0)).toBe(150);
  });
});
