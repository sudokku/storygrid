---
phase: 03-media-upload-cell-controls
plan: "02"
subsystem: toolbar-sidebar-controls
tags: [toolbar, sidebar, undo-redo, keyboard-shortcuts, zoom, safe-zone, properties-panel, cell-dimensions]
dependency_graph:
  requires: [03-01, 02-grid-rendering]
  provides: [wired-toolbar, keyboard-shortcuts, sidebar-properties-panel]
  affects: [Toolbar, Sidebar, EditorShell]
tech_stack:
  added: []
  patterns: [tree-path-dimension-calculation, React.memo-SelectedCellPanel, key-prop-remount-on-selection-change]
key_files:
  created:
    - src/test/toolbar.test.tsx
    - src/test/sidebar.test.tsx
  modified:
    - src/Editor/Toolbar.tsx
    - src/Editor/Sidebar.tsx
    - src/Editor/EditorShell.tsx
    - src/test/editor-shell.test.tsx
decisions:
  - computeCellDimensions uses path-tracking recursion (not restore-on-backtrack) for clarity and correctness
  - SelectedCellPanel wrapped in React.memo with key={selectedNodeId} for clean remounts on cell change
  - Sidebar upload reuses autoFillCells for multi-file; fileToBase64 for single-replace of filled cell
  - editor-shell.test.tsx updated to use data-testid="sidebar" instead of text-based "Properties" assertion
metrics:
  duration_seconds: 216
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 02: Toolbar Controls & Sidebar Properties Panel Summary

**One-liner:** Fully wired Toolbar (undo/redo, zoom ±10%, safe zone toggle, export placeholder, new/clear) plus a complete Sidebar properties panel (no-selection canvas stubs + selected-cell thumbnail/fit/bg-color/dimensions/actions) with global Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts mounted in EditorShell.

## What Was Implemented

### Task 1: Toolbar — Wired Controls + Keyboard Shortcuts

**Toolbar.tsx** (complete rewrite from placeholder spans):

- **Undo/Redo buttons** — subscribe to `gridStore.historyIndex`, `gridStore.history.length`, `gridStore.undo`, and `gridStore.redo`. Buttons disabled when `historyIndex <= 0` (undo) or `historyIndex >= history.length - 1` (redo). Apply `opacity-40 cursor-not-allowed` CSS when disabled.
- **Zoom controls** — Minus/Plus buttons call `setZoom(zoom ± 0.1)`; `setZoom` in editorStore clamps to `[0.5, 1.5]`. Zoom-out disabled at 50%, Zoom-in disabled at 150%. Percentage label: `${Math.round(zoom * 100)}%` with `data-testid="zoom-label"`.
- **Safe Zone toggle** — Eye icon when `showSafeZone=false`, EyeOff when `showSafeZone=true`. Button has `aria-pressed={showSafeZone}`.
- **Export placeholder** — Download icon + "Export" label, `onClick={() => {}}`, `title="Export (Phase 4)"` per D-15.
- **New/Clear button** — Trash2 icon, calls `window.confirm(...)` then `clearGrid()` per D-16.
- All buttons wrapped in base-ui `<Tooltip>` using the established `render` prop pattern (consistent with ActionBar.tsx).

**EditorShell.tsx** (keyboard shortcuts added):

- Subscribe to `gridStore.undo` and `gridStore.redo` once at component level.
- `useEffect` mounts global `keydown` listener on `window`: Ctrl+Z calls `undo()`, Ctrl+Shift+Z calls `redo()`.
- Guard: skip shortcut if `target.tagName === 'INPUT' || 'TEXTAREA' || target.isContentEditable`.
- Cleanup: listener removed on unmount via `return () => window.removeEventListener(...)`.

### Task 2: Sidebar — Full Properties Panel

**Sidebar.tsx** (complete rewrite from stub):

**`computeCellDimensions(root, nodeId)`** — Path-based approach:
- `findPath()` builds `Array<{ node: ContainerNode; idx: number }>` from root to target via DFS with push/pop.
- Iterates path, applying fractional weights: `direction='vertical'` multiplies `hFraction`, `direction='horizontal'` multiplies `wFraction`.
- Returns `{ w: Math.round(1080 * wFraction), h: Math.round(1920 * hFraction) }`.
- Verified by tests: vertical container 2-leaf → child gets 1080×960; horizontal container 2-leaf → child gets 540×1920.

**`NoSelectionPanel`** (D-09 stubs):
- "Canvas" heading
- Disabled `<input type="color">` (bg color stub, Phase 5)
- Disabled `<input type="range">` (gap slider stub, Phase 5)

**`SelectedCellPanel`** (D-10 sections in order):
1. Media thumbnail — `aspect-video` container; shows `<img>` when `mediaUrl` is set, `ImageIcon` placeholder when empty.
2. Fit toggle — Cover/Contain segmented control; active button highlighted with `bg-[#3b82f6] text-white`.
3. Background color picker — `<input type="color">` only rendered when `node.fit === 'contain'`; bound to `node.backgroundColor ?? '#000000'`.
4. Cell dimensions — computed via `computeCellDimensions`; `data-testid="cell-dimensions"` for tests.
5. Actions row — Upload/Replace button (label switches based on `mediaUrl`), Clear image (only when `mediaUrl`), Remove cell.

Upload in Sidebar:
- Single file replacing existing media: `fileToBase64` → `removeMedia(oldId)` → `nanoid()` → `addMedia` → `setMedia`.
- Multi-file or empty cell: delegates to `autoFillCells` with `getRoot: () => useGridStore.getState().root`.

**Main `Sidebar` component:**
- Subscribes to `editorStore.selectedNodeId`.
- Renders `SelectedCellPanel` with `key={selectedNodeId}` (ensures remount on cell switch, resetting local state).
- `data-testid="sidebar"` on `<aside>` element.

## Key Decisions Honored

- **D-09**: No-selection shows disabled canvas-level stubs (bg color + gap) as Phase 5 placeholders.
- **D-10**: Selected-cell panel order: thumbnail → fit toggle → bg color (contain only) → dimensions → actions.
- **D-12**: Global `keydown` listener in EditorShell for Ctrl+Z/Ctrl+Shift+Z; ignores INPUT/TEXTAREA focus.
- **D-13**: Zoom ±10% steps, percentage label, clamped 50%-150%.
- **D-14**: Safe Zone toggle wired to `editorStore.toggleSafeZone`.
- **D-15**: Export button renders as placeholder (no-op onClick).
- **D-16**: New/Clear uses `window.confirm` before calling `clearGrid()`.
- **MEDI-06**: Toolbar Undo/Redo buttons wired to gridStore.
- **MEDI-07**: Keyboard shortcut handler mounted in EditorShell.
- **MEDI-08**: Sidebar shows all cell properties when cell selected.
- **MEDI-09**: Sidebar Upload/Replace/Clear/Remove buttons wired.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Created toolbar.test.tsx and sidebar.test.tsx**
- **Found during:** Task 1 / Task 2
- **Issue:** Plan's `<verify>` referenced test files that didn't exist yet (`src/test/toolbar.test.tsx`, `src/test/sidebar.test.tsx`)
- **Fix:** Created both test files covering all `<done>` criteria from the plan
- **Files modified:** `src/test/toolbar.test.tsx` (new, 16 tests), `src/test/sidebar.test.tsx` (new, 19 tests)
- **Commits:** 1947b3b, 7b4107e

**2. [Rule 1 - Bug] Updated editor-shell.test.tsx for new Sidebar structure**
- **Found during:** Task 2 (after Sidebar rewrite)
- **Issue:** `editor-shell.test.tsx` checked for `getByText('Properties')` which was removed in Sidebar rewrite; also checked for `[Undo]` placeholder text removed in Toolbar rewrite
- **Fix:** Updated test to use `getByTestId('sidebar')` (now present on `<aside>`) and header element query instead of placeholder text
- **Files modified:** `src/test/editor-shell.test.tsx`
- **Commit:** 1947b3b

## Test Results

- 14 test files, 162 tests all passing
- 35 new tests added (16 toolbar + 19 sidebar)
- No TypeScript errors (`npx tsc --noEmit` clean)

## Known Stubs

- **Export button** — renders with no action (`onClick={() => {}}`). Intentional per D-15. Phase 4 will wire this.
- **Sidebar background color picker (no-selection state)** — disabled stub per D-09. Phase 5 will enable.
- **Sidebar gap slider (no-selection state)** — disabled stub per D-09. Phase 5 will enable.

## Self-Check: PASSED
