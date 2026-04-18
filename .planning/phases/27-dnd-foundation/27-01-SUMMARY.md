---
phase: 27-dnd-foundation
plan: "01"
subsystem: dnd
tags: [infrastructure, dnd, scaffolding, skeleton]
dependency_graph:
  requires: []
  provides:
    - src/dnd module boundary and public API barrel
    - "@dnd-kit/modifiers dependency in package.json"
  affects:
    - Phase 27 Plans 02 and 03 (can now implement computeDropZone and dragStore against stable import surface)
    - Phase 28 (can wire the adapter without redefining file layout)
tech_stack:
  added:
    - "@dnd-kit/modifiers@^9.0.0 (scale-compensation modifiers for canvas transform:scale)"
  patterns:
    - Vanilla Zustand store (no Immer, no persist) for ephemeral drag state
    - Barrel export pattern (src/dnd/index.ts) — consumers never import from sub-files
    - File-header documentation of blocking anti-patterns (Pitfall 1, 4, 10)
key_files:
  created:
    - src/dnd/index.ts
    - src/dnd/adapter/dndkit.ts
    - src/dnd/dragStore.ts
    - src/dnd/computeDropZone.ts
    - src/dnd/useCellDraggable.ts
    - src/dnd/useCellDropTarget.ts
    - src/dnd/DragPreviewPortal.tsx
    - src/dnd/DropZoneIndicators.tsx
  modified:
    - package.json (added @dnd-kit/modifiers)
    - package-lock.json (updated with resolved dependency subtree)
decisions:
  - "@dnd-kit/modifiers installed with caret pin ^9.0.0 per STACK.md recommendation; not exact-pinned"
  - "DND-01/Pitfall 4/Pitfall 10 rules embedded verbatim in adapter/dndkit.ts header to serve as persistent blocking-rule documentation for Phase 28 implementors"
  - "dragStore stub throws on create() to prevent accidental consumption before Plan 03 implementation"
  - "computeDropZone stub throws to prevent accidental use before Plan 02 TDD implementation"
metrics:
  duration: "8 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 2
---

# Phase 27 Plan 01: DnD Foundation Scaffold Summary

Install `@dnd-kit/modifiers@^9.0.0` and scaffold the full `src/dnd/` module as documented skeletons — additive infrastructure for Plans 02/03 and Phase 28 wiring.

## What Was Built

### Task 1: Install @dnd-kit/modifiers

- **Exact installed version:** `@dnd-kit/modifiers@9.0.0` (resolves to `9.0.0` from `^9.0.0` caret pin)
- **Maintainer verified:** `clauderic` (same org as existing @dnd-kit/* deps — T-27-01 mitigated)
- **Lockfile delta:** `package-lock.json | 15 insertions(+)` — 1 new `node_modules/@dnd-kit/modifiers` entry + peer dep references
- **Caret pin:** `"@dnd-kit/modifiers": "^9.0.0"` in package.json dependencies
- **No peer-dependency warnings** during install

### Task 2: Scaffold src/dnd/ Skeleton Module

Eight skeleton files created under `src/dnd/`:

| File | Lines | Role |
|------|-------|------|
| `src/dnd/index.ts` | 11 | Public API barrel — 7 named exports |
| `src/dnd/adapter/dndkit.ts` | 31 | Adapter skeleton with DND-01/Pitfall 4/Pitfall 10 docs |
| `src/dnd/dragStore.ts` | 32 | Vanilla Zustand skeleton — throws until Plan 03 |
| `src/dnd/computeDropZone.ts` | 27 | Pure function skeleton — throws until Plan 02 |
| `src/dnd/useCellDraggable.ts` | 33 | Hook skeleton with Pitfall 1 (spread-last) docs |
| `src/dnd/useCellDropTarget.ts` | 24 | Hook skeleton with Pitfall 2 (single-event-source) docs |
| `src/dnd/DragPreviewPortal.tsx` | 15 | Component skeleton — returns null |
| `src/dnd/DropZoneIndicators.tsx` | 16 | Component skeleton — returns null |
| **Total** | **189 lines** | |

## Acceptance Criteria Verification

- `grep -c '"@dnd-kit/modifiers"' package.json` → `1`
- `grep -E '"@dnd-kit/modifiers": "\^9\.' package.json` → matches
- `grep -q 'node_modules/@dnd-kit/modifiers' package-lock.json` → exits 0
- `grep -q "Single PointerSensor only" src/dnd/adapter/dndkit.ts` → exits 0 (DND-01)
- `grep -q "NEVER 500ms" src/dnd/adapter/dndkit.ts` → exits 0 (Pitfall 4)
- `grep -q "Phase 25 wiring" src/dnd/adapter/dndkit.ts` → exits 0 (Pitfall 10)
- `grep -q "spread LAST" src/dnd/useCellDraggable.ts` → exits 0 (Pitfall 1)
- `grep -q "parallel" src/dnd/useCellDropTarget.ts` → exits 0 (Pitfall 2)
- `grep -c "export" src/dnd/index.ts` → `7` (≥ 6 required)
- `ls src/dnd/*.test.ts src/dnd/*.test.tsx 2>/dev/null | wc -l` → `0` (no test files)
- `npx tsc --noEmit` → exits 0 (clean compile)
- `git diff --stat HEAD~2 HEAD -- src/Grid src/Editor src/store src/App.tsx` → empty

## REQ-ID Addressability

- **DND-03** (`src/dnd/` module exists, index.ts barrel): ADDRESSABLE by Plans 02/03/28+
- **DND-06** (`@dnd-kit/modifiers` installed): ADDRESSABLE by Phase 28 for canvas transform:scale compensation
- **DND-01** (single PointerSensor rule): Documented in adapter header, enforced in Phase 28
- **DND-02** (ephemeral dragStore): Skeleton type signatures ready, implementation in Plan 03

## Deviations from Plan

None — plan executed exactly as written.

**Note on pre-existing test failures:** The existing test suite has 9 pre-existing failures (phase25-touch-dnd.test.tsx × 3, ActionBar tests × 2, phase05-p02-cell-swap × 3, phase22-mobile-header × 1) that existed before this plan was executed. These are not caused by plan execution and are not in scope for this plan (files outside src/dnd/ and package*.json).

## Known Stubs

All 8 skeleton files are intentional stubs with documented "throw until Phase 2X" behavior:

| Stub | File | Line | Reason |
|------|------|------|--------|
| `computeDropZone` throws | `computeDropZone.ts` | 24 | Implementation in Plan 02 TDD |
| `useDragStore` create() throws | `dragStore.ts` | 31 | Implementation in Plan 03 TDD |
| `useCellDraggable` throws | `useCellDraggable.ts` | 30 | Implementation in Phase 28 |
| `useCellDropTarget` throws | `useCellDropTarget.ts` | 22 | Implementation in Phase 28 |
| `DragPreviewPortal` returns null | `DragPreviewPortal.tsx` | 16 | Implementation in Phase 28 |
| `DropZoneIndicators` returns null | `DropZoneIndicators.tsx` | 16 | Implementation in Phase 28 |

These stubs are intentional plan design — the file layout exists to allow Plans 02/03 (Wave 2 parallel) to implement their respective modules against a stable import surface.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The 8 new source files are all skeleton stubs with no runtime behavior (T-27-02 accepted). `@dnd-kit/modifiers` is a trusted @dnd-kit org package (maintainer `clauderic`, T-27-01 mitigated).

## Self-Check: PASSED

- `src/dnd/index.ts` — FOUND
- `src/dnd/adapter/dndkit.ts` — FOUND
- `src/dnd/dragStore.ts` — FOUND
- `src/dnd/computeDropZone.ts` — FOUND
- `src/dnd/useCellDraggable.ts` — FOUND
- `src/dnd/useCellDropTarget.ts` — FOUND
- `src/dnd/DragPreviewPortal.tsx` — FOUND
- `src/dnd/DropZoneIndicators.tsx` — FOUND
- Task 1 commit `4883b6a` — FOUND in git log
- Task 2 commit `8fe647a` — FOUND in git log
