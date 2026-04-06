# Phase 4: Export Engine - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the full export pipeline: always-mounted ExportSurface at actual 1080×1920px, html-to-image double-call toPng() capture, PNG/JPEG format selection with quality control, download via `<a>` tag, and progress/error feedback. No video support (Phase 6), no visual polish controls like gap/radius/background (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Export Trigger Flow
- **D-01:** The toolbar Export button is a **split button**: left side triggers immediate download using last-used settings (default: PNG), right side (▼) opens a settings popover.
- **D-02:** The quick export path (left click) uses the last-selected format and quality — first run defaults to PNG.

### Export Settings UI
- **D-03:** The ▼ popover contains: **Format toggle** (PNG / JPEG segmented control) + **Quality slider** (70%–100%, only visible when JPEG is selected) + a **Download** button.
- **D-04:** The quality slider corresponds to html-to-image `quality` option mapped from 0.7–1.0 (displayed as 70%–100%).
- **D-05:** The popover is self-contained — no sidebar section needed for export settings.

### Progress & Error UX
- **D-06:** Progress and errors are shown via **toast notifications**, not inline in the button.
- **D-07:** Toast states: "⧗ Preparing…" → "⧗ Exporting…" → dismisses on success (download starts). On failure: "⚠ Export failed" toast with a "Try again" action.
- **D-08:** The Export button is **disabled** while export is in progress (prevents double-clicks).
- **D-09:** Video-guarded export (EXPO-03): if any cell contains a video, export is blocked with a clear toast message — "Export not available: remove video cells first."

### ExportSurface Architecture
- **D-10:** ExportSurface reuses the same `GridNode`/`ContainerNode`/`LeafNode` components as the live preview — no separate renderer.
- **D-11:** ExportSurface is a fixed 1080×1920px container (`position: absolute; left: -9999px; visibility: hidden`), always mounted, never conditionally rendered. No CSS `transform: scale()` — renders at actual pixel dimensions.
- **D-12:** ExportSurface subscribes to `gridStore` directly (same store as the preview). It stays in sync automatically — no props threading or manual sync needed.
- **D-13:** ExportSurface must suppress interactive behaviors (hover action bars, divider drag handles, selection borders) — pass an `isExporting` or `exportMode` prop to Grid components, or use a React context to hide interactive elements in export context.

### Double-Call Pattern (locked in requirements)
- **D-14:** html-to-image `toPng()` is called **twice** per export. First call result is discarded (blank-PNG browser paint workaround per EXPO-02). Second call result is used for download.
- **D-15:** The "Preparing…" toast maps to the first `toPng()` call; "Exporting…" maps to the second call.

### Download
- **D-16:** PNG filename: `storygrid-{timestamp}.png` where timestamp = `Date.now()`.
- **D-17:** JPEG filename: `storygrid-{timestamp}.jpg`.
- **D-18:** Download triggered via a dynamically created `<a>` tag with `download` attribute and `href` set to the data URL.

### Claude's Discretion
- Toast implementation: use a minimal custom toast (no external toast library needed for 2 states). A simple fixed-position div with transition is sufficient.
- Split button styling: consistent with existing toolbar button style (Tailwind utility classes only). The ▼ arrow is a small secondary segment separated by a divider.
- Popover implementation: can use a simple absolutely-positioned div (no Radix Popover needed for this single-use case).
- Whether to extract an `exportStore` or keep export state (isExporting, format, quality) in `editorStore` — either is fine; lean toward `editorStore` to avoid store proliferation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Export (EXPO-01 through EXPO-07) — full acceptance criteria for this phase

### Project Constraints
- `CLAUDE.md` §Technology Stack — html-to-image `^1.11.13` for MVP export; Canvas API fallback if CSS fidelity issues
- `CLAUDE.md` §Rationale and Gotchas §html-to-image — blank-PNG workaround (double-call), CORS note
- `CLAUDE.md` §Open Questions — "If html-to-image produces rendering artifacts, swap to modern-screenshot@^4.6.8 as API-compatible replacement"

### Prior Phase Context
- `.planning/phases/03-media-upload-cell-controls/03-CONTEXT.md` — Toolbar layout (D-12 through D-16), Export button placeholder position, sidebar structure
- `.planning/phases/02-grid-rendering/02-CONTEXT.md` — CanvasWrapper + canvas scale architecture, how GridNode/ContainerNode/LeafNode are composed, editorStore.zoom

### Project Reference
- `.planning/PROJECT.md` §Key Decisions — "Dual render (scaled preview + hidden full-res div): Export must be pixel-perfect 1080×1920; editor must fit viewport"
- `.planning/STATE.md` §Accumulated Context — "ExportSurface always mounted (visibility:hidden), never conditionally rendered — prevents blank-PNG race"; "All images converted to base64 at upload time (Phase 3) — prerequisite for correct Phase 4 exports"

No external specs — requirements fully captured in decisions above.
</canonical_refs>
