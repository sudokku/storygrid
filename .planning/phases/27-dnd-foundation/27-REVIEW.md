---
phase: 27-dnd-foundation
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/dnd/index.ts
  - src/dnd/adapter/dndkit.ts
  - src/dnd/dragStore.ts
  - src/dnd/computeDropZone.ts
  - src/dnd/useCellDraggable.ts
  - src/dnd/useCellDropTarget.ts
  - src/dnd/DragPreviewPortal.tsx
  - src/dnd/DropZoneIndicators.tsx
  - src/dnd/computeDropZone.test.ts
  - src/dnd/dragStore.test.ts
  - src/store/__tests__/moveCell-noop-guards.test.ts
  - package.json
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 27 delivers the DnD foundation: a pure `dragStore` (Zustand, no middleware), a pure `computeDropZone` resolver, skeleton hooks/components wired for Phase 28, and a comprehensive test suite. The architecture is sound and the critical constraints from PITFALLS.md are well-enforced through comments and tests. No security or data-loss issues were found.

Three warnings were identified:

1. A degenerate zone-coverage gap in `computeDropZone` for cells at or below 20×20 viewport px — the `center`, `bottom`, `left`, and `right` zones become unreachable because the threshold clamp equals the cell dimension. The test suite masks this because it only checks that a valid zone is returned, not that all zones are reachable.
2. Both `useCellDraggable` and `useCellDropTarget` unconditionally `throw` — any accidental render of a component that calls these hooks before Phase 28 lands will produce an uncaught error with no recovery path.
3. The architecture-assertion tests in `dragStore.test.ts` use a relative file path (`'src/dnd/dragStore.ts'`) that silently passes if the CWD drifts from the project root, making the assertion a no-op rather than a hard failure.

---

## Warnings

### WR-01: computeDropZone — all zones except 'top' unreachable for cells ≤ 20×20 viewport px

**File:** `src/dnd/computeDropZone.ts:28-33`

**Issue:** The threshold is clamped at `Math.max(20, ...)`. When a cell's viewport-space dimensions are ≤ 20px (e.g. at extreme canvas zoom-out), `threshold` equals or exceeds `h` (and `w`). For a 20×20 cell: `threshold = max(20, min(20,20)*0.2) = 20`. The check `y < threshold` is `y < 20`, which is true for every y in [0, 19], so all pointer positions return `'top'` before any other check runs. The zones `center`, `bottom`, `left`, and `right` become completely unreachable.

The test in section 7 of `computeDropZone.test.ts` (the 20×20 degenerate case) only asserts that the returned value is a member of `VALID_ZONES` and that no exception is thrown — it does not assert that all five zones can be reached, so this gap passes CI silently.

At scale 0.2, a 300×600 logical-px cell maps to 60×120 viewport px (threshold=20), which is fine. However a smaller logical cell or a more aggressive zoom could produce viewport cells narrower than 100px, where threshold=20 starts to eat disproportionately into the zone space. At 40px wide, threshold=20 means the left and right bands alone consume the entire width — center is already unreachable for this width.

**Fix:** Lower the absolute minimum of the clamp or add an early-exit guard for degenerate cells, and add a test that asserts all five zones are reachable for nominal cell sizes:

```typescript
// Option A — lower the absolute minimum so center stays reachable:
const threshold = Math.max(10, Math.min(w, h) * 0.2);

// Option B — guard degenerate cells explicitly:
const minDim = Math.min(w, h);
if (minDim < 40) {
  // Cell too small for 5-zone split; collapse to top/bottom/left/right only
  if (y < h / 2) return 'top';
  return 'bottom';
}
const threshold = Math.max(10, minDim * 0.2);
```

The test should also be updated to verify reachability of all 5 zones at a nominal size (the existing section 6 sweep already covers this implicitly for 60×120, 150×300, 300×600, but the degenerate 20×20 test should be updated to explicitly assert the expected behavior rather than just "valid zone").

---

### WR-02: useCellDraggable and useCellDropTarget throw unconditionally — no recovery path

**File:** `src/dnd/useCellDraggable.ts:32`, `src/dnd/useCellDropTarget.ts:23`

**Issue:** Both hooks throw `Error(...)` unconditionally. If any component that calls these hooks is mounted before Phase 28 lands (e.g. during development, in a test environment that imports from `src/dnd`, or if a Phase 28 import is accidentally omitted), the entire React subtree will crash with an unhandled error and no error boundary will be able to recover because hooks cannot be conditionally called and `throw` inside a hook tears down the render.

```typescript
// Current — crashes any component that mounts with these hooks
export function useCellDraggable(_leafId: string): UseCellDraggableResult {
  throw new Error('useCellDraggable: implementation lands in Phase 28');
}
```

**Fix:** Return a no-op stub instead of throwing, so that components render safely in the skeleton state. The `isDragging: false` sentinel already makes the intent clear without crashing:

```typescript
export function useCellDraggable(_leafId: string): UseCellDraggableResult {
  // Phase 27 stub — real implementation lands in Phase 28.
  return {
    attributes: {},
    listeners: {},
    isDragging: false,
    setNodeRef: () => {},
  };
}

export function useCellDropTarget(_leafId: string): UseCellDropTargetResult {
  // Phase 27 stub — real implementation lands in Phase 28.
  return {
    isOver: false,
    setNodeRef: () => {},
  };
}
```

If the intent is to intentionally gate callers from using these before Phase 28, a `console.warn` is safer than a `throw` — it fails loudly in dev without crashing the app.

---

### WR-03: Architecture-assertion tests read a relative file path — silently pass if CWD is wrong

**File:** `src/dnd/dragStore.test.ts:238`, `src/dnd/dragStore.test.ts:248`

**Issue:** Both middleware-absence tests read the source file using a relative path:

```typescript
const src = await fs.readFile('src/dnd/dragStore.ts', 'utf-8');
```

If Vitest's working directory is not the project root (e.g., the test is run from a subdirectory or the `root` config changes), `readFile` will throw `ENOENT`. The test has no `try/catch`, so it will fail with a file-not-found error rather than an assertion failure. More critically, if the path resolves but to a different file, the regex assertions would incorrectly pass. The same pattern appears in `moveCell-noop-guards.test.ts:219`.

**Fix:** Use `process.cwd()` with an explicit project-relative path (the noop-guards test already does this correctly at line 219):

```typescript
// dragStore.test.ts — apply the same pattern as moveCell-noop-guards.test.ts:219
const src = await fs.readFile(`${process.cwd()}/src/dnd/dragStore.ts`, 'utf-8');
```

---

## Info

### IN-01: adapter/dndkit.ts exports only an empty object — consider not exporting at all until Phase 28

**File:** `src/dnd/adapter/dndkit.ts:31`

**Issue:** The file exports `export {}` as a skeleton. This is fine but creates a module that appears in the import graph with no surface area. Any consumer who accidentally imports from this path gets nothing and no TypeScript error. Since `index.ts` does not re-export from this file, the risk is low, but the empty export could confuse automated dependency analysis tools.

**Fix:** Either leave a comment at the top of `index.ts` noting that `adapter/dndkit.ts` is intentionally not re-exported until Phase 28, or remove the `export {}` and use a comment-only file. No code change is strictly required.

---

### IN-02: DragPreviewPortal and DropZoneIndicators return null with no props — type signatures will need to change in Phase 28

**File:** `src/dnd/DragPreviewPortal.tsx:13`, `src/dnd/DropZoneIndicators.tsx:14`

**Issue:** Both components are declared with zero props (`function DragPreviewPortal(): null`). Phase 28 will need to add props (e.g., `leafId` for `DropZoneIndicators`, `ghostDataUrl` or similar for `DragPreviewPortal`). Any call sites that consume these today without props will produce a TypeScript error when props are added in Phase 28, requiring a two-site change instead of one. This is a forward-compatibility note, not a current bug.

**Fix:** Consider adding a placeholder props type now, even if empty, so the addition of required props in Phase 28 is less surprising:

```typescript
// DragPreviewPortal.tsx
export type DragPreviewPortalProps = Record<string, never>; // Phase 28 will add props here
export function DragPreviewPortal(_props: DragPreviewPortalProps): null {
  return null;
}
```

No action required before Phase 28.

---

### IN-03: moveCell positive-control test — tree-mutation assertion is comment-only

**File:** `src/store/__tests__/moveCell-noop-guards.test.ts:208-211`

**Issue:** The positive control test (line 201) verifies `historyLength + 1` correctly, but its comment acknowledges that the `rootJSON` comparison may not detect a structural change when both leaf cells have no media (the swap is a no-op at the JSON level). The assertion is therefore incomplete for the empty-grid fixture state.

```typescript
// (For center/swap the structure is the same but mediaId swapped; JSON may differ if content differs.
//  At minimum, history advanced — that's the canary.)
```

If `moveCell` accidentally returned without mutating (e.g., a guard regression that allows `fromId === toId` to slip through for non-identical ids), the test would still pass as long as `pushSnapshot` was called. History advancing is a necessary but not sufficient indicator of correctness.

**Fix:** Pre-load distinct media into the two leaf cells in the fixture so that the JSON-level swap is observable, then assert `after.rootJSON !== before.rootJSON` as an additional check. This is a test quality improvement for Phase 27 or a follow-up.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
