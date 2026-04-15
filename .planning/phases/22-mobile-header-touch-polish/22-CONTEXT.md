# Phase 22 Context: Mobile Header & Touch Polish

## Phase Summary

**Goal**: Mobile users can access all primary editor actions and the canvas responds correctly to touch without scroll interference.

**Requirements**: HEADER-01, HEADER-02, SCROLL-01, SCROLL-02

---

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 22 goal, success criteria, requirements
- `.planning/REQUIREMENTS.md` — HEADER-01, HEADER-02, SCROLL-01, SCROLL-02 definitions
- `src/Editor/Toolbar.tsx` — Current mobile branch (lines 94–109) to be replaced
- `src/Editor/ExportSplitButton.tsx` — Component to adapt for mobile
- `src/Editor/CanvasArea.tsx` — Where overscroll/touch-action changes land
- `src/Editor/EditorShell.tsx` — Root layout where body-level overscroll-behavior lands

---

## Decisions

### Header Layout — Icons only, no wordmark on mobile

Remove the "StoryGrid" wordmark entirely on mobile. The header becomes a full-width icon toolbar with 5 buttons: **Undo, Redo, Templates, Export (split), Clear**.

- All buttons: minimum 44×44px tap target, ≥8px gaps between them
- No text labels — icon-only
- The wordmark is already hidden on mobile in spirit; dropping it entirely frees full width for actions

**Implementation note**: The existing mobile branch in `Toolbar.tsx` (lines 94–109) is fully replaced by the new icon toolbar. The `isMobile` conditional stays; only the returned JSX changes.

### Export Button on Mobile — Full ExportSplitButton, icon form factor

Mobile gets the same `ExportSplitButton` functionality as desktop (PNG/MP4 format choice via dropdown), but adapted to icon form:

- Left half: upload/export icon → triggers export with current format
- Right half: small `▾` chevron → opens format/quality dropdown
- Total: 44×44px container (the two halves split that width)
- The `ExportSplitButton` component should accept a prop or detect mobile to switch to icon-only rendering, OR a new `MobileExportButton` wrapper renders it differently — Claude's discretion on implementation approach

### Clear Button on Mobile — No confirmation dialog

Tapping Clear on mobile immediately clears the canvas with no `window.confirm()`. Undo is always available. The confirmation is desktop behavior only.

**Implementation**: In the new mobile header Clear button handler, call `clearGrid()` directly without the `window.confirm()` guard.

### Touch/Scroll Polish — Implementation decisions (no user input needed)

SCROLL-01 and SCROLL-02 are mechanical changes Claude handles:

- **SCROLL-01** (`overscroll-behavior: contain`): Apply to both the canvas area wrapper in `CanvasArea.tsx` and the `<body>` or root `<div>` in `EditorShell.tsx` / `index.css`. The MobileSheet already has `overscrollBehavior: 'contain'` on its inner content div — extend this to the canvas wrapper.
- **SCROLL-02** (`touch-action: manipulation`): Add to all interactive elements (buttons, the canvas area). The most effective approach is a global CSS rule targeting `button, [role="button"], input, select, textarea` plus the canvas wrapper. Existing `touchAction: 'none'` on CanvasArea when sheet is open is correct behavior — the `manipulation` value applies when sheet is closed.

---

## Deferred Ideas

None captured during this discussion.

---

## Prior Decisions Applied

- [Phase 5.1] Mobile layout uses CSS-driven `hidden md:flex` breakpoint — new mobile header follows same pattern (`isMobile` via `useMediaQuery('(max-width: 767px)')`)
- [Roadmap v1.4] ActionBar stays desktop-only (hover-gated); mobile gets the new CELL tray in Phase 24 — no changes to portal ActionBar in this phase
- [Phase 7] ActionBar uses portal to viewport-space — unrelated to this phase, no changes

---

## Out of Scope (Phase 22)

- Bottom sheet redesign (Phase 23)
- Cell action tray (Phase 24)
- Touch drag-and-drop (Phase 25)
- Adding text/sticker overlays from mobile header (not in requirements)
- Zoom controls on mobile header (desktop-only feature, not in requirements)
