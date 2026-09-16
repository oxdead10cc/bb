import { describe, expect, it } from "vitest";
import {
  FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH,
  type FavoriteModelPreset,
} from "@bb/domain";
import {
  buildFavoritePresetRows,
  containsFavoritePreset,
  toggleFavoritePreset,
} from "./favoriteModelPresets";
import type { ProviderPickerOption } from "./model-brand-prefix";

const opus: FavoriteModelPreset = {
  providerId: "claude-code",
  model: "claude-opus-5",
  reasoningLevel: "ultracode",
};
const sonnet: FavoriteModelPreset = {
  providerId: "claude-code",
  model: "claude-sonnet-5",
  reasoningLevel: "medium",
};
const codex: FavoriteModelPreset = {
  providerId: "codex",
  model: "gpt-5.6",
  reasoningLevel: "high",
};

const providerOptions = [
  { value: "claude-code", label: "Claude Code", brandPrefix: "Claude " },
  { value: "codex", label: "Codex" },
] satisfies readonly ProviderPickerOption[];

const claudeModelOptions = [
  { value: "claude-opus-5", label: "Claude Opus 5" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
];

function rows(
  overrides: Partial<Parameters<typeof buildFavoritePresetRows>[0]>,
) {
  return buildFavoritePresetRows({
    presets: [opus, codex],
    activeProviderId: "claude-code",
    activeModelOptions: claudeModelOptions,
    providerOptions,
    selection: null,
    reasoningLabel: (preset) => preset.reasoningLevel,
    ...overrides,
  });
}

describe("containsFavoritePreset", () => {
  it("matches on provider, model, and reasoning level together", () => {
    expect(containsFavoritePreset([opus], opus)).toBe(true);
    expect(
      containsFavoritePreset([opus], { ...opus, reasoningLevel: "high" }),
    ).toBe(false);
    expect(
      containsFavoritePreset([opus], { ...opus, providerId: "codex" }),
    ).toBe(false);
  });
});

describe("toggleFavoritePreset", () => {
  it("adds a missing preset and removes a matching one", () => {
    const added = toggleFavoritePreset([opus], codex);
    expect(added).toEqual([opus, codex]);
    expect(toggleFavoritePreset(added, opus)).toEqual([codex]);
  });

  it("keeps the same model at different efforts as separate entries", () => {
    const next = toggleFavoritePreset([opus], {
      ...opus,
      reasoningLevel: "high",
    });
    expect(next).toHaveLength(2);
  });

  it("drops the oldest entry once the list is full", () => {
    const full = Array.from(
      { length: FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH },
      (_unused, index): FavoriteModelPreset => ({
        providerId: "codex",
        model: `model-${index}`,
        reasoningLevel: "high",
      }),
    );
    const next = toggleFavoritePreset(full, opus);
    expect(next).toHaveLength(FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH);
    expect(next.at(0)?.model).toBe("model-1");
    expect(next.at(-1)).toEqual(opus);
  });
});

describe("buildFavoritePresetRows", () => {
  it("labels the active provider's preset from the catalog without its brand prefix", () => {
    const [row] = rows({ presets: [opus] });
    expect(row?.label).toBe("Opus 5");
    expect(row?.qualifier).toBe("ultracode");
  });

  it("falls back to the model id for a provider whose catalog is not loaded", () => {
    const [row] = rows({ presets: [codex] });
    expect(row?.label).toBe("gpt-5.6");
  });

  it("drops a preset whose model left the active provider's catalog", () => {
    const result = rows({
      presets: [{ ...opus, model: "claude-opus-4" }, codex],
    });
    expect(result.map((row) => row.preset)).toEqual([codex]);
  });

  it("keeps a preset for another provider even when its model is unknown here", () => {
    const result = rows({ presets: [{ ...codex, model: "gpt-unreleased" }] });
    expect(result).toHaveLength(1);
  });

  it("drops a preset for a provider that is no longer installed", () => {
    const result = rows({
      presets: [{ ...codex, providerId: "acp-removed" }],
    });
    expect(result).toEqual([]);
  });

  it("marks only the row matching the current selection", () => {
    const result = rows({ presets: [opus, sonnet], selection: sonnet });
    expect(result.map((row) => row.selected)).toEqual([false, true]);
  });

  it("prefers a stored label over the catalog label", () => {
    const [row] = rows({ presets: [{ ...opus, label: "Deep work" }] });
    expect(row?.label).toBe("Deep work");
  });
});
