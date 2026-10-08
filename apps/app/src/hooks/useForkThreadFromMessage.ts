import { useCallback, useLayoutEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Thread } from "@bb/domain";
import { sdk } from "@/lib/sdk";
import { isThreadForkable, type AppCreateThreadRequest } from "@bb/client-core";
import type { ThreadRoutePathArgs } from "@/lib/route-paths";
import { threadDefaultExecutionOptionsQueryKey } from "@/hooks/queries/query-keys";
import { findCachedProviderInfo } from "@/hooks/queries/system-queries";
import {
  applyCreateThreadResult,
  beginCreateThreadTransaction,
} from "@/hooks/cache-owners/thread-runtime-cache-owner";
import { buildForkIntoProjectEnvironment } from "@/lib/fork-target-projects";

interface UseForkThreadFromMessageArgs {
  navigateInPane: (thread: ThreadRoutePathArgs) => void;
  sourceHostId?: string | null;
  sourceThread: Thread | null;
}

interface ForkThreadFromMessageTarget {
  sourceSeqEnd: number;
  targetProjectId?: string;
}

export function useForkThreadFromMessage({
  navigateInPane,
  sourceHostId = null,
  sourceThread,
}: UseForkThreadFromMessageArgs): (
  target: ForkThreadFromMessageTarget,
) => Promise<void> {
  const queryClient = useQueryClient();
  const forkThread = useMutation({
    meta: {
      errorMessage: "Failed to fork thread.",
      lifecycleOperation: "create_thread",
    },
    mutationFn: (request: AppCreateThreadRequest) =>
      sdk.threads.spawn({
        ...request,
        origin: "app",
        originKind: "fork",
        startedOnBehalfOf: null,
      }),
    onMutate: async () => beginCreateThreadTransaction({ queryClient }),
    onSuccess: (thread, request) => {
      applyCreateThreadResult({ queryClient, request, thread });
    },
  });
  const forkThreadRef = useRef(forkThread.mutateAsync);
  const forkInFlightRef = useRef(false);
  const sourceThreadRef = useRef(sourceThread);
  const sourceHostIdRef = useRef(sourceHostId);
  const navigateInPaneRef = useRef(navigateInPane);
  useLayoutEffect(() => {
    forkThreadRef.current = forkThread.mutateAsync;
    sourceThreadRef.current = sourceThread;
    sourceHostIdRef.current = sourceHostId;
    navigateInPaneRef.current = navigateInPane;
  }, [forkThread.mutateAsync, navigateInPane, sourceHostId, sourceThread]);

  return useCallback(
    async (target: ForkThreadFromMessageTarget) => {
      const source = sourceThreadRef.current;
      if (
        source === null ||
        !isThreadForkable(
          source,
          findCachedProviderInfo(queryClient, source.providerId)?.capabilities
            .supportsFork ?? false,
        ) ||
        forkInFlightRef.current
      ) {
        return;
      }

      forkInFlightRef.current = true;
      try {
        const executionOptions = await queryClient.fetchQuery({
          queryKey: threadDefaultExecutionOptionsQueryKey(source.id),
          queryFn: ({ signal }) =>
            sdk.threads.defaultExecutionOptions({
              signal,
              threadId: source.id,
            }),
        });
        if (executionOptions === null || source.environmentId === null) {
          return;
        }
        const targetProjectId = target.targetProjectId ?? source.projectId;
        const sourceHostId = sourceHostIdRef.current;
        const environment: AppCreateThreadRequest["environment"] | null =
          targetProjectId === source.projectId
            ? { type: "reuse", environmentId: source.environmentId }
            : sourceHostId === null
              ? null
              : buildForkIntoProjectEnvironment({
                  hostId: sourceHostId,
                  projectId: targetProjectId,
                });
        if (environment === null) {
          return;
        }

        const fork = await forkThreadRef.current({
          environment,
          input: [],
          model: executionOptions.model,
          originKind: "fork",
          permissionMode: executionOptions.permissionMode,
          pinned: source.pinnedAt !== null,
          projectId: targetProjectId,
          providerId: source.providerId,
          reasoningLevel: executionOptions.reasoningLevel,
          sectionId: source.sectionId,
          ...(executionOptions.serviceTier
            ? { serviceTier: executionOptions.serviceTier }
            : {}),
          sourceSeqEnd: target.sourceSeqEnd,
          sourceThreadId: source.id,
          startedOnBehalfOf: null,
        });
        navigateInPaneRef.current({
          projectId: fork.projectId,
          threadId: fork.id,
        });
      } catch {
        return;
      } finally {
        forkInFlightRef.current = false;
      }
    },
    [queryClient],
  );
}
