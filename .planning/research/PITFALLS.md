# Pitfalls Research

**Domain:** Client-side canvas collage editor — adding effects, overlays, persistence, and audio to StoryGrid v1.2
**Researched:** 2026-04-08
**Confidence:** HIGH (architecture-specific pitfalls verified against existing codebase; browser-specific claims verified against MDN / caniuse / WebKit Bugzilla)

---

## Critical Pitfalls

### Pitfall 1: ctx.filter Is Disabled By Default in All Safari Versions

**What goes wrong:**
`CanvasRenderingContext2D.filter` — the property that enables canvas-side filters like `blur(8px)`, `grayscale(100%)`, `brightness(1.5)` — is not supported in any Safari version including Safari 18. According to caniuse, Safari marks the feature as "Disabled by default" from 3.1 through the Technical Preview. Chrome 52+ and Firefox 49+ have full support; Safari has zero shipping support.

**Why it happens:**
Developers test in Chrome/Firefox where `ctx.filter = 'brightness(1.5)'` works correctly, then ship without Safari testing. At runtime in Safari, the filter assignment is silently ignored and the image draws unfiltered.

**How to avoid:**
Do not use `ctx.filter` as the primary filter path. Instead, implement effects using manual per-pixel manipulation or the Canvas ImageData API, or use an offscreen canvas with `filter:` CSS applied and then `drawImage()` that canvas. For the specific filters needed (brightness, contrast, saturation, grayscale, sepia), each has a well-known compositing equivalent:
- Brightness/contrast: apply via `ctx.globalCompositeOperation` + colored overlay draws
- Grayscale: convert via `ImageData` pixel manipulation or a ColorMatrix-equivalent approach
- Blur: draw overflowed source and clip (see Pitfall 2)

Alternatively, use a pure Canvas 2D color-matrix approach that works in all browsers without the `filter` property. Build a `applyEffects(ctx, rect, leaf)` function called in the existing `drawLeafToCanvas()` pipeline at both preview and export sites — this guarantees parity.

**Warning signs:**
- Filters visible in Chrome but completely absent in Safari
- `ctx.filter` assignment does not throw — it fails silently in Safari

**Phase to address:**
Effects & Filters phase — must be designed upfront. Cannot retrofit after building on `ctx.filter`.

---

### Pitfall 2: Blur Filter Edge Bleeding When Combined with Clip Paths

**What goes wrong:**
When `ctx.filter = 'blur(Npx)'` is applied before `drawImage()`, the Gaussian blur algorithm samples outside the image boundary and blends with transparent pixels, producing a semi-transparent fade along all four edges. In StoryGrid, each cell has a clip path applied for border-radius. The blur bleeds produce faded/transparent edges inside the clip boundary, creating a visible halo artifact particularly noticeable on cells with dark images.

The existing `drawPannedCoverImage` and `drawCoverImage` already use `ctx.save()`/`ctx.clip()`/`ctx.restore()` for border-radius clipping — adding a filter on top of this interacts with the clip bounds.

**Why it happens:**
The blur algorithm needs real pixels beyond the draw boundary. When drawing to the clip boundary exactly, there are no pixels on the outside, so the algorithm blends edge pixels with transparency.

**How to avoid:**
Draw the source image `blurRadius * 2` pixels beyond each edge of the cell rect, then let the existing clip path trim it. The formula: draw to `{x: rect.x - r*2, y: rect.y - r*2, w: rect.w + r*4, h: rect.h + r*4}` before applying the blur. The clip path from `ctx.rect(rect.x, rect.y, rect.w, rect.h)` removes the overflow, and the blur now has real pixels on all sides.

**Warning signs:**
- Blurred cells show a soft transparent border inside the cell boundary
- Artifact is proportional to blur radius — small blur hides it, large blur reveals it
- Particularly visible when blur cell is adjacent to a gap or different-colored cell

**Phase to address:**
Effects & Filters phase, blur slider implementation task.

---

### Pitfall 3: Preview/Export Filter Divergence — CSS vs Canvas Path

**What goes wrong:**
The LeafNode preview renders via `<canvas>` using `drawLeafToCanvas()`. If filters are applied as CSS `filter:` on the preview canvas element instead of inside `drawLeafToCanvas()`, the export (which calls `drawLeafToCanvas()` directly) will produce unfiltered output. The preview looks right; the PNG/MP4 export is wrong.

**Why it happens:**
CSS `filter:` on a canvas element is the path of least resistance for quick preview implementation. It works immediately in all browsers. The mistake is not wiring the same filter into the Canvas 2D draw path used by the export engine.

**How to avoid:**
Apply ALL visual effects inside `drawLeafToCanvas()` using Canvas 2D operations — never via CSS on the preview element. The existing architecture already enforces this for pan/zoom/fit. Extend the `LeafNode` type to include an `effects` object (brightness, contrast, saturation, blur, preset) and pass it through `drawLeafToCanvas()` so both paths are identical by construction.

Add an integration test that renders a leaf with a specific effect to a canvas, exports it, and asserts the export canvas pixel at the center is within tolerance of the expected filtered value.

**Warning signs:**
- Filters look correct in the editor but the exported PNG looks unfiltered
- Video export also unfiltered while preview canvas shows filters correctly
- No test failures during development because tests don't cross preview/export boundaries

**Phase to address:**
Effects & Filters phase, at the type design and `drawLeafToCanvas` extension step.

---

### Pitfall 4: Effects Stored in LeafNode Snapshot — History Bloat When Combined with Base64 Images

**What goes wrong:**
The current `pushSnapshot()` calls `structuredClone({ root: plainRoot })`. Once effects are added to `LeafNode`, the snapshots still only contain the `root` tree (not `mediaRegistry`). This is correct and intentional — base64 image data lives in `mediaRegistry` which is excluded from snapshots. However, if effects values are non-trivial objects (e.g., nested preset metadata), each slider drag fires a `pushSnapshot` producing up to 50 structuredClone calls on the full tree before the cap kicks in. With a 12-cell grid, each clone copies 12 × N effect fields per snapshot.

The real danger: if sticker/overlay embedded base64 (PNG stickers) is stored inside the `root` tree snapshot instead of a separate registry, every snapshot carries the full sticker image data. With a 200KB sticker and 50 history entries, that's 10MB of in-memory history.

**Why it happens:**
Overlay/sticker model is designed alongside the effects feature. The temptation is to embed sticker base64 directly in overlay data because it co-locates cleanly with position/rotation/scale. But the history machinery clones everything in `root`.

**How to avoid:**
Follow the existing pattern: create a `stickerRegistry` (same shape as `mediaRegistry`) and store only a `stickerId` reference in the overlay node — never the raw base64. History snapshots will then contain only IDs. Keep overlay/sticker base64 out of any snapshot path.

For effects values (numbers: brightness 0-200, blur 0-20px), the structuredClone cost is negligible — no special handling needed. Only blob-like data needs the registry pattern.

**Warning signs:**
- DevTools heap snapshot shows Memory spiking when undoing through steps with sticker overlays
- `history` array visible in Zustand devtools contains large objects

**Phase to address:**
Overlay layer phase, at the overlay data model design step. Effects phase also — confirm `effects` fields are number-only primitives, not complex objects.

---

### Pitfall 5: Overlay Coordinate Space — Three Incompatible Systems

**What goes wrong:**
StoryGrid has three coordinate spaces that are easy to confuse:
1. **Viewport/CSS pixels** — where `createPortal(document.body)` elements like ActionBar live. Pointer events use `clientX/clientY`.
2. **Scaled preview space** — the canvas is displayed at `transform: scale(K)` where K varies with viewport. Mouse events inside the canvas wrapper have coordinates in scaled CSS pixels.
3. **Canvas space (1080×1920)** — the internal coordinate system used by all drawing, export, and the `drawLeafToCanvas()` pipeline.

Overlay items (text, stickers) need to be positioned in one canonical system. If stored in CSS pixels, they break when the editor is resized or zoomed. If stored in viewport pixels, they depend on window size. If stored in canvas space (1080×1920), they must be mapped through scale+translate for all pointer interactions.

**Why it happens:**
The natural instinct is to store overlay position in the same coordinates returned by pointer events. But `clientX/clientY` is in viewport space; the canvas is scaled and offset from the viewport top-left by a variable amount.

**How to avoid:**
Store ALL overlay positions in canvas space (0–1080 for X, 0–1920 for Y). Convert incoming pointer events to canvas space using:
```
const rect = canvasWrapper.getBoundingClientRect();
const scaleX = 1080 / rect.width;
const scaleY = 1920 / rect.height;
const canvasX = (event.clientX - rect.left) * scaleX;
const canvasY = (event.clientY - rect.top) * scaleY;
```
This is the same conversion already used for the pan/zoom gesture. Overlay rendering in the preview converts back: multiply by `(rect.width / 1080)`. Export uses canvas coordinates directly.

**Warning signs:**
- Overlay items appear in wrong position when browser window is resized
- Overlay position correct at one zoom level but offset at others
- Export places text in a different position than preview shows

**Phase to address:**
Overlay layer phase, at the data model and event handling design step. Must be locked in before any drag-move implementation.

---

### Pitfall 6: Hit-Testing Conflict Between Overlay Drag and Cell Selection

**What goes wrong:**
The overlay layer renders above the grid (higher z-index). When a user clicks on an empty area of the overlay (not on any overlay item), the click must fall through to the grid cells below to enable cell selection. If the overlay layer captures all pointer events, clicking a cell becomes impossible when the overlay is active.

Conversely, when dragging an overlay item, the drag must not accidentally trigger cell selection or the ActionBar portal.

**Why it happens:**
Rendering an overlay `<div>` with `position: absolute; inset: 0` captures all pointer events by default. The natural fix — `pointer-events: none` on the overlay — breaks overlay item interaction.

**How to avoid:**
Use `pointer-events: none` on the overlay container div and `pointer-events: auto` on each individual overlay item element. This allows clicks to pass through empty overlay space while still capturing events on items. For drag events on overlay items, use `stopPropagation()` selectively to prevent cell grid interaction during overlay drags.

Also guard the ActionBar portal: ActionBar shows based on `selectedNodeId`, which is set by cell click. If overlay item clicks do not call `setSelectedNode(null)` explicitly, a stale cell selection can remain active while editing an overlay item.

**Warning signs:**
- Clicking a cell while overlay mode is active does nothing
- Dragging overlay items simultaneously triggers cell split/merge actions
- ActionBar appears unexpectedly while manipulating overlay items

**Phase to address:**
Overlay layer phase, event routing task.

---

### Pitfall 7: Text Rendering Divergence Between DOM and Canvas (`ctx.fillText`)

**What goes wrong:**
Text overlays shown in the editor preview as DOM `<div>` elements will render differently than the same text drawn via `ctx.fillText()` in the export. Specific divergences:
- **Line height:** DOM `line-height` has no direct Canvas 2D equivalent. `ctx.fillText` draws single lines; manual wrapping via `ctx.measureText()` produces different line spacing.
- **Kerning and letter spacing:** `ctx.font` string parsing varies across browsers. Safari can misinterpret shorthand font strings.
- **TextMetrics cross-browser:** `fontBoundingBoxAscent` values differ by up to 21px between Chrome and Safari per browser test interop issue #427 (2024).
- **Text wrapping:** DOM wraps automatically with CSS `width` + `word-break`. Canvas requires manual word-wrap logic that must precisely match visual output.

**Why it happens:**
It is tempting to show text overlays as DOM elements (simple CSS styling) while planning to "export them to canvas later." But Canvas 2D text rendering is not a faithful replica of CSS text rendering, and the gap becomes apparent at export time.

**How to avoid:**
Use the preview canvas element itself to render text overlays using `ctx.fillText()` — do not use DOM elements for the preview. Maintain a single `drawOverlayItem(ctx, item, canvasWidth, canvasHeight)` function used identically in preview and export. For text wrapping, implement a `wrapText(ctx, text, maxWidth)` helper that returns line arrays, and use the same helper in both paths.

For Safari `ctx.font` parsing: use the canonical form `"bold 48px 'Helvetica Neue', sans-serif"` rather than shorthand. Verify the rendered font on Safari by checking `ctx.font` after assignment — Safari sometimes ignores invalid font strings silently.

**Warning signs:**
- Text in preview looks different from text in exported PNG (position, size, line breaks)
- Line breaks occur at different positions in export vs preview
- Font appears different weight/size in Safari export vs Chrome preview

**Phase to address:**
Overlay layer phase, text overlay rendering task.

---

### Pitfall 8: Emoji Rendering Inconsistency Across Platforms in Canvas Export

**What goes wrong:**
Emoji drawn via `ctx.fillText("🔥", x, y)` render as Apple Color Emoji on macOS/iOS, Noto Color Emoji on Linux/Android, and Segoe UI Emoji on Windows. The visual appearance (design, color, proportions) differs significantly between these font sets. Additionally, mobile Safari (iOS) ignores `fontSize` on emoji in canvas contexts in some historical versions and renders at a fixed size.

This is not a fixable divergence — it is an OS font system constraint. The export PNG will look different when generated on different devices.

**Why it happens:**
Emoji rendering in the browser canvas falls back to the system emoji font, which is OS-determined. There is no way to force a specific emoji font unless you embed it as a web font (which emoji color fonts are typically not available as WOFF2 for legal reasons).

**How to avoid:**
Do not render emoji via `ctx.fillText` in the export. Instead, convert emoji to a rendered image before export using one of:
1. Draw emoji to a temporary offscreen canvas using the browser's native rendering, then `drawImage()` that canvas into the export canvas (preserves OS rendering but at least bakes it in)
2. Use an emoji-as-SVG library (e.g., Twemoji) to convert emoji codepoints to deterministic SVG/PNG representations

Option 2 gives cross-platform consistency. For the MVP, option 1 is acceptable — document that emoji appearance depends on the user's OS. Add a warning UI note near the emoji picker.

**Warning signs:**
- Emoji look different on reviewer's device than creator's device
- Reports that "the fire emoji looks wrong" — this is an OS difference, not a bug

**Phase to address:**
Overlay layer phase, emoji/sticker picker task.

---

### Pitfall 9: SVG Sticker XSS via User-Uploaded SVG Files

**What goes wrong:**
SVG files are XML and can contain `<script>` tags, `javascript:` href attributes, `onload` event handlers, and `<foreignObject>` with embedded HTML. If a user-uploaded SVG is inlined into the DOM or rendered directly as an `<img>` with `src=blob:`, the script content can execute.

Even rendering an SVG via `drawImage()` onto a canvas after creating a blob URL is potentially unsafe — some browsers allow script execution within SVGs loaded as images.

**Why it happens:**
SVG looks like an image format. Developers treat it like PNG/JPEG and skip sanitization.

**How to avoid:**
Sanitize all user-uploaded SVG files with DOMPurify before any use:
```typescript
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(svgString, {
  USE_PROFILES: { svg: true, svgFilters: true }
});
```
Store only the sanitized SVG string (never the raw blob URL) in the sticker registry. When rendering to canvas, create a Blob from the sanitized string and draw it via `drawImage`. Never inject the raw SVG string into the DOM.

Pin DOMPurify to a version after the CVE-2024-47875 patch (version 3.1.7+).

**Warning signs:**
- User-uploaded SVG causes unexpected UI behavior
- Browser console shows script errors from inside SVG content

**Phase to address:**
Overlay layer phase, image sticker upload task.

---

### Pitfall 10: localStorage Quota Exceeded — Silent Auto-Save Failure

**What goes wrong:**
`localStorage` has a 5MB per-origin limit. StoryGrid stores base64 images in `mediaRegistry`. A single high-res JPEG can be 500KB–2MB as base64. A project with 6 images easily exceeds the quota. When `localStorage.setItem()` throws `QuotaExceededError`, the auto-save silently fails — the user sees no error, continues editing, closes the tab, and loses all work.

Additionally, browsers throw different error names (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, code 22) so a plain `catch (e)` may behave unexpectedly if not checking specifically.

**Why it happens:**
Auto-save is typically implemented as a fire-and-forget `useEffect` subscription. The error is thrown synchronously inside `setItem()` but is caught in a generic catch that logs to console rather than surfacing to the user.

**How to avoid:**
Wrap all `localStorage` writes in a try/catch that detects quota errors specifically:
```typescript
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (
      e.code === 22 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      return false; // Quota hit — caller must handle
    }
    throw e; // Rethrow unexpected errors
  }
}
```
On quota failure, surface a non-dismissible toast: "Project too large to auto-save. Export a .storygrid file to save your work." Do not silently swallow the error.

For video cells: video blob URLs CANNOT be persisted in localStorage at all — they are revoked on page unload. The auto-save strategy must exclude video media. For the `.storygrid` export file, videos must be either omitted or embedded as base64 (which will be large). Document this limitation explicitly in the UI.

**Warning signs:**
- Auto-save appears to work (no error shown) but project is lost on reload
- Projects with video cells reload with empty video cells
- Console shows `QuotaExceededError` that the app does not surface

**Phase to address:**
Persistence phase, auto-save implementation task.

---

### Pitfall 11: Blob URLs Must Not Be Stored in `.storygrid` Files

**What goes wrong:**
`blob:` URLs (used for video media) are session-scoped. They are created by `URL.createObjectURL()` and become invalid when the page unloads. If a `.storygrid` JSON file is exported containing `blob:https://localhost/abc-123` in `mediaRegistry`, importing that file on a different device (or even a new tab) will produce broken cells — the blob URL will 404 silently when `drawImage()` tries to use it.

The current `cleanupStaleBlobMedia()` action already handles the detection side (removes blob-URL media on startup), but the issue is upstream: storing blob URLs in the exported file in the first place.

**Why it happens:**
`mediaRegistry` is a flat `Record<string, string>`. Both base64 data URIs and `blob:` URLs are strings. Serializing the entire `mediaRegistry` to JSON includes both, without distinction.

**How to avoid:**
When generating the `.storygrid` export, filter `mediaRegistry` to exclude any entries where the value starts with `blob:`. For video cells, two strategies:
1. Omit video from the file and warn the user ("Video cells are not saved in .storygrid files")
2. Convert blob URLs to base64 before export (large file size, but preserves video)

Whichever strategy is chosen, validate in the import path: reject any `.storygrid` file whose `mediaRegistry` contains `blob:` URLs (they are useless anyway).

**Warning signs:**
- Imported `.storygrid` file shows correct grid layout but black video cells
- `drawImage()` fails silently when trying to render a revoked blob URL
- Video cells clear themselves on reload (because `cleanupStaleBlobMedia` fires)

**Phase to address:**
Persistence phase, file export and import tasks.

---

### Pitfall 12: Schema Evolution — Old `.storygrid` Files Break on New Versions

**What goes wrong:**
When a `LeafNode` gains new required fields (e.g., `effects: EffectSettings`), importing a `.storygrid` file from a prior version that lacks those fields will produce `undefined` values, potentially crashing the Canvas renderer or Zustand actions that expect the field to exist.

**Why it happens:**
JSON import typically does `JSON.parse(text)` then spreads the result directly into store state. No version check, no field migration, no default filling.

**How to avoid:**
Use Zod (already compatible with the TypeScript stack — install `zod`) to define a versioned schema for `.storygrid` files. Use `.safeParse()` to validate on import:
```typescript
const result = StorygridFileSchema.safeParse(parsed);
if (!result.success) {
  showError('Cannot open this file — it may be from an incompatible version.');
  return;
}
```
Include a `version` field in the file schema. On import, run a `migrate(fileVersion, data)` function that fills missing fields with defaults before loading into the store. Follow the pattern established by Zustand's `persist` middleware `migrate` callback.

Never blindly spread imported JSON into the store: `set({ ...importedData })` is a crash waiting to happen with schema drift.

**Warning signs:**
- Import of a `.storygrid` file throws a runtime TypeError immediately
- Canvas renderer calls `drawLeafToCanvas` with `undefined` for `effects`
- Only crashes on files created before a specific deploy date

**Phase to address:**
Persistence phase, file import task. Schema version must be established at the first persistence release and incremented on every structural change.

---

### Pitfall 13: Audio Feature Requires Significant MediaRecorder Pipeline Change — Not an Add-On

**What goes wrong:**
The current `exportVideoGrid()` in `videoExport.ts` creates a `canvas.captureStream(FPS)` and passes it directly to `new MediaRecorder(stream)`. This stream is video-only — it has no audio track. Simply toggling a cell's audio on/off has no effect without restructuring the export pipeline to:
1. Create a Web Audio API `AudioContext`
2. Create `MediaStreamAudioSourceNode` instances from the video elements' streams
3. Connect them through a `ChannelMergerNode` to a `MediaStreamAudioDestinationNode`
4. Add the audio destination's track to the canvas stream before passing to `MediaRecorder`

This is a non-trivial pipeline change, not a parameter toggle. Treating it as a quick add-on will result in a broken export that silently produces video-only MP4.

**Why it happens:**
The audio feature looks conceptually simple ("just include audio from the video cells"). The complexity is hidden in the Web Audio graph wiring that must happen before `recorder.start()` is called.

**How to avoid:**
Design the audio pipeline as a first-class architectural change to `exportVideoGrid`. The revised pipeline:
1. For cells with `audioEnabled: true`: call `video.captureStream()` on the dedicated export video element to get its `MediaStream`, then `AudioContext.createMediaStreamSource(stream)` to tap it
2. Connect all audio sources to a `ChannelMergerNode` → `MediaStreamAudioDestinationNode`
3. Call `canvasStream.addTrack(audioDestination.stream.getAudioTracks()[0])` before creating `MediaRecorder`
4. Create `MediaRecorder` from the combined stream (video from canvas + audio from merger)

Note: `video.muted = true` on the export video elements (currently set to suppress preview audio during export) must be changed — a muted `HTMLVideoElement` produces a muted `MediaStream` from `captureStream()`. Set `video.muted = false` for audio-enabled cells and manage audio suppression at the Web Audio graph level (AudioContext gain nodes) instead.

**Warning signs:**
- Exported MP4 has no audio track (silent) even when cells have `audioEnabled: true`
- `video.captureStream()` returns a stream with no audio tracks when `video.muted = true`
- Audio works in Chrome but not Firefox (sample rate mismatch — see Pitfall 14)

**Phase to address:**
Audio toggle phase, entire export pipeline task. Must be scoped as a pipeline rewrite, not a parameter.

---

### Pitfall 14: AudioContext Must Be Unlocked by User Gesture Before Export

**What goes wrong:**
`new AudioContext()` created before a user gesture is in `suspended` state (Chrome autoplay policy) or fails silently (Safari). Calling `AudioContext.createMediaStreamSource()` on a suspended context produces a valid but silent audio graph. The export produces a video file with no audio, and no error is thrown.

**Why it happens:**
`exportVideoGrid()` is called from a button click handler — which IS a user gesture in most cases. However, if the `AudioContext` is created eagerly at module load time or in a store initializer (to avoid creation cost during export), it will be created without a gesture and remain suspended.

**How to avoid:**
Create the `AudioContext` inside the button click handler — specifically inside the `exportVideoGrid` function itself, or in the React handler that calls it. Never create it at module level or in a store initializer. After creation, call `audioContext.resume()` explicitly:
```typescript
const audioCtx = new AudioContext();
await audioCtx.resume(); // Ensures it is running even if browser needs nudging
```
After export completes, call `audioCtx.close()` to release resources.

For Safari: `AudioContext` on Safari 15 also requires a user gesture. The export button click satisfies this. Do NOT pre-create the context in a `useEffect` on mount.

**Warning signs:**
- `audioCtx.state === 'suspended'` when checked after construction
- Audio works when tested via console (user gestures in DevTools count) but not in production
- Silent MP4 exported on Safari even though audio toggle is enabled

**Phase to address:**
Audio toggle phase, AudioContext initialization task.

---

### Pitfall 15: Private Browsing Disables localStorage in Safari — Crash Without Guard

**What goes wrong:**
In Safari Private Browsing mode, `localStorage` is disabled. Any call to `localStorage.setItem()` throws a `SecurityError` immediately. The auto-save feature will crash the app on every state change for Safari private browsing users. This is different from a `QuotaExceededError` — it is a `SecurityError` and must be caught separately.

**Why it happens:**
Auto-save is implemented as a Zustand subscription on every state change. In normal browsing it works. In private mode, Safari throws on the very first `setItem` call and if the error propagates up through React's render cycle, it can result in an unhandled promise rejection or React error boundary trigger.

**How to avoid:**
Wrap `localStorage` access in a detection function run at app startup:
```typescript
function isLocalStorageAvailable(): boolean {
  try {
    const key = '__storygrid_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
```
If `false`, disable auto-save silently and show a persistent banner: "Auto-save unavailable in private browsing. Export a .storygrid file to save your work."

**Warning signs:**
- Unhandled exception in Safari private tab immediately on app load
- `SecurityError: DOM Exception 18` in console
- Auto-save subscription triggers an error on every Zustand state change

**Phase to address:**
Persistence phase, storage availability check task (must be the first thing implemented before any localStorage write).

---

### Pitfall 16: Filter Slider Drag Triggers pushSnapshot on Every Mouse-Move

**What goes wrong:**
If the effects slider (`oninput` handler) calls `gridStore.updateCell()` directly, it fires `pushSnapshot` on every mouse-move event during drag (potentially 60× per second). Each `pushSnapshot` calls `structuredClone` on the entire grid tree. With 12 cells and 50 history entries being maintained, this is noticeable CPU jank during slider drag and pollutes the undo history with hundreds of near-identical snapshots.

**Why it happens:**
`updateCell` is already wired to `pushSnapshot` because all cell mutations are historically reversible. Sliders naturally fire rapidly.

**How to avoid:**
Separate the slider's "live preview" path from the "commit to history" path:
- On `onInput` (drag): update a **local React state** or a separate transient store field (not `updateCell`) and redraw the preview canvas without touching history.
- On `onPointerUp` / `onChange` (drag end): commit the final value via `updateCell()` which pushes one snapshot.

This is the same pattern React controlled inputs use for expensive operations. The preview canvas for the affected cell subscribes to the transient value during drag; on commit, the Zustand snapshot takes over.

**Warning signs:**
- Undo history fills up instantly while dragging a slider (50 undos = 50 tiny increments instead of one)
- CPU usage spikes during slider drag visible in DevTools Performance tab
- The slider feels laggy on mid-range mobile devices

**Phase to address:**
Effects & Filters phase, slider implementation task.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| CSS `filter:` on preview canvas element for effects | Fast to implement, all browsers | Export shows no effects (critical divergence) | Never |
| Storing sticker base64 inside root tree snapshot | Simple data model | 10MB+ in-memory history with 3 stickers | Never |
| Storing blob URLs in `.storygrid` file | Simple serialization | Imported video cells are always broken | Never |
| Eager AudioContext creation at module load | Lower latency on export | Silent audio in all browsers (suspended state) | Never |
| Skipping SVG sanitization for user-uploaded stickers | Faster upload flow | XSS vulnerability | Never |
| Single `JSON.parse` without schema validation on file import | One line of code | Runtime crash on schema drift | Never |
| Skipping private browsing detection for localStorage | No extra code | SecurityError crash for Safari private users | Never |
| `updateCell` on every slider tick | Simple event handler | 60 snapshots/second, jank, history pollution | Never — use transient state |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `ctx.filter` + Safari | Assume Safari supports it because it's in MDN docs | Verify caniuse — it is disabled-by-default in ALL Safari versions including 18; use Canvas ImageData or compositing instead |
| Web Audio + MediaRecorder | Create AudioContext at app init | Create inside the export button click handler; call `audioCtx.resume()` explicitly |
| `video.muted = true` + Web Audio tap | Assume muted element still exposes audio to captureStream | A muted video's captureStream returns a stream with no audio; use gain nodes in the Web Audio graph instead |
| Zustand persist + localStorage | Assume persist handles quota gracefully | persist does not catch QuotaExceededError; wrap all setItem calls manually |
| Overlay coordinate mapping | Use `event.clientX/clientY` directly | Map through `canvasWrapper.getBoundingClientRect()` and scale by `1080/rect.width`, `1920/rect.height` |
| `.storygrid` import | Spread parsed JSON directly into store | Parse with Zod schema, run version migration, fill defaults before loading |
| DOMPurify + SVG | Use default sanitize config | Use `USE_PROFILES: { svg: true, svgFilters: true }` and pin to ≥ 3.1.7 (post-CVE-2024-47875) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `pushSnapshot` on every slider tick | History floods 50 entries in 1 second of dragging; jank | Transient local state for live preview; commit on pointer-up only | Any slider with > 5px travel |
| structuredClone on large tree at 60fps | CPU spike visible in DevTools during any drag | Only call `pushSnapshot` on committed user intent, never in animation loops | Tree depth > 3 with 12+ leaves |
| Blur at 60fps in preview canvas | Frame drops in cells with high blur radius | Apply blur only in export path; use CSS `filter:` on overlay div for preview (not the leaf canvas) | Blur radius > 8px on mid-range mobile |
| Per-pixel ImageData filters in 60fps rAF | Drops below 30fps on 1080×1920 | Use compositing operations instead of ImageData for live preview; ImageData only at export | Canvas size > 500×500 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Inlining user-uploaded SVG without sanitization | XSS — malicious script executes in app context | DOMPurify with SVG profile before any use |
| Loading unsanitized SVG via `<img src=blob:>` | Contained in Chrome/Firefox but exploitable in some contexts | Sanitize then recreate blob from clean string |
| Blindly spreading imported `.storygrid` JSON into store | Prototype pollution or state corruption if file is crafted | Zod schema parse with safeParse; never use `...parsed` pattern |
| Embedding user text in `ctx.font` string directly | Not XSS, but can break canvas rendering | Validate font size is a number; whitelist font family strings |

---

## "Looks Done But Isn't" Checklist

- [ ] **Effects preview:** Verify the exported PNG matches the effect seen in the editor — not just that sliders move
- [ ] **Effects in video export:** Verify effects appear in the MP4, not just in the PNG export path
- [ ] **Blur cells in Safari:** Open in Safari 15+ — filter should degrade gracefully (no effect), not crash or show blank
- [ ] **Audio in exported MP4:** Play the MP4 in a media player (not the browser), check audio with multiple cells toggled on/off
- [ ] **Audio with `video.muted`:** Confirm export video elements are un-muted before audio tap; test that muted-toggle cells produce silence in export
- [ ] **Overlay position fidelity:** Resize the browser window, then export — overlay items should be at the same relative position as seen in the editor
- [ ] **Text in export:** Export a PNG with text overlay and compare character-by-character positioning against the preview at 1:1 pixel scale
- [ ] **Persistence quota:** Test auto-save with a project containing 8 high-res JPEGs; confirm QuotaExceededError produces a user-visible warning
- [ ] **Private browsing:** Open app in Safari private tab — confirm no crash, confirm warning banner appears
- [ ] **File import:** Import a `.storygrid` file missing the `effects` field — confirm graceful default-fill, not crash
- [ ] **Blob URL in file:** Import a `.storygrid` file containing a `blob:` URL — confirm it is rejected gracefully
- [ ] **SVG sticker:** Upload an SVG with a `<script>` tag — confirm it is sanitized and the script does not execute
- [ ] **Emoji in export:** Generate export on macOS and verify emoji appearance is documented or consistent

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ctx.filter built on Safari (discovered late) | HIGH | Rewrite all effect rendering to use compositing/ImageData; no shortcuts |
| Sticker base64 in history snapshots (memory issue) | MEDIUM | Migrate sticker registry out of root tree; add migration in loadProject |
| Blob URLs in exported .storygrid files (discovered after release) | MEDIUM | Add import-time filter to strip blob: entries; add export-time filter; users lose video cells on old files |
| AudioContext suspended (silent MP4) | LOW | Move AudioContext construction inside export handler; 5 line change |
| QuotaExceededError silently swallowed | LOW | Add try/catch wrapper around all localStorage writes with user toast |
| Schema crash on import | LOW | Add Zod parse + migration before store load; provide "Reset project" fallback |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ctx.filter unsupported in Safari | Effects & Filters — effect engine design | Test in Safari 15+: effects appear correct or degrade gracefully |
| Blur edge bleeding | Effects & Filters — blur slider task | Visual QA: blurred cell has no transparent halo at edges |
| Preview/export filter divergence | Effects & Filters — drawLeafToCanvas extension | Integration test: pixel comparison of preview canvas vs exported PNG |
| History bloat from sticker base64 | Overlay layer — data model design | Heap snapshot: history array < 1MB with 3 sticker overlays |
| Overlay coordinate space confusion | Overlay layer — data model and event handling | Resize browser, export: overlay items at correct positions in PNG |
| Hit-testing overlay vs cell conflict | Overlay layer — event routing | Click through overlay empty space → cell selected; drag overlay item → no cell action |
| Text rendering divergence DOM vs Canvas | Overlay layer — text rendering implementation | Export PNG: text matches preview in font size, line breaks, position |
| Emoji cross-platform inconsistency | Overlay layer — emoji picker | Document known behavior; or implement Twemoji for consistency |
| SVG sticker XSS | Overlay layer — image sticker upload | Upload SVG with `<script>` — script does not execute |
| localStorage quota | Persistence — auto-save implementation | Test with 8 large images: QuotaExceededError shows user warning |
| Blob URLs in .storygrid file | Persistence — file export | Export .storygrid after adding video cell: file contains no `blob:` strings |
| Schema evolution crash | Persistence — file import | Import file with missing `effects` field: app loads with defaults, no crash |
| Audio pipeline scope underestimate | Audio toggle — pipeline design | Exported MP4 contains audio track: verify with `ffprobe` |
| AudioContext suspended | Audio toggle — AudioContext initialization | Export on Safari private + Chrome: MP4 has audio |
| Private browsing crash | Persistence — storage availability check | Open in Safari private: no crash, warning banner visible |
| Slider history flooding | Effects & Filters — slider implementation | Drag slider for 2 seconds: only 1 undo entry added |

---

## Sources

- CanvasRenderingContext2D.filter support: https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter (Safari disabled-by-default confirmed across all versions)
- WebKit bug #198416 ctx.filter: https://bugs.webkit.org/show_bug.cgi?id=198416
- Canvas blur edge bleeding fix: https://dev.to/shaishav_patel_271fdcd61a/building-a-browser-based-image-blur-tool-with-canvas-api-no-libraries-3g8h
- Canvas text metrics cross-browser interop issue (2024): https://github.com/web-platform-tests/interop/issues/427
- DOMPurify SVG sanitization: https://dompurify.com/can-dompurify-handle-sanitization-of-svg-or-mathml-content-if-so-how/
- CVE-2024-47875 DOMPurify: https://security.snyk.io/vuln/SNYK-JS-DOMPURIFY-8184974
- localStorage QuotaExceededError handling: https://mmazzarolo.com/blog/2022-06-25-local-storage-status/
- Storage quotas MDN: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Safari private browsing localStorage disabled: https://michalzalecki.com/why-using-localStorage-directly-is-a-bad-idea/
- Web Audio autoplay policy Chrome: https://developer.chrome.com/blog/autoplay
- Web Audio best practices MDN: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- Combining audio + video in MediaRecorder: https://copyprogramming.com/howto/combining-audio-and-video-tracks-into-new-mediastream
- MediaStreamAudioSourceNode MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioSourceNode
- Web Audio delayed/glitchy Safari bug: https://bugs.webkit.org/show_bug.cgi?id=221334
- Safari WebM Opus Safari 15 bug: https://bugs.webkit.org/show_bug.cgi?id=226922
- Zustand persist middleware docs: https://zustand.docs.pmnd.rs/reference/middlewares/persist
- Zustand schema migration guide: https://dev.to/diballesteros/how-to-migrate-zustand-local-storage-store-to-a-new-version-njp
- Zod safeParse for file import: https://medium.com/@bashaus/validating-file-uploads-and-their-contents-with-zod-in-typescript-38a122b5b926
- Canvas hit detection methods: https://joshuatz.com/posts/2022/canvas-hit-detection-methods/
- Emoji cross-platform rendering inconsistencies: https://apptools.wiki/articles/14328-how-can-global-product-development-teams-standardize-the-implementation-of-emoji-assets
- MediaRecorder audio memory leak (Firefox bug): https://bugzilla.mozilla.org/show_bug.cgi?id=1376134

---
*Pitfalls research for: StoryGrid v1.2 — Effects, Overlays, Persistence, Audio*
*Researched: 2026-04-08*
