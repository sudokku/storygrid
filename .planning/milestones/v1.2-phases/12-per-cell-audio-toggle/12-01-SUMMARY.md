---
phase: 12-per-cell-audio-toggle
plan: 01
subsystem: data-model
tags: [audio, leafnode, store, fixtures, tdd]
requires:
  - LeafNode type with effects field (Phase 11)
  - gridStore with pushSnapshot helper and updateLeaf/findNode integration
provides:
  - LeafNode.audioEnabled required boolean field
  - createLeaf() default audioEnabled: true
  - gridStore.toggleAudioEnabled(nodeId) action (single-snapshot, no-op guards)
  - Migrated test fixtures so tsc + vitest stay green
affects:
  - All downstream Phase 12 plans (02 UI toggle, 03 video export audio graph)
tech-stack:
  added: []
  patterns:
    - "Single boolean + pure toggle action with findNode/updateLeaf composition"
    - "Fixture migration via makeLeaf helper updates (one-per-file) + targeted inline literal edits"
key-files:
  created: []
  modified:
    - src/types/index.ts
    - src/lib/tree.ts
    - src/store/gridStore.ts
    - src/store/gridStore.test.ts
    - src/test/tree-functions.test.ts
    - src/test/canvas-export.test.ts
    - src/test/action-bar.test.tsx
    - src/test/sidebar.test.tsx
    - src/test/toolbar.test.tsx
    - src/test/grid-rendering.test.tsx
    - src/test/phase04-01-task2.test.tsx
    - src/test/phase04-02-task1.test.tsx
    - src/test/phase05-p01-templates.test.tsx
    - src/test/phase05-p02-cell-swap.test.ts
    - src/test/phase05-p02-pan-zoom.test.tsx
    - src/test/phase05-p02-export-settings.test.ts
    - src/test/phase05-p03-responsive.test.tsx
    - src/test/phase05-p03-shortcuts.test.tsx
    - src/test/phase07-02-sidebar-thumbnail.test.tsx
    - src/test/phase07-02-gridstore-thumbnail.test.ts
    - src/test/phase09-p01-cell-move.test.ts
    - src/test/phase09-p02-store-move.test.ts
    - src/test/phase09-p03-leafnode-zones.test.ts
    - src/Grid/__tests__/ActionBar.test.tsx
    - src/Grid/__tests__/LeafNode.test.tsx
    - src/Editor/__tests__/phase05.1-p01-foundation.test.tsx
    - src/Editor/__tests__/phase05.1-p02-mobile-controls.test.tsx
decisions:
  - toggleAudioEnabled uses findNode+updateLeaf+pushSnapshot composition (mirrors setEffects/applyPreset shape)
  - audioEnabled added to makeLeaf helpers once-per-file rather than to every overrides call site
  - Fixture migration touched all 25 `type: 'leaf'` files even though tsconfig.app.json excludes tests, matching D-28 and Phase 11 precedent
metrics:
  duration: "~8 min"
  completed: "2026-04-09"
---

# Phase 12 Plan 01: Data Model Foundation Summary

**One-liner:** Required `audioEnabled: boolean` on `LeafNode` with `toggleAudioEnabled` store action and full test-fixture migration, delivered via strict TDD (RED -> GREEN).

## What Shipped

### Type + Factory
- `src/types/index.ts`: added `audioEnabled: boolean;` as a required field on `LeafNode`, immediately after `effects: EffectSettings`.
- `src/lib/tree.ts::createLeaf()`: defaults `audioEnabled: true`. This is the single initialization site for the field — all new leaves (template builds, splits, moves via `createLeaf()` spread) inherit the default automatically.

### Store action
- `src/store/gridStore.ts::toggleAudioEnabled(nodeId)`: added to `GridStoreState` type immediately after `updateCell`, implemented immediately after `updateCell`. Shape:

```ts
toggleAudioEnabled: (nodeId) =>
  set(state => {
    const leaf = findNode(current(state.root), nodeId);
    if (!leaf || leaf.type !== 'leaf') return;   // no-op guard BEFORE pushSnapshot
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, {
      audioEnabled: !leaf.audioEnabled,
    });
  }),
```

Guarantees:
- Exactly one `pushSnapshot` per successful toggle -> one undo entry per user action.
- No-op on missing/non-leaf nodeId -> does NOT pollute history.
- Uses already-imported `findNode`, `updateLeaf`, `current` helpers — no new imports.

### Test coverage (new)
- `src/test/tree-functions.test.ts`: `createLeaf > initializes audioEnabled to true` (1 test).
- `src/store/gridStore.test.ts`: new `describe('toggleAudioEnabled', ...)` block with 6 tests:
  1. `defaults audioEnabled to true for new leaves`
  2. `flips audioEnabled from true to false`
  3. `flips audioEnabled back to true on second call`
  4. `pushes exactly one history snapshot per toggle`
  5. `is a no-op for non-existent nodeId`
  6. `undo restores previous audioEnabled value` (AUD-08 data-model precondition)

Total new tests: **7 passing**.

### Fixture migration
Updated all 25 source files that construct `LeafNode` literals. Strategy:
- For files with a `makeLeaf` helper (11 files), added `audioEnabled: true` once inside the helper body before `...overrides` so every call site inherits the default.
- For files with inline `type: 'leaf'` literals (14 files), added `audioEnabled: true` to each literal directly.
- No fixture opted-in to `audioEnabled: false` because no existing test asserts muted-audio behavior yet (that comes in Plan 02).

## Verification

- `npx tsc --noEmit`: exits 0 with zero errors.
- `npx vitest run`: **539 passed, 2 skipped** (46 test files), up from 532/2 before this plan. Delta = +7 new tests.
- `grep -n "audioEnabled: boolean" src/types/index.ts`: 1 match in `LeafNode`.
- `grep -n "audioEnabled: true" src/lib/tree.ts`: 1 match inside `createLeaf`.
- `grep -n "toggleAudioEnabled" src/store/gridStore.ts`: 2 matches (type + implementation).
- `grep -rn "audioEnabled" src/test src/Grid/__tests__ src/Editor/__tests__`: covers every fixture file touched.

## Commits

| # | Type | Hash | Description |
|---|------|------|-------------|
| 1 | test (RED) | `e3e0619` | Add failing tests for audioEnabled field and toggleAudioEnabled action |
| 2 | feat (GREEN) | `41c01e2` | Add audioEnabled field and toggleAudioEnabled action |
| 3 | test (fixtures) | `cf5feee` | Migrate all LeafNode test fixtures to include audioEnabled |

## Deviations from Plan

None that required auto-fix rules. The plan was followed task-by-task exactly as written.

**Observation (not a deviation):** The plan's acceptance criterion `npx tsc --noEmit` already exited 0 *before* Task 2's fixture migration because `tsconfig.app.json` excludes `src/test` and `src/**/__tests__` from type-checking. The migration was still performed per Task 2 because (a) D-28 explicitly requires it, (b) Phase 11 precedent treats fixture migration as mandatory regardless of tsc coverage, and (c) runtime correctness benefits from consistent fixture shape if the test exclusion is ever lifted.

## Scope of AUD-08 in This Plan

Per the note in the plan's `<success_criteria>`: AUD-08 (per-cell audio state persisted in saved projects and `.storygrid` files) is intentionally **not** claimed by this plan's frontmatter `requirements: [AUD-01, AUD-09]`. This plan delivers only the *data-model precondition* — the field exists as a required boolean and survives undo/redo round-trips (test #6 above). Phase 14 Project Persistence will deliver the serialization layer and claim AUD-08 at that time.

## Downstream Contracts (Locked)

Plans 02 and 03 can now rely on:

```ts
// In any LeafNode reference throughout the codebase:
leaf.audioEnabled  // boolean, always defined
```

```ts
// In any component/hook with store access:
const toggleAudioEnabled = useGridStore(s => s.toggleAudioEnabled);
toggleAudioEnabled(nodeId);  // idempotent, one undo entry, no-op on bad id
```

These are the only two contracts Plans 02 (ActionBar/Sidebar UI) and 03 (video export audio graph) need from the data layer.

## Known Stubs

None. The field is real, the action is real, tests exercise both. No UI yet (Plan 02) and no export wiring yet (Plan 03), but those are separate plans — not stubs within this plan.

## Self-Check: PASSED

Verified:
- `src/types/index.ts` contains `audioEnabled: boolean;` in LeafNode -> FOUND
- `src/lib/tree.ts` createLeaf has `audioEnabled: true` -> FOUND
- `src/store/gridStore.ts` contains `toggleAudioEnabled` (2 matches: type + impl) -> FOUND
- Commit `e3e0619` (RED tests) -> FOUND
- Commit `41c01e2` (GREEN impl) -> FOUND
- Commit `cf5feee` (fixture migration) -> FOUND
- `npx tsc --noEmit` exit 0 -> VERIFIED
- `npx vitest run` 539 passed / 2 skipped -> VERIFIED
