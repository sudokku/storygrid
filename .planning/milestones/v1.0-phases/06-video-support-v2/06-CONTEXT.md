# Phase 6: Video Support (v2) - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add video file support to cells: accept video/* in upload, render video preview via canvas rAF loop, add a playback timeline bar, and export the composition as MP4 using ffmpeg.wasm with COOP/COEP headers for SharedArrayBuffer. Safari video export is explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Video Storage Model
- **D-01:** Video files are stored as **blob URLs** (`URL.createObjectURL()`) in `mediaRegistry`, NOT as base64 dataURIs. This is a deliberate exception to the image storage model — video files (10–100MB) would freeze the tab as base64 strings.
- **D-02:** `mediaRegistry` becomes **dual-mode**: base64 dataURI for images (existing), blob URL for videos (new). Consumers must handle both; the distinction can be detected by checking `value.startsWith('blob:')` or by storing a separate `mediaType` map.
- **D-03:** **Video cells are cleared on page reload.** Blob URLs do not survive page refresh. When the app initializes, any cell whose `mediaId` resolves to a `blob:` URL that no longer exists is cleared (mediaId set to null). Images (base64) survive reload unchanged.
- **D-04:** No "missing media" placeholder state is needed. Clear-on-reload is the contract.

### LeafNode Video Rendering
- **D-05:** LeafNode stays **canvas-only** — no `<video>` element in the DOM. A hidden `<video>` element is used as a source for `drawImage()` calls. This extends the existing canvas-based rendering model without breaking the unified LeafNode abstraction.
- **D-06:** The canvas rAF (requestAnimationFrame) loop runs **only while playing**. On pause or stop, the loop cancels. A paused video shows a still frame drawn once (either on seek or on pause). This avoids continuous CPU burn when the user is not actively previewing.
- **D-07:** The hidden `<video>` element has `muted` and `playsInline` attributes. It is not appended to the DOM — held only in a ref. `object-fit` behavior (cover/contain) is applied in the canvas draw call via `drawLeafToCanvas()`, matching the existing image draw path.

### Timeline Bar UI
- **D-08:** The timeline bar lives **below the CanvasArea, above nothing** — it is a child of the canvas column (same column as CanvasArea), not full-width. It renders between CanvasArea and the bottom edge of the editor main area.
- **D-09:** Controls shown: **play/pause button** + **range scrubber** (seek input) + **current time / total duration** text (e.g., `0:03 / 0:08`). No loop toggle, no speed control, no per-track controls.
- **D-10:** The timeline bar is **only visible when at least one video cell exists** in the grid. It mounts/unmounts reactively based on whether any leaf has a video mediaId. Hidden when image-only.
- **D-11:** The scrubber represents the master playhead. Seeking updates all video elements simultaneously (sets `currentTime` on all hidden video refs). Total duration = longest video duration across all video cells.

### Video Export UX
- **D-12:** **Output duration = longest video cell.** Shorter videos loop to fill the duration. Image cells render as static frames for the full duration. No user-facing duration input.
- **D-13:** Codec: **H.264 in MP4 container**. Quality: fixed CRF ~23 (no user-facing quality slider for video). Keeps the export UI clean — no new settings added to the ExportSplitButton popover for video.
- **D-14:** **Auto-detect export path:** same Export button, no mode switching. If any video cell exists → ffmpeg.wasm path → downloads `.mp4`. If image-only → existing Canvas API path → downloads `.png`/`.jpg`. The ExportSplitButton popover hides format/quality controls when in video mode (they don't apply to ffmpeg export).
- **D-15:** ffmpeg.wasm is **lazy-loaded only when export is triggered** with video cells present (VIDE-04). The ~25MB WASM core is not bundled — loaded from CDN at runtime.
- **D-16:** Export progress uses ffmpeg's progress callback (VIDE-07). The existing Toast component shows progress: "Loading ffmpeg…" → "Encoding 0%…" → "Encoding 100%" → download. Same toast UX pattern as image export.

### COOP/COEP Headers
- **D-17:** Headers configured in `vercel.json` (and `_headers` for Netlify fallback). Required for SharedArrayBuffer (ffmpeg.wasm multi-thread). Must apply to all routes.
- **D-18:** Dev server also needs COOP/COEP headers — configure in `vite.config.ts` server.headers. Without this, ffmpeg.wasm will fail in local dev.

### Claude's Discretion
- How to track media type (image vs video) in the registry — either a parallel `mediaTypeMap: Record<string, 'image' | 'video'>` or a typed wrapper. Planner decides.
- Whether to co-locate the hidden `<video>` ref inside `LeafNodeComponent` or manage a global `videoElementRegistry` — planner decides based on sync complexity.
- Exact CRF value and ffmpeg filter graph for xstack — researcher/planner to determine based on ffmpeg.wasm 0.12.x API.
- File naming for MP4: `storygrid-{timestamp}.mp4` (consistent with existing PNG/JPEG naming pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Video Support (VIDE-01 through VIDE-07) — full acceptance criteria for this phase

### Project
- `.planning/PROJECT.md` — constraints section (ffmpeg.wasm lazy-loaded, bundle size, browser support targets)
- `.planning/ROADMAP.md` §Phase 6 — success criteria

### Prior Phase Context (relevant decisions)
- `.planning/phases/04-export-engine/04-CONTEXT.md` — export architecture (ExportSurface, toast UX, Canvas API pipeline)
- `.planning/phases/03-media-upload-cell-controls/03-CONTEXT.md` — mediaRegistry base64 pattern, FileReader approach

### External
- No external specs referenced during discussion — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Grid/LeafNode.tsx` — canvas-based rendering via `drawLeafToCanvas()`; holds `canvasRef`, `imgElRef`, `drawRef`. Video will add a `videoElRef` parallel to `imgElRef`.
- `src/lib/export.ts` — `drawLeafToCanvas()` and `loadImage()` utilities. Video export will add a parallel `drawVideoFrameToCanvas()` or extend the existing function.
- `src/Editor/Toast.tsx` — existing toast component for progress/error feedback; used by export flow already.
- `src/Editor/ExportSplitButton.tsx` — export UI entry point; will need auto-detect logic to switch between Canvas API and ffmpeg paths.
- `src/store/gridStore.ts` — `mediaRegistry: Record<string, string>` and `addMedia(mediaId, dataUri)` — will need to accept blob URLs alongside base64.
- `src/store/editorStore.ts` — `isExporting` flag already exists; will need `isPlaying: boolean`, `playheadTime: number` for timeline state.

### Established Patterns
- Media stored via `addMedia(mediaId, dataUri)` in gridStore; mediaId is a nanoid string
- Canvas rendering: `drawLeafToCanvas(canvas, img, fit, panX, panY, panScale, bgColor)` shared between preview and export
- Toast states: "Preparing…" → "Exporting…" → dismiss on success
- Stores use Zustand with Immer middleware; actions in `gridStore` push undo snapshots

### Integration Points
- `src/Editor/CanvasArea.tsx` — timeline bar will be inserted as a sibling below CanvasArea's canvas wrapper, inside the same column flex container
- `src/Editor/EditorShell.tsx` — layout orchestrator; needs to conditionally render `PlaybackTimeline` when video cells exist
- `src/Editor/ExportSplitButton.tsx` — auto-detect logic: check `getAllLeaves(root).some(l => l.mediaId && mediaRegistry[l.mediaId]?.startsWith('blob:'))` to decide export path

</code_context>

<specifics>
## Specific Ideas

- Timeline bar position confirmed with ASCII mockup: below canvas area (canvas column only), not full-width
- Blob URL dual-mode registry is a clean break from the image pattern — planner should document this clearly in the plan
- "Clear on reload" for video cells is intentional and acceptable — video sessions are ephemeral by design

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-video-support-v2*
*Context gathered: 2026-04-05*
