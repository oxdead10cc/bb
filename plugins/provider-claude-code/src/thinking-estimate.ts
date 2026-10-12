const MAX_SAMPLES_PER_MODEL = 2000;
const MIN_SAMPLES_ABOVE_CURRENT = 20;
const ALL_MODELS = "*";

export interface ThinkingTokenHistory {
  record(model: string | undefined, tokens: number): void;
  expected(model: string | undefined, current: number): number | undefined;
}

export function createThinkingTokenHistory(): ThinkingTokenHistory {
  const samplesByModel = new Map<string, number[]>();

  function push(key: string, tokens: number): void {
    const samples = samplesByModel.get(key) ?? [];
    samples.push(tokens);
    if (samples.length > MAX_SAMPLES_PER_MODEL) {
      samples.shift();
    }
    samplesByModel.set(key, samples);
  }

  function medianAbove(key: string, current: number): number | undefined {
    const above = (samplesByModel.get(key) ?? [])
      .filter((tokens) => tokens > current)
      .sort((left, right) => left - right);
    if (above.length < MIN_SAMPLES_ABOVE_CURRENT) {
      return undefined;
    }
    return above[Math.floor((above.length - 1) / 2)];
  }

  return {
    record(model, tokens) {
      if (!Number.isFinite(tokens) || tokens <= 0) {
        return;
      }
      const rounded = Math.round(tokens);
      push(ALL_MODELS, rounded);
      if (model !== undefined) {
        push(model, rounded);
      }
    },
    expected(model, current) {
      return (
        (model === undefined ? undefined : medianAbove(model, current)) ??
        medianAbove(ALL_MODELS, current)
      );
    },
  };
}

export const sharedThinkingTokenHistory = createThinkingTokenHistory();
