---
phase: 25-touch-drag-and-drop
plan: 01
subsystem: drag-and-drop
tags: [touch, mobile, dnd-kit, sensor, gesture]
dependency_graph:
  requires:
    - src/store/gridStore.ts (moveCell action)
    - "@dnd-kit/core (MouseSensor, TouchSensor, KeyboardSensor, useDraggable, useDroppable, useDndMonitor)"
  provides:
    - DragZoneRefContext (shared ref for zone routing between LeafNode and CanvasWrapper)
    - TouchSensor-enabled drag (500ms hold + 5px tolerance)
    - useDndMonitor-based 5-zone detection with pointer position tracking
    - hold-pulse CSS keyframe animation
  affects:
    - src/Grid/CanvasWrapper.tsx (DndContext host)
    - src/Grid/LeafNode.tsx (draggable + droppable + zone detection)
    - src/Grid/ActionBar.tsx (visual-only grip handle)
    - src/index.css (keyframe animation)
tech_stack:
  added: []
  patterns:
    - "DragZoneRefContext: React context sharing MutableRefObject between DndContext host and useDndMonitor consumers"
    - "setRefs callback: merges divRef + setDragNodeRef + setDropNodeRef into one ref callback"
    - "pointerPosRef + document pointermove: tracks pointer coordinates for zone math inside useDndMonitor"
    - "File-drop separation: handleFileDrop/handleFileDragOver guard on dataTransfer.types.includes('Files')"
key_files:
  created: []
  modified:
    - src/Grid/CanvasWrapper.tsx
    - src/Grid/LeafNode.tsx
    - src/Grid/ActionBar.tsx
    - src/index.css
    - src/test/phase05-p02-cell-swap.test.ts
    - src/test/grid-rendering.test.tsx
    - src/test/phase05-p02-pan-zoom.test.tsx
    - src/test/phase09-p03-leafnode-zones.test.ts
    - src/Grid/__tests__/LeafNode.test.tsx
decisions:
  - "DragZoneRefContext chosen over DndContext.onDragOver data propagation — simpler, avoids dynamic useDroppable data updates per pointer move"
  - "pointerPosRef + document pointermove chosen for zone detection — useDndMonitor.onDragOver does not reliably expose current pointer coords"
  - "touchAction: none applied permanently on leaf cells — leaf divs are not scroll containers; pinch-to-zoom uses passive touchstart/touchmove listeners"
  - "File-drop separation guards on dataTransfer.types.includes('Files') — @dnd-kit pointer drags do not populate dataTransfer.files"
  - "Phase09 zone tests rewritten — old tests used native HTML5 dragOver with text/cell-id dataTransfer; new tests verify EC-12 file-drop coexistence and store contract"
metrics:
  duration: "12 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_modified: 9
---

# Phase 25 Plan 01: Touch Drag-and-Drop (@dnd-kit Migration) Summary

Migrated cell-to-cell drag-and-drop from native HTML5 drag events to @dnd-kit's unified sensor model, enabling touch drag on mobile (long-press 500ms) while preserving desktop mouse drag and desktop file-drop behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add DndContext with sensors in CanvasWrapper + hold-pulse CSS | 7f04308 | CanvasWrapper.tsx, index.css |
| 2 | Migrate LeafNode to @dnd-kit hooks + clean up ActionBar | 8c0b050 | LeafNode.tsx, ActionBar.tsx, 5 test files |

## What Was Built

**Task 1 — CanvasWrapper + CSS:**
- Added `DndContext` wrapping the canvas-surface div with `MouseSensor` (5px distance), `TouchSensor` (500ms delay + 5px tolerance), and `KeyboardSensor`
- Exported `DragZoneRefContext` — a React context holding a `MutableRefObject` that LeafNode's `useDndMonitor` writes the active drop zone to, and `onDragEnd` reads to call `moveCell`
- `onDragEnd` calls `moveCell(active.id, over.id, activeZoneRef.current)` and resets the ref to 'center'
- Added `@keyframes drag-hold-pulse` in `index.css` with `prefers-reduced-motion: reduce` fallback

**Task 2 — LeafNode + ActionBar:**
- Replaced HTML5 `handleDragOver`/`handleDragLeave`/`handleDrop` with `useDraggable` + `useDroppable` + `useDndMonitor`
- `useDndMonitor.onDragOver` tracks pointer position via `document.pointermove` + `pointerPosRef`, computes 5-zone hit detection, and writes zone to `DragZoneRefContext.activeZoneRef`
- `setRefs` callback merges `divRef` + `setDragNodeRef` + `setDropNodeRef`
- Root div spread with `dragListeners` and `dragAttributes`; `touchAction: 'none'` applied permanently; lift state (`scale(1.08)`, `opacity: 0.6`) on `isDragging`; hold-pulse animation on `isPendingDrag`
- Extracted file-drop as standalone `handleFileDrop`/`handleFileDragOver` (guards on `dataTransfer.types.includes('Files')`)
- Removed `moveCell` from LeafNode (now CanvasWrapper owns it)
- ActionBar drag handle button: removed `draggable` and `onDragStart`; GripVertical icon retained as visual affordance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useDndMonitor requires DndContext ancestor — test suite failures**
- **Found during:** Task 2 verification
- **Issue:** 49 tests that render `LeafNodeComponent` directly (without `CanvasWrapper`) failed with "useDndMonitor must be used within a children of DndContext"
- **Fix:** Added `withDnd()` wrapper helper and `DndContext` import to 4 test files: `grid-rendering.test.tsx`, `phase05-p02-pan-zoom.test.tsx`, `LeafNode.test.tsx`, `phase09-p03-leafnode-zones.test.ts`
- **Files modified:** 5 test files (including cell-swap test for draggable assertion update)
- **Commit:** 8c0b050

**2. [Rule 1 - Bug] phase09 zone tests used native HTML5 drag events no longer wired**
- **Found during:** Task 2 verification
- **Issue:** `phase09-p03-leafnode-zones.test.ts` tested `dragOver` events with `text/cell-id` dataTransfer — the mechanism that was removed. These 12 tests all failed.
- **Fix:** Rewrote the test file to: (a) verify EC-12 file-drop coexistence via native DragEvent (still valid), (b) verify moveCell store contract directly, (c) document that zone integration tests move to `phase25-touch-dnd.test.tsx` (Plan 02)
- **Files modified:** `src/test/phase09-p03-leafnode-zones.test.ts`
- **Commit:** 8c0b050

**3. [Rule 1 - Bug] MockResizeObserver.disconnect nullified roCallback — Test 5 failure**
- **Found during:** Task 2 verification
- **Issue:** Adding `DndContext` wrapper caused additional `useLayoutEffect` cleanup/re-run cycles which called `observer.disconnect()`, setting `roCallback = null` before Test 5 could fire it
- **Fix:** Removed the `roCallback = null` assignment from `MockResizeObserver.disconnect()` with explanatory comment
- **Files modified:** `src/Grid/__tests__/LeafNode.test.tsx`
- **Commit:** 8c0b050

### Pre-existing Issue (Not Caused by This Plan)

`phase22-mobile-header.test.tsx > Mobile Clear button: calls clearGrid without calling window.confirm` was failing before this plan (confirmed by baseline check). The Toolbar's `handleClearGrid` unconditionally calls `window.confirm` before `clearGrid` — the test expects no confirm on mobile. This is out of scope for Plan 25-01.

## Known Stubs

None. All functionality is fully wired:
- Zone detection: live via `useDndMonitor` + `pointerPosRef`
- Drop dispatch: live via `CanvasWrapper.onDragEnd` → `moveCell`
- File-drop: preserved via `handleFileDrop`/`handleFileDragOver`
- Hold-pulse: CSS keyframe defined; `isPendingDrag` state wired

## Threat Flags

No new threat surface introduced beyond the plan's threat model (T-25-01, T-25-02 already registered).

## Self-Check: PASSED

Files exist:
- src/Grid/CanvasWrapper.tsx — FOUND (contains DragZoneRefContext, DndContext, MouseSensor, TouchSensor)
- src/Grid/LeafNode.tsx — FOUND (contains useDraggable, useDroppable, useDndMonitor, handleFileDrop, touchAction)
- src/Grid/ActionBar.tsx — FOUND (drag handle has no draggable prop)
- src/index.css — FOUND (contains drag-hold-pulse keyframe)

Commits:
- 7f04308 — FOUND (Task 1)
- 8c0b050 — FOUND (Task 2)

TypeScript: `npx tsc --noEmit` exits 0
Test suite: 709 passed / 1 pre-existing failure (phase22) / 2 skipped / 4 todo — no new failures introduced
