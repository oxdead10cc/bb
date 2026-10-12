import type { ActiveThinking } from "@bb/domain";

const THINKING_TOKEN_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const MIN_RATE_WINDOW_MS = 1_000;

export function formatThinkingTokens(value: number): string {
  return THINKING_TOKEN_FORMATTER.format(
    Math.max(0, Math.round(value)),
  ).toLowerCase();
}

export function describeThinkingProgress(
  thinking: Pick<
    ActiveThinking,
    "estimatedTokens" | "expectedTokens" | "startedAt" | "updatedAt"
  >,
): string | null {
  const tokens = thinking.estimatedTokens;
  if (tokens === undefined || tokens <= 0) {
    return null;
  }
  const expected =
    thinking.expectedTokens !== undefined && thinking.expectedTokens > tokens
      ? ` / ~${formatThinkingTokens(thinking.expectedTokens)}`
      : "";
  const parts = [`${formatThinkingTokens(tokens)}${expected} tok`];
  const windowMs = thinking.updatedAt - thinking.startedAt;
  if (windowMs >= MIN_RATE_WINDOW_MS) {
    parts.push(`${Math.round(tokens / (windowMs / 1000))} tok/s`);
  }
  return parts.join(" · ");
}
