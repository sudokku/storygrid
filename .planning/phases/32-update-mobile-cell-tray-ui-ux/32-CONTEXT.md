# Phase 32: Update mobile cell tray UI/UX - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the `MobileCellTray` as the primary mobile editing surface: add Effects and Audio buttons, add text labels to all buttons, make the tray horizontally scrollable, and hide the tray when the bottom sheet is fully open. Simultaneously: stop auto-expanding the sheet when a cell is tapped (tray is now the primary interaction), and compact both the app header and the sheet tab strip to Apple HIG minimum heights. No new overlay/text/sticker capabilities — this phase is entirely about the existing tray and header chrome.

</domain>

<decisions>
## Implementation Decisions

### Tray Content
- **D-01:** Add an **Effects** button to the tray. It is always visible when a cell is selected (same visibility rule as the Fit toggle — not conditional on media). Position: between Clear and Audio in the button order.
- **D-02:** Add an **Audio toggle** button (video cells only — same condition as the desktop sidebar's audio toggle: `mediaTypeMap[mediaId] === 'video'`). Position: rightmost, after Effects.
- **D-03:** Final button order: **Upload → Split H → Split V → Fit → Clear → Effects → Audio**. Clear and Audio are conditional (Clear: hasMedia; Audio: isVideo). Effects is always shown when a cell is selected.

### Tray Visual Design
- **D-04:** Add a short text label **below each icon**. Label text: Upload, Split H, Split V, Fit, Clear, Effects, Audio. Font: small/xs, same white color as icons.
- **D-05:** No active-state color changes. Icon swap is sufficient for stateful buttons: Fit already swaps Minimize2 ↔ Maximize2; Audio already swaps Volume2 ↔ VolumeX. No additional color treatment.

### Tray Layout
- **D-06:** The tray container uses **horizontally scrollable layout** (`overflow-x: auto`, `flex-nowrap`) so all buttons fit on narrow phones without clipping. Scroll indicators (fade edges) are Claude's discretion.

### Tray Position & Behavior
- **D-07:** Tray hides when **`sheetSnapState === 'full'`** — adds this condition to the existing visibility logic alongside `isDragging` and `!isVisible`. Tray is fully hidden (opacity 0, pointer-events none) whenever the sheet is fully open.
- **D-08:** **Effects button behavior:** tapping Effects calls `setSheetSnapState('full')` to expand the sheet, making the EffectsPanel visible. The tray then hides per D-07. User taps the chevron to collapse the sheet and return to the tray.

### Sheet Auto-Open Behavior
- **D-09:** **Remove the cell-selection auto-expand behavior** in `MobileSheet.tsx` (the `useEffect` on lines ~32–36 that calls `setSheetSnapState('full')` when `selectedNodeId` transitions from null → non-null). Cell tap now shows only the tray — the sheet stays collapsed.
- **D-10:** The **overlay-selection auto-expand** (lines ~40–44, same file) is **kept unchanged** — tapping a text/sticker overlay still auto-opens the sheet to the overlay panel. Only cell auto-open is removed.

### Header Compaction
- **D-11:** **Mobile app header (Toolbar mobile branch):** Compress from `h-12` (48px) to the minimum height that keeps all touch targets ≥44×44px. Target: `h-10` (40px) or tighter if padding allows 44px buttons. Exact height is Claude's discretion within the Apple HIG ≥44px touch-target constraint.
- **D-12:** **Sheet tab strip:** Compress from 60px to minimum that keeps the chevron button ≥44px. Target: ~44–48px. The collapsed `SNAP_TRANSLATE` value (`translateY(calc(100% - 60px))`) **must be updated to match** the new tab strip height, or the strip will be partially off-screen.
- **D-13:** The `SNAP_TRANSLATE` for `'full'` (`translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))`) uses 56px as the assumed app header height. If the app header changes, **this value must be updated** to avoid the sheet overlapping the header.

### Claude's Discretion
- Exact pixel values for header/tab-strip heights within the Apple HIG ≥44px touch-target constraint.
- Scroll fade edges (gradient overlays) on the tray's left/right ends — add if it looks clean, skip if not.
- Whether the Effects button scrolls the sheet content to the EffectsPanel section or simply opens the sheet to whatever position it was last at (simple path: just call `setSheetSnapState('full')`; the sheet content already shows EffectsPanel when a cell is selected).
- Label truncation strategy if a label is too long for its button width.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tray Component
- `src/Editor/MobileCellTray.tsx` — Primary file. All button additions (D-01–D-03), label additions (D-04), scroll layout (D-06), and visibility changes (D-07, D-08) land here.

### Sheet Component
- `src/Editor/MobileSheet.tsx` — D-09: remove cell-selection auto-expand useEffect (~lines 32–36). D-10: keep overlay-selection useEffect unchanged. D-12/D-13: update tab strip height and `SNAP_TRANSLATE` values.

### App Header
- `src/Editor/Toolbar.tsx` — D-11: compress mobile branch header height (`h-12` → tighter).

### Store References
- `src/store/editorStore.ts` — `sheetSnapState`, `setSheetSnapState`, `selectedNodeId`. Read before modifying sheet behavior.
- `src/dnd/dragStore.ts` — `status === 'dragging'` flag used in existing tray visibility logic; preserve.

### Audio Toggle Reference
- `src/Grid/ActionBar.tsx` — Existing audio toggle in desktop ActionBar uses `mediaTypeMap[leaf.mediaId] === 'video'` guard. Mirror this condition for the tray's audio button.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MobileCellTray.tsx` existing `BTN_CLASS`: `'min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10 ...'` — update to include `flex-col gap-0.5` for label layout (icon + label stacked vertically).
- `MobileCellTray.tsx` existing audio store selectors pattern: `useGridStore(s => ...)` with `findNode` — extend the same pattern for `mediaTypeMap` to gate the audio button.
- `MobileSheet.tsx` `SNAP_TRANSLATE`: two values (`full`, `collapsed`) — both may need updating when header/tab heights change (D-12, D-13 coupling).
- `Volume2`/`VolumeX` icons already imported in `ActionBar.tsx` — add to `MobileCellTray.tsx` imports.
- `SlidersHorizontal` or `Sliders` (lucide) for the Effects button icon — check which is already used in `EffectsPanel` to stay consistent.

### Established Patterns
- Conditional button rendering: Clear button already uses `{hasMedia && <button ...>}` pattern — mirror for Audio (`{isVideo && <button ...>`).
- `isDragging` hides tray: existing `opacity: isDragging ? 0 : (isVisible ? 1 : 0)` pattern — extend condition to include `sheetSnapState === 'full'`.
- `setSheetSnapState` called from tray is a new pattern (tray → sheet cross-coupling) — prefer calling it directly via `useEditorStore` selector.

### Integration Points
- `MobileCellTray.tsx` → add `useEditorStore(s => s.sheetSnapState)` and `useEditorStore(s => s.setSheetSnapState)` selectors for D-07 and D-08.
- `MobileSheet.tsx` → delete the `useEffect` block that calls `setSheetSnapState('full')` on cell selection (D-09).
- `Toolbar.tsx` mobile branch `<header>` → change height class and any padding for D-11.

</code_context>

<specifics>
## Specific Ideas

- The user's goal for disabling sheet auto-open: "make the Action Tray actually useful" — the sheet expanding immediately on cell tap was stealing focus from the tray and training users to ignore it. Removing auto-open puts the tray front-and-center.
- The Effects button is a deliberate path into the sheet — it replaces the need for auto-open for the most common deep-edit action.
- Header compaction is about recovering vertical canvas space on phones so the collage canvas is more prominent.

</specifics>

<deferred>
## Deferred Ideas

- **Add Overlay on mobile** (text/emoji/sticker from tray) — noted again; not in this phase.
- **Safe zone toggle / zoom controls** on mobile — still missing; deferred beyond Phase 32.
- **Overlay-selection auto-open** — kept for now; could be reconsidered if the UX feels inconsistent.

</deferred>

---

*Phase: 32-update-mobile-cell-tray-ui-ux*
*Context gathered: 2026-04-20*
