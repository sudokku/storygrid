---
phase: 05-polish-ux
plan: "02"
subsystem: editor-ux
tags: [dark-theme, keyboard-shortcuts, responsive, sidebar]
dependency_graph:
  requires: ["05-01"]
  provides: ["POLH-08", "POLH-09", "POLH-12"]
  affects: ["src/Editor/EditorShell.tsx", "src/Editor/CanvasArea.tsx", "src/Editor/Sidebar.tsx"]
tech_stack:
  added: []
  patterns: ["useMediaQuery inline hook", "Zustand getState() in event handlers", "window.matchMedia polyfill in test setup"]
key_files:
  created:
    - src/test/phase05-p03-dark-theme.test.tsx
    - src/test/phase05-p03-shortcuts.test.tsx
    - src/test/phase05-p03-responsive.test.tsx
  modified:
    - src/Editor/EditorShell.tsx
    - src/Editor/CanvasArea.tsx
    - src/Editor/Sidebar.tsx
    - src/test/setup.ts
decisions:
  - "Use useGridStore.getState() / useEditorStore.getState() directly in keydown handler instead of reactive subscriptions — avoids adding multiple deps to useEffect and always reads latest state"
  - "Escape key prioritizes pan mode exit (setPanModeNodeId(null)) before deselecting — required for Phase 5 pan/zoom feature"
  - "Ctrl+E triggers export by clicking [data-testid=export-button] DOM element — zero extra prop drilling or refs needed"
  - "window.matchMedia polyfill added to setup.ts globally — jsdom lacks matchMedia; needed by any component using useMediaQuery"
  - "Desktop notice placed inside sidebar aside element (not replacing it) — ensures data-testid=sidebar always present for existing tests"
metrics:
  duration: "334 seconds (~6 min)"
  completed: "2026-04-01"
  tasks_completed: 2
  files_changed: 7
---

# Phase 05 Plan 02: Dark Theme + Keyboard Shortcuts + Responsive Sidebar Summary

Dark editor theme, 6 new keyboard shortcuts (Delete/Backspace, H, V, F, Escape, Ctrl+E), and responsive sidebar with desktop notice below 1024px, all tested with 23 new tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dark Theme + Keyboard Shortcuts | 9cc8347 | EditorShell.tsx, CanvasArea.tsx, +2 test files |
| 2 | Responsive Sidebar Layout | c91e7ec | Sidebar.tsx, setup.ts, +1 test file |

## What Was Built

### Task 1: Dark Theme + Keyboard Shortcuts

**Dark theme:**
- `src/Editor/EditorShell.tsx` outer div: `bg-[#111111]` → `bg-[#0a0a0a]` (D-17, darkest in #0a0a0a-#141414 range)
- `src/Editor/CanvasArea.tsx` main: `bg-[#111111]` → `bg-[#0f0f0f]` (D-18)

**Keyboard shortcuts added to EditorShell `handleKeyDown`:**
- `Delete` / `Backspace`: calls `remove(selectedNodeId)` + `setSelectedNode(null)` when a cell is selected
- `H` / `h`: calls `split(selectedNodeId, 'horizontal')` when a cell is selected
- `V` / `v`: calls `split(selectedNodeId, 'vertical')` when a cell is selected
- `F` / `f`: toggles fit between `cover` ↔ `contain` via `updateCell`
- `Escape`: exits pan mode first (`setPanModeNodeId(null)`), falls back to `setSelectedNode(null)`
- `Ctrl+E` / `Cmd+E`: clicks `[data-testid="export-button"]` to trigger export

All shortcuts guarded against `INPUT`, `TEXTAREA`, and `contentEditable` targets (existing D-12 guard).

### Task 2: Responsive Sidebar

**`useMediaQuery` hook** (inline in Sidebar.tsx):
- `(max-width: 1023px)` → show `data-testid="desktop-notice"` message, sidebar still mounts
- `(max-width: 1199px)` → sidebar narrows from `w-[280px]` to `w-[200px]`
- 1200px+ → full `w-[280px]`

**Test setup fix:** Added `window.matchMedia` polyfill to `src/test/setup.ts` — jsdom doesn't implement matchMedia natively.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added window.matchMedia polyfill to test setup**
- **Found during:** Task 2 implementation
- **Issue:** Existing sidebar.test.tsx started failing when Sidebar.tsx used `window.matchMedia` in `useMediaQuery` hook on mount — jsdom has no native matchMedia
- **Fix:** Added a default `matchMedia` polyfill to `src/test/setup.ts` returning `{ matches: false }` for all queries. Individual tests can override with `Object.defineProperty`
- **Files modified:** `src/test/setup.ts`
- **Commit:** c91e7ec

## Known Stubs

None — all shortcuts, theme changes, and responsive behavior are fully wired.

## Self-Check: PASSED

Files exist:
- FOUND: src/Editor/EditorShell.tsx
- FOUND: src/Editor/CanvasArea.tsx
- FOUND: src/Editor/Sidebar.tsx
- FOUND: src/test/phase05-p03-dark-theme.test.tsx
- FOUND: src/test/phase05-p03-shortcuts.test.tsx
- FOUND: src/test/phase05-p03-responsive.test.tsx

Commits exist:
- FOUND: 9cc8347 (feat(05-02): dark theme + keyboard shortcuts)
- FOUND: c91e7ec (feat(05-02): responsive sidebar with useMediaQuery hook)

All 315 tests pass.
