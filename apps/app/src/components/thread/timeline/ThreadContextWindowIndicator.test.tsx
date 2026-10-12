// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ThreadContextWindowUsage } from "@bb/server-contract";
import {
  ThreadContextWindowCard,
  ThreadContextWindowIndicator,
} from "./ThreadContextWindowIndicator";

afterEach(cleanup);

it("shows details when a snapshot arrives and removes them when only aggregate usage remains", () => {
  const usage: ThreadContextWindowUsage = {
    usedTokens: 1000,
    modelContextWindow: 10000,
    estimated: true,
    snapshot: {
      capturedAt: "2026-09-11T00:00:00.000Z",
      providerSessionId: "session",
      providerTurnId: null,
      model: "model",
      usedTokens: 1000,
      contextWindowTokens: 10000,
      autoCompactAtTokens: null,
      estimated: true,
      categories: [
        {
          id: "messages",
          label: "Messages",
          kind: "used",
          tokens: 1000,
          entries: [],
        },
      ],
    },
  };
  const aggregateUsage = {
    usedTokens: usage.usedTokens,
    modelContextWindow: usage.modelContextWindow,
    estimated: usage.estimated,
  };
  const { rerender } = render(
    <ThreadContextWindowCard usage={aggregateUsage} />,
  );
  expect(screen.getByText("10% used")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
  rerender(<ThreadContextWindowCard usage={usage} />);
  fireEvent.click(screen.getByRole("button", { name: "Show details" }));
  expect(screen.getByText("Messages")).toBeTruthy();
  rerender(<ThreadContextWindowCard usage={aggregateUsage} />);
  expect(screen.queryByText("Messages")).toBeNull();
  expect(screen.queryByRole("button", { name: "Hide details" })).toBeNull();
  expect(screen.getByText("10% used")).toBeTruthy();
});

it("shows used and maximum context tokens next to the ring", () => {
  render(
    <ThreadContextWindowIndicator
      usage={{
        usedTokens: 112_400,
        modelContextWindow: 1_000_000,
        estimated: false,
      }}
    />,
  );
  expect(screen.getByText("112k / 1m")).toBeTruthy();
  expect(
    screen.getByRole("button", {
      name: "Context window 11% used, 112k of 1m tokens",
    }),
  ).toBeTruthy();
});

it("marks estimated context token counts", () => {
  render(
    <ThreadContextWindowIndicator
      usage={{
        usedTokens: 150_000,
        modelContextWindow: 200_000,
        estimated: true,
      }}
    />,
  );
  expect(screen.getByText("~150k / 200k")).toBeTruthy();
});
