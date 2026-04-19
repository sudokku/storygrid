---
phase: 29-esc-cancel-visual-polish
plan: "03"
subsystem: dnd
tags: [drag-and-drop, animation, keyboard, esc-cancel, ghost, visual-polish]
dependency_graph:
  requires:
    - dragStore.pointerDownX
    - dragStore.pointerDownY
    - dragStore.lastDropId
    - dragStore.setPointerDown
    - dragStore.setLastDrop
    - dragStore.clearLastDrop
    - --ghost-cap CSS variable
    - animate-drop-flash Tailwind utility
  provides:
    - KeyboardSensor wired in CanvasWrapper (ESC-cancel enabled)
    - grabOffsetModifier reads pointerDownX/Y from dragStore
    - DragOverlay snap-back animation 200ms ease-in
    - ghost opacity 20% + 200px size cap
    - handleDragEnd setLastDrop-before-end ordering (drop flash)
  affects:
    - src/Grid/LeafNode.tsx (reads lastDropId for animate-drop-flash — Plan 29-04)
tech_stack:
  added: []
  patterns:
    - "KeyboardSensor added to useSensors alongside PointerSensor for ESC-cancel (CANCEL-01)"
    - "grabOffsetModifier reads from useDragStore.getState() instead of activatorEvent for true grab-point (D-01/D-02)"
    - "dropAnimation config object { duration: 200, easing: 'ease-in' } on DragOverlay with prefersReducedMotion guard"
    - "setLastDrop(toId) called before end() in handleDragEnd — end() resets lastDropId so ordering is critical"
key_files:
  created: []
  modified:
    - src/dnd/DragPreviewPortal.tsx
    - src/Grid/CanvasWrapper.tsx
decisions:
  - "grabOffsetModifier guard: if pointerDownX/Y === 0 return transform unchanged — keyboard drags have no pointer coords and the centred overlay is correct for keyboard nav"
  - "prefersReducedMotion check uses window.matchMedia at render time — no React state needed for a one-time read"
  - "handleDragEnd refactored to early-return pattern for each guard branch — each branch owns its own end()+cursor reset, making the setLastDrop-before-end order unambiguous on the success path"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 29 Plan 03: DragPreviewPortal + CanvasWrapper orchestration Summary

**ESC-cancel via KeyboardSensor, snap-back dropAnimation 200ms ease-in, ghost opacity 20% + 200px cap, grabOffsetModifier reads true grab-point from dragStore, drop-flash setLastDrop ordering fixed**

## What Was Built

Two orchestration files updated to wire all Phase 29 drag UX improvements:

**DragPreviewPortal.tsx:**
- `grabOffsetModifier` now reads `useDragStore.getState().pointerDownX/pointerDownY` instead of `activatorEvent` — captures the true grab point before the 8px/250ms sensor threshold fires
- Keyboard guard: when `pointerDownX === 0 && pointerDownY === 0` (keyboard-initiated drag), returns transform unchanged so overlay stays centred
- `DragOverlay` now has `dropAnimation={{ duration: 200, easing: 'ease-in' }}` with `prefersReducedMotion` guard (null when reduced motion preferred)
- Ghost `<img>` opacity changed from 1.0 to 0.2 so drop-zone indicators show through
- Ghost `<img>` gets `className="max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)]"` referencing the `--ghost-cap: 200px` CSS variable from Plan 02

**CanvasWrapper.tsx:**
- `KeyboardSensor` imported from `@dnd-kit/core` and added to `useSensors(touchSensor, mouseSensor, keyboardSensor)` — enables ESC key to fire `onDragCancel` during active drag
- `handleDragEnd` refactored to early-return pattern: each guard branch (no sourceId, no over, same-cell drop) owns its own `end()` + cursor reset
- On the success path: `setLastDrop(toId)` called BEFORE `end()` so the flash selector in LeafNode reads a non-null `lastDropId` in the same render cycle
- `setTimeout(() => useDragStore.getState().clearLastDrop(), 700)` schedules flash cleanup

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix grabOffsetModifier, dropAnimation, ghost opacity and size cap | 26b1745 | src/dnd/DragPreviewPortal.tsx |
| 2 | Add KeyboardSensor and fix handleDragEnd ordering | 10208fc | src/Grid/CanvasWrapper.tsx |

## Verification

- `grep -n "activatorEvent" src/dnd/DragPreviewPortal.tsx` — no code references (only in comments describing the old approach)
- `grep -n "opacity: 0.2" src/dnd/DragPreviewPortal.tsx` — match found
- `grep -n "pointerDownX" src/dnd/DragPreviewPortal.tsx` — match found in modifier implementation
- `grep -n "KeyboardSensor" src/Grid/CanvasWrapper.tsx` — matches in import and useSensor call
- `grep -n "setLastDrop\|end()" src/Grid/CanvasWrapper.tsx` — setLastDrop (line 127) before end() (line 128) on success path
- `npx tsc --noEmit` exits 0 — no type errors
- `npx vitest run` — 808 pass, 8 skip, 4 todo; 3 pre-existing failures in ActionBar/mobile-header tests unrelated to this plan

## Deviations from Plan

None — plan executed exactly as written. All three changes in Task 1 and both changes in Task 2 applied as specified.

## Pre-existing Test Failures (Out of Scope)

3 tests were failing before this plan's changes and remain failing:
- `src/test/action-bar.test.tsx` — "renders Upload button as the first non-drag button (D-07)"
- `src/Grid/__tests__/ActionBar.test.tsx` — "Test 4: All 7 buttons render with correct aria-labels"
- `src/test/phase22-mobile-header.test.tsx` — "calls clearGrid without calling window.confirm"

These are pre-existing failures in ActionBar and mobile header components, unrelated to DnD orchestration. Logged per deviation scope boundary rule — not fixed.

## Known Stubs

None. Both files perform real logic — no placeholder values or hardcoded empty returns.

## Threat Flags

None. All changes are within the trust boundaries documented in the plan's threat model. `over.id` derives from dnd-kit's internal ID system sourced from app-controlled `data-*` attributes (T-29-03: accepted). The 700ms `setTimeout` is a single non-accumulating timer (T-29-04: accepted).

## Self-Check: PASSED

- `src/dnd/DragPreviewPortal.tsx` — modified, contains `pointerDownX`, `opacity: 0.2`, `max-w-[var(--ghost-cap)]`, `dropAnimation`
- `src/Grid/CanvasWrapper.tsx` — modified, contains `KeyboardSensor`, `keyboardSensor`, `setLastDrop`, `clearLastDrop`
- Commit `26b1745` — feat(29-03): update DragPreviewPortal
- Commit `10208fc` — feat(29-03): add KeyboardSensor and fix handleDragEnd ordering
