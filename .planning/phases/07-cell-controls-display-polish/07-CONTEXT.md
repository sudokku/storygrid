# Phase 7: Cell Controls & Display Polish - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix four specific display bugs in v1.0:
1. Cell action bar gets clipped when a cell is too small to contain it (CELL-01)
2. Action bar controls are fixed-px — appear different sizes across screen resolutions (CELL-02)
3. Empty cell placeholder icon and label are fixed-px — look wrong on 4K (CELL-03)
4. Video cells show a broken thumbnail in the sidebar because `<img src={videoBlobUrl}>` doesn't render (MEDIA-01)

No new features. All changes are confined to `LeafNode.tsx`, `ActionBar.tsx`, `Sidebar.tsx`, and the media registration path.

</domain>

<decisions>
## Implementation Decisions

### ActionBar Overflow (CELL-01)
- **D-01:** Use `overflow-visible` on the leaf cell container to let the ActionBar escape its boundary — preserves the existing absolute-positioning logic without a portal or DOM restructure.
- **D-02:** The canvas/media layer must still clip correctly. Achieve this by placing a separate clipping wrapper around the canvas element only (not the full cell container), so media stays clipped while controls can overflow freely.
- **D-03:** Ensure the canvas wrapper (and any parent between the cell and the canvas element) does not re-introduce clipping that would hide the bar again. The `overflow-visible` change must propagate cleanly through all intermediate containers up to the CanvasWrapper level.

### Sizing Units (CELL-02 + CELL-03)
- **D-04:** Replace fixed-px sizes on ActionBar buttons/icons and the empty cell icon with canvas-relative sizing using CSS `clamp()`. Target the canvas element as the size reference — not the viewport — because the canvas is the user's working area and already has known dimensions (1080×1920 scaled by `canvasScale`).
- **D-05:** The ActionBar already applies `scale(1/canvasScale)` to counteract canvas zoom. The clamp-based sizes should be authored at the logical canvas scale, so the existing inverse-scale transform keeps them stable at all zoom levels.
- **D-06:** Use a CSS custom property (e.g., `--action-bar-btn-size`) derived from canvas container size or set as a computed value, with `clamp(min, preferred, max)` to bound the extremes. Exact values are Claude's discretion.

### Empty Cell Placeholder (CELL-03)
- **D-07:** Use the same canvas-relative `clamp()` approach (D-04) for the placeholder icon size.
- **D-08:** Hide the text label on small cells — don't scale it down, just suppress it. A CSS-based threshold (e.g., container query or a class set via ResizeObserver) should hide the label when the cell is below a practical minimum height. Exact breakpoint is Claude's discretion.

### Video Thumbnail (MEDIA-01)
- **D-09:** Capture the first frame at **media registration time** — when a video file is added to the media store. Draw the first frame via a temporary `<canvas>` + `HTMLVideoElement`, then call `canvas.toDataURL('image/jpeg')` to produce a data URL stored alongside the blob URL.
- **D-10:** Store the thumbnail data URL in the existing media store (e.g., a parallel `thumbnailMap: Record<mediaId, string>` next to `mediaTypeMap`). The Sidebar reads from `thumbnailMap` when rendering video cells — no prop drilling or component-level capture needed.
- **D-11:** The Sidebar thumbnail `<img>` renders `thumbnailMap[mediaId]` for video cells and `mediaUrl` for image cells (existing behavior unchanged).

### Claude's Discretion
- Exact `clamp()` values for button and icon sizing (D-05, D-06)
- Implementation mechanism for canvas-relative sizing (CSS container queries vs. injected custom property vs. inline style from ResizeObserver)
- Exact height threshold for hiding empty cell label (D-08)
- Whether to use `seeked` event or `loadeddata` event for reliable first-frame capture in D-09

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Phase Requirements
- `.planning/REQUIREMENTS.md` — CELL-01, CELL-02, CELL-03, MEDIA-01 definitions

### Key Source Files
- `src/Grid/LeafNode.tsx` — leaf cell container, ActionBar mounting, empty cell placeholder
- `src/Grid/ActionBar.tsx` — action bar buttons and icon sizing
- `src/Editor/Sidebar.tsx:283–288` — thumbnail rendering (the `<img src={mediaUrl}>` that breaks for video)
- `src/store/gridStore.ts` — media store where `mediaRegistry` and `mediaTypeMap` live (add `thumbnailMap` here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActionBar.tsx` — self-contained, already receives `nodeId`, `fit`, `hasMedia`. No structural changes needed — only sizing CSS.
- `gridStore` `mediaRegistry` / `mediaTypeMap` — parallel map pattern already established; `thumbnailMap` follows the same pattern.
- `canvasScale` from `editorStore` — already consumed in `LeafNode` to apply `scale(1/canvasScale)` to the ActionBar wrapper; thumbnail capture does not need this.

### Established Patterns
- Media store uses parallel maps keyed by `mediaId` (`mediaRegistry`, `mediaTypeMap`). Adding `thumbnailMap` is consistent.
- `overflow-hidden` on the cell container is intentional for media clipping — D-02 requires isolating this to a canvas-only wrapper instead.
- ActionBar is already `hidden md:block` (mobile hidden) — sizing changes apply only to the desktop rendering path.

### Integration Points
- `LeafNode.tsx` mounts the ActionBar in a positioned `div` with `transform: scale(1/canvasScale)` — CSS sizing changes go here and in `ActionBar.tsx`.
- Media registration happens in `gridStore` (`addMedia` action) — thumbnail capture logic goes here or is triggered from here.
- `Sidebar.tsx` `SelectedCellPanel` reads `mediaUrl` from store — add `thumbnailUrl` selector alongside it.

</code_context>

<specifics>
## Specific Ideas

- The canvas-clipping isolation (D-02) means the cell container changes from `overflow-hidden` to `overflow-visible`, with a new inner wrapper around the `<canvas>` element that carries `overflow-hidden` instead. This is a targeted structural change.
- Thumbnail capture (D-09) must handle the async nature of video seek: create a hidden `<video>`, set `src`, listen for `seeked` (or `loadeddata`), draw to canvas, extract data URL, then clean up. Must also handle `crossOrigin` if any future URLs are cross-origin (blob URLs are same-origin, so not an issue for now).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-cell-controls-display-polish*
*Context gathered: 2026-04-07*
