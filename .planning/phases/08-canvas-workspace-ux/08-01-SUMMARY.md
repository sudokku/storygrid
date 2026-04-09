---
phase: 08-canvas-workspace-ux
plan: 01
subsystem: canvas-overlay
tags: [ui, canvas, safe-zone, visual-feedback]
dependency_graph:
  requires: [lucide-react, tailwindcss]
  provides: [safe-zone-visual-indicator]
  affects: [Grid/CanvasWrapper.tsx]
tech_stack:
  added: []
  patterns:
    - "Two-layer CSS background: repeating-linear-gradient stripes stacked over rgba tint in one background declaration"
    - "Absolute inset-0 overlay with pointer-events-none so visual-only layers never block cell selection"
key_files:
  created:
    - src/test/phase08-p01-safe-zone.test.tsx
  modified:
    - src/Grid/SafeZoneOverlay.tsx
decisions:
  - "Dimmed (black/40) + diagonal-stripe pattern chosen over solid fill — preserves underlying media visibility while making unsafe zones unmissable (D-01)"
  - "Icon size 64px / text-2xl — component lives inside the 1080x1920 unscaled surface and is visually downscaled with the canvas via parent transform:scale()"
  - "z-10 used for overlay — sits above grid media but below ActionBar, per D-04"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_touched: 2
  lines_added: 84
  completed_date: "2026-04-08"
requirements:
  - CANVAS-01
---

# Phase 08 Plan 01: Safe Zone Visual Indicator Summary

Replaced the dashed-border safe zone overlay with a dimmed (40% black) + diagonal-striped treatment featuring EyeOff icons and "Instagram header"/"Instagram footer" labels, implementing CANVAS-01.

## What Was Built

**`src/Grid/SafeZoneOverlay.tsx`** — Full rewrite. The component now renders an `absolute inset-0` root with `pointer-events-none z-10`, containing two absolutely-positioned regions:

- **Top region** (`data-testid="safe-zone-top"`) — height from `var(--safe-zone-top)`, centered EyeOff icon over the text "Instagram header"
- **Bottom region** (`data-testid="safe-zone-bottom"`) — height from `var(--safe-zone-bottom)`, centered EyeOff icon over the text "Instagram footer"

Both regions use a single two-layer CSS background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px), rgba(0,0,0,0.40)` — diagonal stripes painted on top of a 40% black tint in one declaration.

**`src/test/phase08-p01-safe-zone.test.tsx`** — 7 regression tests asserting:
1. Overlay root mounts with correct testid
2. Top region contains "Instagram header"
3. Bottom region contains "Instagram footer"
4. Each region contains at least one `<svg>` (EyeOff)
5. Root has `pointer-events-none` and `z-10` classes
6. Top region's inline `height` equals `var(--safe-zone-top)`
7. Bottom region's inline `height` equals `var(--safe-zone-bottom)`

## Tasks

### Task 1: Rewrite SafeZoneOverlay (TDD)

- **RED** commit `bb560bd`: Added failing test — dashed-border implementation did not expose `safe-zone-top`/`safe-zone-bottom` testids. 6 of 7 tests failed.
- **GREEN** commit `bf152e0`: Replaced SafeZoneOverlay.tsx contents with the dimmed + striped + labelled implementation. All 7 tests pass.

### Task 2: Regression test

Delivered in the RED step of Task 1. The test file exists, imports SafeZoneOverlay from `../Grid/SafeZoneOverlay`, and all 7 assertions pass. No additional commit required.

## Verification

- `npm run test -- --run src/test/phase08-p01-safe-zone.test.tsx` — 7/7 pass
- `npm run build` — succeeds (322.88 KB / 103.23 KB gzipped, no TS errors, only pre-existing INEFFECTIVE_DYNAMIC_IMPORT warning from `src/lib/media.ts` unrelated to this plan)

## Acceptance Criteria (from PLAN)

- [x] `SafeZoneOverlay.tsx` imports `EyeOff` from `'lucide-react'`
- [x] Contains literal `"Instagram header"`
- [x] Contains literal `"Instagram footer"`
- [x] Contains `"repeating-linear-gradient"`
- [x] Contains `"var(--safe-zone-top)"`
- [x] Contains `"var(--safe-zone-bottom)"`
- [x] Contains `pointer-events-none` class
- [x] Contains `z-10` class
- [x] Contains `data-testid="safe-zone-overlay"`
- [x] Contains `data-testid="safe-zone-top"`
- [x] Contains `data-testid="safe-zone-bottom"`
- [x] Does NOT contain `border-dashed` (old implementation removed)
- [x] `npm run build` succeeds
- [x] Regression test file exists with all 7 tests passing

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (Out of Scope)

Pre-existing test suite failures unrelated to this plan: 60 failing tests across `src/test/toolbar.test.tsx`, `src/test/editorStore.test.ts`, and a few others. These failures were present on `HEAD~2` (before this plan started) and are not caused by the SafeZoneOverlay changes. The `phase08-p01-safe-zone.test.tsx` file is part of the 312 passing tests. Out of scope per the fix-attempt-limit / scope-boundary rule.

## Commits

| Task        | Commit    | Message                                                                    |
| ----------- | --------- | -------------------------------------------------------------------------- |
| 1 (RED)     | `bb560bd` | test(08-01): add failing test for SafeZoneOverlay stripes+labels           |
| 1 (GREEN)   | `bf152e0` | feat(08-01): rewrite SafeZoneOverlay with dimmed+striped overlay and labels |

## Known Stubs

None. The component is fully wired — it consumes the same `--safe-zone-top`/`--safe-zone-bottom` CSS vars the rest of the app already uses, and is already mounted by `CanvasWrapper.tsx` when `showSafeZone` is true.

## Self-Check: PASSED

- FOUND: src/Grid/SafeZoneOverlay.tsx
- FOUND: src/test/phase08-p01-safe-zone.test.tsx
- FOUND commit: bb560bd
- FOUND commit: bf152e0
