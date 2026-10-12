import { cn } from "@bb/shared-ui/lib/utils";
import { ExpandableTimelineRow } from "./ExpandableTimelineRow.js";
import { TimelineReasoningDetail } from "./TimelineReasoningDetail.js";
import { TimelineStatusIndicator } from "./TimelineStatusIndicator.js";

const INDICATOR_HEADER_CLASS_NAME = "min-h-7 items-center";

interface TimelineWorkingIndicatorProps {
  label?: string;
  isThinking?: boolean;
  details?: string;
  reasoningId?: string;
  progress?: string | null;
}

export function TimelineWorkingIndicator({
  label,
  isThinking = false,
  details,
  reasoningId,
  progress = null,
}: TimelineWorkingIndicatorProps) {
  const resolvedLabel = label ?? (isThinking ? "Thinking…" : "Working...");
  const progressText = progress === null ? null : ` · ${progress}`;
  const hasDetails = (details?.trim().length ?? 0) > 0;

  if (isThinking || hasDetails) {
    return (
      <div className="mt-4">
        <ExpandableTimelineRow
          reasoningExpansionKey={reasoningId}
          expandable={hasDetails}
          headerClassName={INDICATOR_HEADER_CLASS_NAME}
          title={{
            segments: [
              { text: resolvedLabel, em: false, shimmer: true, truncate: true },
              ...(progressText === null
                ? []
                : [
                    {
                      text: progressText,
                      em: false,
                      shimmer: false,
                      truncate: false,
                      accent: "muted" as const,
                    },
                  ]),
            ],
            decorations: [],
            tone: "default",
            action: null,
            plain:
              progressText === null
                ? resolvedLabel
                : `${resolvedLabel}${progressText}`,
          }}
          renderBody={() => <TimelineReasoningDetail text={details ?? ""} />}
        />
      </div>
    );
  }

  return (
    <TimelineStatusIndicator
      label={<span className="animate-shine">{resolvedLabel}</span>}
      className={cn("mt-4 flex", INDICATOR_HEADER_CLASS_NAME)}
    />
  );
}
