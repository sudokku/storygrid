---
phase: 22
plan: "01"
subsystem: mobile-ui
one_liner: "Mobile header rebuilt with 5 icon buttons (44x44px each) plus global CSS rules eliminating pull-to-refresh and 300ms tap delay"
tags: [mobile, ux, touch, css, toolbar]
dependency_graph:
  requires: []
  provides: [mobile-5-button-header, touch-action-manipulation, overscroll-contain]
  affects: [src/Editor/Toolbar.tsx, src/Editor/ExportSplitButton.tsx, src/Editor/CanvasArea.tsx, src/index.css]
tech_stack:
  added: []
  patterns:
    - "isMobile prop on ExportSplitButton enables icon-only mobile render path"
    - "Shared popoverContent variable eliminates JSX duplication between mobile and desktop export popover"
    - "node:fs readFileSync in tests as fallback for Vite ?raw CSS imports (jsdom doesn't process Vite query transforms)"
    - "overscrollBehavior: contain always set on CanvasArea main; touchAction: none overlaid when sheet is open"
key_files:
  created:
    - src/test/phase22-mobile-header.test.tsx
    - src/test/phase22-touch-polish.test.tsx
  modified:
    - src/Editor/Toolbar.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/Editor/CanvasArea.tsx
    - src/index.css
decisions:
  - "Mobile Clear button calls clearGrid() directly without window.confirm — on mobile there is no accidental keyboard shortcut risk and confirmation dialogs are disruptive on touch"
  - "ExportSplitButton gains isMobile prop (default false) rather than duplicating the component — single source of truth for export logic"
  - "popoverContent extracted as local variable to share between mobile and desktop render paths — avoids ~60 lines of duplicated JSX"
  - "CSS touch-action: manipulation applied globally to all interactive elements rather than individually — single rule covers all current and future buttons"
  - "Used node:fs readFileSync in phase22-touch-polish tests instead of Vite ?raw import — jsdom test environment does not process Vite query transforms at module load time"
metrics:
  duration_seconds: 279
  completed_date: "2026-04-15"
  tasks_completed: 3
  files_changed: 6
---

# Phase 22 Plan 01: Mobile Header & Touch Polish Summary

Mobile header rebuilt with 5 icon buttons (44x44px each) plus global CSS rules eliminating pull-to-refresh and 300ms tap delay.

## What Was Built

### Task 1 — Test stubs for HEADER-01, HEADER-02, SCROLL-01, SCROLL-02

Created two test files covering all 4 requirements:
- `src/test/phase22-mobile-header.test.tsx` — 10 tests for mobile header layout and touch sizing
- `src/test/phase22-touch-polish.test.tsx` — 4 tests for CSS overscroll and touch-action rules

Tests started in RED state as expected.

### Task 2 — 5-button mobile header + ExportSplitButton isMobile prop

**Toolbar.tsx mobile branch** replaced the old "StoryGrid wordmark + single Export button" with:
1. Undo (`data-testid="mobile-undo"`, `w-11 h-11`)
2. Redo (`data-testid="mobile-redo"`, `w-11 h-11`)
3. TemplatesPopover wrapped in `w-11 h-11` div
4. `<ExportSplitButton isMobile />` (icon-only form)
5. Clear (`data-testid="mobile-clear"`, `w-11 h-11`) — calls `clearGrid()` directly, no `window.confirm`

Header uses `gap-2` (8px) between buttons, `justify-around` for even distribution.

Removed unused imports from Toolbar: `exportGrid`, `downloadDataUrl`, `hasVideoCell`, `CanvasSettings`, `isExporting`, `setIsExporting`. The desktop branch is untouched.

**ExportSplitButton.tsx** gained `isMobile?: boolean` prop (default `false`). When `isMobile=true`:
- Renders `w-11 h-11` container with Download icon + ChevronDown
- Uses the shared `popoverContent` variable (extracted to avoid ~60-line duplication)
- Includes Toast and ExportMetricsPanel identically to desktop path

### Task 3 — Overscroll and touch-action CSS rules

**`src/index.css`** inside `@layer base`:
- `body` rule: added `overscroll-behavior: contain` (prevents pull-to-refresh on body scroll)
- New rule targeting `button, [role="button"], input, select, textarea, a`: sets `touch-action: manipulation` (eliminates 300ms tap delay globally)

**`src/Editor/CanvasArea.tsx`** `<main>` element style:
- Changed from `sheetOpen ? { touchAction: 'none' } : undefined`
- To `{ overscrollBehavior: 'contain', ...(sheetOpen ? { touchAction: 'none' } : {}) }`
- Canvas area always contains overscroll; when sheet is open, touch is also locked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite ?raw import returns empty string in jsdom test environment**
- **Found during:** Task 3 test run
- **Issue:** `import css from '../index.css?raw'` resolves to empty string `''` in Vitest jsdom — Vite query transforms are not processed at test module collection time
- **Fix:** Replaced with `readFileSync(resolve(__dirname, '../index.css'), 'utf-8')` via `node:fs` — reads the actual file at test runtime
- **Files modified:** `src/test/phase22-touch-polish.test.tsx`
- **Commit:** ee9d28c

## Known Stubs

None. All 5 mobile header controls are wired to live store actions. Export button triggers the real export pipeline. No placeholder data or TODO comments in shipped code.

## Threat Flags

None. This plan adds no new network endpoints, auth paths, file access patterns, or cross-origin resources. All changes are presentation-layer CSS and JSX layout.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| phase22-mobile-header | 10/10 | PASS |
| phase22-touch-polish | 4/4 | PASS |
| Full suite | 686 passed / 2 skipped | PASS |

TypeScript: `npx tsc --noEmit` — clean, no errors.

## Self-Check: PASSED

Files created/modified:
- [x] src/test/phase22-mobile-header.test.tsx — exists
- [x] src/test/phase22-touch-polish.test.tsx — exists
- [x] src/Editor/Toolbar.tsx — modified (mobile-undo/redo/clear testids, gap-2, ExportSplitButton isMobile)
- [x] src/Editor/ExportSplitButton.tsx — modified (isMobile prop, mobile render path)
- [x] src/Editor/CanvasArea.tsx — modified (overscrollBehavior: contain in style)
- [x] src/index.css — modified (overscroll-behavior: contain in body, touch-action: manipulation rule)

Commits:
- [x] 0116aee — test(22-01): add failing tests
- [x] 45f6c0a — feat(22-01): mobile header + ExportSplitButton
- [x] ee9d28c — feat(22-01): overscroll-behavior and touch-action CSS rules
