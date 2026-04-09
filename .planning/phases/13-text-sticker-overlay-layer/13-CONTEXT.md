# Phase 13: Text & Sticker Overlay Layer - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Free-position overlay system: text overlays (with font/size/color/weight/alignment controls), emoji stickers, and image sticker overlays (PNG/SVG). All overlay types are draggable, resizable (corner handle), and rotatable (top handle) on the 1080×1920 canvas. Overlays render identically in the live preview (DOM layer), PNG export (Canvas API), and MP4 video export (per-frame draw).

**Explicitly NOT in scope:** overlay undo/redo beyond add and delete (OVL-F-03 future), background pill/rect text styling (OVL-F-01), text outline/shadow (OVL-F-02), curved text (OVL-F-04), sticker packs (OVL-F-05), snap-to-safe-zone alignment guides (OVL-F-06).

</domain>

<decisions>
## Implementation Decisions

### Overlay Store Architecture
- **D-01:** Overlays live in a **separate `overlayStore`** (new Zustand + Immer store, next to `gridStore` / `editorStore`). Grid mutations never touch overlays. Mirrors how `editorStore` is architecturally separate from `gridStore`.
- **D-02:** Overlay **selection lives in `editorStore`** as a new `selectedOverlayId: string | null` field. Clicking an overlay sets `selectedOverlayId` and clears `selectedNodeId`. Clicking a cell clears `selectedOverlayId` and sets `selectedNodeId`. Mutual exclusion (OVL-15) enforced by the two stores acting on each other's state.
- **D-03:** Overlay objects use a **type union**: `TextOverlay | EmojiOverlay | StickerOverlay`, each with a `type` discriminant. Shared base fields: `id`, `x`, `y` (canvas pixel space 0–1080 / 0–1920), `width`, `rotation` (degrees), `zIndex`. Type-specific fields:
  - `TextOverlay`: `type: 'text'`, `content`, `fontFamily`, `fontSize` (16–256px), `color`, `fontWeight: 'regular' | 'bold'`, `textAlign: 'left' | 'center' | 'right'`
  - `EmojiOverlay`: `type: 'emoji'`, `char` (the emoji character)
  - `StickerOverlay`: `type: 'sticker'`, `stickerRegistryId` — never inline base64

### Undo / Redo
- **D-04:** Undo/redo tracks **add and delete** overlay actions only. Move/resize/rotate actions are NOT in the undo history in this phase (OVL-F-03 is future). Each `addOverlay` and `deleteOverlay` call pushes exactly one snapshot into the gridStore history (same `pushSnapshot` mechanism as existing actions — overlayStore and gridStore share the snapshot array, or overlayStore calls gridStore's pushSnapshot).
- **D-05:** Planner decides whether `overlayStore` calls `gridStore.pushSnapshot` directly, or whether a combined snapshot captures both grid tree + overlay array together. Goal: one Ctrl+Z undoes one add/delete.

### Sticker Registry
- **D-06:** Image sticker base64 goes into a `stickerRegistry` (mirroring `mediaRegistry`) with only an `id` reference in the `StickerOverlay` node. Never inline base64 in the overlay store or history snapshots.
- **D-07:** User-uploaded SVG content is sanitized with **DOMPurify** at upload time before storing or rendering. The `Image()` → blob URL path is safe for rendering; sanitization is the upload-time gate.

### Coordinate Space
- **D-08 (ROADMAP lock):** All overlay `x`, `y`, `width` are stored in **canvas pixel space (0–1080 × 0–1920)**, not viewport pixels. The `canvas-surface` CSS transform scales all children automatically; viewport-space coordinates would require re-projection on every resize.

### Live Editor Rendering (DOM Layer)
- **D-09:** In the live editor, overlays render as **DOM elements absolutely positioned over the canvas container**, transformed via CSS (`translate` + `rotate`). The canvas element itself does NOT render overlays during editing — only during PNG/MP4 export. WYSIWYG parity is maintained by keeping DOM rendering visually identical to canvas rendering.
- **D-10:** A new `OverlayLayer` component sits as a sibling to the canvas inside `CanvasWrapper` (or `CanvasArea`). It renders all overlays from `overlayStore` as absolutely-positioned divs, scaled proportionally to the canvas's current viewport scale (from `editorStore.canvasScale`).
- **D-11:** Drag, resize, and rotate handles are **React component handles on the DOM overlay wrapper**. Each selected overlay gets corner handles (resize, proportional) and a top handle (rotate), using raw **pointer events** (`pointerdown` / `pointermove` / `pointerup` with `setPointerCapture`) — same pattern as `Divider` and pan/zoom from prior phases. No dnd-kit for overlays.

### Text Editing UX
- **D-12:** Text content is edited **inline** via a double-click (or click-to-select then click-again): a `<div contenteditable>` (or `<textarea>`) is absolutely positioned over the canvas in viewport space, scaled to match the overlay's visual size and position. Canvas updates as the user types (live preview of the overlay on the DOM layer updates immediately from the `contenteditable` value).
- **D-13:** Single-click selects the overlay (shows handles). Double-click (or a second single click after select) enters edit mode. Pressing `Escape` or clicking outside exits edit mode and commits the content.
- **D-14:** The Sidebar also shows a text input field for the selected text overlay's content — both sync to the same store field. Sidebar input is the fallback for mobile where double-click is less reliable.

### Text Overlay Controls (Sidebar)
- **D-15:** Sidebar `SelectedCellPanel` (or a new `OverlayPanel` sibling) shows text controls when a `TextOverlay` is selected: content input, font picker, size slider (16–256px), color picker, weight toggle (Regular / Bold), alignment picker (L / C / R).
- **D-16:** Font picker renders as a **dropdown where each option label is displayed in its own typeface** — Geist, Playfair Display, Dancing Script visible in their respective fonts.

### Font Loading
- **D-17:** Load **Playfair Display** and **Dancing Script** via `<link>` in `index.html` at build time (Google Fonts). Total font stack: Geist (already loaded) + Playfair Display (serif display) + Dancing Script (script/handwriting) = 3 fonts for OVL-03. 
- **D-18:** PNG/MP4 export must call `document.fonts.ready` before any `ctx.fillText()` that uses these fonts — otherwise the browser may fall back to a default font on first render.

### Emoji Picker
- **D-19:** Use the **`emoji-mart` library** for the emoji picker panel. Add it as a **lazy-loaded chunk** (dynamic import) so it doesn't hit the initial bundle. Lazy-load triggers on first open of the picker panel.
- **D-20:** Emoji picker panel appears as a **popover from an "Add" toolbar button** — same UX pattern as `TemplatesPopover` (`src/components/TemplatesPopover.tsx`).
- **D-21:** Emoji stickers render on canvas (in export) via **`ctx.fillText(char, x, y)`** with a large font size. The `EmojiOverlay.char` stores the raw emoji character. Rendering is system-font dependent; this is acceptable for Instagram story use cases.

### Export (Canvas API + Video)
- **D-22:** PNG export (`src/lib/export.ts`) adds an **overlay draw pass after all cells are drawn** — overlays sit above all cells. For each overlay in `zIndex` order: draw text (`ctx.fillText`), emoji (`ctx.fillText`), or image sticker (`ctx.drawImage` from the stickerRegistry image).
- **D-23:** MP4 export (`src/lib/videoExport.ts`) renders overlays **on every frame** in the render loop, same pass ordering as PNG. Text/emoji use `ctx.fillText`; image stickers use `ctx.drawImage`. Overlay positions and styles don't change per-frame (they are static over the video duration).
- **D-24:** Overlay rendering in export reads directly from `overlayStore.getState()` — no prop threading required.

### Z-Ordering
- **D-25:** Overlays maintain a `zIndex` integer field. "Bring Forward" increments it; "Send Backward" decrements it. Rendering order in both DOM layer and canvas export follows ascending `zIndex`. Planner handles normalization if gaps form.

### Claude's Discretion
- Exact Tailwind styling of the overlay DOM elements (border, handle size/color).
- Whether `OverlayPanel` is a new sidebar section or folded into `SelectedCellPanel` via a type switch.
- Exact sizing of the corner and rotation handles (likely matching the 8–12px thumb size from prior interactive patterns).
- Whether `overlayStore` uses `zustand/middleware/immer` (recommended, matching `gridStore`) or plain Zustand.
- Whether snapshot merging across gridStore + overlayStore is done by copying overlay array into the grid snapshot, or by a separate parallel snapshot array.
- Whether the inline `contenteditable` uses a raw `div[contenteditable]` or a controlled `<textarea>` resized to fit.
- The specific "Add" toolbar button layout (icon + label vs icon-only, popover position).
- Exact `emoji-mart` version and configuration (skin tone, theme: dark to match editor).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Overlay Layer — OVL-01 through OVL-17, the acceptance criteria this phase must satisfy
- `.planning/ROADMAP.md` §Phase 13 — goal, success criteria, key pitfalls (canvas pixel space, stickerRegistry, DOMPurify SVG sanitization)

### Prior Phase Context (relevant decisions carried forward)
- `.planning/phases/11-effects-filters/11-CONTEXT.md` — drawLeafToCanvas as the unified export draw path; effects applied inside it; canvas.filter usage pattern
- `.planning/phases/12-per-cell-audio-toggle/12-CONTEXT.md` — mediaRegistry / stickerRegistry mirror pattern; overlayStore snapshot integration with gridStore.pushSnapshot

### Existing Codebase Patterns
- `src/store/gridStore.ts` — pushSnapshot pattern; Immer store structure to mirror
- `src/store/editorStore.ts` — selectedNodeId to extend with selectedOverlayId
- `src/Grid/Divider.tsx` — pointer event / setPointerCapture interaction pattern to reuse for drag/resize/rotate handles
- `src/components/TemplatesPopover.tsx` — popover-from-toolbar pattern for the emoji picker
- `src/lib/export.ts` — canvas draw path; overlay pass goes after all cells are drawn
- `src/lib/videoExport.ts` — per-frame render loop; overlay draw pass inserted same location
- `src/Grid/CanvasWrapper.tsx` — where the new `OverlayLayer` component sits as a sibling to the canvas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gridStore.pushSnapshot` — existing undo snapshot mechanism; overlayStore add/delete calls this
- `editorStore.selectedNodeId` / `setSelectedNode` — mutual exclusion pattern to replicate for overlay selection
- `TemplatesPopover.tsx` — popover component pattern for the emoji picker panel
- `Divider.tsx` pointer event loop — drag interaction to reuse for overlay drag/resize/rotate handles
- `src/lib/export.ts drawLeafToCanvas()` — unified draw path; overlay pass added after cell loop
- `src/lib/videoExport.ts` render loop — overlay pass added per-frame alongside cell draw

### Established Patterns
- Canvas pixel space coordinates: all spatial values at 1080×1920 scale
- Type union with discriminant (`type: 'leaf' | 'container'`): same pattern for `TextOverlay | EmojiOverlay | StickerOverlay`
- Store separation: gridStore owns tree, editorStore owns UI state, overlayStore owns overlays
- Immer middleware on all Zustand stores (required for nested state)
- Registry pattern for large binary data: `mediaRegistry` → `stickerRegistry`

### Integration Points
- `src/Grid/CanvasWrapper.tsx` or `src/Editor/CanvasArea.tsx` — new `OverlayLayer` renders as a sibling div inside the canvas container, same dimensions as canvas, pointer-events: none on the container (pointer-events: auto on individual overlay elements)
- `src/Editor/Sidebar.tsx` — new `OverlayPanel` section or type-switch in `SelectedCellPanel` for when `selectedOverlayId` is set
- `src/Editor/Toolbar.tsx` — new "Add" button to trigger text/emoji/sticker add actions
- `src/index.html` — Google Fonts `<link>` for Playfair Display + Dancing Script

</code_context>

<specifics>
## Specific Ideas

- Font trio: **Geist** (already loaded, sans-serif default), **Playfair Display** (elegant serif for display-style text), **Dancing Script** (flowing handwriting/script). These are common Instagram story font aesthetics.
- Emoji picker uses emoji-mart as a lazy-loaded chunk. Opens as a popover from the toolbar "Add" button — same popover pattern as `TemplatesPopover.tsx`.
- Emoji chars stored raw in `EmojiOverlay.char`; rendered via `ctx.fillText()` on export — no rasterization overhead.
- Inline text editing: single-click selects (shows handles), double-click opens `contenteditable` div scaled to overlay position. `Escape` or outside-click commits and exits edit mode.
- Overlay selection is mutually exclusive with cell selection: setting `selectedOverlayId` clears `selectedNodeId` and vice versa.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-text-sticker-overlay-layer*
*Context gathered: 2026-04-10*
