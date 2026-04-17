---
phase: 28-cell-to-cell-drag
plan: 08
subsystem: Grid/LeafNode
tags: [dnd, leafnode, refactor, phase-28, surgical-edit, d-20, ghost-07, drop-04, drag-01]

# Dependency graph
requires:
  - plan: 28-01
    provides: "dragStore extended with ghostDataUrl + sourceRect — scoped selectors consumed here"
  - plan: 28-02
    provides: "PointerSensorMouse/Touch + scaleCompensationModifier — consumed transitively via DndContext in Plan 07"
  - plan: 28-03
    provides: "useCellDraggable body — consumed at the drag-activation site"
  - plan: 28-04
    provides: "useCellDropTarget body — consumed at the drop-target site"
  - plan: 28-06
    provides: "DropZoneIndicators component — conditionally mounted on hovered target"
provides:
  - "LeafNode consuming new DnD hooks from '../dnd' — useCellDraggable + useCellDropTarget + DropZoneIndicators + useDragStore"
  - "3 scoped dragStore selectors (isOverThisCell, isSourceOfDrag, activeZone) — per-leaf re-render containment (ARCHITECTURE §3)"
  - "GHOST-07: source cell opacity dims to 0.4 during drag"
  - "D-17 / DROP-04: 2px accent-blue ring-inset on hovered drop target while dragging"
  - "DRAG-01: cursor:grab when not in pan mode; grabbing while dragging"
  - "Pitfall 9 belt-and-braces: video rAF draw loop pauses when cell is drag source"
  - "Zero Phase 25 DnD residue — no @dnd-kit/core DnD imports, no DragZoneRefContext, no pointerPosRef, no isPendingDrag, no inline zone JSX"
affects:
  - 28-07 (CanvasWrapper DndContext mount — Wave 4 sibling plan) — completes the end-to-end wiring
  - 28-09 (EditorShell <DragPreviewPortal /> mount) — unblocked
  - 28-10a / 28-10b (test rewrites) — will target the new dragStore selector surface + DropZoneIndicators render path

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scoped primitive Zustand selectors for per-leaf re-render containment (isOverThisCell / isSourceOfDrag / activeZone)"
    - "Conditional DropZoneIndicators mount gated on isOverThisCell (D-12)"
    - "rAF draw-loop guard reading dragStore via getState() in imperative per-frame code (Pitfall 9)"
    - "Pitfall 1 preserved: dragListeners spread LAST after all explicit pointer handlers on root JSX"
    - "D-28 preserved: native file-drop triad (handleFileDragOver/handleFileDragLeave/handleFileDrop) unchanged"

key-files:
  created: []
  modified:
    - "src/Grid/LeafNode.tsx — surgical 15-point rewrite: removed useContext, @dnd-kit DnD imports, DragZoneRefContext import, ArrowLeftRight, type ActiveZone, 3 useState + 1 useContext lines, pointerPosRef + document pointermove listener, useDndMonitor block, isPendingDrag pointer listeners, 5 inline zone JSX blocks, isDragging box-shadow, data-hold-pending attribute, drag-hold-pulse animation. Added useCellDraggable/useCellDropTarget imports + DropZoneIndicators import + useDragStore import, 3 scoped selectors, rAF dragStore guard, GHOST-07 opacity 0.4 rule, D-17 isOverThisCell ring, DRAG-01 grab cursor, single <DropZoneIndicators zone={activeZone} /> render."

key-decisions:
  - "Applied Pitfall 9 belt-and-braces guard inside the per-frame rAF tick (Claude's Discretion). Guard reads useDragStore.getState() each frame — no subscription — and re-schedules the frame without drawing when sourceId===id during drag. This prevents toDataURL race on video source cells. Added `id` to the useEffect deps since it is now referenced inside tick()."
  - "Kept Pitfall 1 ordering: the 5 explicit handlers (onClick/onDoubleClick/Pointer*) come first; `{...(!isPanMode ? dragListeners : {})}` is spread LAST on the JSX root (invariant enforced by T-28-21)."
  - "D-17 accent outline uses the same `ring-2 ring-[#3b82f6] ring-inset` token as `isSelected`. The cascade in `ringClass` places `isOverThisCell` BELOW `isPanMode` and `isSelected` so those two take precedence — drop-target highlight doesn't fight the orange pan-mode ring or the selected-cell ring."
  - "Used `isSourceOfDrag` (from dragStore) rather than `isDragging` (from useCellDraggable) for the GHOST-07 opacity rule. Symmetry with `isOverThisCell` and deterministic in tests that write dragStore directly."
  - "Left `touchAction: 'none'` on root style — this is Phase 25 code, CROSS-02 belongs to Phase 30 per deferred list, but the attribute was already present pre-plan and removing it now would be out of scope."
  - "Did NOT refactor the file structure (component hook ordering, useEffect consolidation, etc.). The plan is surgical — minimize diff to reduce review surface and regression risk."

patterns-established:
  - "Pattern: Scoped dragStore selector triad (isOverThisCell / isSourceOfDrag / activeZone) — reusable by any DnD-aware leaf component. Primitives only → Object.is equality → zero re-render overhead for non-participating cells."
  - "Pattern: rAF draw-loop drag guard — `if (dragState.sourceId === id && dragState.status === 'dragging') { rafIdRef.current = requestAnimationFrame(tick); return; }` at the top of the per-frame function. Prevents Pitfall 9 toDataURL race without touching the draw pipeline."

requirements-completed: [DRAG-01, DRAG-07, GHOST-07, DROP-01, DROP-04, DROP-05]

# Metrics
duration: ~5min
tasks: 1
files_modified: 1
completed: 2026-04-17
---

# Phase 28 Plan 08: LeafNode Surgical Rewire Summary

**Performed the 15-point surgical edit of `src/Grid/LeafNode.tsx` per D-20: stripped all Phase 25 DnD wiring (useDraggable/useDroppable/useDndMonitor, DragZoneRefContext, pointerPosRef, isPendingDrag, ActiveZone type, 5 inline zone JSX blocks, hold-pulse animation, isDragging box-shadow) and replaced with the Wave 2/3 hooks — `useCellDraggable(id)` + `useCellDropTarget(id)` — plus a single conditional `<DropZoneIndicators zone={activeZone} />` render driven by 3 scoped dragStore selectors. Added GHOST-07 source dim (opacity 0.4), D-17/DROP-04 2px accent outline on hovered target, DRAG-01 cursor:grab, and a Pitfall 9 belt-and-braces rAF pause on the drag-source video cell. File-drop triad (D-28) and the Pitfall 1 spread-listeners-last invariant preserved unchanged.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T12:30:48Z
- **Completed:** 2026-04-17T12:36:03Z (approx)
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- 30 insertions / 120 deletions in `src/Grid/LeafNode.tsx` — net -90 LOC.
- Zero occurrences of `useDraggable`, `useDroppable`, `useDndMonitor`, `DragZoneRefContext`, `pointerPosRef`, `isPendingDrag`, `type ActiveZone`, `edge-line-*`, `swap-overlay-`, `data-hold-pending` in the file (verified by ripgrep).
- `useCellDraggable(id)` called exactly once at line 315.
- `useCellDropTarget(id)` called exactly once at line 317.
- `<DropZoneIndicators zone={activeZone} />` rendered conditionally gated on `isOverThisCell` (line 666) — single replacement for the 5 inline zone JSX blocks.
- 3 scoped dragStore selectors in place: `isOverThisCell`, `isSourceOfDrag`, `activeZone` — all return primitives (boolean / string|null), so Object.is equality prevents unnecessary re-renders per ARCHITECTURE §3 / T-28-22.
- GHOST-07: `isSourceOfDrag ? { opacity: 0.4 } : {}` on root style (line 601).
- D-17 / DROP-04: ringClass chain now branches to `ring-2 ring-[#3b82f6] ring-inset` when `isOverThisCell` (and not already selected / pan-mode).
- DRAG-01: `cursor: isPanMode ? undefined : (isDragging ? 'grabbing' : 'grab')` (line 600) — always grab when not in pan mode.
- Pitfall 9 belt-and-braces: rAF tick reads `useDragStore.getState()` and short-circuits without drawing when `sourceId === id && status === 'dragging'`, preventing `toDataURL()` from racing an in-flight canvas draw on video source cells.
- Pitfall 1 preserved: `{...(!isPanMode ? dragListeners : {})}` spread LAST on the root JSX element, after all explicit `onPointerDown/Move/Up` handlers (line 624).
- D-28 file-drop triad unchanged: `handleFileDrop`, `handleFileDragOver` (with `dataTransfer.types.includes('Files')` guard), `handleFileDragLeave`, and their JSX bindings all intact.
- `npx tsc --noEmit` exits 0.
- Full test suite: **849 passed / 10 failed / 2 skipped / 4 todo** — delta vs Plan 06 baseline: **-1 passing, +1 failure** as explicitly expected by the plan (see "Expected Test-Baseline Delta" below).

## Task Commits

Task 1 — single `refactor` commit (no TDD cycle; surgical refactor of an existing file):

1. **Task 1:** `86bc197` — `refactor(28-08): surgical rewire of LeafNode DnD to src/dnd hooks (D-20)`

_No `test()` commit in this plan — per plan frontmatter, test rewrites live in Plan 10a/10b (D-21/D-22). This plan is pure refactor; acceptance is driven by the 19+ plan greps + `npx tsc --noEmit` + no-new-regressions beyond the deterministic GHOST-07 expectation swap._

## Files Created/Modified

- **`src/Grid/LeafNode.tsx`** — surgical edit map applied per D-20:
  - **Removed imports:** `useContext` (React), `ArrowLeftRight` (lucide), `useDraggable/useDroppable/useDndMonitor` (@dnd-kit/core), `DragZoneRefContext` (./CanvasWrapper).
  - **Added imports:** `useCellDraggable, useCellDropTarget, DropZoneIndicators, useDragStore` from `../dnd`.
  - **Removed types:** `type ActiveZone = 'top' | 'bottom' | ...`
  - **Removed state/refs:** `activeZone` useState, `isPendingDrag` useState, `dragZoneRef` useContext, `pointerPosRef` useRef + document pointermove listener.
  - **Added selectors:** `isOverThisCell`, `isSourceOfDrag`, `activeZone` via `useDragStore(…)`.
  - **Removed hooks:** `useDndMonitor({ onDragStart/onDragOver/onDragEnd/onDragCancel })` block, `isPendingDrag` pointerdown/up/cancel listeners.
  - **Replaced hooks:** `useDraggable({id, data})` → `useCellDraggable(id)`; `useDroppable({id, data})` → `useCellDropTarget(id)`.
  - **Added rAF guard:** dragStore source-check at the top of the video tick function.
  - **Modified root `style`:** removed `isDragging` boxShadow override, removed `isPendingDrag` animation, removed `data-hold-pending` attribute, changed cursor rule to `isPanMode ? undefined : (isDragging ? 'grabbing' : 'grab')`, added `isSourceOfDrag ? { opacity: 0.4 }` spread.
  - **Modified `ringClass`:** added `isOverThisCell ? 'ring-2 ring-[#3b82f6] ring-inset'` branch below isSelected.
  - **Replaced 5 inline zone JSX blocks** (lines ~720-756 of pre-plan file) with a single conditional: `{isOverThisCell && <DropZoneIndicators zone={activeZone} />}`.

## Decisions Made

1. **Applied the Pitfall 9 belt-and-braces guard** (Claude's Discretion per CONTEXT §A6). The plan's EDIT 19 marked this optional but recommended. Implementation: inside the rAF `tick()` function, read `useDragStore.getState()`, short-circuit the frame without calling `drawRef.current()` when this cell is the active drag source. Added `id` to the useEffect dependency array since the guard references it. Cost: one dragStore.getState() read per frame on video cells — negligible.
2. **Used `isSourceOfDrag` (dragStore) rather than `isDragging` (useCellDraggable) for GHOST-07.** Plan action §15 notes both would align, but using the dragStore selector keeps symmetry with `isOverThisCell` and is authoritative in tests that mutate dragStore directly.
3. **Preserved `touchAction: 'none'`** on the root style. It pre-existed in the Phase 25 code and CROSS-02 (touch-action) is explicitly deferred to Phase 30 — but removing the attribute now would be out-of-scope churn and could regress touch-drag activation. Leaving it untouched respects scope.
4. **Did NOT extract the rAF guard into a shared helper.** The guard is two lines + a comment. Extracting would cross the hook boundary into src/dnd/ territory and pollute that module with LeafNode-specific per-frame concerns. Inline is clearer.
5. **D-17 cascade ordering:** `isPanMode → isSelected → isOverThisCell → !mediaUrl`. Drop-target highlight ranks BELOW pan-mode (orange ring) and selected-cell (blue ring) so dragging onto a cell already in one of those states doesn't visually oscillate — the pre-existing highlight wins.

## Deviations from Plan

**None functionally.** The plan's 15 EDITs (actually numbered 1-20 in the plan text due to overlap with Pitfall/D-28 preservation blocks) were all applied verbatim. Two interpretive notes:

### Note 1 — Plan TODO edit numbering vs reality
The plan's EDIT 16 reads "listeners spread — Pitfall 1 invariant: KEEP AS-IS." The existing code at `LeafNode.tsx:662` was already correct per Pitfall 1. Confirmed post-edit at the rewritten line 624 — listeners still spread last.

### Note 2 — Video rAF guard placement
The plan's EDIT 19 suggested placing the guard at "the top of the per-frame loop function". The actual rAF loop was in the `tick()` inner function at lines ~254-258 of the pre-plan file. Guard inserted at the top of `tick()` before `drawRef.current()` — correct placement per spec.

## Expected Test-Baseline Delta (not a regression)

**Pre-plan baseline** (per Plan 06 SUMMARY): 850 passed / 9 failed (Phase 25 + ActionBar pre-existing failures scheduled for wholesale removal in Plan 10 per D-21/D-22).

**Post-plan result:** 849 passed / 10 failed.

**Delta analysis:** +1 failure. The single new failure is `src/test/phase25-touch-dnd.test.tsx > DRAG-02: Visual lift feedback > leaf root div has inset box-shadow and opacity:0.6 when isDragging=true`.

**Why this is expected, not a regression:**
- The test asserts Phase 25's `isDragging ? { opacity: 0.6, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.6)' }` style spread.
- Plan 28-08 EDIT 15 explicitly requires removing that style spread and replacing with GHOST-07's `isSourceOfDrag ? { opacity: 0.4 }`.
- The test lives inside `src/test/phase25-touch-dnd.test.tsx`, which Plan 10 DELETES WHOLESALE per D-21: "Tests deleted wholesale: `src/test/phase25-touch-dnd.test.tsx` (mocks `MouseSensor`/`TouchSensor`/`KeyboardSensor` with 500ms delay semantics)."
- The test is therefore already on the deletion list; its failure is the intended consequence of the Phase 25 → Phase 28 cutover (DND-04 "no parallel engines" — the old visual spec is invalidated in the same commit the new spec lands).

The other 9 failures match the pre-existing set in `.planning/phases/27-dnd-foundation/deferred-items.md` (action-bar 1, phase05-p02-cell-swap 3, phase22-mobile-header 1, phase25-touch-dnd 3 others, Grid/__tests__/ActionBar 1 = 9).

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 07 (CanvasWrapper DndContext mount — Wave 4 sibling)** — consumer-ready. LeafNode now reads `overId`/`sourceId`/`activeZone` from dragStore imperatively via scoped selectors; CanvasWrapper's `onDragStart`/`onDragOver`/`onDragEnd`/`onDragCancel` callbacks will write those fields via `useDragStore.getState().beginCellDrag/setOver/setGhost/end`.
- **Plan 09 (EditorShell `<DragPreviewPortal />` mount)** — unblocked. DragPreviewPortal reads dragStore fields that CanvasWrapper populates; LeafNode is now out of that loop entirely.
- **Plan 10a / 10b (test rewrites + integration)** — unblocked. The new stable test-ids (`drop-zones`, `drop-zone-{center,top,bottom,left,right}`) are rendered conditionally when `isOverThisCell` is true; integration tests can mutate dragStore directly to trigger render paths.
- **SC-3 grep** (`grep -r 'TouchSensor\|MouseSensor\|DragZoneRefContext\|useDndMonitor' src/`) now returns zero matches in LeafNode — the last Phase 25 DnD residue is cleared. Full SC-3 closure happens when Plan 07 finishes the CanvasWrapper cleanup.

## TDD Gate Compliance

This plan is a `refactor`, not a TDD cycle. No `test()` commit precedes the `refactor()` commit — by design:

- Behavioral tests for `useCellDraggable`, `useCellDropTarget`, and LeafNode integration live in Plan 10a/10b per D-30.
- Acceptance gates for this plan are:
  - `npx tsc --noEmit` clean — PASS
  - 19+ plan greps (positive + negative) — PASS
  - No NEW regressions beyond the deterministic GHOST-07 expectation swap in `phase25-touch-dnd.test.tsx` (documented above) — PASS

Plan frontmatter marks the plan as non-TDD (no `tdd="true"` attribute on Task 1).

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| Zero occurrences of `useDraggable`, `useDroppable`, `useDndMonitor`, `DragZoneRefContext`, `pointerPosRef`, `isPendingDrag`, `ActiveZone` in LeafNode.tsx | PASS (0 matches) |
| `useCellDraggable(id)` called exactly once | PASS (line 315) |
| `useCellDropTarget(id)` called exactly once | PASS (line 317) |
| `<DropZoneIndicators zone={activeZone} />` rendered exactly once, conditionally on `isOverThisCell` | PASS (line 666) |
| 3 scoped dragStore selectors: `isOverThisCell`, `isSourceOfDrag`, `activeZone` | PASS |
| `opacity: 0.4` applied when `isSourceOfDrag` (GHOST-07) | PASS (line 601) |
| `cursor: 'grab'` / `'grabbing'` applied via inline style (DRAG-01) | PASS (line 600) |
| D-17 ring class addition when `isOverThisCell` | PASS (ringClass cascade) |
| File-drop triad preserved (handleFileDragOver, handleFileDragLeave, handleFileDrop) | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| `npm run test -- --run` — no NEW regressions beyond expected | PASS (see Expected Test-Baseline Delta) |

## Known Stubs

None. LeafNode is fully wired to the new DnD engine. The end-to-end drag-and-drop user flow is NOT yet observable (DragPreviewPortal not mounted, DndContext not replaced in CanvasWrapper) — those land in Plan 07 (CanvasWrapper) and Plan 09 (EditorShell mount), both of which are independently tracked Phase 28 plans. This is not a stub — it's the declared Wave 4 architecture.

## Threat Flags

None. This plan:
- Removes network/auth/file surface: NO (only touches DnD wiring).
- Introduces new trust boundaries: NO.
- Changes schema at trust boundaries: NO.
- Mitigations per plan's threat_model:
  - T-28-21 (spread-first listeners regression): MITIGATED — grep confirms `{...(!isPanMode ? dragListeners : {})}` is the LAST prop on the root JSX element, after all explicit pointer handlers.
  - T-28-22 (object-returning selector re-render storm): MITIGATED — all 3 selectors return primitives.
  - T-28-23 (file-drop accidentally deleted): MITIGATED — grep confirms `handleFileDrop`, `handleFileDragOver`, `dataTransfer.types.includes('Files')` all present.
  - T-28-24 (testid spoof): ACCEPTED — client-side only, no new surface introduced.

## Self-Check: PASSED

- File `src/Grid/LeafNode.tsx` — FOUND (git log shows commit `86bc197` touched it)
- Commit `86bc197` — FOUND in `git log --oneline -3`:
  ```
  86bc197 refactor(28-08): surgical rewire of LeafNode DnD to src/dnd hooks (D-20)
  3b86936 chore: merge executor worktree (28-06)
  7bea84e docs(28-06): complete DropZoneIndicators 5-icon overlay plan
  ```
- Acceptance greps (run via ripgrep):
  - Negative set (useDraggable / useDroppable / useDndMonitor / DragZoneRefContext / pointerPosRef / isPendingDrag / type ActiveZone / edge-line- / swap-overlay- / data-hold-pending): **0 matches** ✓
  - Positive set (useCellDraggable(id) / useCellDropTarget(id) / `DropZoneIndicators zone={activeZone}` / isOverThisCell / isSourceOfDrag / opacity: 0.4 / handleFileDrop / handleFileDragOver / `dataTransfer.types.includes('Files')`): **11 matches total, all 9 distinct patterns present at least once** ✓
  - `grep 'cursor: isPanMode ? undefined : (isDragging ? \'grabbing\' : \'grab\')' src/Grid/LeafNode.tsx` → 1 match (DRAG-01) ✓
- Type check: `npx tsc --noEmit` → exit 0 ✓
- Test suite: 849 passed / 10 failed — +1 failure is the deterministic GHOST-07 expectation swap documented above ✓

---
*Phase: 28-cell-to-cell-drag*
*Plan: 08*
*Completed: 2026-04-17*
