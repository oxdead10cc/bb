import { atomWithStorage } from "jotai/utils";
import { z } from "zod";
import { createTabScopedStorage } from "@/lib/browser-storage";

const RECENT_THREAD_IDS_STORAGE_KEY = "bb.threadSwitcher.recentThreadIds";
const RECENT_THREAD_IDS_MAX_STORED = 20;

const recentThreadIdsSchema = z.array(z.string().min(1));

const EMPTY_RECENT_THREAD_IDS: readonly string[] = [];

export type RecentThreadSwitcherDirection = 1 | -1;

export interface RecentThreadSwitcherSession {
  threadIds: readonly string[];
  selectedIndex: number;
}

interface OpenRecentThreadSwitcherArgs {
  recentThreadIds: readonly string[];
  isThreadAvailable: (threadId: string) => boolean;
  currentThreadId: string | null;
  direction: RecentThreadSwitcherDirection;
}

export function recordRecentThreadId(
  threadIds: readonly string[],
  threadId: string,
): readonly string[] {
  if (threadIds[0] === threadId) return threadIds;
  return [threadId, ...threadIds.filter((id) => id !== threadId)].slice(
    0,
    RECENT_THREAD_IDS_MAX_STORED,
  );
}

export function openRecentThreadSwitcher({
  recentThreadIds,
  isThreadAvailable,
  currentThreadId,
  direction,
}: OpenRecentThreadSwitcherArgs): RecentThreadSwitcherSession | null {
  const threadIds = recentThreadIds.filter(isThreadAvailable);
  const startsWithCurrent =
    currentThreadId !== null && threadIds[0] === currentThreadId;
  const firstCandidateIndex = startsWithCurrent ? 1 : 0;
  if (threadIds.length <= firstCandidateIndex) return null;
  return {
    threadIds,
    selectedIndex: direction === 1 ? firstCandidateIndex : threadIds.length - 1,
  };
}

export function moveRecentThreadSwitcherSelection(
  session: RecentThreadSwitcherSession,
  direction: RecentThreadSwitcherDirection,
): RecentThreadSwitcherSession {
  const count = session.threadIds.length;
  return {
    ...session,
    selectedIndex: (session.selectedIndex + direction + count) % count,
  };
}

export const recentThreadIdsAtom = atomWithStorage<readonly string[]>(
  RECENT_THREAD_IDS_STORAGE_KEY,
  EMPTY_RECENT_THREAD_IDS,
  createTabScopedStorage<readonly string[]>({
    parse: (storedValue, initialValue) => {
      if (storedValue === null) return initialValue;
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(storedValue);
      } catch {
        return initialValue;
      }
      const result = recentThreadIdsSchema.safeParse(parsedValue);
      return result.success
        ? result.data.slice(0, RECENT_THREAD_IDS_MAX_STORED)
        : initialValue;
    },
    serialize: (value) => JSON.stringify(value),
  }),
  { getOnInit: true },
);
