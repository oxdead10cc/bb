# Favorite model presets

## Goal

Let a user keep a short, curated list of favorite **provider + model + reasoning
effort** combinations and apply one in a single action from the promptbox model
picker.

Today the picker remembers exactly one last-used model and one last-used
reasoning level per provider, and the only way to move between combinations is
linear cycling (`modelPicker.cycleModel`, `modelPicker.cycleReasoning`), which
always moves model and effort independently. There is no way to jump straight to
"Opus 5 + Ultracode" or to keep it next to "GPT-5.6 + Medium".

Status (2026-09-16): implemented on `feat/favorite-model-presets`, except keyboard shortcuts.

## Decisions

- One **global, cross-provider** list. Each row shows its provider, so a Claude
  preset and a Codex preset live side by side.
- Storage is the existing `ui_preferences` registry — server-backed, revision
  guarded, scriptable from the CLI. No DB migration, no new table.
- **No keyboard shortcuts in the first cut.** They are a separate stage; the
  indexed-command machinery (`numberedChatBindings`) is already in place when we
  want them.

## Current State

- `apps/app/src/components/pickers/ModelReasoningPicker.tsx` (1646 lines) is a
  controlled component with two production call sites:
  `apps/app/src/components/promptbox/ExecutionControls.tsx:94` and
  `apps/app/src/components/plugin/PluginProviderModelPicker.tsx:139`.
- Model rows come from `modelOptions` / `moreModelOptions` built in
  `apps/app/src/hooks/thread-creation-options/model-catalog-selection.ts`
  (catalog order, no pinning). `buildModelNavRows`
  (`ModelReasoningPicker.tsx:148`) merges them into the keyboard-navigable rows.
  The `Model` section header is a plain `MenuSectionLabel` at
  `ModelReasoningPicker.tsx:1135`.
- Reasoning options are scoped per model upstream, from
  `activeModel.supportedReasoningEfforts`
  (`model-catalog-selection.ts:118-127`), and rendered as a `ToggleGroup` gated
  by `showReasoningSection` (`ModelReasoningPicker.tsx:554`).
- A normal model click fires `onModelChange(model)` only; reasoning is a second,
  separate `onReasoningChange(level)` call. **But** the handoff flow already
  carries a combined payload: `handoff.onSelect({providerId, model,
  reasoningLevel})` (`ModelReasoningPicker.tsx:100`), which
  `ThreadDetailPromptArea.tsx:784` turns into a single
  `setProviderModelReasoning(selection)` call. That setter is declared at
  `apps/app/src/hooks/useThreadCreationOptions.ts:112` and is the atomic apply
  path this feature needs.
- Last-used selections are client-only jotai atoms in
  `apps/app/src/hooks/thread-creation-options/persisted-selection-fields.ts:12`
  (`bb.promptbox.model`, `bb.promptbox.reasoning`, keyed per provider).
- `ui_preferences` keys are declared in `packages/domain/src/ui-preferences.ts:35`
  with per-key zod schema + default via `defineUiPreference`; storage is
  key/JSON/revision rows, read and written through
  `apps/server/src/services/system/ui-preferences.ts:41` and `:56`, and exposed
  as `bb settings ui set <key> <json>` (`docs/configuration.md:666`).
- Indexed keyboard commands (for the later hotkey stage) follow
  `PANE_FOCUS_APP_COMMAND_IDS` (`packages/domain/src/app-keybindings.ts:27`) plus
  `numberedChatBindings()` (`apps/server/src/services/system/app-keybindings.ts:73`).
  bb has no parameterized command — each index is its own command id.

## What shipped

### Preference key and schema

`packages/domain/src/ui-preferences.ts` gains `composer.favoriteModelPresets` in
`UI_PREFERENCE_KEYS` plus a `defineUiPreference` entry holding a list of
`{ providerId, model, reasoningLevel, label? }`, capped at
`FAVORITE_MODEL_PRESET_LIST_MAX_LENGTH` (20) and defaulting to `[]`. The level
reuses `reasoningLevelSchema` rather than redeclaring the union. The file also
exports the `FavoriteModelPreset` type and `favoriteModelPresetKey`, the identity
used for dedup and toggling.

No DB migration: `ui_preferences` already stores arbitrary JSON per key, and the
CLI derives its key list from `UI_PREFERENCE_KEYS`, so
`bb settings ui set composer.favoriteModelPresets '[...]'` works without a new
command.

### Storage and pure logic

`apps/app/src/components/pickers/favoriteModelPresets.ts` holds the synced atom
(`createSyncedPreferenceAtom`), the `useFavoriteModelPresets` hook, and the pure
helpers `containsFavoritePreset`, `toggleFavoritePreset`, and
`buildFavoritePresetRows`. Row building hides a preset whose model is missing
from the selected provider's catalog and one whose provider is not installed,
without deleting either.

### Picker

`apps/app/src/components/pickers/ModelReasoningPicker.tsx` renders a `Favorites`
section above the `Model` label, prepends those rows to the keyboard navigation
list, and adds a star beside `Reasoning` that toggles the combination currently
shown. Applying a preset is atomic: it routes through `handoff.onStart` +
`handoff.onSelect` when the thread has a handoff and the preset names another
provider, otherwise through the new optional `onApplySelection` prop, and only
falls back to separate `onModelChange` / `onReasoningChange` calls when neither
is wired.

### Call sites

`ExecutionControls` forwards `onApplySelection`; `ThreadDetailPromptArea` and
`NewThreadComposer` pass `setProviderModelReasoning`
(`apps/app/src/hooks/useThreadCreationOptions.ts`), the setter the handoff flow
already used.

### Tests

- `apps/app/src/components/pickers/favoriteModelPresets.test.ts` — toggle
  semantics, the 20-entry cap, and every row-filtering rule.
- `apps/app/src/components/pickers/ModelReasoningPicker.test.tsx` — the section
  appears only when something is favorited, a same-provider preset applies as one
  atomic call, a cross-provider preset routes through handoff, the fallback path,
  stale-preset hiding, and starring/unstarring.

Verify: `pnpm exec turbo run typecheck test --filter=@bb/app --filter=@bb/domain`

### Docs

`docs/configuration.md` (section renamed from Sidebar preferences to UI
preferences), `packages/templates/src/templates/bb-guide-customization.md`,
`plugins/bb-guide/skills/bb-cli/SKILL.md`, and
`plugins/bb-guide/skills/bb-cli/references/app-settings.md`.

## Not done

Keyboard shortcuts. When wanted: add `FAVORITE_SELECT_APP_COMMAND_IDS`
(`favorite.select.1` … `.5`) to `APP_COMMAND_IDS`
(`packages/domain/src/app-keybindings.ts`), metadata rows in
`apps/app/src/lib/app-command-metadata.ts`, defaults through
`numberedChatBindings()` in `apps/server/src/services/system/app-keybindings.ts`,
and a handler via `useIndexedAppCommandHandlers`. Prefer `Alt+1..5`: it matches
the existing `Alt+M` / `Alt+P` / `Alt+T` model chords and avoids the browser
tab-switch collision `Cmd+1..5` would hit on web and Electron.
