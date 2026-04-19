---
phase: 30-mobile-handle-tray-polish
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/dnd/dragStore.ts
  - src/dnd/dragStore.test.ts
  - src/dnd/useCellDraggable.ts
  - src/dnd/useCellDraggable.test.ts
  - src/Editor/MobileCellTray.tsx
  - src/Editor/MobileCellTray.test.ts
  - src/Grid/CanvasWrapper.tsx
  - src/Grid/CanvasWrapper.test.ts
  - src/Grid/LeafNode.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-04-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase introduces drag-state sheet-snap persistence (`prevSheetSnapState`), mobile tray drag-visibility gating (`CROSS-08a`), and `useCellDraggable` style return (`CROSS-02/03`). The logic is sound and well-documented. Three warnings were found: a setTimeout leak in `CanvasWrapper`, a mutable-default-argument-style stale closure risk in `handleDragEnd`, and a missing drag-end cleanup path for the `beginCellDrag` + immediate `end()` (no-sourceId) guard branch that skips the cursor/listener reset if the context-menu listener was not yet added. Four informational items cover dead state, a silent cast, and test coverage gaps.

---

## Warnings

### WR-01: setTimeout in `handleDragEnd` is not cancelled on unmount — potential state update after unmount

**File:** `src/Grid/CanvasWrapper.tsx:155`

**Issue:** `setTimeout(() => useDragStore.getState().clearLastDrop(), 700)` is called on every successful drop but the returned timer ID is never stored or cancelled in the component's cleanup. If `CanvasWrapper` unmounts within 700 ms of a drop (e.g., the user navigates away), the callback fires on an orphaned store, which is benign in Zustand but also means `clearLastDrop` runs against potentially new drag state. More critically, if the component unmounts and remounts (strict-mode double-invoke), two timers can race.

**Fix:**
```tsx
// In CanvasWrapper, track the timer with a ref:
const dropFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleDragEnd, replace the bare setTimeout:
if (dropFlashTimerRef.current !== null) clearTimeout(dropFlashTimerRef.current);
dropFlashTimerRef.current = setTimeout(() => {
  useDragStore.getState().clearLastDrop();
  dropFlashTimerRef.current = null;
}, 700);

// Add a cleanup effect:
useEffect(() => () => {
  if (dropFlashTimerRef.current !== null) clearTimeout(dropFlashTimerRef.current);
}, []);
```

---

### WR-02: `handleDragEnd` reads `activeZone` from store snapshot that may be stale at call time

**File:** `src/Grid/CanvasWrapper.tsx:118`

**Issue:**
```ts
const { sourceId, activeZone } = useDragStore.getState();
```
`handleDragEnd` reads `activeZone` from the store at the point the callback fires, which is correct. However, the callback is wrapped in `useCallback([moveCell])` — `moveCell` is the only dependency. If `moveCell` ever becomes unstable (e.g., a selector change) and the callback is recreated while a drag is in flight, the captured `activeZone` is still read from `getState()` so there is no closure-capture issue. This is actually fine, but the code passes `activeZone ?? 'center'` to `moveCell` — if `handleDragMove` was never called (e.g., the user lifts immediately without moving), `activeZone` in the store is `null` and defaults silently to `'center'`. This means a tap-hold-release on a different cell always triggers a `center` merge even when the user did not consciously choose a zone. This may be the intended UX (center = swap), but if a no-movement drop should be a no-op, an explicit guard is needed.

**Fix:** Add a comment or explicit guard to make the intent clear:
```ts
// activeZone is null when pointer never moved after activation; 'center' (swap) is the intended fallback.
// If a zero-movement drop should cancel instead, replace ?? 'center' with an early return.
moveCell(sourceId, toId, activeZone ?? 'center');
```
This is low-severity but worth an explicit decision recorded in code.

---

### WR-03: `useCellDraggable` composed `onPointerDown` swallows `rawPointerDown` errors silently

**File:** `src/dnd/useCellDraggable.ts:47`

**Issue:**
```ts
onPointerDown: (e: Event) => {
  const pe = e as PointerEvent;
  useDragStore.getState().setPointerDown(pe.clientX, pe.clientY);
  rawPointerDown?.(e);
},
```
`rawPointerDown` is the dnd-kit internal sensor listener. If it throws (unlikely, but possible during sensor initialization), the error is silently swallowed because there is no try/catch and no error boundary at this layer. More practically: the cast `e as PointerEvent` is unchecked — if dnd-kit ever passes a non-pointer event to this listener, `pe.clientX` will be `undefined`, silently writing `NaN` to the store.

**Fix:**
```ts
onPointerDown: (e: Event) => {
  if (e instanceof PointerEvent) {
    useDragStore.getState().setPointerDown(e.clientX, e.clientY);
  }
  rawPointerDown?.(e);
},
```
The `instanceof` check eliminates the unsafe cast and prevents `NaN` from entering `pointerDownX/Y`.

---

## Info

### IN-01: `isDragging` from `useDraggable` is redundant with dragStore `isSource` in `LeafNode`

**File:** `src/Grid/LeafNode.tsx:296-312`

**Issue:** `LeafNodeComponent` destructures `isDragging` from `useCellDraggable` (which comes from `useDraggable`) and also reads `isSource` from `dragStore` (`s.sourceId === id && s.status === 'dragging'`). Both resolve to `true` for the same condition — the cell is being dragged. `isDragging` from dnd-kit is used only for the `z-50` and `animate-cell-wobble` class, while `isSource` is used for `opacity: 0.4`. Having two sources of truth for the same fact creates a maintenance burden — if one is ever out of sync with the other, the visual state will be inconsistent.

**Fix:** Prefer the dragStore-based `isSource` for all per-source-cell visual state, removing the dependency on `isDragging` from the dnd-kit hook:
```tsx
const isSource = useDragStore((s) => s.sourceId === id && s.status === 'dragging');
// Replace: ${isDragging ? 'z-50' : ''} and ${isDragging ? 'animate-cell-wobble' : ''}
// With:    ${isSource ? 'z-50' : ''}   and ${isSource ? 'animate-cell-wobble' : ''}
```

---

### IN-02: `handleDragEnd` no-sourceId early-return branch does not need to remove the `contextmenu` listener it never added

**File:** `src/Grid/CanvasWrapper.tsx:119-126`

**Issue:** The guard at line 119:
```ts
if (!sourceId) {
  useDragStore.getState().end();
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('contextmenu', suppressContextMenu, true);
  return;
}
```
This branch handles the case where `handleDragStart` returned early (the `dnd-ignore` guard). In that early-return path, the `contextmenu` listener was never added (`document.addEventListener` at line 100 is only reached after the early-return check). Calling `removeEventListener` for a listener that was never added is harmless (no-op per spec), but it is misleading to a reader and a maintenance hazard — if the listener is later moved, the cleanup here will incorrectly suppress removal elsewhere.

**Fix:** Either add a comment noting this is intentionally defensive, or track whether the listener was registered with a boolean flag:
```ts
// suppressContextMenu was never added in the dnd-ignore path; removeEventListener is a no-op here.
```

---

### IN-03: `CanvasWrapper.test.ts` is entirely `it.todo` — provides zero regression protection

**File:** `src/Grid/CanvasWrapper.test.ts:44-63`

**Issue:** All 7 test cases in this file are `it.todo` stubs. The file runs as part of the test suite but exercises no actual code. Until these are implemented (per the Wave 1 / Plan 30-03 intent), regressions in CROSS-04, CROSS-05, CROSS-06, and CROSS-07 will not be caught automatically.

**Fix:** This is tracked per the plan, but worth flagging so the orchestrator can verify the stubs are filled in before closing the phase. No code change needed now.

---

### IN-04: `MobileCellTray` file-upload handler does not revoke blob URLs for video media

**File:** `src/Editor/MobileCellTray.tsx:69`

**Issue:**
```ts
const blobUrl = URL.createObjectURL(file);
addMedia(newId, blobUrl, 'video');
```
A `blob:` URL is created and stored in the media registry. There is no corresponding `URL.revokeObjectURL` call when the media is removed or replaced. This is an existing pattern throughout the codebase (also present in `LeafNode.tsx`), so it is consistent — but it means blob URLs accumulate in the browser's memory for the lifetime of the page. Not a correctness bug in isolation, but worth noting for the v1.4 persistence/cleanup milestone.

**Fix:** When `removeMedia` is called for a blob URL, revoke it:
```ts
// In gridStore's removeMedia action (or in a cleanup effect):
const url = state.mediaRegistry[id];
if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
```
This is a wider codebase concern, not specific to this file.

---

_Reviewed: 2026-04-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
