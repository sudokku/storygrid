# Phase 31: Improve mobile interactions UI/UX - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two concrete mobile canvas interaction failures: (1) browser-level zoom/scroll interfering with the in-app pinch-to-zoom on the canvas area, and (2) cell dividers being unreliable to grab and drag on touch due to a too-small hit area, the 250ms long-press drag timer firing first, and browser scroll hijacking the move. No new capabilities — pan mode, sheet, and tray are unchanged.

</domain>

<decisions>
## Implementation Decisions

### Pinch-to-Zoom / Browser Zoom Interference
- **D-01:** Apply `touch-action: none` to the `CanvasArea` `<main>` element **unconditionally** — not just when the sheet is open. Currently the conditional guard (`sheetOpen ? { touchAction: 'none' } : {}`) leaves touch-action unset when the sheet is collapsed, allowing the browser to intercept pinch gestures.
- **D-02:** Add `maximum-scale=1, user-scalable=no` to the viewport `<meta>` tag in `index.html` to prevent browser-level page zoom from competing with the in-app pinch handler. Scope: page-level (the whole page is a single-screen app — no scroll content that browser zoom would help with).
- **D-03:** The in-app pinch-to-zoom handler (Phase 5.1, in `CanvasWrapper`) stays unchanged — these fixes suppress browser interference, not the app behavior.

### Divider Resizing on Touch
- **D-04:** Widen the divider hit area from 22px to 40px (i.e., `-top-[20px]` / `-left-[20px]` offsets, `h-[40px]` / `w-[40px]`) to make the grab target reliably reachable on touch.
- **D-05:** Add `touch-action: none` to the divider hit area `<div>` (the `onPointerDown` element). This prevents browser scroll from taking over mid-drag once the user has grabbed a divider.
- **D-06:** The divider already has `data-dnd-ignore="true"` on both the outer `<div>` and the hit area `<div>`. The dnd adapter (`src/dnd/adapter/`) must check for `data-dnd-ignore="true"` on the pointerdown target and its ancestors before starting the 250ms long-press timer — if found, abort the drag activation. Verify this check exists; add it if missing.

### Claude's Discretion
- Exact pixel value for the widened divider hit area (40px is the decision but ±4px is fine if layout demands it).
- Whether the `data-dnd-ignore` check in the adapter is already sufficient or needs tightening — Claude reads the adapter code and decides the minimal change needed.
- Whether `maximum-scale=1, user-scalable=no` in the viewport meta conflicts with any existing meta tag — Claude checks `index.html` and merges cleanly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Canvas Area
- `src/Editor/CanvasArea.tsx` — D-01 applies here: the `touchAction` conditional in the `style` prop becomes unconditional.

### Divider
- `src/Grid/Divider.tsx` — D-04 (hit area size) and D-05 (`touch-action: none`) both apply here. The hit area dimensions are in the inner `<div>` className strings around line 79.

### DnD Adapter (drag activation guard)
- `src/dnd/adapter/` — D-06: check that the long-press timer aborts when `data-dnd-ignore="true"` is found on the pointerdown target or ancestor. Read all files in this directory before modifying.

### Index HTML
- `index.html` — D-02: viewport meta needs `maximum-scale=1, user-scalable=no` added.

### Pinch-to-zoom source (read-only reference)
- `src/Grid/CanvasWrapper.tsx` (or wherever Phase 5.1 pinch handler lives) — read to confirm the in-app handler is untouched by this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasArea.tsx` `style` prop: already has conditional `touchAction: 'none'` — just remove the conditional.
- `Divider.tsx` hit area `<div>`: className strings control hit-area size — change px values in `h-[22px]`/`w-[22px]` and offset values. `data-dnd-ignore="true"` already present.
- `useCellDraggable.ts`: Phase 30 added `touchAction: 'none'` to the draggable style — the pattern for suppressing touch on specific elements is established.

### Established Patterns
- `touch-action: none` scoped to specific elements (not ancestors) is the established pattern from Phase 30 (CROSS-02 decision D-02 in 30-CONTEXT.md).
- `data-dnd-ignore="true"` is an existing convention on dividers — the adapter likely already handles it; verify before adding logic.

### Integration Points
- `CanvasArea.tsx` → `style` prop on `<main>` — single-line change.
- `Divider.tsx` → hit area `<div>` className and `style` prop — two changes (size + touch-action).
- `index.html` → `<meta name="viewport">` — attribute addition.
- `src/dnd/adapter/` → pointerdown handler — conditional check for `data-dnd-ignore`.

</code_context>

<specifics>
## Specific Ideas

- The user described the pinch-to-zoom as "sometimes the browser picks up, sometimes jitters, other times works fine" — the non-determinism is because `touchAction: none` is only applied conditionally. Making it unconditional should make browser behavior deterministic.
- Divider failure: "can't reliably resize more than a few pixels because browser scroll picks up" — `touch-action: none` on the hit area div stops this cold.
- Long-press drag timer fires on the divider's parent cell because the 250ms timer starts on pointerdown on the cell body; the divider hit area sits on top but the cell's pointerdown may still register. The `data-dnd-ignore` check in the adapter is the clean fix — no pointer-event CSS tricks needed.

</specifics>

<deferred>
## Deferred Ideas

- **Add Overlay on mobile** — AddOverlayMenu (text/emoji/sticker) is desktop-only. User selected only canvas interactions for this phase; overlay access on mobile is a follow-up.
- **Missing mobile tools** — Safe zone toggle, overlay visibility toggle, zoom controls not accessible on mobile. Deferred.
- **First-use onboarding** — Mobile welcome card improvements. Deferred.
- **Two-finger pan** — User kept double-tap as the pan model; two-finger pan considered and not chosen.

</deferred>

---

*Phase: 31-improve-mobile-interactions-ui-ux*
*Context gathered: 2026-04-19*
