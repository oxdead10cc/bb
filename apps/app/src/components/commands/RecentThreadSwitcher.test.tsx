// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultAppSettings,
  type AppDefaultKeybinding,
  type AppCommandId,
} from "@bb/domain";
import { makeThreadListEntry } from "@bb/test-helpers/domain-fixtures";
import { AppCommandProvider } from "@/components/commands/AppCommandProvider";
import { recentThreadIdsAtom } from "@/lib/recent-threads";
import {
  makeProjectWithThreadsResponse,
  makeSidebarBootstrapResponse,
} from "@/test/fixtures/projects";
import { RecentThreadSwitcher } from "./RecentThreadSwitcher";

const mocks = vi.hoisted(() => {
  function tabBinding(
    command: AppCommandId,
    shift: boolean,
  ): AppDefaultKeybinding {
    return {
      command,
      desktopOnly: false,
      shortcut: {
        key: "Tab",
        mod: false,
        meta: false,
        control: true,
        alt: false,
        shift,
      },
      when: { all: ["mainSurface"], none: ["modalOpen"] },
    };
  }
  return {
    bindings: [
      tabBinding("thread.cycleRecent", false),
      tabBinding("thread.cycleRecentBackward", true),
    ],
    navigate: vi.fn(),
    navigation: null as unknown,
  };
});

vi.mock("@/hooks/queries/system-queries", () => ({
  useSystemConfig: () => ({
    data: {
      generalSettings: { ...defaultAppSettings, showKeyboardHints: false },
      keybindings: mocks.bindings,
      defaultKeybindings: mocks.bindings,
    },
  }),
}));

vi.mock("@/lib/bb-desktop", () => ({
  getBbDesktopInfo: () => null,
}));

vi.mock("@/hooks/queries/sidebar-navigation-query", () => ({
  useSidebarNavigationSelection: (select: (navigation: unknown) => unknown) =>
    select(mocks.navigation),
}));

vi.mock("@/components/ui/app-route-anchor", () => ({
  useRouteNavigate: () => mocks.navigate,
}));

vi.mock("@/hooks/usePromptDraftStorage", () => ({
  usePromptDraftHasInput: () => false,
}));

vi.mock("@/lib/plugin-thread-row-status", () => ({
  usePluginThreadRowStatus: () => null,
}));

vi.mock("@/components/thread/ThreadStatusGlyph", () => ({
  ThreadStatusGlyph: () => null,
}));

vi.mock("@/components/thread/ThreadTitleMentions", () => ({
  ThreadTitle: ({ title }: { title: string }) => <span>{title}</span>,
}));

mocks.navigation = makeSidebarBootstrapResponse({
  projects: [
    makeProjectWithThreadsResponse({
      id: "proj_test",
      name: "Test project",
      threads: [
        makeThreadListEntry({
          id: "thr_a",
          projectId: "proj_test",
          title: "Alpha",
        }),
        makeThreadListEntry({
          id: "thr_b",
          projectId: "proj_test",
          title: "Beta",
        }),
        makeThreadListEntry({
          id: "thr_c",
          projectId: "proj_test",
          title: "Gamma",
        }),
      ],
    }),
  ],
});

function renderSwitcher(recentThreadIds: readonly string[]) {
  const store = createStore();
  store.set(recentThreadIdsAtom, recentThreadIds);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AppCommandProvider>
          <RecentThreadSwitcher threadId="thr_a" />
        </AppCommandProvider>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

function pressTab({ shift = false }: { shift?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    ctrlKey: true,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

function pressEscape() {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function releaseControl() {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Control", bubbles: true }),
    );
  });
}

describe("RecentThreadSwitcher", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("records the current thread as the most recent one", () => {
    const store = renderSwitcher(["thr_b", "thr_a"]);
    expect(store.get(recentThreadIdsAtom)).toEqual(["thr_a", "thr_b"]);
  });

  it("opens the previously used thread when Control is released", () => {
    renderSwitcher(["thr_b", "thr_c"]);
    expect(pressTab().defaultPrevented).toBe(true);
    releaseControl();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/projects/proj_test/threads/thr_b",
    );
  });

  it("moves deeper with each Tab and back with Shift while Control stays held", () => {
    renderSwitcher(["thr_b", "thr_c"]);
    pressTab();
    pressTab();
    pressTab();
    pressTab({ shift: true });
    expect(mocks.navigate).not.toHaveBeenCalled();
    releaseControl();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/projects/proj_test/threads/thr_c",
    );
  });

  it("does not navigate after Escape", () => {
    renderSwitcher(["thr_b"]);
    pressTab();
    pressEscape();
    releaseControl();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows the recent threads with the selection once Control is held", () => {
    vi.useFakeTimers();
    renderSwitcher(["thr_b", "thr_c"]);
    pressTab();
    expect(screen.queryByRole("listbox")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "AlphaTest project",
      "BetaTest project",
      "GammaTest project",
    ]);
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("leaves Control+Tab alone when no other recent thread is available", () => {
    renderSwitcher(["thr_missing"]);
    expect(pressTab().defaultPrevented).toBe(false);
    releaseControl();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
