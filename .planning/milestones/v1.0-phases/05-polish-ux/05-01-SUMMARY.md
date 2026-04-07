---
phase: 05-polish-ux
plan: 01
subsystem: types, stores, grid rendering, templates UI, canvas settings UI
tags: [types, zustand, react, tailwind, templates, canvas-settings, tdd]
dependency_graph:
  requires: [04-02]
  provides: [types/LeafNode-pan-fields, store/editorStore-canvas-settings, store/gridStore-applyTemplate-swapCells, lib/tree-swapLeafContent-buildTemplate, components/TemplatesPopover, Editor/CanvasSettingsPanel, Grid/ContainerNode-gap, Grid/CanvasWrapper-background, Grid/LeafNode-border-radius-color]
  affects: [05-02, 05-03, 05-04, 05-05]
tech_stack:
  added: []
  patterns: [TDD-red-green, useShallow-zustand5, inline-style-for-dynamic-CSS, outline-for-non-layout-borders]
key_files:
  created:
    - src/test/phase05-p01-templates.test.tsx
    - src/test/phase05-p01-canvas-settings.test.tsx
    - src/components/TemplatesPopover.tsx
  modified:
    - src/types/index.ts
    - src/lib/tree.ts
    - src/store/editorStore.ts
    - src/store/gridStore.ts
    - src/Editor/Toolbar.tsx
    - src/Editor/Sidebar.tsx
    - src/Grid/ContainerNode.tsx
    - src/Grid/CanvasWrapper.tsx
    - src/Grid/LeafNode.tsx
    - src/test/sidebar.test.tsx
decisions:
  - "LeafNode border uses outline (not border) to avoid layout shifts — outline: 1px solid borderColor applied always"
  - "CanvasSettingsPanel always rendered at top of Sidebar (replaces NoSelectionPanel stub completely)"
  - "buildTemplate generates all leaves with panX/panY/panScale defaults matching createLeaf"
  - "applyTemplate clears mediaRegistry (avoids dangling media refs from old tree)"
metrics:
  duration: 9min
  completed: 2026-04-01
  tasks_completed: 2
  files_modified: 10
  files_created: 3
---

# Phase 5 Plan 01: Types + Store + Pure Functions + UI Components Summary

Established canvas settings data layer and the two main UI features for Phase 5 Polish & UX: template presets with confirmation dialogs, and canvas style controls (gap, border radius, border color, solid/gradient background).

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Types + Store + Pure Functions Foundation | c3b46f3 | Complete |
| 2 | Templates Popover + Canvas Settings Panel + Grid Rendering | 29c7ab0 | Complete |

## What Was Built

**Task 1 — Data Layer:**
- `LeafNode` type extended with `panX: number`, `panY: number`, `panScale: number` fields (defaults 0, 0, 1)
- `createLeaf()` updated to include pan defaults
- `swapLeafContent(root, idA, idB)` pure function — swaps media, fit, backgroundColor, pan fields between two leaves; returns unchanged root if either id not found or not a leaf
- `buildTemplate(name: TemplateName)` — builds 6 preset trees: 2x1, 1x2, 2x2, 3-row, l-shape, mosaic
- `TemplateName` type exported from tree.ts
- `editorStore` extended with: `gap` (0), `borderRadius` (0), `borderColor` (#000000), `backgroundMode` (solid), `backgroundColor` (#ffffff), `backgroundGradientFrom` (#ffffff), `backgroundGradientTo` (#000000), `backgroundGradientDir` (to-bottom), `panModeNodeId` (null)
- All setters added with clamping for gap (0-20) and borderRadius (0-24)
- `gridStore` extended with `applyTemplate(templateRoot)` and `swapCells(idA, idB)` actions

**Task 2 — UI Layer:**
- `TemplatesPopover` component: grid layout button opens 2x3 popover of template thumbnails; confirms before applying to non-empty grids
- `TemplatesPopover` placed in Toolbar after Undo/Redo group
- `CanvasSettingsPanel` in Sidebar: gap slider (0-20px), border radius slider (0-24px), border color picker, background Solid/Gradient toggle with color pickers and direction selector
- `CanvasSettingsPanel` always renders at top of Sidebar (replaces old stub `NoSelectionPanel`)
- `ContainerNode` applies CSS `gap` from editorStore as inline style
- `CanvasWrapper` applies `background` (solid color or `linear-gradient`) from editorStore
- `LeafNode` applies `borderRadius` and `outline` from editorStore

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated sidebar tests to match new CanvasSettingsPanel**
- **Found during:** Task 2
- **Issue:** Old `sidebar.test.tsx` tests expected disabled (stub) inputs in the "no selection" state (NoSelectionPanel). New CanvasSettingsPanel replaces those stubs with real, enabled controls.
- **Fix:** Updated 3 test cases — changed "shows disabled background color input" to "shows active (enabled) border color input", "shows disabled gap slider" to "shows active (enabled) gap slider", added Solid/Gradient toggle test. Updated "does NOT show background color picker in cover mode" to check there's no "Background color" label in the cell panel (rather than no enabled color input, since CanvasSettingsPanel always renders enabled inputs).
- **Files modified:** `src/test/sidebar.test.tsx`
- **Commit:** 29c7ab0

## Known Stubs

None. All canvas settings controls are wired to editorStore and produce live CSS output on the grid. The export engine (Canvas API renderer in Phase 4) does not yet read gap/borderRadius/borderColor/background from the store — that integration is planned for Phase 5 plan 05-05.

## Self-Check: PASSED

- `src/components/TemplatesPopover.tsx` — FOUND
- `src/test/phase05-p01-templates.test.tsx` — FOUND
- `src/test/phase05-p01-canvas-settings.test.tsx` — FOUND
- commit c3b46f3 — FOUND
- commit 29c7ab0 — FOUND
- All 292 tests pass (`npx vitest run`)
