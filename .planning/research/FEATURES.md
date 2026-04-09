# Feature Research

**Domain:** Instagram Story collage editor — v1.2 Effects, Overlays & Persistence
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH (grounded in real tool behavior; some mobile-specific UX verified via multiple sources, audio edge cases LOW confidence)

---

## Domain Context

This is a **subsequent milestone** research document. StoryGrid already ships: recursive split-tree grid, per-leaf media (image + video), Canvas API PNG/JPEG export, MediaRecorder MP4 export, safe zone overlay, templates, gap/radius/border controls, mobile bottom sheet, undo/redo, portal-based ActionBar, and cell move/swap.

v1.2 adds four capability clusters: per-cell effects/filters, global text+sticker overlay layer, project persistence, and per-cell audio toggle on video export.

Comparators studied: Instagram Stories editor, Canva, CapCut, Unfold, Pixlr, Photopea, tldraw (persistence model), Procreate (file format model).

---

## 1. Per-Cell Effects & Filters

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Preset filter carousel (6–10 named presets) | Every comparable tool (Instagram, CapCut, Canva, Pixlr) leads with one-tap named presets. Users expect B&W/sepia/vivid/fade at minimum. | MEDIUM | Implement as named combinations of Canvas 2D filter strings. Canonical baseline: Normal, B&W (grayscale 100%), Sepia, Vivid (contrast+saturation boost), Fade (brightness+low contrast), Warm, Cool. |
| Per-preset intensity slider | Instagram's own UX: select filter, then tap again to reveal a 0–100% strength slider. Users expect "turn it down a notch." | LOW | Scale each filter's parameters linearly from 0 (identity) to 100 (full preset). |
| Manual adjustment sliders: brightness, contrast, saturation | Canva calls these out explicitly; so does every mobile editor. Missing = product feels unfinished. | LOW | Map to Canvas 2D `brightness()`, `contrast()`, `saturate()` filter functions. |
| Non-destructive application (reset to original) | Canva, Photopea, Lightroom all allow reverting. Users expect "undo filter" without losing undo history. | LOW | Store filter params as data alongside MediaItem; never bake into pixel data. "Reset" zeros all params. |
| Live preview while dragging sliders | Universal expectation since mobile photo editors normalized it circa 2018. | LOW | Apply params on every slider `onChange` event; no debounce needed at cell-canvas level. |
| Per-cell application | Multi-cell collage context demands per-cell control. Global-only adjustment would break the core product proposition. | LOW | Attach `CellEffect` object to each LeafNode; render during existing `drawLeafToCanvas()` call. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Extended slider set: warmth (hue-rotate), blur, vignette, fade | Canva ships brightness, contrast, saturation, warmth, vibrance, clarity, highlights, shadows, fade, vignette. Users who have used Canva will look for warmth and vignette. | MEDIUM | Warmth = `hue-rotate()` small angle (±20 deg). Vignette = radial gradient drawn over cell after image. Blur = `blur()`. Fade = brightness up + contrast down. |
| Compare-to-original hold gesture | Instagram Stories has a hold-to-compare pattern. Validates the filter isn't overdone. | LOW | On `pointerdown` on a "Compare" button (or long-press cell), temporarily set all filter params to identity for preview. Release restores. |
| "Auto enhance" one-tap preset | Google Photos, SnapSeed. Sets brightness/contrast/saturation to computed "best" values. | HIGH | Requires pixel analysis (histogram). Defer or ship as fixed "balanced" preset rather than truly adaptive. Anti-feature if adaptive — too complex for v1.2. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Destructive apply (bake into pixel data) | Seems simpler | Breaks undo, cannot reset, bloats history snapshots with raw pixel arrays | Keep filter params as JSON data on LeafNode; apply at draw time |
| Global filter across all cells simultaneously | "Apply to all" UX | Conflicts with per-cell creative intent; easy to accidentally flatten the collage look | Provide a "copy filters to all cells" explicit action as a v1.3 differentiator |
| CSS filter on the `<canvas>` element in the editor preview | Tempting shortcut — CSS filter renders in-browser cheaply | Does not carry through to Canvas API export; WYSIWYG breaks | Apply via `ctx.filter` in `drawLeafToCanvas()` so preview and export share the same code path |
| Adaptive auto-enhance | Users see it in Google Photos | Requires pixel histogram analysis; heavy on main thread; out of scope for v1.2 | Fixed "Vivid" and "Balanced" presets satisfy the same user need |

### Implementation Notes

Canvas 2D `ctx.filter` supports: `blur()`, `brightness()`, `contrast()`, `grayscale()`, `hue-rotate()`, `invert()`, `opacity()`, `saturate()`, `sepia()`, `drop-shadow()`. **Browser compatibility warning:** `CanvasRenderingContext2D.filter` is marked "not Baseline" by MDN — test on Safari 15 explicitly. Chrome 90+ and Firefox 90+ have full support; Safari 15 support is partial. Fallback: draw image, then apply CSS `filter` on a hidden `<canvas>` and read back pixels (expensive but correct).

Named preset catalog (v1.2 baseline):

| Name | Filter String |
|------|--------------|
| Normal | `none` |
| B&W | `grayscale(1)` |
| Sepia | `sepia(0.85) contrast(1.1)` |
| Vivid | `saturate(1.6) contrast(1.15)` |
| Fade | `brightness(1.12) contrast(0.82) saturate(0.7)` |
| Warm | `hue-rotate(-15deg) saturate(1.2) brightness(1.05)` |
| Cool | `hue-rotate(15deg) saturate(0.9) brightness(0.97)` |
| Drama | `contrast(1.4) saturate(0.8) brightness(0.9)` |

---

## 2. Text & Sticker Overlay Layer

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free-position text via drag | Instagram, Canva, CapCut — tap to add, drag to place. No grid/snap required as baseline. | MEDIUM | Overlay items stored as list with `{x, y}` (0–1 normalized to canvas dimensions). Rendered above grid. |
| Font size control | Every text tool ships this. No size control = unusable. | LOW | Slider or stepper, range 12–200px at 1080×1920 resolution. |
| Text color picker | All tools. | LOW | Color picker (HSL wheel or swatch grid). |
| Font weight (bold / normal) | Instagram has Bold as a top-level toggle. Canva exposes full weight list. | LOW | At minimum: Normal / Bold toggle. Full weight selection is differentiator. |
| Alignment (left / center / right) | Standard text tool expectation. | LOW | Three-button toggle in text toolbar. |
| Delete overlay item | Trash icon or drag-to-trash-zone or backspace. | LOW | All three patterns seen across tools. |
| Emoji picker → emoji as text | Instagram Stories emoji is a core creation pattern for the target audience. | MEDIUM | Use native OS emoji input (contenteditable trick or `<input>` with emoji keyboard on mobile) OR ship a simple categorized picker library. |
| Two-finger pinch to resize + rotate on mobile | CapCut, Instagram, Canva — universal mobile gesture for overlay items. Single-handle resize is desktop-only. | MEDIUM | Track two touch points on overlay item; compute scale delta and angle delta between frames. |
| Corner handle drag to resize (desktop) | Desktop equivalent of pinch. Canva, Figma, Google Slides all use corner handles. | LOW | Render 4 corner handles + 1 rotate handle on selected overlay item. |
| Separate rotate handle (desktop) | Canva, Google Slides — users expect a circular handle above the selection box. | LOW | Can share the top-center handle position. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Text background styles: none / solid pill / solid rect | Instagram provides: None, Colored background (pill), Strong background (rect). Canva has similar. Makes text legible on busy imagery. | LOW | Render filled rounded rect behind text bounding box in `drawOverlayToCanvas()`. |
| Text outline / stroke | Instagram's "outline" style; Canva text effects. Adds legibility without background. | LOW | `ctx.strokeText()` with configurable color and lineWidth. |
| Text shadow | Canva "Shadow" effect. Soft or hard. | LOW | `ctx.shadowBlur`, `ctx.shadowColor`, `ctx.shadowOffsetX/Y`. |
| Snap to center / edge guidelines | Canva and Figma show temporary alignment guides when dragging close to horizontal or vertical center, or canvas edges. | MEDIUM | Compute snap zones on drag; display a temporary guide line. Applies to both text and sticker items. |
| Image sticker upload (user PNG/SVG) | Over, Unfold — upload a PNG (ideally with transparent background) as a sticker. Core creative differentiator. | MEDIUM | Accept `image/*` files. Store as base64 in overlay item (same strategy as cell images). Render via `ctx.drawImage()`. |
| Z-index reordering (bring forward / send back) | Canva exposes this for all layers. tldraw ships it. For collages with many overlays, essential. | LOW | Store overlay list with explicit order; "Bring to Front" = move to end of array; "Send to Back" = move to start. Expose via right-click context menu or long-press menu. |
| Font family picker (curated set) | Canva's brand differentiator is font variety. For v1.2, a curated set of 8–12 Google Fonts covers the story aesthetic. | MEDIUM | Load fonts via Google Fonts CDN (lazy). Display as preview swatches not just names. |
| Snap to safe zone boundary | StoryGrid already has a safe zone overlay — snap text to its inner edge is a natural extension. | LOW | Given safe zone is a known CSS variable (`--safe-zone-top`, `--safe-zone-bottom`), the snap threshold is straightforward. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full animation / motion text (bounce, fade-in keyframes) | Looks impressive in demos | Export pipeline (MediaRecorder canvas rAF loop) would need per-frame animation state machine; massive complexity jump | Defer to v1.3 or later; static text covers 90% of story use cases |
| Real-time collaborative text editing | Modern doc tools do this | Zero-backend constraint makes this impossible by design | Out of scope permanently |
| Text on path / curved text | Seen in Over and Spark AR | Requires canvas path measurement; high complexity for niche use case | Defer beyond v1.3 |
| Background removal from uploaded sticker images | Adobe Express does this via AI | Requires ML model (Segment Anything / rembg); ~20MB WASM; violates 500KB bundle budget | Advise user to pre-remove background in a separate tool; accept transparent PNG |
| Native emoji rendering in export | Emoji look different across OS | Canvas renders emoji via OS font; output is not portable across platforms | Document this clearly; do not attempt to override OS emoji glyphs |
| Full layer panel (Figma-style) | Power users want it | Overkill for typical 3–8 overlay items in a story | Z-index via bring-forward / send-back context menu is sufficient |

### Implementation Notes

Overlay layer is a new top-level data structure: `OverlayItem[]` in the store, separate from the grid tree. Each item has a type discriminant (`text | emoji | sticker`), normalized position (0–1 relative to 1080×1920), scale, rotation, and type-specific payload. Renders above the grid in both the editor canvas and the export pipeline. The ActionBar portal architecture already escapes the grid stacking context — overlay items render in their own React layer on top of the canvas preview, with their own event handlers. Export: `drawOverlayToCanvas()` iterates the list after `drawGridToCanvas()` completes.

---

## 3. Project Persistence

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-save current project on every change | Any tool that stores user work does this. Losing a collage due to tab close = immediate churn. | LOW | Zustand store subscribe → debounced write (500–800ms after last change) to IndexedDB. Do NOT use localStorage for project data — 5MB limit is too small once base64 images are included. |
| Named project list (save / load / rename / delete) | Figma, Canva, Procreate — all present a project manager. "Recent files" is the minimum; named projects is the expectation. | MEDIUM | Simple list UI in a modal or sidebar panel. Each project is a record in IndexedDB keyed by `nanoid()`. |
| Export current project as `.storygrid` file | Users expect to be able to back up their work or share it. File export is table stakes for any creative tool that doesn't have cloud. | MEDIUM | Serialize project state to JSON, offer as download via anchor element. Extension `.storygrid`. |
| Import `.storygrid` file | Pair with export. Without import, export is a dead end. | LOW | `<input type="file" accept=".storygrid">` → parse JSON → load into store. |
| Schema version field in serialized format | Any tool that evolves its data model needs this. Without it, old files break silently. | LOW | `{ "version": 2, ... }` top-level field. Run migrations on load if version < current. |
| Media embedded in project file (base64) | Users who export `.storygrid` expect to be able to import it on another device or after clearing browser storage. Reference-only (blob URLs) breaks on import. | MEDIUM | Convert all media to base64 on export. On import, convert back to object URLs. This matches the existing image storage strategy (base64). Video files are large — warn user if project file exceeds 50MB. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Autosave" indicator in toolbar | Notion, Figma — "Saved" / "Saving…" status label. Gives users confidence. | LOW | Observe IndexedDB write promise; show transient "Saved" label. |
| Project thumbnail in project list | Canva shows a preview image for each design. Makes the list scannable. | MEDIUM | Render a small PNG thumbnail (e.g. 320×568px) at save time using the existing Canvas API export pipeline at reduced resolution. Store as base64 alongside project data. |
| "Duplicate project" action | Figma's most-used project action after open. | LOW | Clone the project record in IndexedDB with a new ID and appended " (copy)" in name. |
| Autosave recovery modal on load | If a crash interrupted the last session (detected by a "dirty" flag that gets cleared on clean save), offer to restore. | MEDIUM | Set `lastSaveDirty = true` at session start; clear on successful autosave; on next load, if `dirty`, show "Restore unsaved changes?" dialog. |
| Storage quota warning | IndexedDB quota varies by browser (typically 50–500MB). Projects with many embedded videos can exceed it silently. | LOW | Check `navigator.storage.estimate()` after each save; warn if usage > 80% of quota. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| localStorage for project data | Simple API, familiar | 5MB origin limit; base64 images easily exceed this for a single project; writes block main thread | IndexedDB: async, no size limit in practice, can store binary directly |
| Cloud sync / server backup | Users expect it from Canva | Violates zero-backend constraint permanently | Document the `.storygrid` export as the backup path; cloud is a post-v2 consideration |
| Git-style version history per project | Power users want "go back to yesterday's version" | Extreme storage overhead per project; full undo/redo is already in-session via existing history mechanism | The existing 50-entry undo stack covers in-session recovery; file-level versioning is out of scope |
| Zipped binary bundle (assets as files in a zip) | Smaller than base64 JSON; Figma does something similar | Requires JSZip or native compression; more complex import/export pipeline | Plain JSON with base64 inline is simpler and sufficient for the use case; if size is a problem, add compression as v1.3 differentiator |
| Pretty-printed JSON in export file | Developer-friendly | Bloats file size unnecessarily for large projects | Use `JSON.stringify(data)` (compact) for `.storygrid` files; pretty-print only in debug mode |
| Reference-only media (blob URL paths) | Avoids base64 bloat in file | Blob URLs are session-scoped; they die when the tab closes; importing a reference-only file on another device is impossible | Always embed media as base64 in `.storygrid` files |

### Implementation Notes

Storage strategy:
- **In-session (autosave):** Zustand subscribe → 600ms debounced → serialize state → write to IndexedDB via a thin wrapper (e.g. `idb-keyval` or raw IndexedDB). Media stays as base64 strings (images) or blob URLs (video).
- **Project file export (`.storygrid`):** Convert all blob URLs to base64 before serializing. Strip ephemeral fields (`selectedNodeId`, `zoom`, `tool`). Include schema version, project name, timestamp.
- **Project file import:** Parse JSON, validate `version` field, run migrations if needed, re-hydrate blob URLs from base64 video data, load into store.
- **Video in `.storygrid` files:** A single 1-minute 1080p video can be ~50MB as base64. Warn the user at export time if total file size > 20MB. Do not block the export.
- **IndexedDB schema:** `projects` object store, key = `projectId (nanoid)`. Fields: `id`, `name`, `createdAt`, `updatedAt`, `thumbnail` (small base64 PNG), `state` (full serialized store state with base64 media). The `thumbnail` is stored separately so the project list can render previews without loading full state.

---

## 4. Per-Cell Audio Toggle on Video Export

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-cell speaker icon toggle (on/off) in ActionBar | User has already chosen this interaction model. CapCut and mobile editors universally use an icon-based mute toggle per clip. | LOW | Add `audioEnabled: boolean` field to LeafNode (default `true` for video cells, irrelevant for image cells). Render speaker-on / speaker-muted icon in ActionBar (portal, already in viewport space). |
| Same toggle reflected in sidebar | Sidebar shows cell details; audio state should be visible and editable there too. | LOW | Mirror the toggle in SelectedCellPanel below video thumbnail. |
| Default: audio ON for newly added video cells | CapCut, iMovie default: audio is on. Users mute explicitly. On → Off is intentional; Off → On is accidental. | LOW | Initialize `audioEnabled: true` in `createLeaf()` / `setMedia()` for video cells. |
| Undo/redo support for audio toggle | Consistent with every other cell mutation in the store. | LOW | The toggle dispatches a store action that goes through the existing undo history mechanism. |
| Audio muted indicator visible on cell canvas | CapCut shows a muted speaker icon overlaid on video clips. Lets users see the state at a glance without selecting the cell. | LOW | Render a small muted speaker icon in the top-right of the cell `<canvas>` in editor mode when `audioEnabled === false`. Do not render in export. |
| Export: only enabled cells contribute audio to MP4 | The core feature. In the MediaRecorder pipeline, mixing audio from multiple video elements requires a Web Audio API graph. | HIGH | Create an `AudioContext`; for each video element with `audioEnabled: true`, create a `MediaElementAudioSourceNode` and connect to a `MediaStreamDestinationNode`; capture the audio stream alongside the canvas stream for MediaRecorder. This is the most complex part of the feature. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Volume slider per cell (0–100%) | CapCut has per-clip volume. More precise than binary mute. | MEDIUM | Extend `audioEnabled: boolean` to `audioVolume: number (0–1)`. Connect to `GainNode` in the Web Audio graph. Expose as a slider in the sidebar. |
| Global audio preview during playback | The timeline already has master play/pause. Mixing audio during preview (not just export) gives WYSIWYG feedback. | HIGH | Requires building the Web Audio graph at editor load time (not just at export time). Significant added complexity; likely defer to v1.3. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Background music track | "Add a song to my story" is a common request | Requires audio file upload, mixing pipeline, duration sync with video length, copyright considerations; large scope jump | Explicitly out of scope in PROJECT.md; users can add music in Instagram natively post-export |
| Per-cell fade-in/fade-out audio | Pro editor feature | Requires per-frame audio envelope in the Web Audio graph; disproportionate complexity | Binary mute toggle covers the core use case |
| Audio normalization / leveling | Makes clips sound consistent | Requires audio analysis pipeline | Out of scope for v1.2; add only if user feedback surfaces it |

### Edge Case: No Cells Have Audio Enabled

When all video cells have `audioEnabled: false` (or the project has no video cells):
- **Recommended behavior:** Export with no audio track at all (not a silent track). Rationale: a silent audio track wastes file size and can cause playback confusion on some devices. MediaRecorder naturally produces no audio track if no audio stream is passed to it.
- **Implementation:** Check `hasAnyAudio` before building the Web Audio graph. If false, pass only the canvas `MediaStream` (no audio tracks) to `MediaRecorder`.
- **Confidence:** LOW — browser behavior for "no audio track in MediaRecorder output" varies. Safari historically had issues with audio-track-less recordings. Test explicitly on Chrome, Firefox, and Safari (even though Safari MP4 export is deferred, the fallback behavior matters).

### Implementation Notes

The existing MediaRecorder pipeline captures a canvas `MediaStream`. To add per-cell audio mixing:

1. Create a single `AudioContext` at export start.
2. For each video `HTMLVideoElement` with `audioEnabled: true`, create `ctx.createMediaElementSource(videoEl)` → connect to a shared `GainNode` → connect to `ctx.createMediaStreamDestination()`.
3. Combine canvas stream tracks + audio destination stream tracks into a single `MediaStream` passed to `MediaRecorder`.
4. On export complete, close `AudioContext`.

Caveats: `createMediaElementSource()` "steals" the video element's audio output — the editor's audio preview will go silent unless the source is also connected to `ctx.destination`. Connect to both `ctx.destination` (preview) and the `MediaStreamDestinationNode` (export). This is relevant if global audio preview (the differentiator) is built later.

---

## Feature Dependencies

```
Per-cell effects (ctx.filter in drawLeafToCanvas)
    └──requires──> existing drawLeafToCanvas() Canvas API pipeline (ALREADY BUILT)
    └──requires──> LeafNode data model extension (add CellEffect object)

Text/sticker overlay layer
    └──requires──> new OverlayItem[] in store (new)
    └──requires──> drawOverlayToCanvas() called after drawGridToCanvas() (new)
    └──requires──> overlay items rendered above canvas preview (new React layer)
    └──enhances──> safe zone overlay (snap text to safe zone boundary)
    └──depends-on-portal-arch──> ActionBar portal is ALREADY BUILT (v1.1)

Project persistence
    └──requires──> IndexedDB wrapper (new)
    └──requires──> serialization of base64 media (images already base64; videos need conversion)
    └──requires──> schema versioning (new)
    └──enhances──> all other features (persists effects params, overlay items, audio flags)
    └──conflicts-with──> blob URLs for video (must convert to base64 for .storygrid export)

Per-cell audio toggle
    └──requires──> audioEnabled field on LeafNode (new, trivial)
    └──requires──> Web Audio API mixing graph at export time (new, HIGH complexity)
    └──requires──> existing MediaRecorder pipeline (ALREADY BUILT)
    └──optional-enhancement──> volume slider (GainNode extension)
```

### Dependency Notes

- **Effects requires drawLeafToCanvas():** The filter string must be applied as `ctx.filter` before `ctx.drawImage()` inside the existing canvas render function. This keeps export parity with the editor preview guaranteed.
- **Overlay layer requires new store slice:** Overlay items are not part of the grid tree and should not be. They live in a separate `overlayStore` or as a top-level `overlays: OverlayItem[]` field in the grid store. Either works; a separate slice is cleaner.
- **Persistence conflicts with blob URLs:** Video blob URLs are session-scoped (revoked on cleanup). When exporting a `.storygrid` file, all video blob URLs must be fetched (`fetch(blobUrl).then(r => r.arrayBuffer())`) and converted to base64 before serialization. This is the main complexity of the persistence feature.
- **Audio toggle complexity is front-loaded:** The Web Audio mixing graph is the single highest-complexity item in v1.2. It should be built and tested before the UI toggle, not after.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-cell preset filters | HIGH | LOW | P1 |
| Per-cell manual sliders (brightness, contrast, saturation) | HIGH | LOW | P1 |
| Non-destructive filter reset | HIGH | LOW | P1 |
| Auto-save to IndexedDB | HIGH | LOW | P1 |
| Named project list (save/load/delete) | HIGH | MEDIUM | P1 |
| Export/import .storygrid file | HIGH | MEDIUM | P1 |
| Schema version field | HIGH | LOW | P1 |
| Free-position text overlay | HIGH | MEDIUM | P1 |
| Text color, size, weight | HIGH | LOW | P1 |
| Emoji picker → sticker | HIGH | MEDIUM | P1 |
| Two-finger pinch resize/rotate (mobile) | HIGH | MEDIUM | P1 |
| Per-cell audio toggle (UI) | HIGH | LOW | P1 |
| Audio mixing in MP4 export | HIGH | HIGH | P1 |
| Extended sliders (warmth, blur, vignette) | MEDIUM | MEDIUM | P2 |
| Compare-to-original toggle | MEDIUM | LOW | P2 |
| Text background styles (pill, rect) | MEDIUM | LOW | P2 |
| Text outline / shadow | MEDIUM | LOW | P2 |
| Image sticker upload | MEDIUM | MEDIUM | P2 |
| Z-index reordering (bring front/back) | MEDIUM | LOW | P2 |
| Project thumbnail in project list | MEDIUM | MEDIUM | P2 |
| Snap to center / safe zone guidelines | MEDIUM | MEDIUM | P2 |
| Autosave indicator label | LOW | LOW | P2 |
| Font family picker (curated) | MEDIUM | MEDIUM | P2 |
| Volume slider per cell | LOW | MEDIUM | P3 |
| Global audio preview during playback | LOW | HIGH | P3 |
| Autosave recovery modal | LOW | MEDIUM | P3 |
| Storage quota warning | LOW | LOW | P3 |
| Duplicate project action | LOW | LOW | P3 |

---

## Competitor Feature Analysis

| Feature | Instagram Stories | Canva Story Editor | CapCut | Our Approach (v1.2) |
|---------|-------------------|--------------------|--------|---------------------|
| Filter presets | Named carousel (Clarendon, Juno, Gingham, etc.) | Named presets + custom | Named presets per clip | Named presets (8 presets) |
| Filter intensity | Tap-to-reveal slider (0–100%) | Preset intensity slider | Per-clip intensity | Preset intensity slider |
| Manual adjustments | Brightness, contrast, saturation, warmth, vignette, color (tint), fade, highlights, shadows | Brightness, contrast, saturation, warmth, vibrance, clarity, highlights, shadows, fade, vignette | Brightness, contrast, saturation, sharpen, highlight, shadow, color temperature | Brightness, contrast, saturation (v1.2); warmth, blur, vignette (P2) |
| Filter non-destructive | Yes (can remove filter) | Yes | Yes | Yes (params on LeafNode) |
| Text positioning | Free drag, snap to center | Free drag, smart guides | Free drag, snap | Free drag; snap as P2 |
| Text font controls | Limited (5 presets) | Full (hundreds of fonts) | Moderate (dozens) | Curated 8–12 Google Fonts |
| Text effects | Background color (pill), outline | Shadow, outline, glow, hollow | Animated presets | Background pill, outline, shadow |
| Sticker types | Emoji, GIFs, image stickers (from library) | Emoji, stickers (from Canva library), image upload | Emoji, stickers, image overlay | Emoji, user image upload |
| Sticker resize/rotate | Two-finger pinch + corner handles | Corner handles + rotate | Pinch + handles | Both (pinch mobile, handles desktop) |
| Z-index control | Last-added is on top, no manual reorder | Full layer panel with reorder | Timeline-based (order = time) | Bring-forward / send-back context menu |
| Project save | Instagram cloud (implicit) | Canva cloud (implicit) | Local + cloud | IndexedDB auto-save + .storygrid file |
| Project file format | Proprietary cloud | Proprietary cloud | Proprietary | JSON (.storygrid) with base64 media |
| Audio per clip | Not applicable (single clip) | Not applicable (design tool) | Per-clip mute + volume | Per-cell mute toggle |
| Audio default | N/A | N/A | On (must mute explicitly) | On |

---

## Sources

- Instagram Stories filter carousel: https://help.instagram.com/608433622656862
- Instagram filter names (Clarendon, Juno, Gingham): https://socialrails.com/blog/instagram-filters-guide
- Canva adjustment sliders: https://www.canva.com/help/image-settings/
- Canva text effects: https://www.canva.com/help/text-effects/
- CapCut overlay gestures (pinch, rotate, resize): https://www.capcut.com/resource/how-to-add-capcut-overlays
- CanvasRenderingContext2D.filter (MDN): https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
- IndexedDB best practices (web.dev): https://web.dev/articles/indexeddb-best-practices-app-state
- tldraw persistence model: https://tldraw.dev/docs/persistence
- Procreate file format (embedded assets): https://help.procreate.com/procreate/handbook/gallery/gallery-file-types
- localStorage vs IndexedDB limits: https://rxdb.info/articles/localstorage.html
- Autosave with React hooks (debounce pattern): https://www.synthace.com/blog/autosave-with-react-hooks
- MediaRecorder and audio tracks: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder
- Schema versioning patterns: https://gist.github.com/mattyod/3608613
- Instagram safe zones 2026: https://zeely.ai/blog/master-instagram-safe-zones/

---

*Feature research for: StoryGrid v1.2 — Effects, Overlays & Persistence*
*Researched: 2026-04-08*
