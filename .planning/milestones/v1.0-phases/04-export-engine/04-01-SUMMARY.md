---
phase: 04-export-engine
plan: "01"
subsystem: export
tags: [export, context, state, tdd]
dependency_graph:
  requires:
    - "03-media-upload-cell-controls (mediaRegistry, addMedia, setMedia)"
    - "02-grid-rendering (LeafNode, ContainerNode, GridNodeComponent)"
    - "01-grid-tree-engine (getAllLeaves, GridNode types)"
  provides:
    - "ExportModeContext: export-mode suppression for all grid components"
    - "ExportSurface: always-mounted 1080x1920 capture container"
    - "exportGrid: double-call toPng/toJpeg capture function"
    - "downloadDataUrl: anchor-click file download trigger"
    - "hasVideoCell: video-presence guard for format selection"
    - "editorStore export state: isExporting, exportFormat, exportQuality"
  affects:
    - "04-02: ExportSplitButton UI consumes exportRef and calls exportGrid"
tech_stack:
  added: []
  patterns:
    - "React context (createContext/useContext) for render-mode signalling"
    - "Always-mounted hidden DOM node for html-to-image capture (visibility:hidden + left:-9999px)"
    - "Double-call html-to-image pattern: first call primes browser paint, second call captures"
    - "Anchor-click download: createElement('a') + href + click() + removeChild"
key_files:
  created:
    - src/Grid/ExportModeContext.tsx
    - src/Grid/ExportSurface.tsx
    - src/lib/export.ts
    - src/test/phase04-01-task1.test.tsx
    - src/test/phase04-01-task2.test.tsx
  modified:
    - src/store/editorStore.ts
    - src/Grid/LeafNode.tsx
    - src/Grid/ContainerNode.tsx
    - src/Editor/EditorShell.tsx
    - src/Editor/Toolbar.tsx
decisions:
  - "ExportSurface always mounted (visibility:hidden + off-screen) — prevents blank-PNG race condition (EXPO-07)"
  - "Double-call toPng/toJpeg pattern — forces browser paint cycle before real capture (D-14)"
  - "ExportFormat type exported from both editorStore and lib/export for reuse in Plan 02"
  - "Toolbar accepts exportRef as optional prop with default {} — preserves existing tests that render Toolbar without props"
metrics:
  duration: "268s"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 10
---

# Phase 4 Plan 01: Export Engine Foundation Summary

**One-liner:** Export pipeline foundation with ExportModeContext, always-mounted ExportSurface, double-call toPng/toJpeg capture, and anchor-click download trigger.

## What Was Built

This plan establishes the complete invisible export pipeline. After this plan, calling `exportGrid()` with the `exportRef.current` DOM node produces a downloaded PNG/JPEG file of the 1080x1920 grid.

### ExportModeContext (`src/Grid/ExportModeContext.tsx`)

Simple React context with `createContext(false)` default. Components call `useExportMode()` to check if they are being rendered inside an export capture. ExportSurface wraps its subtree with `<ExportModeContext.Provider value={true}>`.

### editorStore export state (`src/store/editorStore.ts`)

Added `isExporting`, `exportFormat` ('png' | 'jpeg'), `exportQuality` (0–1) state fields with corresponding setters. Also exports `ExportFormat` type. Plan 02 will read `isExporting` to show/hide the progress overlay.

### Grid component suppression

- **LeafNode**: skips ActionBar div, selection ring, dim overlay, and mouse enter/leave handlers when `useExportMode()` is true.
- **ContainerNode**: skips Divider rendering between children when `useExportMode()` is true.

### ExportSurface (`src/Grid/ExportSurface.tsx`)

Always-mounted `<div>` positioned at `left: -9999px`, `visibility: hidden`, `width: 1080px`, `height: 1920px`. Holds a `GridNodeComponent` tree inside `ExportModeContext.Provider value={true}`. The `exportRef` prop is a `RefObject<HTMLDivElement>` passed from EditorShell; Plan 02 passes it to `exportGrid()`.

### Export logic (`src/lib/export.ts`)

- `exportGrid(node, format, quality, onStage)`: calls `toPng` or `toJpeg` twice (first result discarded per D-14 paint-priming pattern); fires `onStage('preparing')` and `onStage('exporting')` callbacks.
- `downloadDataUrl(dataUrl, filename)`: creates a hidden anchor, sets `download` + `href`, clicks, and removes it.
- `hasVideoCell(root, mediaRegistry)`: walks all leaves, returns `true` if any `mediaRegistry[leaf.mediaId]` starts with `'data:video/'`.

### EditorShell + Toolbar wiring

EditorShell creates `exportRef = useRef<HTMLDivElement>(null)`, passes it to `<Toolbar exportRef={exportRef} />`, and mounts `<ExportSurface exportRef={exportRef} />` as the last child of the root div. Toolbar accepts `exportRef` as an optional prop (default `{}`) for use by Plan 02's ExportSplitButton.

## Test Coverage

29 new tests added across two files:
- `src/test/phase04-01-task1.test.tsx` — 14 tests for ExportModeContext, editorStore export state, LeafNode/ContainerNode suppression
- `src/test/phase04-01-task2.test.tsx` — 15 tests for exportGrid (double-call, stage callbacks, error propagation), downloadDataUrl, hasVideoCell, ExportSurface (dimensions, visibility, aria-hidden), EditorShell wiring

Full suite: **218 tests, all passing**.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Toolbar exportRef prop uses optional with default**
- **Found during:** Task 2
- **Issue:** Existing toolbar.test.tsx renders `<Toolbar />` without props; making `exportRef` required would break those tests.
- **Fix:** Changed signature from `function Toolbar({ exportRef })` to `function Toolbar({ exportRef: _exportRef }: { exportRef?: RefObject<HTMLDivElement | null> } = {})`.
- **Files modified:** `src/Editor/Toolbar.tsx`
- **Commit:** 0a3f6af

**2. Test restructuring — top-level imports vs dynamic imports for html-to-image mocking**
- **Found during:** Task 2 RED tests
- **Issue:** Using `vi.spyOn` after dynamic `await import(...)` in the same test file caused stale module cache — spies didn't intercept calls. html-to-image's `SVGImageElement` also not defined in jsdom.
- **Fix:** Rewrote tests to use top-level imports (`import * as htmlToImage from 'html-to-image'`) with `vi.spyOn` before calls. This is the standard Vitest pattern for spying on ESM modules.
- **Files modified:** `src/test/phase04-01-task2.test.tsx`

## Known Stubs

None. All implemented functions have complete behavior wired. `exportRef` is threaded through to Toolbar as a stub for Plan 02 consumption — this is intentional per the plan spec ("The exportRef is not used in this plan — it will be consumed by ExportSplitButton in Plan 02").

## Self-Check: PASSED
