# Stack Research

**Domain:** Client-side photo/video collage editor (v1.2 additions)
**Researched:** 2026-04-08
**Confidence:** HIGH (all critical choices verified against MDN, npm, caniuse, or official docs)

---

## Context: What Is Already Shipped

These packages are installed and working — do NOT re-evaluate:

| Package | Installed Version | Role |
|---------|-------------------|------|
| Vite | ^8.0.1 | Build tool |
| React | ^18.3.1 | UI framework |
| TypeScript | ~5.9.3 | Language |
| Zustand | ^5.0.12 | State |
| Immer | ^10.2.0 | Immutable updates |
| Tailwind CSS | ^3.4.19 | Styling |
| @dnd-kit/core | ^6.3.1 | Drag and drop |
| lucide-react | ^1.7.0 | Icons |
| nanoid | ^5.1.7 | ID generation |
| mediabunny | ^1.40.1 | Installed but NOT used in export pipeline |

**Critical architecture note:** Video export currently uses `canvas.captureStream()` + `MediaRecorder` — NOT Mediabunny. The existing `videoExport.ts` renders all cells into a 1080×1920 canvas and captures the stream. The canvas is `muted=true` on all video elements. There is no audio in the current export pipeline.

---

## v1.2 New Stack Additions

### 1. Canvas Filters / Effects

**Recommendation: `ctx.filter` + `context-filter-polyfill` for Safari 15**

`CanvasRenderingContext2D.filter` is the only approach that works natively in the Canvas export renderer without a runtime graphics library. All the required filters (brightness, contrast, saturation, grayscale, sepia, blur) are supported via this CSS-filter-syntax property.

**Safari blocker:** `ctx.filter` is NOT supported in Safari 15 (not even in Safari 17; disabled-by-default in Safari 18). The project targets Safari 15+. Source: [caniuse CanvasRenderingContext2D.filter](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter).

**Solution:** Install `context-filter-polyfill` — a lightweight npm package that polyfills `CanvasRenderingContext2D.filter` by intercepting drawing calls. Supports all required filters: blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia. Latest version: 0.3.23 (June 2025). Small package (105 stars, actively maintained).

**Do NOT use:**
- WebGL shaders — massive added complexity, requires a separate WebGL canvas context, total mismatch with the existing 2D canvas export pipeline.
- glfx.js / camanjs — abandoned/unmaintained, WebGL-only, incompatible with canvas `drawImage` export pipeline.
- CSS `filter:` on `<canvas>` element in the preview — works visually but impossible to replicate in the Canvas API export context (CSS properties are not available inside `ctx.drawImage`).
- Pixel-by-pixel getImageData/putImageData manipulation — slow on 1080×1920 canvas, complexity is not justified when the polyfill solves the Safari gap cleanly.

**Integration:** Apply `ctx.filter = 'brightness(1.2) contrast(0.9)'` before each `ctx.drawImage()` call in `drawLeafToCanvas()` / `renderGridIntoContext()`. Reset to `'none'` after each leaf. Same code path works in preview canvas AND in the export canvas AND in the MediaRecorder export canvas.

| Package | Version | Bundle Impact | Install |
|---------|---------|---------------|---------|
| context-filter-polyfill | ^0.3.23 | ~5KB gzip (estimated) | `npm install context-filter-polyfill` |

**Note:** Import the polyfill once at app entry (e.g., `import 'context-filter-polyfill'`). It detects and skips browsers that natively support `ctx.filter`.

---

### 2. Overlay UX: Drag / Resize / Rotate Stickers and Text

**Recommendation: Build with raw pointer events + CSS transform math. Do NOT add a library.**

**Analysis of candidates:**

| Library | Version | Last Published | React 18 | Gzipped | Verdict |
|---------|---------|----------------|-----------|---------|---------|
| react-moveable | 0.56.0 | 2 years ago | YES (needs flushSync) | ~100KB est. | Too large, stale |
| interactjs | 1.10.27 | Active | YES (no React adapter) | ~30KB | Low-level, no React state binding |
| konva + react-konva | 9.x | Active | YES | ~150KB | Full canvas renderer, replaces DOM |

**react-moveable** is the only library with first-class drag + resize + rotate in React, but it was last published 2 years ago and its bundle size is substantial. More importantly, the overlays live in DOM (React) space above the canvas, meaning the existing React/Zustand data flow already handles state. Adding a library that manages its own internal transform state creates a synchronization problem.

**react-konva / Konva** would replace the entire preview rendering with a Konva canvas — a major architectural break. Not viable.

**The raw approach is correct here:** Each overlay element is a `position: absolute` div with `transform: translate(x,y) rotate(deg)`. Drag = `onPointerDown` + `onPointerMove` on the element. Resize = resize handle `onPointerDown`. Rotation = rotation handle at top of element + `Math.atan2` calculation. This is ~150 lines of utility code total, fully integrated with Zustand store, no new dependencies, and renders identically in preview and export (since export reads the overlay state from the Zustand store and paints overlays onto the canvas directly via `ctx.fillText` / `ctx.drawImage`).

**Why no library:** The overlay count is small (typical Instagram post: 3-6 stickers), interaction events are straightforward, and the export path MUST read overlay positions from Zustand state anyway — a library managing its own internal DOM transform state would need to be synced back to the store on every move, which is error-prone. Building raw keeps both paths (preview + export) reading from one ground truth.

---

### 3. Font Loading for Text Overlays

**Recommendation: `@fontsource-variable` packages (already in project) + CSS Font Loading API (`document.fonts`)**

The project already has `@fontsource-variable/geist` installed. This approach is correct for text overlays.

**Pattern for Canvas export parity:**

1. Import the fontsource CSS at app entry (e.g., `import '@fontsource-variable/geist'`). This registers the font via `@font-face` in the document.
2. Before the export canvas draws text, explicitly await `document.fonts.ready` (or `document.fonts.load('16px Geist Variable')`). This guarantees the font is loaded before `ctx.fillText()` is called.
3. Set `ctx.font = '700 48px "Geist Variable"'` and then `ctx.fillText(...)`.

**No new packages needed.** The CSS Font Loading API is fully supported in Chrome 90+, Firefox 90+, Safari 15+ (source: [MDN CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API) — "works across latest devices since March 2025").

**Font selection for v1.2:** Offer the user 3-5 fonts maximum. Recommended starter set from fontsource:
- `@fontsource-variable/geist` (already installed) — clean modern sans
- `@fontsource/playfair-display` — elegant serif for headings
- `@fontsource/dancing-script` — script/handwritten style

Each `@fontsource` package is a static CSS + woff2 asset. Import only the weights needed (`/400.css`, `/700.css`) to minimize bundle impact. Typical gzipped woff2 per weight: ~15-40KB (loaded async, not in JS bundle).

| Package | Version | Purpose |
|---------|---------|---------|
| @fontsource/playfair-display | ^5.x | Optional serif overlay font |
| @fontsource/dancing-script | ^5.x | Optional script overlay font |

(Geist Variable already installed — covers the default font.)

---

### 4. Emoji Picker

**Recommendation: `emoji-mart` v5 + `@emoji-mart/data` + `@emoji-mart/react`**

| Package | Version | Weekly Downloads | Notes |
|---------|---------|-----------------|-------|
| emoji-mart | ^5.6.0 | 3M+ | Framework-agnostic core |
| @emoji-mart/data | ^1.x | 3M+ | Emoji dataset (load separately) |
| @emoji-mart/react | ^1.1.1 | active | React wrapper |

**Why emoji-mart:** Most popular emoji picker in the React ecosystem (3M+ weekly downloads). Framework-agnostic core (works as a web component). The React wrapper is thin. It supports search, categories, skin tone selection, and recent emoji — all table-stakes for a sticker picker.

**Bundle strategy:** `@emoji-mart/data` is large (~1MB uncompressed). Load it lazily when the user opens the picker:
```ts
const data = await import('@emoji-mart/data');
```
This keeps the main bundle unaffected. The picker itself renders in a popover that's only mounted when activated.

**Alternative: `emoji-picker-react` v4.18.0** — 34MB package weight (unacceptable), eliminate from consideration.

**Peer dependency:** `@emoji-mart/react@1.1.1` declares `react@>=16.8` — React 18 is compatible. The core `emoji-mart` has no React peer dependency (web component approach).

---

### 5. SVG Sticker Rendering in Canvas Export

**Recommendation: Serialize to `Blob` URL → `Image()` element → `ctx.drawImage()`. No library needed.**

The native browser approach for SVG-on-canvas works reliably in Chrome 90+, Firefox 90+, and Safari 15+:

```ts
const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
const url = URL.createObjectURL(svgBlob);
const img = new Image();
img.onload = () => {
  ctx.drawImage(img, x, y, width, height);
  URL.revokeObjectURL(url);
};
img.src = url;
```

For user-uploaded SVG files: read as text with `FileReader.readAsText()`, store the SVG string in the Zustand overlay store (not a blob URL — SVG strings are serializable and can be persisted to localStorage/file without expiry). On export, reconstruct the Image from the string as above.

**Why not canvg:** canvg v4.0.3 (1.29MB package size) is heavy for a use case where the native browser SVG renderer already handles the task. The `Image()` approach uses the browser's own SVG renderer, which is more capable and correct than canvg's JavaScript reimplementation for complex SVGs. canvg is only needed for Node.js server-side rendering or headless canvas — not required here.

**Important caveat:** SVGs with external resource references or `<foreignObject>` may fail in the `Image()` approach due to CORS/security restrictions. For sticker use cases (decorative SVGs), this is not a practical concern.

---

### 6. Project Persistence / Serialization

**Recommendations:**

#### Storage backend: `idb-keyval` for media, `localStorage` for project metadata

localStorage (5-10MB limit, synchronous, strings only) cannot store video blobs or large base64 image strings reliably across multiple projects. The correct split:

| Data | Storage | Rationale |
|------|---------|-----------|
| Project metadata (tree structure, overlay positions, settings) | localStorage | Small JSON (<100KB), fast sync reads for auto-save |
| Image media (base64) | IndexedDB via idb-keyval | Binary-safe, async, large capacity |
| Video media (blob URLs) | Re-upload required on reload | Blob URLs expire on tab close — cannot persist |

**idb-keyval** is the right IndexedDB wrapper for this use case:
- 295 bytes brotli'd (get/set only) — effectively zero bundle impact
- Promise-based, tree-shakeable
- Version 6.2.2 (Jake Archibald, actively maintained)
- `npm install idb-keyval`

**Video persistence strategy:** Blob URLs cannot be serialized — they expire when the tab closes. On project load, video cells must show a "re-upload required" state. The `.storygrid` file format should store a video cell placeholder (filename, duration, thumbnail frame as base64) so the user knows which file to re-upload. This is consistent with how Figma and similar tools handle external file references.

#### Schema validation for `.storygrid` file import: **Zod v4**

**Why:** `.storygrid` files are user-provided JSON. Without validation, malformed files cause cryptic runtime errors deep in the tree renderer. Zod provides TypeScript-first schema definition, parse-time type narrowing, and clear error messages. v4 is 14x faster than v3 and ~57% smaller.

**Bundle:** Full zod v4 is ~17KB gzipped. `@zod/mini` is ~1.9KB gzipped for tree-shakeable usage. For file import validation (small, infrequent operation), load zod lazily with the import action:
```ts
const { z } = await import('zod');
```

| Package | Version | Gzipped | Notes |
|---------|---------|---------|-------|
| zod | ^4.x | ~17KB (lazy-loaded) | TypeScript-first schema validation |

**File versioning:** Store a `"version": 1` field at the root of the `.storygrid` JSON. Write a migration function for each version bump. Keep migrations pure (no side effects). This is a standard approach (used by Figma plugins, Excalidraw, etc.).

**No ORM or database wrapper beyond idb-keyval.** The data model is a serializable Zustand store snapshot — no relational queries needed.

---

### 7. Per-Cell Audio Toggle on Video Export

**Recommendation: Web Audio API — `AudioContext` + `MediaElementAudioSourceNode` + `ChannelMergerNode` → `MediaStreamAudioDestinationNode`. No new library needed.**

The existing video export uses `canvas.captureStream()` → `MediaRecorder`. To add audio from selected video cells, add a Web Audio graph alongside:

**Architecture:**

```
HTMLVideoElement (cell A, audio on)  → createMediaElementAudioSourceNode()  ──┐
HTMLVideoElement (cell B, audio on)  → createMediaElementAudioSourceNode()  ──┤→ GainNode → MediaStreamAudioDestinationNode
HTMLVideoElement (cell C, audio off) → (not connected)                         │
                                                                               ↓
MediaRecorder(canvas.captureStream() + audioDestination.stream.getAudioTracks())
```

1. Create one `AudioContext`.
2. For each video cell with audio enabled: `ctx.createMediaElementAudioSourceNode(videoElement)` → connect to a `GainNode` → connect to `MediaStreamAudioDestinationNode`.
3. Combine the canvas video track and the audio destination's audio track into a single `MediaStream`: `new MediaStream([...canvasStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()])`.
4. Pass the combined stream to `MediaRecorder`.

**Verified:** `AudioContext.createMediaStreamDestination()` is supported Chrome 51+, Firefox 43+ — matching existing video export browser support. Source: [MDN AudioContext.createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination).

**Important constraint:** `createMediaElementAudioSourceNode` requires the video element NOT to be `muted=true` at the time of connection. The existing export video elements are created with `video.muted = true`. This must change: set `video.muted = false` for audio-enabled cells before connecting to the audio graph. The muted state was set to enable autoplay policy bypass — with the audio routing through Web Audio, the HTMLVideoElement's muted attribute can be false while still playing back correctly.

**No new packages needed.** Web Audio API is a browser built-in. No wrapper library adds value here.

---

## Summary: New Packages to Install

```bash
# Production
npm install context-filter-polyfill emoji-mart @emoji-mart/data @emoji-mart/react idb-keyval zod

# Optional font additions (install only chosen fonts)
npm install @fontsource/playfair-display @fontsource/dancing-script
```

| Package | Version | Gzipped Size | Purpose |
|---------|---------|-------------|---------|
| context-filter-polyfill | ^0.3.23 | ~5KB | Safari 15 polyfill for ctx.filter |
| emoji-mart | ^5.6.0 | ~15KB (lazy data) | Emoji picker core |
| @emoji-mart/data | ^1.x | ~1MB (lazy-loaded) | Emoji dataset — lazy import only |
| @emoji-mart/react | ^1.1.1 | ~5KB | React wrapper for emoji picker |
| idb-keyval | ^6.2.2 | <1KB | IndexedDB key-value store for media |
| zod | ^4.x | ~17KB (lazy) | .storygrid file import validation |

**Estimated new JS bundle addition (lazy-excluded):** ~25KB gzipped. Well within the 500KB budget.

---

## What NOT to Add

| Avoid | Why | Instead |
|-------|-----|---------|
| react-moveable | 2-year stale, ~100KB, external transform state conflicts with Zustand | Raw pointer events + transform math (~150 LOC) |
| react-konva / konva | Replaces entire DOM preview with canvas — breaks existing component architecture | Keep DOM preview, use canvas only for export |
| interactjs | Vanilla JS, no React state integration, requires manual sync | Raw pointer events |
| glfx.js / camanjs | Abandoned, WebGL-only, incompatible with 2D canvas pipeline | ctx.filter + context-filter-polyfill |
| html2canvas | Drops CSS transforms, object-fit — wrong for export | Already rejected; existing Canvas API renderer is correct |
| emoji-picker-react | 34MB package weight | emoji-mart |
| canvg | 1.29MB, duplicates browser SVG renderer | Native Image() + blob URL |
| WebGL shaders for filters | Enormous complexity, separate GPU context, fragile cross-browser | ctx.filter + polyfill |
| @emoji-mart/react fork (@slidoapp) | Unofficial fork, unnecessary | Official @emoji-mart/react 1.1.1 |
| Mediabunny for audio mixing | Mediabunny is for WebCodecs-based encode — current pipeline is MediaRecorder; mixing layers is mismatched | Web Audio API AudioContext |

---

## Version Compatibility

| Package | React 18 | Safari 15 | Chrome 90+ | Firefox 90+ |
|---------|----------|-----------|------------|-------------|
| context-filter-polyfill | N/A | YES (polyfills gap) | YES (no-op) | YES (no-op) |
| emoji-mart + @emoji-mart/react | YES (react >=16.8) | YES | YES | YES |
| idb-keyval | N/A | YES | YES | YES |
| zod v4 | N/A | YES | YES | YES |
| ctx.filter (native) | N/A | NO — use polyfill | YES (52+) | YES (49+) |
| Web Audio AudioContext | N/A | YES (Safari 14.1+) | YES | YES |
| FontFace / document.fonts | N/A | YES (Safari 10+) | YES | YES |
| SVG → Image() → ctx.drawImage | N/A | YES | YES | YES |

---

## Open Questions / Risks

1. **context-filter-polyfill + blur on Safari 15:** The polyfill GitHub has a known issue (#3) where only a rectangular portion of the image draws in Safari. Verify blur filter output on Safari 15 during Phase 11 implementation. If issue persists, skip blur on Safari (degrade gracefully — blur is a nice-to-have, not table stakes).

2. **MediaRecorder audio + muted video elements:** Existing export code sets `video.muted = true` to bypass autoplay policy on Chrome. Removing `muted` for audio-enabled cells may re-trigger autoplay restrictions. Mitigation: Only set `muted = false` after the export has been triggered by a user gesture (the Export button click satisfies the gesture requirement). Test explicitly.

3. **localStorage size with multiple projects:** If users create many projects with base64 images, localStorage will fill up (5-10MB limit). Plan B: move ALL project data to IndexedDB (idb-keyval) at Phase 11 implementation time, using localStorage only for the list of project IDs and names. This is a design decision for the planner, flagged here as a risk.

4. **emoji-mart @emoji-mart/react v1.1.1 last published 3 years ago:** The React wrapper has not been updated but it is a thin wrapper over the stable web-component core. Verify React 18 concurrent mode compatibility with `flushSync` if picker updates cause tearing. The core `emoji-mart` package IS actively maintained.

5. **Mediabunny package installed but unused:** mediabunny ^1.40.1 is in package.json but no source file imports it. It should remain unused for v1.2 — the MediaRecorder pipeline is the correct approach given no COOP/COEP requirement. Consider removing it to reduce node_modules bloat, but this is out of scope for v1.2.

---

## Sources

- [caniuse: CanvasRenderingContext2D.filter](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter) — Safari 15 not supported, confirmed
- [MDN: CanvasRenderingContext2D.filter](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter) — filter syntax reference
- [context-filter-polyfill GitHub](https://github.com/davidenke/context-filter-polyfill) — v0.3.23, filter support matrix
- [MDN: AudioContext.createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination) — audio mixing pattern
- [MDN: CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API) — document.fonts.ready pattern
- [emoji-mart GitHub](https://github.com/missive/emoji-mart) — framework-agnostic, web component core
- [idb-keyval GitHub](https://github.com/jakearchibald/idb-keyval) — v6.2.2, 295 bytes brotli'd
- [Zod v4 release notes](https://zod.dev/v4) — 14x faster, 57% smaller than v3
- [Mediabunny supported formats](https://mediabunny.dev/guide/supported-formats-and-codecs) — audio codec support verified
- [npm: canvg](https://www.npmjs.com/package/canvg) — v4.0.3, 1.29MB, eliminated
- [npm: emoji-picker-react](https://www.npmjs.com/package/emoji-picker-react) — 34MB package, eliminated

---

*Stack research for: StoryGrid v1.2 Effects, Overlays & Persistence*
*Researched: 2026-04-08*
