---
phase: 31-improve-mobile-interactions-ui-ux
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/Editor/CanvasArea.tsx
  - index.html
  - src/Grid/Divider.tsx
  - src/test/divider.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-04-19
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase introduces mobile touch improvements: a 40px hit area on dividers (`touchAction: none` scoped to the hit zone), pointer-capture-based drag, and `touchAction: none` on the workspace `<main>` element. The implementation is mostly correct. Three issues warrant attention before shipping: a missing `onPointerCancel` handler that can leave drag state stuck on mobile, a silent no-op assertion in the test suite that masks a regression risk, and a fragile `style.transform` override that competes with Tailwind's composed transform system.

---

## Warnings

### WR-01: Missing `onPointerCancel` handler — drag state never cleaned up on mobile cancellation

**File:** `src/Grid/Divider.tsx:114-116`

**Issue:** Pointer capture is set in `handlePointerDown` via `setPointerCapture`. On mobile, the browser can cancel a pointer (e.g., when the OS takes over a gesture, an incoming call interrupts, or a scroll takes priority). When `pointercancel` fires, the captured pointer is released but `dragState.current` and `lastSizesRef.current` are never reset. On the next drag interaction, `handlePointerMove` will compute a delta relative to a stale `startPos` from the previous aborted drag, producing a large spurious resize jump.

**Fix:** Add an `onPointerCancel` handler that mirrors `handlePointerUp`'s cleanup but skips the store commit:

```tsx
const handlePointerCancel = useCallback(() => {
  lastSizesRef.current = null;
  dragState.current = null;
  onLocalSizesChange(null);
}, [onLocalSizesChange]);

// In JSX:
onPointerCancel={handlePointerCancel}
```

---

### WR-02: `style.transform` on grab handle overwrites Tailwind's composed transform

**File:** `src/Grid/Divider.tsx:139`

**Issue:** Tailwind v3 composes transforms via CSS variables (`--tw-translate-x`, `--tw-translate-y`, etc.) and outputs a single `transform` property combining all active utilities. The inline `style.transform` on line 139 sets `transform` directly, bypassing the CSS variable chain and overwriting whatever Tailwind had composed. Currently this works because the inline style manually re-implements the same translation (`translateX(-50%)` / `translateY(-50%)`), but it is fragile: adding any future Tailwind transform utility to this element (rotate, skew, additional translate) will be silently discarded at runtime.

The visual result is correct today, but the pattern is unsafe.

**Fix:** Either use a CSS custom property to pass the scale and compose it in the className, or use `transform` consistently from a single source. The simplest fix is to remove the Tailwind translate classes and keep everything in `style`:

```tsx
style={{
  transform: isVerticalContainer
    ? `translateX(-50%) scale(${1 / canvasScale})`
    : `translateY(-50%) scale(${1 / canvasScale})`,
}}
// Remove: left-1/2 -translate-x-1/2 / top-1/2 -translate-y-1/2 from className
// Replace position centering with: left-1/2 or top-1/2 (positioning only)
```

---

### WR-03: Test assertion at line 98 is a silent no-op due to incorrect optional chaining

**File:** `src/test/divider.test.tsx:98`

**Issue:** The assertion `expect(useGridStore.getState().resize).not.toHaveBeenCalled?.()` uses optional chaining (`?.()`) on the `.not.toHaveBeenCalled` getter. In Vitest, `.toHaveBeenCalled` is a method — `not.toHaveBeenCalled` resolves to a function, and `?.()` calls it, so it does actually execute. However, the result is truthy regardless, meaning if someone accidentally called `resize` during a `pointerMove`, this assertion would NOT catch it — because the `?.()` silently returns `undefined` if the property happened to be nullish, and in non-nullish cases produces no useful failure signal compared to a direct call.

More specifically: Vitest's `expect` proxy makes `.not.toHaveBeenCalled` a bound assertion function. Calling it with `?.()` rather than `()` is harmless in the non-nullish path, but the intent is unclear and the optional chaining implies the author was unsure whether the method exists — which can mask future refactors that break the mock setup (e.g., `resize` is no longer a spy).

**Fix:** Remove the optional chaining so the assertion is explicit and will fail loudly if the spy setup breaks:

```ts
// Before
expect(useGridStore.getState().resize).not.toHaveBeenCalled?.();

// After
expect(useGridStore.getState().resize).not.toHaveBeenCalled();
```

---

## Info

### IN-01: `touchAction: none` on `<main>` disables all touch scrolling globally

**File:** `src/Editor/CanvasArea.tsx:85`

**Issue:** `style={{ touchAction: 'none' }}` is applied unconditionally to the `<main>` wrapper. This prevents the browser from handling any touch gesture (pan, pinch-zoom) anywhere in the workspace, not just on active dividers. For a fixed-canvas app where scrolling is not needed, this is likely intentional — but it means any future scrollable region (e.g., a panel, a media tray) added inside `<main>` will silently fail to scroll on touch without an explicit override. The divider hit area already sets its own `touchAction: none`, which is sufficient for the drag use case.

**Suggestion:** Document the intent with a comment, or consider applying `touchAction: none` only to the canvas container rather than the outer `<main>` element, to leave room for future nested scroll contexts.

---

### IN-02: Stale scaffold title in `index.html`

**File:** `index.html:7`

**Issue:** The `<title>` tag reads `storygrid_scaffold`, which is a development placeholder. This will appear in browser tabs, bookmarks, and search engine results if the app is deployed without updating it.

**Fix:**
```html
<title>StoryGrid</title>
```

---

_Reviewed: 2026-04-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
