---
phase: 23-bottom-sheet-redesign
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/Editor/MobileSheet.tsx
  - src/store/editorStore.ts
  - src/Editor/__tests__/phase05.1-p01-foundation.test.tsx
  - src/Editor/Toolbar.tsx
  - src/components/TemplatesPopover.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-04-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The five files form a cohesive unit: the new bottom-sheet toggle/tab-strip contract in `MobileSheet.tsx`, its backing store slice in `editorStore.ts`, the corresponding test suite, the mobile toolbar in `Toolbar.tsx`, and the `TemplatesPopover` component shared across toolbar breakpoints.

The MobileSheet refactor itself is clean and correctly implements the toggle/snap contract described in the phase plan. The store is well-structured. No security issues were found. Three warnings relate to correctness edge cases: a missing `key` prop on the `TemplatesPopover` wrapper in the mobile toolbar that prevents popover state reset on breakpoint change, an auto-expand effect that fires even when `selectedNodeId` was already set at mount (potentially overriding an intentional collapsed state), and a clear-canvas button in the mobile toolbar that bypasses the confirmation guard. Three informational items flag dead code, an incomplete test state reset, and a minor accessibility gap.

---

## Warnings

### WR-01: Mobile clear button bypasses confirmation guard

**File:** `src/Editor/Toolbar.tsx:79`

**Issue:** The desktop clear button (line 240) uses `handleClearGrid`, which calls `window.confirm(...)` before invoking `clearGrid()`. The mobile clear button calls `clearGrid` directly, skipping the destructive-action confirmation. A single mis-tap on mobile will erase the entire canvas with no warning.

**Fix:**
```tsx
// Replace the direct onClick on the mobile Trash2 button:
<button
  className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--foreground)]"
  onClick={handleClearGrid}   // ← use the guarded handler, not clearGrid
  aria-label="Clear canvas"
  data-testid="mobile-clear"
>
  <Trash2 size={20} />
</button>
```
`handleClearGrid` is already defined in the same component scope; no new logic is needed.

---

### WR-02: Auto-expand effect fires on mount when a node is already selected

**File:** `src/Editor/MobileSheet.tsx:29-31`

**Issue:** The `useEffect` dependency array is `[selectedNodeId, setSheetSnapState]`. On initial mount, if the store already has a non-null `selectedNodeId` (e.g., a restored session or a programmatic pre-selection), the effect runs immediately and forces `sheetSnapState` to `'full'`, ignoring whatever snap state the store had at mount time. This is likely intentional for the current scope, but the behavior is undocumented and will silently conflict with any future persisted snap-state feature.

**Fix:** Guard the effect to only trigger on transitions from null to a non-null id:

```tsx
const prevSelectedRef = React.useRef<string | null>(null);

useEffect(() => {
  if (selectedNodeId && prevSelectedRef.current === null) {
    setSheetSnapState('full');
  }
  prevSelectedRef.current = selectedNodeId;
}, [selectedNodeId, setSheetSnapState]);
```

Alternatively, document the current behavior explicitly with a comment so future maintainers do not add persistence without accounting for this.

---

### WR-03: TemplatesPopover open state not reset when switching between mobile and desktop breakpoints

**File:** `src/Editor/Toolbar.tsx:69-71`

**Issue:** `TemplatesPopover` manages its own `open` state internally. The mobile toolbar renders `<TemplatesPopover />` inside a wrapper `<div>`, while the desktop toolbar renders `<TemplatesPopover />` directly. When the viewport crosses the `767px` breakpoint, the component tree switches branch. However, because there is no shared `key` and no external `open` control, React may preserve the stale `open=true` state if the component instance is reused across re-renders (depending on tree position stability). If the popover is open when the user resizes, the dismiss-on-outside-click listener may be orphaned.

The cleaner fix is to lift the `open` state to the toolbar and pass it down, but a lower-risk fix is to add a stable key:

```tsx
// Mobile branch:
<div className="w-11 h-11 flex items-center justify-center">
  <TemplatesPopover key="mobile-templates" />
</div>

// Desktop branch:
<TemplatesPopover key="desktop-templates" />
```

This guarantees state reset on breakpoint switch.

---

## Info

### IN-01: Incomplete store state reset in test beforeEach

**File:** `src/Editor/__tests__/phase05.1-p01-foundation.test.tsx:55-73`

**Issue:** The `beforeEach` block resets `useEditorStore` state but omits several fields that exist in the store: `isPlaying`, `playheadTime`, `totalDuration`, `selectedOverlayId`, `showOverlays`. If any test in the file (or a test running before this suite) sets these fields, they may leak across tests, producing false passes or false failures in tests that indirectly render components sensitive to those values.

**Fix:** Add the missing fields to the reset:
```ts
useEditorStore.setState({
  // ... existing fields ...
  isPlaying: false,
  playheadTime: 0,
  totalDuration: 0,
  selectedOverlayId: null,
  showOverlays: true,
});
```

---

### IN-02: `WebkitOverflowScrolling: 'touch'` is a dead CSS property

**File:** `src/Editor/MobileSheet.tsx:71`

**Issue:** `-webkit-overflow-scrolling: touch` was removed in iOS 13 (2019). All supported browsers (Safari 15+, Chrome 90+, Firefox 90+) use momentum scrolling natively via the standard `overflow: auto/scroll` path. The property is harmless but adds noise.

**Fix:** Remove line 71 (`WebkitOverflowScrolling: 'touch'`).

---

### IN-03: `aria-haspopup="true"` on TemplatesPopover button should use a semantic value

**File:** `src/components/TemplatesPopover.tsx:147`

**Issue:** `aria-haspopup="true"` is equivalent to `aria-haspopup="menu"` per the ARIA spec, but the popover renders a grid of buttons, not a menu role. Screen readers will announce it as a menu trigger, which mismatches the actual widget. This is a minor accessibility inaccuracy.

**Fix:**
```tsx
aria-haspopup="dialog"
```
Or, if the popover is considered a listbox/grid, use `aria-haspopup="listbox"`. `"dialog"` is the most defensible choice for a floating panel that is not a menu.

The same issue appears in `src/Editor/Toolbar.tsx:138` for the Add Overlay button.

---

_Reviewed: 2026-04-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
