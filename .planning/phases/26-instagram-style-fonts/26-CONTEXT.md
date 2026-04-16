# Phase 26: Instagram-Style Fonts - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the text overlay font picker from 3 fonts to 8 Instagram-aesthetic Google Fonts, each loaded asynchronously with font-display: swap. The font picker UI must display each font name rendered in its own typeface. Mobile users must also have access to full overlay editing (font, size, color, weight, alignment, layer, delete) via the bottom sheet.

This phase does NOT include: new overlay types, animation, text effects, or any other overlay capabilities beyond font selection.

</domain>

<decisions>
## Implementation Decisions

### Picker UI
- **D-01:** Replace the native `<select>` with a custom inline scrollable list — a column of buttons, each rendering its name in that font. Always-visible in the sidebar panel (no click to open). This is the only reliable way to satisfy FONT-03 (names in own typeface) across Chrome, Firefox, and Safari.
- **D-02:** The list shows all 8 fonts. The currently-applied font is highlighted (e.g., blue accent background, consistent with existing OverlayPanel selected states). Clicking a row applies the font immediately.

### Font Loading
- **D-03:** Replace the existing `<link>` in `index.html` with a single consolidated Google Fonts link covering all 8 families. Use `&display=swap` (font-display: swap). Load only the weights used: 400 and 700 for all families; add italic 400 for Playfair Display (already loaded).
- **D-04:** The `document.fonts.ready` await in `overlayExport.ts` already handles export correctness — no changes needed there.

### Default Font
- **D-05:** Change the default `fontFamily` for new text overlays from `'Geist'` to `'Bebas Neue'`. Update `AddOverlayMenu.tsx` where the default is set. Existing overlays are unaffected (fontFamily is stored per-overlay).

### Mobile Access
- **D-06:** OverlayPanel must be accessible on mobile. When an overlay is selected on mobile, the bottom sheet shows full overlay controls — font picker, size slider, color, weight, alignment, layer order, delete. This is the same control set as the desktop Sidebar panel.
- **D-07:** Full parity: no capability gap between desktop and mobile overlay editing. The bottom sheet already scrolls, so all controls fit without truncation.
- **D-08:** The trigger for showing overlay controls in the bottom sheet is `selectedOverlayId !== null` — mirror the same condition the desktop Sidebar uses in `Sidebar.tsx` (line 499).

### Claude's Discretion
- How to detect "mobile" for routing overlay controls to the bottom sheet vs sidebar — use existing viewport/mobile detection pattern already present in the codebase (Phase 22–24 established this).
- Font list order in the picker: follow the FONT-01 order — Bebas Neue, Oswald, Dancing Script, Playfair Display, Space Mono, Pacifico, Barlow Condensed, Caveat.
- Whether to keep Geist in the font list as a 9th option or remove it — Claude's discretion. If removed, any existing text overlays with Geist will fall back to the browser default; if kept, it stays as an unlisted-but-valid value or as the last entry.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` — FONT-01, FONT-02, FONT-03 definitions
- `src/Editor/OverlayPanel.tsx` — Current font picker (<select> to replace) and full panel structure to reuse for mobile
- `src/Editor/AddOverlayMenu.tsx` — Where default fontFamily is set (line ~45) — change 'Geist' → 'Bebas Neue'
- `src/lib/overlayExport.ts` — document.fonts.ready usage (D-04: no changes needed)
- `index.html` — Existing Google Fonts <link> to replace with consolidated 8-font link
- `src/Editor/Sidebar.tsx` — Line 499: selectedOverlayId condition that gates OverlayPanel rendering — mirror this for mobile bottom sheet
- `src/types/index.ts` — TextOverlay type, fontFamily field (line ~54)

</canonical_refs>

<deferred>
## Deferred Ideas

- Mobile overlay editing was initially considered out of scope but was pulled in (D-06). No other items deferred.

</deferred>
