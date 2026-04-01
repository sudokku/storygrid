---
phase: 04-export-engine
plan: "02"
subsystem: export-ui
tags: [export, ui, toast, split-button, popover, tdd]
dependency_graph:
  requires:
    - "04-01 (exportGrid, downloadDataUrl, hasVideoCell, editorStore export state, ExportSurface)"
    - "02-grid-rendering (Toolbar, EditorShell, exportRef wiring)"
  provides:
    - "ExportSplitButton: split button with popover for export settings"
    - "Toast: minimal 2-state toast notification component"
    - "Toolbar: updated with ExportSplitButton replacing placeholder"
  affects:
    - "Phase 5: ExportSplitButton accessible for Ctrl+E keyboard shortcut wiring"
tech_stack:
  added: []
  patterns:
    - "Split button pattern: two adjacent buttons sharing a container div with w-px divider"
    - "Popover via absolute positioning + outside-click useEffect with mousedown listener"
    - "Toast as local useState in ExportSplitButton (no global toast store)"
    - "Escape key closes popover via keydown listener registered alongside mousedown"
key_files:
  created:
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/test/phase04-02-task1.test.tsx
  modified:
    - src/Editor/Toolbar.tsx
    - src/test/toolbar.test.tsx
decisions:
  - "Toast state managed locally in ExportSplitButton (not global store) — export progress is ephemeral UI state, not persistent app state"
  - "ExportSplitButton passes { current: null } fallback when Toolbar rendered without exportRef — allows test isolation without prop requirement change"
  - "toolbar.test.tsx 'renders Export button' updated to query 'Export PNG' specifically — ExportSplitButton renders two buttons matching /export/i"
metrics:
  duration: "225s"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 5
---

# Phase 4 Plan 02: Export UI Summary

**One-liner:** ExportSplitButton with PNG/JPEG popover, quality slider, toast progress feedback, and video guard wired into Toolbar via exportRef.

## What Was Built

This plan delivers the complete user-facing export experience. Users can click the left segment to export immediately with last-used settings, or open the popover via the chevron to switch format and adjust JPEG quality.

### Toast component (`src/Editor/Toast.tsx`)

Minimal fixed-position toast with 4 states:
- `preparing` / `exporting` — spinner + text, `role="status"` for screen readers
- `error` — AlertCircle icon + "Export failed." + "Try again" inline button, `role="alert"`
- `video-blocked` — AlertCircle icon + "Export not available: remove video cells first.", `role="alert"`, auto-dismisses after 4 seconds via `useEffect`
- `null` — returns null (unmounts)

### ExportSplitButton (`src/Editor/ExportSplitButton.tsx`)

Split button with:
- **Left segment**: Download icon + "Export PNG/JPEG" label, triggers `handleExport` immediately
- **Divider**: 1px vertical separator
- **Right segment (chevron)**: `aria-expanded` attribute, toggles popover
- **Popover**: absolutely positioned dialog with format radio group (PNG/JPEG) + quality slider (0.7–1.0, JPEG only) + Download button
- **Outside-click dismissal**: `useEffect` registers `mousedown` + `keydown(Escape)` listeners on `document` when popover is open, removes them on close/unmount
- **Export orchestration**: video guard → `setIsExporting(true)` → `exportGrid()` with stage callbacks → `downloadDataUrl()` → `setIsExporting(false)` in `finally`

### Toolbar (`src/Editor/Toolbar.tsx`)

Replaced the old Export placeholder block (Tooltip wrapping a Download button with `onClick={() => {}}` and `title="Export (Phase 4)"`) with `<ExportSplitButton exportRef={...} />`. Removed `Download` from lucide-react imports.

## Test Coverage

24 new tests in `src/test/phase04-02-task1.test.tsx`:
- Toast: 12 tests covering all states (null/preparing/exporting/error/video-blocked), role attributes, copy, callbacks, auto-dismiss timer
- ExportSplitButton: 12 tests covering segment rendering, label updates, disabled state, popover open/close, format toggle, slider visibility/attributes, aria-expanded, export invocation, video guard

Full suite: **242 tests, all passing**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] toolbar.test.tsx 'renders Export button' broke on multiple button matches**
- **Found during:** Task 2 verification
- **Issue:** Existing test used `getByRole('button', { name: /export/i })` which matched multiple buttons after ExportSplitButton was added (both "Export PNG" and "Export settings" contain the word "export").
- **Fix:** Updated test query to `getByRole('button', { name: /export png/i })` which uniquely identifies the left export segment.
- **Files modified:** `src/test/toolbar.test.tsx`
- **Commit:** 0daf61b

**2. [Rule 1 - Bug] Test mocking document.body.appendChild before render caused empty body**
- **Found during:** Task 1 TDD GREEN phase
- **Issue:** `vi.spyOn(document.body, 'appendChild')` intercepted React's own `render` call (which uses `appendChild` internally), causing the rendered component to not appear in the DOM.
- **Fix:** Moved the `appendChild` spy to after the `render()` call, only intercepting the anchor-download `appendChild`.
- **Files modified:** `src/test/phase04-02-task1.test.tsx`

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` gate. The automated work (Tasks 1 and 2) is complete. Manual verification of the full export pipeline is required before this plan is marked complete.

## Known Stubs

None. All export functions are fully wired. The ExportSplitButton reads from real editorStore and gridStore state.

## Self-Check: PARTIAL (awaiting checkpoint)

Tasks 1 and 2 committed and verified. Task 3 (human verification) pending.
