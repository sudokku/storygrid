---
phase: 27-dnd-foundation
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/dnd/DragPreviewPortal.tsx
  - src/dnd/DropZoneIndicators.tsx
  - src/dnd/adapter/dndkit.ts
  - src/dnd/computeDropZone.test.ts
  - src/dnd/computeDropZone.ts
  - src/dnd/dragStore.test.ts
  - src/dnd/dragStore.ts
  - src/dnd/index.ts
  - src/dnd/useCellDraggable.ts
  - src/dnd/useCellDropTarget.ts
  - src/store/__tests__/moveCell-noop-guards.test.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-04-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found (info-only — no bugs or security issues)

## Summary

Phase 27 delivers the `src/dnd/` module skeleton plus two real implementations (`computeDropZone`, `dragStore`) and a regression lock test for `moveCell` no-op guards. The intentional stubs (DragPreviewPortal, DropZoneIndicators, adapter/dndkit, useCellDraggable, useCellDropTarget) are correctly scoped — throw-on-use for hooks and render-null for components — and were excluded from review per phase-brief guidance.

The two real source files (`computeDropZone.ts`, `dragStore.ts`) are small, pure, idiomatic, and well-documented. Test coverage is thorough: `computeDropZone.test.ts` includes a no-dead-space property sweep at three canvas scales, strict-boundary `±1px` transitions, and a degenerate-cell test. `dragStore.test.ts` exercises all state transitions, 100-cycle cross-isolation, middleware-absence source assertions, and action-reference stability. `moveCell-noop-guards.test.ts` correctly decomposes the two early-return statements into 5 observable guard scenarios and adds a positive control.

**No bugs, no security issues, no correctness concerns.** Four info-level findings relate to test robustness and minor code-style polish. None are blocking.

## Info

### IN-01: Middleware-absence regex guards are overly broad

**File:** `src/dnd/dragStore.test.ts:243-258`
**Issue:** The `/immer/i` and `/persist/i` regexes match any substring, including comment prose. Example: if a future docblock adds the sentence "state does not persist across reloads" or "no Immer middleware — this store is vanilla", the word-level match would flip the test red even though the architectural guarantee still holds. Today's source does not trip this (the docblock at `dragStore.ts:5-8` uses "history / draft / storage" not "immer" or "persist"), but the guard is one stray comment away from a false positive.
**Fix:** Tighten to match only real import or usage forms, e.g.:
```ts
// Only match import statements and identifier references, not prose.
expect(src).not.toMatch(/from\s+['"][^'"]*immer[^'"]*['"]/);
expect(src).not.toMatch(/\bimmer\s*\(/);  // usage as a function
// Similarly for persist:
expect(src).not.toMatch(/from\s+['"]zustand\/middleware['"][^;]*\bpersist\b/);
expect(src).not.toMatch(/\bpersist\s*\(/);
```
Or alternatively, assert on the parsed AST / import list if a test helper already exists.

### IN-02: Redundant weaker assertion in positive-control test

**File:** `src/store/__tests__/moveCell-noop-guards.test.ts:231-238`
**Issue:** Line 238 asserts `expect(after.historyLength).toBeGreaterThan(before.historyLength)`, which is strictly weaker than the `toBe(before.historyLength + 1)` assertion two lines above (231). If the stricter assertion passes the weaker one trivially follows; if it fails the weaker one is never evaluated. The comment on lines 233-237 explains the right idea (JSON-identity can't be asserted because two empty leaves swap to byte-identical content), but the follow-up assertion doesn't add coverage.
**Fix:** Drop the redundant line, or replace it with a meaningful check such as asserting the snapshot that was pushed equals the pre-call root serialization:
```ts
// Already covered by line 231; this line can be removed:
// expect(after.historyLength).toBeGreaterThan(before.historyLength);
```

### IN-03: Unnecessary type cast on editorStore reset

**File:** `src/store/__tests__/moveCell-noop-guards.test.ts:85-87`
**Issue:** The `beforeEach` resets `selectedNodeId` via `useEditorStore.setState({ selectedNodeId: null } as Parameters<typeof useEditorStore.setState>[0])`. The `as Parameters<...>[0]` cast is present because `editorStore`'s state type probably includes actions, and the partial-state overload needs the cast. However, the same file uses the typed action `useEditorStore.getState().setSelectedNode(target)` on lines 124, 145, 164, 203 — so the public API for clearing selection is `setSelectedNode(null)`, which avoids the cast entirely.
**Fix:**
```ts
beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.getState().setSelectedNode(null);
});
```

### IN-04: Stub behavior is inconsistent between hooks and components

**File:** `src/dnd/DragPreviewPortal.tsx:13-15`, `src/dnd/DropZoneIndicators.tsx:14-16`
**Issue:** The hook stubs (`useCellDraggable`, `useCellDropTarget`) throw loudly on invocation, which correctly catches accidental consumption before Phase 28. The component stubs (`DragPreviewPortal`, `DropZoneIndicators`) silently render `null`. A consumer who imports and mounts these components before Phase 28 will see nothing on screen with no warning in the console — harder to diagnose than a thrown error. This is a deliberate choice (a component that throws at render would crash the tree under an error boundary) but the two strategies diverge in their failure mode.
**Fix:** Optional. Either accept the current split (safer at mount time), or add a dev-mode warning for the component stubs so accidental mounting is visible:
```tsx
export function DragPreviewPortal(): null {
  if (import.meta.env.DEV) {
    console.warn('[dnd] DragPreviewPortal stub rendered — implementation lands in Phase 28');
  }
  return null;
}
```
No action required if the barrel re-export is considered sufficient insulation until Phase 28 wires the real implementations.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
