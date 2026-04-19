---
phase: 29-esc-cancel-visual-polish
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/dnd/DragPreviewPortal.tsx
  - src/dnd/dragStore.test.ts
  - src/dnd/dragStore.ts
  - src/Grid/CanvasWrapper.tsx
  - src/Grid/LeafNode.tsx
  - src/index.css
  - tailwind.config.js
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-04-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files reviewed covering the ESC-cancel drag feature and visual polish work (drop-flash animation, cell-wobble animation, ghost overlay, grab-point modifier). The drag store itself is clean and well-structured. The critical bug is in `CanvasWrapper.tsx`: `setLastDrop` is immediately nulled by `end()` within the same synchronous flush, so the drop-flash animation never fires. Two warnings cover an unguarded `window.matchMedia` call and a missing keyframe animation for `drag-hold-pulse`. Two info items cover duplicated keyframe definitions and a magic-number timeout.

---

## Critical Issues

### CR-01: `setLastDrop` immediately overwritten by `end()` — drop-flash animation never fires

**File:** `src/Grid/CanvasWrapper.tsx:127-128`

**Issue:** `setLastDrop(toId)` and `end()` are called back-to-back synchronously. `end()` spreads `INITIAL_STATE` (see `dragStore.ts:78`), which includes `lastDropId: null` (line 70 of `dragStore.ts`). Zustand processes both `set()` calls synchronously, so the net Zustand state when React re-renders is `lastDropId: null`. `LeafNode`'s `isLastDrop` selector (`s.lastDropId === id`, line 311 of `LeafNode.tsx`) therefore always sees `null`, `animate-drop-flash` is never applied, and the drop-flash animation is dead code.

The comment at line 124 acknowledges the ordering requirement ("setLastDrop BEFORE end() — end() resets all fields including lastDropId") but the fix was applied in the wrong direction: the intent was for `end()` NOT to reset `lastDropId`, but the implementation still includes `lastDropId` in `INITIAL_STATE`.

**Fix:** Remove `lastDropId` from the `INITIAL_STATE` spread inside `end()` so it is preserved across the drag-end transition. The safest approach is to exclude it explicitly:

```ts
// dragStore.ts — end action
end: () =>
  set((s) => ({
    ...INITIAL_STATE,
    lastDropId: s.lastDropId,   // preserve; cleared separately via clearLastDrop()
  })),
```

Then the existing `setTimeout(() => useDragStore.getState().clearLastDrop(), 700)` in `CanvasWrapper.tsx` handles the cleanup correctly and no further changes are needed there.

Alternatively, remove `lastDropId` from `INITIAL_STATE` entirely and reset it explicitly in `beginCellDrag` if required for the next drag cycle.

---

## Warnings

### WR-01: `window.matchMedia` called on every render without memoization

**File:** `src/dnd/DragPreviewPortal.tsx:64-66`

**Issue:** `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is evaluated on every render of `DragPreviewPortal`. While `prefers-reduced-motion` changes rarely, calling `window.matchMedia(...)` on each render creates a new `MediaQueryList` object each time and prevents the component from responding to live changes (since `.matches` is a snapshot). More importantly, if this component re-renders frequently (e.g., on every pointer-move during a drag via dragStore subscriptions), this is wasteful.

**Fix:** Hoist to a module-level constant or use a `useMemo`/`useRef`:

```ts
// At module level, outside the component:
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Or, for reactivity to OS-level changes:

```ts
const prefersReducedMotion = useMemo(
  () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  []
);
```

---

### WR-02: `drag-hold-pulse` keyframes defined in CSS but no corresponding Tailwind animation utility

**File:** `src/index.css:107-110`

**Issue:** `@keyframes drag-hold-pulse` is defined in `index.css` and consumed by `[data-hold-pending="true"]` via a bare CSS selector. This animation is not registered in `tailwind.config.js` under `animation` or `keyframes`, unlike `cell-wobble` and `drop-flash`. If a component ever uses `animate-drag-hold-pulse` as a Tailwind class it will silently do nothing. The current usage via `[data-hold-pending="true"]` CSS attribute selector sidesteps this, but the pattern is inconsistent with how the other two animations are wired.

Additionally, nothing in the reviewed files sets `data-hold-pending="true"` on any element, making this animation unreachable from the current codebase.

**Fix:** Either register the animation in `tailwind.config.js` alongside the other two, or remove the keyframe if the hold-pending feature is deferred. If it is in-scope for this phase, verify that some component actually writes `data-hold-pending="true"`.

---

## Info

### IN-01: `drop-flash` keyframes duplicated between `index.css` and `tailwind.config.js`

**File:** `src/index.css:119-122` and `tailwind.config.js:69-72`

**Issue:** The `drop-flash` keyframe is defined twice with identical values — once in raw CSS (`index.css`) and once in `tailwind.config.js` under `theme.extend.keyframes`. At runtime, Tailwind emits the keyframe from the config into the generated CSS, resulting in two identical `@keyframes drop-flash` blocks in the final stylesheet. Browsers deduplicate these but the redundancy adds noise and risks divergence if one is updated without the other.

**Fix:** Remove the raw `@keyframes drop-flash` block from `index.css` (lines 119-122). The Tailwind config version is the authoritative source since `animate-drop-flash` is the consuming utility class.

The same applies to `cell-wobble` (defined in both `index.css:112-117` and `tailwind.config.js:63-68`).

---

### IN-02: Magic-number 700ms timeout in `handleDragEnd` not aligned with a named constant

**File:** `src/Grid/CanvasWrapper.tsx:131`

**Issue:** The `700` ms value passed to `setTimeout` for clearing the drop-flash is a magic number. The comment attributes it to "Atlassian largeDurationMs" but this is not enforced as a shared constant. The `tailwind.config.js` animation duration for `drop-flash` is also `700ms` (line 60 pattern not shown, but the animation is `drop-flash 700ms ease-out`). If either value changes, the timeout and the CSS animation will fall out of sync.

**Fix:** Extract a shared constant — either at the module level in `CanvasWrapper.tsx` or in a shared `dnd/constants.ts` — and reference it in both the `setTimeout` call and (via a CSS variable or Tailwind arbitrary value) the animation duration:

```ts
// e.g., at top of CanvasWrapper.tsx
const DROP_FLASH_MS = 700;
// ...
setTimeout(() => useDragStore.getState().clearLastDrop(), DROP_FLASH_MS);
```

---

_Reviewed: 2026-04-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
