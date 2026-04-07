---
phase: quick-260407-vth
plan: 01
subsystem: grid-templates
tags: [templates, media-migration, ux, applyTemplate, gridStore]
requires: []
provides:
  - silent-template-apply
  - media-migration-across-templates
affects:
  - src/store/gridStore.ts
  - src/components/TemplatesPopover.tsx
tech-stack:
  added: []
  patterns:
    - "DFS-ordered media migration via getAllLeaves on both old and new root"
    - "Per-id blob revocation instead of blanket revokeRegistryBlobUrls"
    - "slice(0, N) to compute dropped ids (handles duplicates correctly)"
key-files:
  created: []
  modified:
    - src/store/gridStore.ts
    - src/components/TemplatesPopover.tsx
    - src/test/phase05-p01-templates.test.tsx
    - src/test/phase07-02-gridstore-thumbnail.test.ts
decisions:
  - "applyTemplate no longer wipes mediaRegistry — it migrates min(N,M) media refs in DFS order and prunes only surplus"
  - "Only raw mediaId is migrated; new leaves keep createLeaf() defaults (fit:cover, pan:0/0/1, bg:null) so the template is a true layout swap"
  - "TemplatesPopover no longer subscribes to root — removes a re-render source on every tree mutation"
  - "phase07-02 Test 6 rewritten to match new prune-surplus semantics (old test asserted the wiped-registry behavior)"
metrics:
  duration: "~10min"
  completed: "2026-04-07"
---

# Quick Task 260407-vth: Template Picker Silent Apply with Media Migration — Summary

Non-destructive template switching: template picker now applies layouts instantly without a `window.confirm` dialog, and existing media is migrated into the new structure (up to `min(oldMediaCount, newLeafCount)`) in depth-first visual order instead of being wiped from the registry.

## What Changed

### `gridStore.applyTemplate` rewrite

The old implementation called `revokeRegistryBlobUrls(...)` and reset all three parallel maps (`mediaRegistry`, `mediaTypeMap`, `thumbnailMap`) to `{}`. The new implementation:

1. Snapshots history first so undo still restores the previous tree *and* its media bindings.
2. Walks the old root DFS via `getAllLeaves` and collects the mediaIds that are actually attached to leaves.
3. Walks the template root DFS.
4. For `i < min(carried.length, newLeaves.length)`, calls `updateLeaf(nextRoot, newLeaves[i].id, { mediaId: carried[i] })`. This guarantees only the raw `mediaId` copies — `fit`, `objectPosition`, `backgroundColor`, `panX`, `panY`, `panScale` all stay at the `createLeaf()` defaults.
5. Computes `droppedIds = carried.filter(id => !keptIds.has(id))` where `keptIds = new Set(carried.slice(0, newLeaves.length))`. Using slice instead of set-diff preserves correct behavior when the same `mediaId` is bound to multiple old cells.
6. For each dropped id: revokes its blob URL if applicable, then deletes from all three parallel maps.
7. Assigns `state.root = nextRoot`.

Kept media's blob URLs are never revoked — that was the whole point.

### `TemplatesPopover.handleApply` simplified

Deleted the `getAllLeaves(root)` check, the `hasMedia`/`isNonEmpty` computation, and the `window.confirm(...)` branch. New body is three lines:

```ts
const handleApply = useCallback((entry: TemplateEntry) => {
  applyTemplate(buildTemplate(entry.name));
  setOpen(false);
}, [applyTemplate]);
```

The `const root = useGridStore(s => s.root)` subscription was removed — it was only feeding the dead confirm check. TemplatesPopover no longer re-renders on every tree mutation.

## Tests

### Added (phase05-p01-templates.test.tsx)

Five new cases covering the full spec:

- **Test A** — empty grid + `2x2` template: all 4 new leaves have `mediaId === null`, registry stays empty.
- **Test B** — 2 media on 2-leaf grid + `2x2` template: leaves `[m1, m2, null, null]`, both entries preserved in registry.
- **Test C** — 4 media (2 data URIs, 2 blob URLs) on `2x2` + `1x2` template: surviving leaves `[m1, m2]`, `m3`/`m4` pruned from registry/typeMap/thumbnailMap, **`URL.revokeObjectURL` called for the two dropped blob URLs only** (verified via `vi.spyOn`).
- **Test D** — leaf A has `fit:contain, bg:#ff0000, panX:50, panY:25, panScale:2`; after applying `2x1`, `newLeaves[0]` has `mediaId === 'm1'` but every other field is back to the `createLeaf()` default.
- **Test E** — migrated blob URL is **not** revoked (regression guard for the blanket-revoke bug).

### Updated (phase07-02-gridstore-thumbnail.test.ts)

Old Test 6 asserted `thumbnailMap === {}` after any `applyTemplate` call. That's no longer the contract — thumbnails for migrated videos must survive. Rewrote the test to use the real semantics: apply `2x2`, fill 4 cells with 2 images + 2 videos (each with a seeded thumbnail), apply `1x2`, then assert both video thumbnails are pruned because they became surplus.

## Verification

- `npx vitest run` — 427 passed, 2 skipped (37 files)
- `npx tsc --noEmit` — clean
- `grep -n "window.confirm" src/components/TemplatesPopover.tsx` — no matches
- `grep -n "getAllLeaves" src/components/TemplatesPopover.tsx` — no matches

## Commits

| Hash | Message |
|------|---------|
| c87c34e | test(quick-260407-vth): add failing tests for applyTemplate media migration |
| 64a7cf8 | feat(quick-260407-vth): migrate media across applyTemplate instead of wiping |
| 41cc818 | feat(quick-260407-vth): apply templates silently without confirm dialog |

## Deviations from Plan

**[Rule 1 - Contract update] phase07-02-gridstore-thumbnail Test 6 rewritten.**
- **Found during:** Task 1 full-suite run.
- **Issue:** Pre-existing Test 6 asserted `applyTemplate() resets thumbnailMap to {}`, directly contradicting the new semantics (thumbnails for migrated videos must survive).
- **Fix:** Rewrote the test to seed 4 media (2 images, 2 videos with thumbnails) onto a `2x2` grid, apply `1x2`, and assert both surplus video thumbnails are pruned. This keeps the test's intent (applyTemplate correctly prunes thumbnailMap) while aligning with the new prune-surplus contract.
- **Files modified:** src/test/phase07-02-gridstore-thumbnail.test.ts
- **Commit:** 64a7cf8 (folded into the implementation commit since it is part of the same semantic change)

## Self-Check: PASSED

- src/store/gridStore.ts — modified (applyTemplate rewrite)
- src/components/TemplatesPopover.tsx — modified (confirm removed)
- src/test/phase05-p01-templates.test.tsx — modified (5 new tests)
- src/test/phase07-02-gridstore-thumbnail.test.ts — modified (Test 6 rewritten)
- Commits c87c34e, 64a7cf8, 41cc818 — all present in `git log`
- Full suite green, tsc clean, grep guards both empty
