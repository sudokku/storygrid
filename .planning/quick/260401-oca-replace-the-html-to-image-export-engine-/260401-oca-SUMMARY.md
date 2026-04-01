---
phase: quick
plan: 260401-oca
subsystem: export
tags: [canvas-api, export, refactor, html-to-image-removal]
dependency_graph:
  requires: []
  provides: [canvas-export-engine]
  affects: [ExportSplitButton, EditorShell, Toolbar, LeafNode, ContainerNode]
tech_stack:
  added: []
  patterns:
    - Canvas API renderGridToCanvas replacing html-to-image DOM capture
    - exportGrid signature: (root, mediaRegistry, format, quality, onStage) — no DOM element arg
    - parseObjectPosition converts CSS strings to 0-1 fractions for cover/contain math
key_files:
  created:
    - src/test/canvas-export.test.ts
  modified:
    - src/lib/export.ts
    - src/Editor/ExportSplitButton.tsx
    - src/Editor/EditorShell.tsx
    - src/Editor/Toolbar.tsx
    - src/Grid/LeafNode.tsx
    - src/Grid/ContainerNode.tsx
    - src/test/phase04-01-task1.test.tsx
    - src/test/phase04-01-task2.test.tsx
    - src/test/phase04-02-task1.test.tsx
    - src/test/imports.test.ts
    - package.json
    - package-lock.json
  deleted:
    - src/Grid/ExportSurface.tsx
    - src/Grid/ExportModeContext.tsx
decisions:
  - "Canvas API used instead of html-to-image: zero-dependency, deterministic, handles object-fit correctly"
  - "exportGrid signature changed from (HTMLElement, ...) to (root, mediaRegistry, ...): no DOM surface needed"
  - "ExportSurface and ExportModeContext deleted: no DOM capture surface needed, no export mode suppression needed"
  - "LeafNode/ContainerNode interactive UI always renders (no exportMode guards)"
  - "Double-call pattern removed: Canvas API is synchronous and deterministic, no browser paint race"
metrics:
  duration: 7 minutes
  completed: 2026-04-01
  tasks_completed: 2
  files_changed: 14
---

# Phase quick Plan 260401-oca: Replace html-to-image Export Engine Summary

**One-liner:** Canvas API tree-walker replacing html-to-image DOM capture, with cover/contain objectPosition math, removing all DOM-capture infrastructure.

## What Was Built

### Task 1: Canvas API export.ts renderer (TDD)
New `src/lib/export.ts` with zero html-to-image dependency:
- `parseObjectPosition(pos)` — converts CSS object-position strings ('left top', '25% 75%', 'center center') to `{x, y}` fractions in [0,1]
- `loadImage(dataUri)` — creates HTMLImageElement from data URI, resolves on load
- `drawCoverImage(ctx, img, rect, objPos)` — 9-arg drawImage with source crop math for object-fit: cover
- `drawContainImage(ctx, img, rect, objPos, bgColor)` — letterbox/pillarbox with background fill for object-fit: contain
- `renderNode(ctx, node, rect, mediaRegistry, imageCache)` — recursive tree walker; containers subdivide their bounding rect by sizes weights; leaves fill or draw with cover/contain
- `renderGridToCanvas(root, mediaRegistry, width, height)` — creates canvas, fills white, calls renderNode, returns canvas element
- `exportGrid(root, mediaRegistry, format, quality, onStage)` — new signature without HTMLElement arg; fires onStage('preparing') then onStage('exporting'); returns data URL
- `downloadDataUrl` and `hasVideoCell` unchanged

25 new tests in `src/test/canvas-export.test.ts` covering: parseObjectPosition, canvas dimensions, leaf fill colors, horizontal/vertical container splits, nested container subdivision, exportGrid data URL format, onStage order, toDataURL call arguments.

### Task 2: Remove DOM-capture infrastructure
**Deleted:**
- `src/Grid/ExportSurface.tsx` — always-mounted 1080x1920 off-screen DOM surface
- `src/Grid/ExportModeContext.tsx` — React context used to suppress interactive UI during export

**Updated components:**
- `ExportSplitButton.tsx` — removed `exportRef` prop; calls `exportGrid(root, mediaRegistry, ...)` directly with store values
- `EditorShell.tsx` — removed `useRef`, `ExportSurface` import and JSX, `exportRef` prop on Toolbar
- `Toolbar.tsx` — removed `RefObject` import, `exportRef` prop, passes `<ExportSplitButton />` with no props
- `LeafNode.tsx` — removed `useExportMode` import; file input, selection ring, hover overlay, ActionBar always render
- `ContainerNode.tsx` — removed `useExportMode` import; Dividers always render between children

**Updated tests:**
- `phase04-01-task1.test.tsx` — removed ExportModeContext tests and exportMode suppression tests; kept editorStore export state tests
- `phase04-01-task2.test.tsx` — removed html-to-image exportGrid tests and ExportSurface tests; kept downloadDataUrl/hasVideoCell; added EditorShell test confirming export-surface absent
- `phase04-02-task1.test.tsx` — removed html-to-image import and exportRef from all renders; updated export test to mock `src/lib/export.exportGrid` and verify new signature
- `imports.test.ts` — replaced html-to-image import test with Canvas API export lib check

**Removed:**
- `html-to-image` npm package (uninstalled from package.json)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] imports.test.ts also imported html-to-image**
- **Found during:** Task 2 — full test run after changes
- **Issue:** `src/test/imports.test.ts` had `import("html-to-image")` which failed immediately after uninstall
- **Fix:** Replaced the html-to-image import test with a Canvas API export lib test (`renderGridToCanvas` + `exportGrid` defined)
- **Files modified:** `src/test/imports.test.ts`
- **Commit:** ce612ff

**2. [Rule 1 - Bug] JSDoc comment in export.ts referenced html-to-image**
- **Found during:** Post-task verification grep
- **Issue:** Comment text `"Replaces the html-to-image DOM-capture approach."` matched the grep check
- **Fix:** Updated comment to remove the html-to-image name reference
- **Files modified:** `src/lib/export.ts`
- **Commit:** 9741b0c

## Verification Results

```
Test Files  21 passed (21)
Tests  250 passed (250)
```

```
PASS: no html-to-image references in src/
PASS: no ExportModeContext imports
PASS: no ExportSurface imports
PASS: no exportRef usage
PASS: html-to-image removed from package.json
Build: ✓ built in 1.11s
Bundle: 97.91KB gzipped (well under 500KB limit)
```

## Commits

| Hash    | Message |
|---------|---------|
| b65b0f7 | feat(quick-260401-oca): rewrite export.ts with Canvas API renderer |
| ce612ff | feat(quick-260401-oca): remove DOM-capture infrastructure and update consumers |
| 9741b0c | chore(quick-260401-oca): remove last html-to-image reference from JSDoc comment |

## Self-Check: PASSED
