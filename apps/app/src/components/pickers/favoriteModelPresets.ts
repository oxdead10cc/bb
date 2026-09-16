import { useAtom } from "jotai";
import {
  FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH,
  favoriteModelPresetKey,
  type FavoriteModelPreset,
  type ReasoningLevel,
} from "@bb/domain";
import { createSyncedPreferenceAtom } from "@/lib/ui-preferences/synced-preference-atom";
import type { ModelPickerOption } from "./model-picker-option";
import type { ProviderPickerOption } from "./model-brand-prefix";
import { stripModelBrandPrefix } from "./model-brand-prefix";

export const favoriteModelPresetsAtom = createSyncedPreferenceAtom(
  "composer.favoriteModelPresets",
);

export interface FavoriteModelPresetSelection {
  providerId: string;
  model: string;
  reasoningLevel: ReasoningLevel;
}

export function containsFavoritePreset(
  presets: readonly FavoriteModelPreset[],
  selection: FavoriteModelPresetSelection,
): boolean {
  const key = favoriteModelPresetKey(selection);
  return presets.some((preset) => favoriteModelPresetKey(preset) === key);
}

export function toggleFavoritePreset(
  presets: readonly FavoriteModelPreset[],
  selection: FavoriteModelPresetSelection,
): FavoriteModelPreset[] {
  const key = favoriteModelPresetKey(selection);
  const remaining = presets.filter(
    (preset) => favoriteModelPresetKey(preset) !== key,
  );
  if (remaining.length !== presets.length) return remaining;
  return [...remaining, selection].slice(
    -FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH,
  );
}

export interface FavoriteModelPresetRow {
  key: string;
  preset: FavoriteModelPreset;
  label: string;
  qualifier: string;
  selected: boolean;
}

export function buildFavoritePresetRows({
  presets,
  activeProviderId,
  activeModelOptions,
  providerOptions,
  selection,
  reasoningLabel,
}: {
  presets: readonly FavoriteModelPreset[];
  activeProviderId: string;
  activeModelOptions: readonly ModelPickerOption[];
  providerOptions: readonly ProviderPickerOption[];
  selection: FavoriteModelPresetSelection | null;
  reasoningLabel: (preset: FavoriteModelPreset) => string;
}): FavoriteModelPresetRow[] {
  const knownProviderIds = new Set(
    providerOptions.map((option) => option.value),
  );
  const selectedKey =
    selection === null ? null : favoriteModelPresetKey(selection);
  const rows: FavoriteModelPresetRow[] = [];
  for (const preset of presets) {
    if (knownProviderIds.size > 0 && !knownProviderIds.has(preset.providerId)) {
      continue;
    }
    const providerOption = providerOptions.find(
      (option) => option.value === preset.providerId,
    );
    const isActiveProvider = preset.providerId === activeProviderId;
    const catalogOption = isActiveProvider
      ? activeModelOptions.find((option) => option.value === preset.model)
      : undefined;
    if (isActiveProvider && catalogOption === undefined) continue;
    const modelLabel = stripModelBrandPrefix(
      catalogOption?.label ?? preset.model,
      providerOption?.brandPrefix,
    );
    const key = favoriteModelPresetKey(preset);
    rows.push({
      key,
      preset,
      label: preset.label ?? modelLabel,
      qualifier: reasoningLabel(preset),
      selected: key === selectedKey,
    });
  }
  return rows;
}

export function useFavoriteModelPresets() {
  const [presets, setPresets] = useAtom(favoriteModelPresetsAtom);
  return {
    presets,
    isFavorite(selection: FavoriteModelPresetSelection): boolean {
      return containsFavoritePreset(presets, selection);
    },
    toggleFavorite(selection: FavoriteModelPresetSelection): void {
      setPresets((current) => toggleFavoritePreset(current, selection));
    },
  };
}
