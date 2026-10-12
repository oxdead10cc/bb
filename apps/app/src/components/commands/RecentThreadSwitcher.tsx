import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import type { ThreadListEntry } from "@bb/domain";
import type { SidebarBootstrapResponse } from "@bb/server-contract";
import { threadListIndicatorStateForThread } from "@bb/client-core";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { useAppCommandHandler } from "@/components/commands/AppCommandProvider";
import { PALETTE_SECTION_LABEL_CLASS } from "@/components/commands/PaletteShell";
import { ThreadStatusGlyph } from "@/components/thread/ThreadStatusGlyph";
import { ThreadTitle } from "@/components/thread/ThreadTitleMentions";
import { useRouteNavigate } from "@/components/ui/app-route-anchor";
import { listSidebarNavigationThreads } from "@/hooks/cache-owners/query-cache";
import { useSidebarNavigationSelection } from "@/hooks/queries/sidebar-navigation-query";
import { usePromptDraftHasInput } from "@/hooks/usePromptDraftStorage";
import { usePluginThreadRowStatus } from "@/lib/plugin-thread-row-status";
import {
  moveRecentThreadSwitcherSelection,
  openRecentThreadSwitcher,
  recentThreadIdsAtom,
  recordRecentThreadId,
  type RecentThreadSwitcherDirection,
  type RecentThreadSwitcherSession,
} from "@/lib/recent-threads";
import { getThreadRoutePath } from "@/lib/route-paths";
import { getThreadDisplayTitle } from "@/lib/thread-title";

const SWITCHER_REVEAL_DELAY_MS = 120;

interface RecentThreadIndex {
  threadsById: ReadonlyMap<string, ThreadListEntry>;
  projectNamesById: ReadonlyMap<string, string>;
}

function indexSidebarNavigation(
  navigation: SidebarBootstrapResponse,
): RecentThreadIndex {
  return {
    threadsById: new Map(
      listSidebarNavigationThreads(navigation).map((thread) => [
        thread.id,
        thread,
      ]),
    ),
    projectNamesById: new Map(
      [...navigation.projects, navigation.personalProject].map((project) => [
        project.id,
        project.name,
      ]),
    ),
  };
}

export function RecentThreadSwitcher({
  threadId,
}: {
  threadId: string | null;
}) {
  const recentThreadIds = useAtomValue(recentThreadIdsAtom);
  const setRecentThreadIds = useSetAtom(recentThreadIdsAtom);
  const index = useSidebarNavigationSelection(indexSidebarNavigation);
  const navigate = useRouteNavigate();
  const [session, setSession] = useState<RecentThreadSwitcherSession | null>(
    null,
  );
  const [revealed, setRevealed] = useState(false);
  const sessionRef = useRef<RecentThreadSwitcherSession | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (threadId === null) return;
    setRecentThreadIds((threadIds) =>
      recordRecentThreadId(threadIds, threadId),
    );
  }, [setRecentThreadIds, threadId]);

  const updateSession = useCallback(
    (next: RecentThreadSwitcherSession | null) => {
      sessionRef.current = next;
      setSession(next);
      if (next === null) {
        if (revealTimerRef.current !== null) {
          clearTimeout(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        setRevealed(false);
        return;
      }
      if (revealTimerRef.current === null) {
        revealTimerRef.current = setTimeout(() => {
          setRevealed(true);
        }, SWITCHER_REVEAL_DELAY_MS);
      }
    },
    [],
  );

  const commit = useCallback(
    (selectedIndex?: number) => {
      const current = sessionRef.current;
      if (current === null) return;
      updateSession(null);
      const targetId =
        current.threadIds[selectedIndex ?? current.selectedIndex];
      const target =
        targetId === undefined ? undefined : index?.threadsById.get(targetId);
      if (target === undefined || target.id === threadId) return;
      navigate(
        getThreadRoutePath({
          projectId: target.projectId,
          threadId: target.id,
        }),
      );
    },
    [index, navigate, threadId, updateSession],
  );

  const cycle = useCallback(
    (direction: RecentThreadSwitcherDirection): boolean => {
      const current = sessionRef.current;
      if (current !== null) {
        updateSession(moveRecentThreadSwitcherSelection(current, direction));
        return true;
      }
      const next = openRecentThreadSwitcher({
        recentThreadIds,
        isThreadAvailable: (id) => index?.threadsById.has(id) ?? false,
        currentThreadId: threadId,
        direction,
      });
      if (next === null) return false;
      updateSession(next);
      return true;
    },
    [index, recentThreadIds, threadId, updateSession],
  );

  useAppCommandHandler("thread.cycleRecent", () => cycle(1));
  useAppCommandHandler("thread.cycleRecentBackward", () => cycle(-1));

  const commitRef = useRef(commit);
  useLayoutEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  useEffect(() => {
    const cancel = () => {
      if (sessionRef.current !== null) updateSession(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (sessionRef.current === null) return;
      if (event.key !== "Escape" && event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        cancel();
        return;
      }
      commitRef.current();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (sessionRef.current === null) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      commitRef.current();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        listRef.current?.contains(event.target)
      ) {
        return;
      }
      cancel();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, [updateSession]);

  useLayoutEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [revealed, session]);

  if (session === null || !revealed || index === undefined) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[12%] z-50 flex justify-center px-4">
      <div
        ref={listRef}
        role="listbox"
        aria-label="Recent threads"
        className="pointer-events-auto max-h-[60vh] w-full max-w-[480px] overflow-y-auto rounded-xl border bg-background p-1.5 shadow-lg"
      >
        <div className={PALETTE_SECTION_LABEL_CLASS}>Recent threads</div>
        {session.threadIds.map((id, rowIndex) => {
          const thread = index.threadsById.get(id);
          if (thread === undefined) return null;
          return (
            <RecentThreadSwitcherRow
              key={id}
              thread={thread}
              projectName={index.projectNamesById.get(thread.projectId) ?? null}
              selected={rowIndex === session.selectedIndex}
              onSelect={() => commit(rowIndex)}
            />
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

function RecentThreadSwitcherRow({
  thread,
  projectName,
  selected,
  onSelect,
}: {
  thread: ThreadListEntry;
  projectName: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm",
        selected && "bg-state-hover text-foreground",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <RecentThreadSwitcherStatus thread={thread} />
      <span className="min-w-0 flex-1">
        <ThreadTitle
          title={getThreadDisplayTitle(thread)}
          className="block truncate text-foreground [&_span]:whitespace-nowrap"
        />
        {projectName === null ? null : (
          <span className="block truncate text-xs leading-4 text-subtle-foreground">
            <Icon
              name="Folder"
              className="mr-1 inline-block size-3.5 align-text-bottom"
              aria-hidden
            />
            {projectName}
          </span>
        )}
      </span>
    </div>
  );
}

function RecentThreadSwitcherStatus({ thread }: { thread: ThreadListEntry }) {
  const hasUnsubmittedDraft = usePromptDraftHasInput({
    kind: "thread",
    projectId: thread.projectId,
    threadId: thread.id,
  });
  const state = threadListIndicatorStateForThread(thread, hasUnsubmittedDraft);
  const pluginStatus = usePluginThreadRowStatus(thread.id);
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-3.5 shrink-0 items-center justify-center text-subtle-foreground"
    >
      <ThreadStatusGlyph
        {...state}
        pluginStatus={pluginStatus}
        size="compact"
      />
    </span>
  );
}
