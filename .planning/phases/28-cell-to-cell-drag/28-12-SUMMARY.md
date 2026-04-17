---
phase: 28-cell-to-cell-drag
plan: 12
subsystem: dnd
tags: [gap-closure, scale-compensation-removal, measuring-strategy, per-axis-threshold, ghost-fix, touch-drag]
dependency_graph:
  requires: [28-11]
  provides: [ghost-1x1-tracking, reliable-edge-zone-commit, per-axis-drop-threshold]
  affects: [src/dnd/adapter/dndkit.ts, src/dnd/DragPreviewPortal.tsx, src/Grid/CanvasWrapper.tsx, src/dnd/computeDropZone.ts]
tech_stack:
  added: []
  patterns: [MeasuringStrategy.Always, per-axis-threshold, no-modifier-on-DragOverlay]
key_files:
  created: []
  modified:
    - src/dnd/adapter/dndkit.ts
    - src/dnd/adapter/__tests__/dndkit.test.ts
    - src/dnd/DragPreviewPortal.tsx
    - src/Grid/CanvasWrapper.tsx
    - src/dnd/computeDropZone.ts
    - src/dnd/computeDropZone.test.ts
    - .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md
decisions:
  - "Remove scaleCompensationModifier — DragOverlay portals to document.body (viewport space); dividing transform by canvasScale amplified movement 1/scale×, the opposite of the intent"
  - "Adopt MeasuringStrategy.Always on DndContext droppable — upstream dnd-kit recommendation for DragOverlay-at-non-1x-scale (PITFALLS.md:461, issues #50/#205/#250/#393)"
  - "Per-axis thresholds in computeDropZone (yThreshold = max(20, h*0.2), xThreshold = max(20, w*0.2)) — aligns compute function with DropZoneIndicators visual band geometry; eliminates non-square dead-band"
  - "Delete 6 scaleCompensation unit tests — they asserted the amplification-as-correct contract which has been disavowed; keeping them would lock the broken architecture back in on future refactors"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_changed: 7
---

# Phase 28 Plan 12: Gap-Closure — Remove scaleCompensationModifier + Per-Axis Zone Threshold Summary

**One-liner:** Removed scaleCompensationModifier (false-premise DragOverlay scale compensation that amplified touch drag 1/scale×) and adopted MeasuringStrategy.Always + per-axis drop-zone thresholds, closing UAT Gap 2 (touch ghost acceleration + unreliable edge zones) and the ghost portion of Gap 3.

## What Was Built

### Task 1: Remove scaleCompensationModifier + Adopt MeasuringStrategy.Always (PRIMARY Gap 2 closure)

**Root cause of ghost acceleration and edge-zone miss (Gap 2 + Gap 3 ghost portion):**

`scaleCompensationModifier` at `src/dnd/adapter/dndkit.ts` divided `transform.x/y` by `canvasScale`. The premise was that `DragOverlay` renders inside the scaled `canvas-surface` container. But `DragOverlay` uses `createPortal(document.body)` internally — it renders in viewport space, completely outside the ancestor `transform: scale()`. The transform dnd-kit delivers is already a viewport-space pointer delta. Dividing it by `canvasScale` (e.g. 0.3 on mobile) amplified movement by ~3.3×: finger moves 10px, ghost jumps 33px.

This amplified delta also flowed into `CanvasWrapper.handleDragOver`'s pointer reconstruction (`activatorEvent.clientX + delta.x`). With delta amplified 3.3×, short touch drags computed a pointer far outside the intended target cell, causing edge zones to only commit when the amplified pointer coincidentally landed in the edge band (~1-in-3 attempts from UAT).

**Fix:**
1. `scaleCompensationModifier` removed from `src/dnd/adapter/dndkit.ts` (export + JSDoc + `useEditorStore` import + `Modifier` type import all gone).
2. `<DragOverlay adjustScale={false}>` in `DragPreviewPortal.tsx` — `modifiers` prop removed entirely. No modifiers = dnd-kit passes viewport-space transform unchanged.
3. `MeasuringStrategy.Always` added to `<DndContext measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>` in `CanvasWrapper.tsx` — upstream-recommended fix for any residual drift at non-1x ancestor scale.
4. 6 scaleCompensation unit tests **deleted** from `src/dnd/adapter/__tests__/dndkit.test.ts` — they encoded the amplification-as-correct contract.

### Task 2: Per-Axis Drop Zone Threshold (SECONDARY independent improvement)

`DropZoneIndicators.tsx` renders edge bands at 20% of each axis independently (`height: 20%` for top/bottom, `width: 20%` for left/right). The old `computeDropZone` used a shorter-axis formula: `threshold = max(20, min(w,h) * 0.2)`. On a 100w×300h cell, the visible top band is 60px tall but the compute threshold was 20px — a 40px dead-band where the user aimed at a visible arrow and got 'center'.

Fix: per-axis thresholds in `computeDropZone.ts`:
- `yThreshold = Math.max(20, h * 0.2)` — matches `height: 20%` top/bottom bands
- `xThreshold = Math.max(20, w * 0.2)` — matches `width: 20%` left/right bands

`computeDropZone.test.ts` updated: all three canvasScale zone-table blocks recomputed (thresholds change for tall cells), new `per-axis threshold (indicator-aligned, gap-closure 28-12)` describe block with regression-lock tests for 100×300 non-square cell.

### Task 3: 28-VERIFICATION.md Documentation

Appended `### Gap-Closure Plan 28-12` subsection under the `## Gap-Closure Updates` umbrella (preserved from plan 28-11). Documents:
- Primary vs secondary task scope distinction
- Artifact status change table (scaleCompensationModifier removed; MeasuringStrategy.Always added; per-axis thresholds)
- Post-fix UAT mapping (Test 2 = partial; Test 4 ghost fixed, outline still open for 28-13)
- Grep gates for post-28-12 validation

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `066a028` | test (RED) | Remove scaleCompensationModifier unit tests (amplification-as-correct contract disavowed) |
| `93b8847` | fix (GREEN) | Remove scaleCompensationModifier; adopt MeasuringStrategy.Always on DndContext |
| `017595c` | test (RED) | Rewrite computeDropZone tests for per-axis threshold aligned with DropZoneIndicators |
| `65d17a2` | fix (GREEN) | Align computeDropZone threshold with DropZoneIndicators per-axis band geometry |
| `d14a224` | docs | Document gap-2 closure (primary + secondary scope) in 28-VERIFICATION.md |

## Deviations from Plan

None — plan executed exactly as written. All artifacts match the plan's `must_haves.artifacts` specifications. The two TDD RED/GREEN cycles completed cleanly with confirmed failures before implementation.

## Test Results

- **8 test files passing** (115 tests, 0 failed)
- `npm run build` — exit 0 (1.17s)
- `npx tsc --noEmit` — passing (verified via build)

## Grep Gates Post-28-12

```
grep -rc 'scaleCompensationModifier' src/ (functional)  → 0 functional refs (3 comment-only mentions — OK)
grep -c 'useEditorStore' src/dnd/adapter/dndkit.ts       → 0 (PASS)
grep -c 'MeasuringStrategy.Always' src/Grid/CanvasWrapper.tsx  → 2 (PASS, >=1)
grep -c 'yThreshold' src/dnd/computeDropZone.ts          → 7 (PASS, >=1)
grep -c 'xThreshold' src/dnd/computeDropZone.ts          → 5 (PASS, >=1)
grep -c 'Math.min(w, h)' src/dnd/computeDropZone.ts      → 0 (PASS)
```

## Gap Closure Status

| Gap | Test | Status After 28-12 |
|-----|------|-------------------|
| Gap 1 | Test 1 — Desktop click-hold drag | CLOSED by plan 28-11 (sensor key collision fix) |
| Gap 2 | Test 2 — Touch drag ghost + zones | PARTIAL — ghost 1:1 (CLOSED); edge zones reliable (CLOSED); per-zone icon emphasis DEFERRED Phase 29 (D-15) |
| Gap 3 (ghost) | Test 4 — Ghost acceleration | CLOSED — modifier removed |
| Gap 3 (outline) | Test 4 — Hovered cell accent outline | OPEN — plan 28-13 scope |

## Known Stubs

None — no stubs introduced. `DropZoneIndicators`'s `{ zone: _zone }` underscore-destructure is intentional per D-15 (Phase 29 scope), not a stub introduced by this plan.

## Self-Check: PASSED

- `src/dnd/adapter/dndkit.ts` — FOUND (no scaleCompensationModifier, no useEditorStore)
- `src/dnd/DragPreviewPortal.tsx` — FOUND (`<DragOverlay adjustScale={false}>` no modifiers)
- `src/Grid/CanvasWrapper.tsx` — FOUND (MeasuringStrategy.Always in DndContext)
- `src/dnd/computeDropZone.ts` — FOUND (yThreshold + xThreshold, no Math.min(w,h))
- `src/dnd/computeDropZone.test.ts` — FOUND (per-axis describe block with 100×300 regression tests)
- `.planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md` — FOUND (Gap-Closure Plan 28-12 subsection)
- Commits 066a028, 93b8847, 017595c, 65d17a2, d14a224 — all present in git log
