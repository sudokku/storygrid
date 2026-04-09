---
phase: 09-improve-cell-movement-and-swapping
plan: 03
subsystem: grid-ui
tags: [ui, react, drag-and-drop, overlay, tdd, phase-9]
dependency-graph:
  requires:
    - src/store/gridStore.ts:moveCell (Plan 02)
    - src/store/editorStore.ts:canvasScale
    - src/Grid/ActionBar.tsx (drag source — unchanged, owned by Plan 04)
  provides:
    - src/Grid/LeafNode.tsx:activeZone state + 5-zone hit detection
    - src/Grid/LeafNode.tsx: edge-line-{top,bottom,left,right}-{id}, swap-overlay-{id} testids
  affects:
    - src/Grid/LeafNode.tsx handleDragOver/handleDragLeave/handleDrop behavior
tech-stack:
  added: []
  patterns:
    - "getBoundingClientRect-based zone math with 20% threshold + 20px minimum band"
    - "Canvas-scale-stable overlay rendering (4/canvasScale px, 32/canvasScale icon)"
    - "pointer-events-none on overlays to prevent drag event interception"
    - "Separation of cell-drag highlight (activeZone) vs file-drag highlight (isDragOver)"
key-files:
  created:
    - src/test/phase09-p03-leafnode-zones.test.ts
  modified:
    - src/Grid/LeafNode.tsx
decisions:
  - "Used ArrowLeftRight from lucide-react (present in installed v0.544.0 — no fallback needed)"
  - "swapCells selector fully removed from LeafNode.tsx — all cell drops route through moveCell (confirmed grep: 0 matches for 'swapCells' in LeafNode.tsx)"
  - "Test harness uses createEvent + Object.defineProperty for clientX/Y injection — jsdom's DragEvent constructor ignores MouseEventInit fields, so fireEvent.dragOver({clientX, clientY}) yields 0/0 coordinates at the handler (discovered during GREEN verification)"
  - "isDragOver (file-drop outline) intentionally does NOT fire during cell drags — the 5-zone overlay is the cell-drag affordance, avoiding visual double-highlighting"
metrics:
  duration: "8min"
  tasks: 2
  files_modified: 2
  tests_added: 12
  completed_date: "2026-04-08"
---

# Phase 9 Plan 3: LeafNode 5-Zone Hit Detection Summary

**One-liner:** `LeafNode` computes which of the 5 drop zones the cursor is over during a cell drag, renders an insertion-line or swap overlay, and dispatches `moveCell(fromId, id, zone)` on drop — making Plan 02's store action reachable from the UI.

## What Shipped

### `src/Grid/LeafNode.tsx`

- **Imports:** added `ArrowLeftRight` to the existing lucide-react import line.
- **New store selector:** `const canvasScale = useEditorStore(s => s.canvasScale)` so overlays remain visually stable under pinch-zoom.
- **Selector swap:** `swapCells` → `moveCell` (removed the old `useGridStore(s => s.swapCells)` line; grepped to confirm no other usages in the file).
- **New state:** `activeZone: 'top' | 'bottom' | 'left' | 'right' | 'center' | null` initialized to `null`.
- **`handleDragOver`:** branches on `dataTransfer.types.includes('text/cell-id')`.
  - Cell drag → runs zone math against `divRef.current.getBoundingClientRect()` with threshold `max(20, min(w,h) * 0.2)`; sets `activeZone`; does **not** flip `isDragOver` (that remains the file-drop indicator only).
  - File drag → unchanged; `setIsDragOver(true)` as before.
- **`handleDragLeave`:** now clears both `isDragOver` and `activeZone`.
- **`handleDrop`:** snapshots `activeZone` at drop time, clears it, then dispatches `moveCell(fromId, id, zoneAtDrop ?? 'center')` (fallback for safety). File-drop branch untouched. Guarded by existing `fromId !== id` check.
- **Overlay JSX:** 5 conditional blocks placed after the existing `drop-target` indicator, inside the cell wrapper (sibling of the canvas clip div), at `z-20`:
  - Edge lines: `position: absolute` pinned to the edge, `4 / canvasScale` px thickness, `#3b82f6` background.
  - Center: `absolute inset-0` with `rgba(0,0,0,0.4)` dim and a centered `ArrowLeftRight` icon at `32 / canvasScale` px.
  - All overlays carry `pointer-events-none` so they cannot swallow drag events (Pitfall 4 from 09-RESEARCH).

### `src/test/phase09-p03-leafnode-zones.test.ts` — 12 tests

- **ZONE-01..05** — each zone hit (top/bottom/left/right/center) renders the matching testid.
- **ZONE-06** — moving from top to center leaves only the center overlay (single-active invariant).
- **ZONE-07** — `dragLeave` clears all overlays.
- **ZONE-08** — top-edge drop calls `moveCell(fromId, id, 'top')` exactly once.
- **ZONE-09** — center drop calls `moveCell(..., 'center')` and **does not** invoke the swap action directly (routing through moveCell).
- **ZONE-10** (EC-12) — a file drag (`dataTransfer.types = ['Files']`) produces **none** of the 5-zone testids, and the legacy `drop-target-{id}` file-drop ring still appears.
- **ZONE-11** — dropping a cell onto itself (`fromId === id`) is a no-op; `moveCell` not called.
- **ZONE-12** — on a 60×60 cell, the 20px minimum band enforces correct top/center split at y=15 vs y=30.

## Lucide Icon Choice

**Used `ArrowLeftRight`** — verified present in the project's installed `lucide-react` (`grep -c "ArrowLeftRight" node_modules/lucide-react/dist/lucide-react.d.ts = 1`). No fallback to `MoveHorizontal` was needed.

## swapCells Removal — Fully Removed

`grep -c "swapCells" src/Grid/LeafNode.tsx` = **0** after the edit. The file no longer imports, selects, or invokes `swapCells`. The center-zone swap behavior is preserved end-to-end because Plan 02's `gridStore.moveCell` delegates `edge === 'center'` to the existing `swapLeafContent` pure helper internally.

`swapCells` itself remains in `gridStore.ts` and is still used by Phase 5 tests (`phase05-p02-cell-swap.test.ts`) — that test suite is unchanged and still green.

## Deviations from Plan

### [Rule 3 - Blocker] jsdom DragEvent ignores MouseEventInit fields

**Found during:** Task 2 GREEN verification.

**Issue:** The plan specified the standard `fireEvent.dragOver(el, { clientX, clientY, dataTransfer: {...} })` pattern from `phase05-p02-cell-swap.test.ts`. Running the tests, ZONE-01..04 and ZONE-06..08 + ZONE-12 all failed with "unable to find edge-line-top" — but ZONE-05 (center) passed. Root cause: jsdom implements `DragEvent` as a thin subclass that does **not** honor `MouseEventInit.clientX/clientY`. Every dragOver event arrived at the React handler with `clientX = clientY = 0`, so the rect math `(0 - 0) < threshold` → always `top`... wait, actually x=0 fell through to `left` zone, not center. Regardless, the wrong zone was active.

**Fix applied:** Added a helper `fireDragEventWithCoords` that:
1. Builds the event via `createEvent.dragOver(el, { dataTransfer })`
2. `Object.defineProperty`s `clientX`, `clientY`, and re-asserts `dataTransfer` on the event object
3. Calls `fireEvent(el, event)` directly

After the fix, all 12 tests pass. No production code change required.

**Files modified:** `src/test/phase09-p03-leafnode-zones.test.ts` (test-only; replaced the two `fireCellDragOver` / `fireCellDrop` wrapper bodies and the ZONE-10 file-drag dispatch).

**Commit:** `81a6daf` (combined with the LeafNode GREEN implementation because the harness adjustment was discovered during GREEN verification).

## Test Harness Adjustments

- **`getBoundingClientRect` mock:** polyfilled onto `Element.prototype` in `beforeEach` returning a 400×400 rect by default; overridden to 60×60 inside ZONE-12. `afterEach` calls `vi.restoreAllMocks()` which is a no-op for prototype mutation, so the subsequent test re-applies the 400×400 mock via `beforeEach`.
- **DataTransfer shape:** hand-rolled object with `types`, `getData`, `setData`, `files`, `items`, `dropEffect`, `effectAllowed`. jsdom has no `DataTransfer` constructor, so we inject the bare minimum the handler reads (`types`, `getData('text/cell-id')`).
- **Store action mocking:** followed the established Zustand-v5 pattern — `useGridStore.setState({ moveCell: vi.fn() })` — because `vi.spyOn` cannot redefine a Zustand v5 store action slot.

## Regression

- `src/test/phase09-p03-leafnode-zones.test.ts` — **12/12 pass**
- `src/test/phase09-p02-store-move.test.ts` — 9/9 pass (moveCell store action)
- `src/test/phase09-p01-cell-move.test.ts` — 18/18 pass (moveLeafToEdge primitive)
- `src/test/phase05-p02-cell-swap.test.ts` — 8/8 pass (swap regression baseline — `swapCells` action itself untouched)
- `src/test/phase05-p02-pan-zoom.test.tsx` — 18/18 pass + 2 skipped (LeafNode renders correctly; no drag-related regressions on the existing interaction code)
- `npx tsc --noEmit` — clean

## Commits

- `e40e642` — `test(09-03): add failing tests for LeafNode 5-zone detection (RED)`
- `81a6daf` — `feat(09-03): implement LeafNode 5-zone detection and moveCell dispatch (GREEN)`

## Self-Check: PASSED

- `src/test/phase09-p03-leafnode-zones.test.ts`: FOUND
- `src/Grid/LeafNode.tsx` activeZone state: FOUND (grep `activeZone` = 16 matches)
- `moveCell(fromId, id,` dispatch: FOUND (1 match)
- Testids `edge-line-top-`, `edge-line-bottom-`, `edge-line-left-`, `edge-line-right-`, `swap-overlay-`: all FOUND
- `#3b82f6` color literal: FOUND
- `4 / canvasScale` expression: FOUND (4 matches — one per edge line)
- `ArrowLeftRight` import: FOUND
- `pointer-events-none` on overlays: FOUND (5 matches — one per overlay div)
- `swapCells(fromId` in LeafNode.tsx: 0 matches — confirmed removed
- commit e40e642: FOUND
- commit 81a6daf: FOUND
- Phase 9 Plan 3 tests: 12/12 pass
- Phase 9 Plan 1 + Plan 2 regression: 27/27 pass
- Phase 5 swap regression: 8/8 pass
- Phase 5 pan-zoom regression: 18/18 pass + 2 skipped
- tsc --noEmit: clean
