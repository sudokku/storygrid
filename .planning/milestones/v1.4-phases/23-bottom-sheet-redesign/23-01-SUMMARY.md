---
phase: 23-bottom-sheet-redesign
plan: "01"
subsystem: mobile-sheet
tags:
  - ui
  - mobile
  - refactor
dependency_graph:
  requires: []
  provides:
    - SheetSnapState narrowed to collapsed|full
    - MobileSheet toggle chevron button
    - MobileSheet tab strip with context label
  affects:
    - src/Editor/MobileSheet.tsx
    - src/store/editorStore.ts
    - src/Editor/__tests__/phase05.1-p01-foundation.test.tsx
tech_stack:
  added: []
  patterns:
    - chevron toggle button replacing drag-pill gesture
    - auto-expand useEffect on selectedNodeId
    - motion-reduce:transition-none for reduced motion compliance
    - 100dvh to fix iOS address-bar overflow
key_files:
  modified:
    - src/Editor/MobileSheet.tsx
    - src/store/editorStore.ts
    - src/Editor/__tests__/phase05.1-p01-foundation.test.tsx
decisions:
  - Retained data-testid="sheet-drag-handle" on tab strip div for Playwright backward compatibility (per UI-SPEC)
  - Auto-expand is one-way (selecting a cell expands to full; deselecting does not collapse)
  - No aria-expanded on toggle button per UI-SPEC accessibility contract
metrics:
  duration_minutes: 10
  completed_date: "2026-04-15T13:38:28Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
---

# Phase 23 Plan 01: Bottom Sheet Drag→Toggle Refactor Summary

**One-liner:** Replaced drag-pill gesture with a chevron toggle button; narrowed SheetSnapState to `'collapsed' | 'full'`; added 60px tab strip with contextual label and auto-expand on cell select.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor MobileSheet.tsx + narrow SheetSnapState | 3a31e06 | src/Editor/MobileSheet.tsx, src/store/editorStore.ts |
| 2 | Update foundation tests + toggle/auto-expand/label coverage | 3177c6b | src/Editor/__tests__/phase05.1-p01-foundation.test.tsx |
| 3 | Mobile device visual verification | cde88cb, 2c4b777 | src/Editor/MobileSheet.tsx, src/Editor/Toolbar.tsx, src/components/TemplatesPopover.tsx |

## What Was Built

**Task 1 — MobileSheet refactor:**
- `SheetSnapState` type narrowed to `'collapsed' | 'full'` in both `editorStore.ts` (declaration + setter) and `MobileSheet.tsx` (local type + SNAP_TRANSLATE map). The `'half'` state is completely removed from the type system.
- Drag state (`isDragging`, `dragStartRef`, `handlePointerDown`, `handlePointerUp`, `DRAG_THRESHOLD`) entirely removed.
- `useGridStore` subscriptions (undo/redo/clearGrid) and their button components (`TemplatesPopover`, `Undo2`, `Redo2`, `Trash2`) removed from MobileSheet — these live in the Toolbar (Phase 22 work).
- 60px tab strip replaces the old drag-handle div: contains a plain `<button>` with `ChevronUp`/`ChevronDown` icon swap and aria-labels `"Open panel"` / `"Close panel"`, plus a `<span>` showing `"Cell Settings"` or `"Canvas Settings"` based on `selectedNodeId`.
- Toggle `onClick`: `setSheetSnapState(sheetSnapState === 'collapsed' ? 'full' : 'collapsed')`.
- Auto-expand `useEffect` updated: `setSheetSnapState('full')` (was `'half'`).
- Sheet wrapper: `height: '100dvh'`, unconditional transition `transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)`, class `motion-reduce:transition-none`.
- `data-testid="sheet-drag-handle"` retained on tab strip div for Playwright backward compatibility.

**Task 2 — Foundation tests updated:**
- Removed: `touch-none` class check, `sheet-undo`/`sheet-redo`/`sheet-clear` testid tests, both drag-gesture test blocks, `sheetSnapState: 'half'` seeding.
- Retained unchanged: renders/testid, collapsed state, md:hidden, cubic-bezier, CanvasSettingsPanel/SelectedCellPanel, Exit Pan Mode button and click wiring, D-02 removal test.
- Added Phase 23 describe block (9 new tests): toggle icon/aria-label by state, toggle click wiring both directions, tab label both branches, auto-expand on cell select, data-sheet-snap attribute reflection.
- All 17 tests pass; `tsc --noEmit` exits 0.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All rendered strings are hardcoded literals; no placeholder data.

## Threat Flags

None. Pure UI refactor — no new network endpoints, auth paths, file access, or schema changes.

## Self-Check

- [x] `src/Editor/MobileSheet.tsx` exists and contains ChevronUp, ChevronDown, 'Open panel', 'Close panel', 'Canvas Settings', 'Cell Settings', '100dvh', 'motion-reduce:transition-none'
- [x] `src/store/editorStore.ts` contains `'collapsed' | 'full'` (no 'half')
- [x] `src/Editor/__tests__/phase05.1-p01-foundation.test.tsx` contains 17 passing tests
- [x] Commit 3a31e06 exists (Task 1)
- [x] Commit 3177c6b exists (Task 2)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run src/Editor/__tests__/phase05.1-p01-foundation.test.tsx` — 17/17 pass

## Self-Check: PASSED
