import { describe, expect, it } from "vitest";
import {
  moveRecentThreadSwitcherSelection,
  openRecentThreadSwitcher,
  recordRecentThreadId,
} from "./recent-threads";

describe("recordRecentThreadId", () => {
  it("moves a reopened thread to the front without duplicating it", () => {
    expect(recordRecentThreadId(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("keeps the same list when the thread is already the most recent", () => {
    const threadIds = ["a", "b"];
    expect(recordRecentThreadId(threadIds, "a")).toBe(threadIds);
  });

  it("drops the oldest thread past the stored limit", () => {
    const threadIds = Array.from({ length: 20 }, (_, index) => `t${index}`);
    const next = recordRecentThreadId(threadIds, "new");
    expect(next).toHaveLength(20);
    expect(next[0]).toBe("new");
    expect(next).not.toContain("t19");
  });
});

describe("openRecentThreadSwitcher", () => {
  const isThreadAvailable = (id: string) => id !== "archived";

  it("selects the previously opened thread when moving forward from the current one", () => {
    expect(
      openRecentThreadSwitcher({
        recentThreadIds: ["current", "archived", "b", "c"],
        isThreadAvailable,
        currentThreadId: "current",
        direction: 1,
      }),
    ).toEqual({ threadIds: ["current", "b", "c"], selectedIndex: 1 });
  });

  it("selects the oldest thread when moving backward", () => {
    expect(
      openRecentThreadSwitcher({
        recentThreadIds: ["current", "b", "c"],
        isThreadAvailable,
        currentThreadId: "current",
        direction: -1,
      }),
    ).toEqual({ threadIds: ["current", "b", "c"], selectedIndex: 2 });
  });

  it("selects the most recent thread outside a thread view", () => {
    expect(
      openRecentThreadSwitcher({
        recentThreadIds: ["a", "b"],
        isThreadAvailable,
        currentThreadId: null,
        direction: 1,
      }),
    ).toEqual({ threadIds: ["a", "b"], selectedIndex: 0 });
  });

  it("does not open when only the current thread is available", () => {
    expect(
      openRecentThreadSwitcher({
        recentThreadIds: ["current", "archived"],
        isThreadAvailable,
        currentThreadId: "current",
        direction: 1,
      }),
    ).toBeNull();
  });
});

describe("moveRecentThreadSwitcherSelection", () => {
  it("wraps around in both directions", () => {
    const session = { threadIds: ["a", "b", "c"], selectedIndex: 2 };
    expect(moveRecentThreadSwitcherSelection(session, 1).selectedIndex).toBe(0);
    expect(
      moveRecentThreadSwitcherSelection({ ...session, selectedIndex: 0 }, -1)
        .selectedIndex,
    ).toBe(2);
  });
});
