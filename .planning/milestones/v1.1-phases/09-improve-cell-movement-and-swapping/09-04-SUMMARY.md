---
phase: 09-improve-cell-movement-and-swapping
plan: 04
subsystem: Grid/ActionBar + tests
tags: [actionbar, drag-handle, ec-06, regression-test]
requires:
  - gridStore.moveCell (09-02)
provides:
  - ActionBar drag handle renders on empty cells
  - Phase 5 cell-swap regression updated for relaxed EC-06 gate
affects:
  - src/Grid/ActionBar.tsx
  - src/test/phase05-p02-cell-swap.test.ts
tech-stack:
  added: []
  patterns:
    - Unconditional drag handle render (EC-06 gate relaxation)
key-files:
  modified:
    - src/Grid/ActionBar.tsx
    - src/test/phase05-p02-cell-swap.test.ts
  created: []
decisions:
  - Drag handle renders unconditionally; aria-label/title changed to "Drag to move"
  - Other hasMedia gates (Clear Media button) kept intact
metrics:
  duration: 3min
  tasks: 2
  files: 2
  completed: 2026-04-08
---

# Phase 9 Plan 04: Relax ActionBar Drag-Handle Gate (EC-06) Summary

Empty cells are now movable: ActionBar renders the `GripVertical` drag handle regardless of `hasMedia`, and the Phase 5 regression test that asserted the opposite was inverted.

## What Shipped

### Task 1 — ActionBar.tsx drag-handle gate relaxed

- Removed the `{hasMedia && (...)}` wrapper around the drag-handle `<button>`.
- Changed `aria-label` and `title` from `"Drag to swap"` to `"Drag to move"` to reflect Phase 9's primary action (center drop still routes through `moveCell(..., 'center')` → swap).
- All other `hasMedia`-gated controls kept untouched:
  - Upload/Replace button still uses `hasMedia` for label toggling.
  - Clear Media button still wrapped in `{hasMedia && (...)}` (confirmed via `grep` — 1 remaining `hasMedia &&` in file).
  - Split H, Split V, Toggle Fit, Remove Cell untouched.

### Task 2 — phase05-p02-cell-swap.test.ts regression updated

Exact assertion changes in `src/test/phase05-p02-cell-swap.test.ts`:

1. **Header comment** updated:
   - Before: `ActionBar does NOT render drag handle when hasMedia=false`
   - After: `ActionBar renders drag handle even when hasMedia=false (EC-06: gate relaxed in Phase 9)`

2. **Test case renamed and inverted** (lines ~167-183):
   - Before: `it('does NOT render drag handle button when hasMedia=false', ...)` → `expect(screen.queryByTestId('drag-handle-leaf-1')).toBeNull();`
   - After: `it('renders drag handle on empty cells (EC-06: gate relaxed in Phase 9)', ...)` → `expect(screen.queryByTestId('drag-handle-leaf-1')).not.toBeNull();` plus `expect(handle).toHaveAttribute('draggable', 'true');`

3. **aria-label assertion updated** (line ~196):
   - Before: `it('drag handle button has aria-label "Drag to swap"', ...)` with `toHaveAttribute('aria-label', 'Drag to swap')`
   - After: `it('drag handle button has aria-label "Drag to move"', ...)` with `toHaveAttribute('aria-label', 'Drag to move')`

4. **Swap behavior tests unchanged** — all 5 `describe('swapCells store action (D-13)')` cases retained verbatim.

## Verification

```
npx vitest run src/test/phase05-p02-cell-swap.test.ts \
  src/test/phase09-p01-cell-move.test.ts \
  src/test/phase09-p02-store-move.test.ts
```

Result: **3 files, 35 tests, all passing.**
- `phase05-p02-cell-swap.test.ts`: 8/8
- `phase09-p01-cell-move.test.ts`: 18/18
- `phase09-p02-store-move.test.ts`: 9/9

## Other Test Files Referencing the Old Gate

None. Only `src/test/phase05-p02-cell-swap.test.ts` asserted the `hasMedia=false` → no drag handle contract. The Phase 9 move tests (`phase09-p01`, `phase09-p02`) do not touch ActionBar rendering and remained green without changes.

## Confirmation: Other ActionBar Gates Intact

After Task 1, `grep -c "hasMedia &&" src/Grid/ActionBar.tsx` = **1** (the Clear Media `<Tooltip>` wrapper at line ~110). Upload/Replace, Split H/V, Toggle Fit, and Remove Cell continue to use `hasMedia` as before (label toggling / no gate).

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `4ff520c` feat(09-04): relax ActionBar drag-handle hasMedia gate (EC-06)
- `d9fda86` test(09-04): invert phase 5 cell-swap gate assertion for EC-06

## Self-Check: PASSED

- `src/Grid/ActionBar.tsx` — FOUND, drag handle unconditional, labels updated
- `src/test/phase05-p02-cell-swap.test.ts` — FOUND, assertions inverted
- commit `4ff520c` — FOUND
- commit `d9fda86` — FOUND
- tests: 35/35 passing
