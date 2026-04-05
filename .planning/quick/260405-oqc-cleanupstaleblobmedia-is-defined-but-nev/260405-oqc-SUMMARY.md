---
phase: quick
plan: 260405-oqc
subsystem: store/startup
tags: [cleanup, blob-urls, gridStore, EditorShell, video]
dependency_graph:
  requires: []
  provides: [cleanupStaleBlobMedia-on-mount]
  affects: [src/store/gridStore.ts, src/Editor/EditorShell.tsx]
tech_stack:
  added: []
  patterns: [fire-once useEffect on mount, Zustand getState() in effect]
key_files:
  created: []
  modified:
    - src/store/gridStore.ts
    - src/Editor/EditorShell.tsx
    - src/test/grid-store.test.ts
decisions:
  - cleanupStaleBlobMedia called via useGridStore.getState() inside useEffect([]) — fire-once action, no reactive selector needed
  - Tests added to existing grid-store.test.ts (not a new file) to stay consistent with project file naming conventions
metrics:
  duration: 5min
  completed: 2026-04-05
  tasks: 1
  files: 3
---

# Quick Task 260405-oqc: Wire cleanupStaleBlobMedia on App Mount Summary

**One-liner:** Synced gridStore with mediaTypeMap+cleanupStaleBlobMedia from main, wired startup call in EditorShell, added 2 tests covering blob cleanup and no-op paths.

## What Was Done

The `cleanupStaleBlobMedia` action existed in the main branch's `gridStore.ts` (added in Phase 06-01) but was absent from the worktree. This task:

1. Synced the worktree's `gridStore.ts` to match main — adding `mediaTypeMap`, `cleanupStaleBlobMedia`, `revokeRegistryBlobUrls`, and updating `addMedia`/`removeMedia`/`clearGrid`/`applyTemplate` signatures.
2. Added a startup `useEffect` in `EditorShell.tsx` that calls `useGridStore.getState().cleanupStaleBlobMedia()` once on mount (empty dep array), placed before the keyboard shortcut effect.
3. Added a `cleanupStaleBlobMedia` describe block to `src/test/grid-store.test.ts` with 2 tests:
   - Removes blob: entries from `mediaRegistry` and `mediaTypeMap`, nulls leaf `mediaId` references, leaves base64 entries untouched.
   - Is a no-op when no blob entries exist (base64 images left alone).

## Verification

- `npx vitest run src/test/grid-store.test.ts` — 22/22 passed (2 new tests green)
- `npx vitest run` full suite — same 6 pre-existing test file failures as baseline; 0 new regressions introduced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] gridStore missing mediaTypeMap and cleanupStaleBlobMedia in worktree**
- **Found during:** Task 1 (TDD RED — tests immediately showed `cleanupStaleBlobMedia is not a function`)
- **Issue:** The worktree's gridStore was behind the main branch — lacked `mediaTypeMap`, `cleanupStaleBlobMedia`, `revokeRegistryBlobUrls`, and related updates to `addMedia`/`removeMedia`/`clearGrid`/`applyTemplate`.
- **Fix:** Rewrote `gridStore.ts` in the worktree to match the main repo version exactly.
- **Files modified:** `src/store/gridStore.ts`
- **Commit:** a44365d

**2. [Rule 1 - Naming] Plan referenced gridStore.test.ts but actual filename is grid-store.test.ts**
- **Found during:** Task 1 file lookup — `src/test/gridStore.test.ts` did not exist.
- **Fix:** Added tests to the correct existing file `src/test/grid-store.test.ts`.
- **Files modified:** `src/test/grid-store.test.ts`

## Known Stubs

None — all wired and tested.

## Self-Check: PASSED

- `src/store/gridStore.ts` — FOUND, contains `cleanupStaleBlobMedia`
- `src/Editor/EditorShell.tsx` — FOUND, contains `cleanupStaleBlobMedia` in useEffect
- `src/test/grid-store.test.ts` — FOUND, contains `cleanupStaleBlobMedia` describe block
- Commit a44365d — FOUND
