# Phase 6 Research: Video Support (v2)

**Researched:** 2026-04-05
**Domain:** Browser video rendering, ffmpeg.wasm, COOP/COEP headers, canvas rAF loops
**Confidence:** HIGH (core APIs), MEDIUM (xstack filter graph exact coordinates), HIGH (COOP/COEP config)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Videos stored as blob URLs (`URL.createObjectURL()`) in `mediaRegistry` — NOT base64
- **D-02:** `mediaRegistry` becomes dual-mode: base64 dataURI for images, blob URL for videos. Detection via `value.startsWith('blob:')`
- **D-03:** Video cells cleared on page reload — blob URLs do not survive refresh; cells with stale blob mediaIds are nulled on init
- **D-04:** No "missing media" placeholder state needed
- **D-05:** LeafNode stays canvas-only. Hidden `<video>` element (not in DOM) used as drawImage source
- **D-06:** rAF loop runs only while playing; stops on pause. Paused video shows still frame drawn once
- **D-07:** Hidden `<video>` has `muted` and `playsInline` attributes; not appended to DOM; held in a ref
- **D-08:** Timeline bar below CanvasArea, inside canvas column — not full-width
- **D-09:** Controls: play/pause button + range scrubber + current time / total duration text
- **D-10:** Timeline bar only visible when at least one video cell exists
- **D-11:** Scrubber = master playhead; seeking sets `currentTime` on all hidden video refs. Total duration = longest video
- **D-12:** Output duration = longest video; shorter videos loop; image cells are static frames
- **D-13:** Codec: H.264 MP4; CRF ~23; no user-facing quality slider for video
- **D-14:** Auto-detect export path: video cells present → ffmpeg path → .mp4; image-only → Canvas API → .png
- **D-15:** ffmpeg.wasm lazy-loaded only when export triggered with video cells present
- **D-16:** Export progress: "Loading ffmpeg…" → "Encoding 0%…" → "Encoding 100%" → download. Toast UX
- **D-17:** COOP/COEP headers in `vercel.json` (and `public/_headers` for Netlify fallback)
- **D-18:** Dev server also needs COOP/COEP headers in `vite.config.ts` server.headers

### Claude's Discretion

- How to track media type (image vs video) — parallel `mediaTypeMap: Record<string, 'image' | 'video'>` or typed wrapper
- Whether hidden `<video>` ref lives in LeafNodeComponent or in a global videoElementRegistry
- Exact CRF value and ffmpeg filter graph for xstack
- File naming: `storygrid-{timestamp}.mp4` (consistent with existing pattern)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIDE-01 | Video files (video/*) accepted in media upload flow | Section 7: LeafNode file input accept, autoFillCells in lib/media |
| VIDE-02 | Video cells render `<video>` with autoplay/muted/loop and object-fit matching leaf.fit | Section 2: rAF loop pattern, drawImage approach |
| VIDE-03 | Timeline bar: master play/pause syncs all video cells; scrubbing seeks all simultaneously | Section 6: state model, videoRef registry |
| VIDE-04 | @ffmpeg/ffmpeg lazy-loaded only when video cells exist and user clicks Export | Section 1: dynamic import() pattern |
| VIDE-05 | Video export produces valid MP4 (H.264) at 1080×1920 using ffmpeg xstack filter | Section 5: export strategy |
| VIDE-06 | COOP/COEP headers configured in vercel.json / _headers for SharedArrayBuffer support | Section 4: header config |
| VIDE-07 | Export progress shown via ffmpeg progress callback | Section 1: progress events, log parsing fallback |
</phase_requirements>

---

## 1. @ffmpeg/ffmpeg 0.12.x — API & Integration

### Package Versions (npm registry verified 2026-04-05)
| Package | Version |
|---------|---------|
| @ffmpeg/ffmpeg | 0.12.15 |
| @ffmpeg/util | 0.12.2 |
| @ffmpeg/core | 0.12.10 |

### Install
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```
Do NOT install `@ffmpeg/core` as a local dependency — load it from CDN at runtime (see below). This keeps the ~25MB WASM out of the initial bundle.

### Import paths
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
```

**Critical note:** `@ffmpeg/ffmpeg` spawns a Web Worker internally. It cannot be imported from a CDN like jsDelivr. It MUST be bundled locally (npm install). Only `@ffmpeg/core` (the WASM binary) is loaded from CDN.

### Lazy-load pattern (VIDE-04)
```typescript
// In export.ts — only called when video cells present
async function loadFFmpeg(): Promise<FFmpeg> {
  // Dynamic import keeps @ffmpeg/ffmpeg out of initial chunk
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}
```

`toBlobURL` fetches the CDN resource and re-serves it as a same-origin blob URL, bypassing CORS restrictions on the CDN. This is the standard workaround documented by ffmpeg.wasm.

### Core API

```typescript
// File I/O
await ffmpeg.writeFile('input0.mp4', await fetchFile(blobUrl));
const data = await ffmpeg.readFile('output.mp4'); // returns Uint8Array
await ffmpeg.deleteFile('input0.mp4'); // cleanup virtual FS

// Execute
await ffmpeg.exec(['-i', 'input0.mp4', 'output.mp4']);
// Returns 0 on success, non-zero on error/timeout

// Events
ffmpeg.on('log', ({ message }) => { /* stdout/stderr */ });
ffmpeg.on('progress', ({ progress, time }) => { /* 0-1, time in microseconds */ });
ffmpeg.off('progress', handler); // cleanup

// Terminate
ffmpeg.terminate(); // kills web worker
```

**Key detail:** `-nostdin` and `-y` are prepended to all `exec()` args automatically by the library.

### Progress tracking (VIDE-07) — known issues

The `progress` event is marked **experimental** and returns `NaN` or incorrect values in many cases, especially for filter_complex operations and when input/output duration differ. The reliable fallback is log parsing:

```typescript
let totalDurationSec = 0; // set from known video durations before exec

ffmpeg.on('log', ({ message }) => {
  // Parse "time=HH:MM:SS.ms" from lines that also contain "speed="
  if (message.includes('time=') && message.includes('speed=')) {
    const match = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const [, h, m, s, cs] = match.map(Number);
      const currentSec = h * 3600 + m * 60 + s + cs / 100;
      const pct = Math.min(Math.round((currentSec / totalDurationSec) * 100), 100);
      onProgress(pct); // update Toast with "Encoding XX%..."
    }
  }
});
```

**Recommendation:** Register both `progress` and `log` listeners. Use `progress` as primary; fall back to log parsing if `progress` value is `NaN` or never fires.

### File cleanup

After export, delete all intermediate files from the virtual FS to prevent memory growth (the WASM memory is not garbage collected between `exec()` calls):

```typescript
await ffmpeg.deleteFile('input0.mp4');
await ffmpeg.deleteFile('input1.mp4');
await ffmpeg.deleteFile('output.mp4');
// For frame sequence approach:
for (let i = 0; i < frameCount; i++) {
  await ffmpeg.deleteFile(`frame${String(i).padStart(6, '0')}.png`);
}
```

---

## 2. Canvas rAF Video Rendering

### Pattern: hidden video element per LeafNode

Per D-05/D-06/D-07, each LeafNodeComponent that holds a video gets a `videoElRef` in addition to the existing `imgElRef`. The video element is never appended to the DOM.

```typescript
const videoElRef = useRef<HTMLVideoElement | null>(null);
const rafIdRef = useRef<number>(0);

// Create hidden video when mediaUrl is a blob:
useEffect(() => {
  if (!mediaUrl?.startsWith('blob:')) {
    videoElRef.current = null;
    return;
  }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.src = mediaUrl;
  video.load();

  video.addEventListener('loadedmetadata', () => {
    // Notify playback state manager of this video's duration
    onVideoDurationReady(id, video.duration);
    // Draw first frame
    video.addEventListener('seeked', drawRef.current, { once: true });
    video.currentTime = 0;
  });

  videoElRef.current = video;
  return () => {
    video.src = ''; // release decoder resources
    videoElRef.current = null;
  };
}, [mediaUrl]);
```

### rAF loop (runs only while playing — D-06)

```typescript
function startRafLoop() {
  function tick() {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current video frame using same drawLeafToCanvas API
    // Pass video element directly to drawImage — same as HTMLImageElement
    drawVideoFrameToCanvas(ctx, video, { x: 0, y: 0, w: cw, h: ch }, leafState);

    rafIdRef.current = requestAnimationFrame(tick);
  }
  rafIdRef.current = requestAnimationFrame(tick);
}

function stopRafLoop() {
  if (rafIdRef.current) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = 0;
  }
}
```

**Note:** `drawImage(videoElement, ...)` works identically to `drawImage(imageElement, ...)`. The existing `drawCoverImage`, `drawContainImage`, `drawPannedCoverImage` functions in `export.ts` accept `CanvasImageSource` — HTMLVideoElement qualifies. The `drawLeafToCanvas` signature uses `HTMLImageElement` explicitly; it will need a small extension to accept `HTMLVideoElement | HTMLImageElement`.

### requestVideoFrameCallback consideration

`requestVideoFrameCallback()` became Baseline 2024 (newly available October 2024), so it is NOT available in Chrome 90 or Safari 15 (project's min targets). Use standard `requestAnimationFrame` for the rAF loop. rVFC would provide frame-accurate timing but cannot be used without feature-gating.

### First frame draw

After `loadedmetadata`, seek to `currentTime = 0` and draw on the `seeked` event. This guarantees a visible frame even before play is pressed.

### Synchronized seeking (D-11)

The timeline scrubber calls a `seekAll(time: number)` function that iterates all registered video refs and sets `currentTime`:

```typescript
function seekAll(time: number) {
  for (const [, video] of videoElementRegistry) {
    video.currentTime = time;
  }
  // Trigger a single still-frame redraw on each cell
  requestAnimationFrame(() => {
    for (const [, drawFn] of drawRefRegistry) {
      drawFn();
    }
  });
}
```

---

## 3. Blob URL Lifecycle Management

### Creation
```typescript
// In lib/media.ts — for video files (detected by file.type.startsWith('video/'))
const blobUrl = URL.createObjectURL(file);
addMedia(mediaId, blobUrl); // stores blob: string in mediaRegistry
```

### Revocation timing

**Do NOT revoke immediately** after creating the URL — the video element holds a reference and revocation would break playback. Revoke when the media is cleared from the cell:

```typescript
// In gridStore — when removeMedia is called for a video
removeMedia: (mediaId) =>
  set(state => {
    const url = state.mediaRegistry[mediaId];
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url); // safe: cell is cleared, video element will be destroyed
    }
    delete state.mediaRegistry[mediaId];
  }),
```

### Clear-on-reload (D-03)

Blob URLs are NOT persistent across page reloads. On app init, scan `mediaRegistry` for any blob URLs and clear those cells:

```typescript
// In app init (main.tsx or App.tsx — before first render or in an init effect)
function clearStaleBlobMedia() {
  const { mediaRegistry, root } = useGridStore.getState();
  const staleMediaIds = Object.entries(mediaRegistry)
    .filter(([, url]) => url.startsWith('blob:'))
    .map(([id]) => id);

  if (staleMediaIds.length === 0) return;

  // Clear cells referencing stale blob mediaIds
  const leaves = getAllLeaves(root);
  for (const leaf of leaves) {
    if (leaf.mediaId && staleMediaIds.includes(leaf.mediaId)) {
      useGridStore.getState().setMedia(leaf.id, null); // or a direct store mutation
    }
  }
  // Remove from registry
  for (const id of staleMediaIds) {
    useGridStore.getState().removeMedia(id);
  }
}
```

**Note:** This is only relevant if the app uses `persist` middleware (Phase 7 feature). Currently `gridStore` has no persistence. Blob URL stale detection is still important if localStorage persistence is added in Phase 7, but for Phase 6 it is defensive housekeeping.

### Memory pressure

Video files are 10–100MB. `URL.createObjectURL()` does not copy the file — it creates a reference to the in-memory `File` object from the upload event. The File object remains in memory as long as any blob URL referencing it is live. Revoking the URL allows the File to be garbage collected.

---

## 4. COOP/COEP Header Configuration

### Why required

`SharedArrayBuffer` — required by ffmpeg.wasm's WASM threading — is only available in [cross-origin isolated contexts](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated). Cross-origin isolation requires both headers to be set on the document:

| Header | Value | Purpose |
|--------|-------|---------|
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents other windows from accessing this page's globals |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Ensures all subresources opt-in to being loaded cross-origin |

### vercel.json (new file — does not currently exist)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

Place this file at the project root (`/vercel.json`).

### public/_headers (Netlify fallback)

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

Place this file at `public/_headers` (Vite copies `public/` to `dist/` on build).

### vite.config.ts server.headers (dev server — D-18)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // ... rest of config
});
```

### Impact on self-hosted assets (VIDE-06 acceptance criterion)

`COEP: require-corp` blocks loading of cross-origin resources that do not send `Cross-Origin-Resource-Policy: cross-origin` (or `same-site`). For StoryGrid:

- **Base64 data URIs:** Inline, no cross-origin load. Unaffected.
- **Blob URLs (`blob:`):** Same-origin by definition. Unaffected.
- **Fonts from `@fontsource-variable/geist`:** Bundled by Vite/served from same origin. Unaffected.
- **SVG/icon assets:** Served from same origin. Unaffected.
- **jsDelivr CDN (ffmpeg core):** The `toBlobURL()` utility fetches the CDN resource and wraps it in a same-origin blob URL BEFORE passing to `ffmpeg.load()`. This sidesteps the CORP check entirely — the browser never requests jsDelivr directly as a subresource.
- **External images dropped by user:** StoryGrid only accepts file drops; no external URL loading. Unaffected.

**Conclusion:** COOP/COEP will not break any existing functionality. The `toBlobURL` pattern is the correct mitigation for CDN-loaded WASM.

### Verifying cross-origin isolation

```javascript
// In browser console after headers are applied:
console.log(self.crossOriginIsolated); // must be true
```

---

## 5. Video Export Strategy (xstack vs frame extraction)

### Two viable approaches

| Approach | Mechanism | Pros | Cons |
|----------|-----------|------|------|
| **A: Direct stream mux** | Feed input video files directly to ffmpeg; use `filter_complex` with `scale`+`overlay` or `xstack` to composite them | No frame extraction; fast; quality = source | Cannot honor canvas pan/zoom/fit state; cannot composite image cells + video cells in same filter graph |
| **B: Canvas frame sequence** | Render composite grid frame-by-frame to canvas; export PNG frames; encode with ffmpeg image2 input | Pixel-perfect: respects pan/zoom/fit/borderRadius/gap; handles mixed image+video cells | Slow (toBlob() per frame); large temporary storage (~1080×1920 PNG × fps × duration = ~MB per second) |

### Recommendation: Hybrid approach (canvas frame rendering into ffmpeg)

Given that StoryGrid's canvas rendering already produces pixel-perfect results (pan, zoom, fit, gap, borderRadius, background), the only way to honor all those settings in the exported MP4 is the canvas frame approach. Approach A (direct stream mux) would bypass all the canvas draw logic and produce incorrect output.

**Hybrid approach:**
1. Render the composite grid canvas at 30fps for the full duration (longest video)
2. For each frame: `canvas.toBlob('image/png')` → `Uint8Array` → `ffmpeg.writeFile()`
3. After all frames written: `ffmpeg.exec(['-r', '30', '-i', 'frame%06d.png', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', 'output.mp4'])`
4. Read output, revoke input frames, download

### Frame rendering loop

```typescript
const FPS = 30;
const duration = maxVideoDuration; // from editorStore or computed from videoRefs
const totalFrames = Math.ceil(duration * FPS);

for (let frame = 0; frame < totalFrames; frame++) {
  const timeSeconds = frame / FPS;

  // Seek all video elements to this time (synchronous seek is not guaranteed,
  // but for export we do: set currentTime, await 'seeked' event, then draw)
  await seekAllVideosTo(timeSeconds);

  // Render the full 1080x1920 canvas (reuse renderGridToCanvas from export.ts,
  // extended to accept video elements for video cells)
  const frameCanvas = await renderGridToCanvas(root, mediaRegistry, 1080, 1920, settings);

  // Write frame to ffmpeg virtual FS
  const pngData = await canvasToUint8Array(frameCanvas);
  await ffmpeg.writeFile(`frame${String(frame).padStart(6, '0')}.png`, pngData);

  onProgress(Math.round((frame / totalFrames) * 80)); // 0–80% = frame writing
}

// Encode
await ffmpeg.exec([
  '-r', '30',
  '-i', 'frame%06d.png',
  '-c:v', 'libx264',
  '-crf', '23',
  '-pix_fmt', 'yuv420p',  // required for broad MP4 player compatibility
  '-movflags', '+faststart',  // put moov atom at front for streaming
  'output.mp4'
]);
onProgress(100);
```

### seekAllVideosTo with await

```typescript
async function seekAllVideosTo(time: number): Promise<void> {
  const promises = Array.from(videoElementRegistry.values()).map(video => {
    return new Promise<void>(resolve => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  });
  await Promise.all(promises);
}
```

### canvasToUint8Array helper

```typescript
async function canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('toBlob returned null')); return; }
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}
```

### Performance considerations

- At 30fps, 10 seconds = 300 frames at 1080×1920 PNG each. Each uncompressed frame ~6MB; PNG compressed ~1–3MB. Total ~300–900MB virtual FS writes. This is the primary performance concern.
- `toBlob()` is async and can take 50–200ms per frame on mid-range hardware.
- 10-second video at 30fps would take ~15–60 seconds to process in the browser. This is acceptable for the MVP use case (users making 3–10 second Story clips).
- Free frames from virtual FS during encoding (after `exec()`), not before.
- If performance becomes unacceptable: reduce to 24fps, or use `canvas.getImageData()` + raw pixel data directly to avoid PNG compression overhead.

### Alternative: xstack (not recommended for this codebase)

The `xstack` filter approach would work only for pure video-cell grids without pan/zoom/fit. Since the canvas pipeline already handles all visual fidelity, implementing a second rendering path in ffmpeg filter_complex would duplicate logic and produce inconsistent results. The frame sequence approach is the correct choice.

If xstack were used, the filter_complex expression for two side-by-side scaled cells would look like:
```
[0:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[v0];
[1:v]scale=540:1920:force_original_aspect_ratio=increase,crop=540:1920[v1];
[v0][v1]xstack=inputs=2:layout=0_0|w0_0[out]
```
But this bypasses pan/zoom/fit/borderRadius — do not use.

---

## 6. State Model for Playback

### New editorStore fields

```typescript
// Add to EditorState type:
isPlaying: boolean;
playheadTime: number;      // seconds, 0-based
totalDuration: number;     // seconds — max of all video cell durations

// Actions:
setIsPlaying: (v: boolean) => void;
setPlayheadTime: (v: number) => void;
setTotalDuration: (v: number) => void;
```

### Video element registry (Claude's discretion — recommendation)

**Recommendation: global registry pattern** (not co-located in LeafNode).

Rationale: The timeline bar, the export engine, and the playhead synchronizer all need to access all video elements simultaneously. A global `Map<nodeId, HTMLVideoElement>` is the cleanest coordination point. It does not need to be in Zustand (it holds mutable DOM references, not serializable state).

```typescript
// src/lib/videoRegistry.ts
export const videoElementRegistry = new Map<string, HTMLVideoElement>();
export const videoDrawRegistry = new Map<string, () => void>();

export function registerVideo(nodeId: string, video: HTMLVideoElement, draw: () => void) {
  videoElementRegistry.set(nodeId, video);
  videoDrawRegistry.set(nodeId, draw);
}

export function unregisterVideo(nodeId: string) {
  videoElementRegistry.delete(nodeId);
  videoDrawRegistry.delete(nodeId);
}
```

LeafNodeComponent registers on video load, unregisters on unmount/media clear.

### Media type tracking (Claude's discretion — recommendation)

**Recommendation: parallel `mediaTypeMap`** in gridStore.

```typescript
// Add to GridStoreState:
mediaTypeMap: Record<string, 'image' | 'video'>;

// addMedia becomes:
addMedia: (mediaId: string, dataUri: string, type: 'image' | 'video') =>
  set(state => {
    state.mediaRegistry[mediaId] = dataUri;
    state.mediaTypeMap[mediaId] = type;
  }),
```

This avoids the `startsWith('blob:')` string check scattered across the codebase and is more explicit. The type is known at upload time (from `file.type`).

### Playhead update loop

While playing, a single `setInterval` or `rAF` in the `PlaybackTimeline` component reads `video.currentTime` from any one video element and syncs it to `editorStore.playheadTime`. This drives the scrubber position.

```typescript
useEffect(() => {
  if (!isPlaying) return;
  const id = setInterval(() => {
    const [firstVideo] = videoElementRegistry.values();
    if (firstVideo) {
      setPlayheadTime(firstVideo.currentTime);
      if (firstVideo.currentTime >= totalDuration) {
        setIsPlaying(false);
      }
    }
  }, 100); // 10fps update rate for scrubber — smooth enough
  return () => clearInterval(id);
}, [isPlaying, totalDuration]);
```

### Play/pause actions

```typescript
function playAll() {
  for (const video of videoElementRegistry.values()) {
    video.play();
  }
  setIsPlaying(true);
  // Start rAF loops in all registered LeafNodes
  for (const drawFn of videoDrawRegistry.values()) {
    // Each LeafNode subscribes to isPlaying from editorStore
    // and starts/stops its own rAF loop
  }
}

function pauseAll() {
  for (const video of videoElementRegistry.values()) {
    video.pause();
  }
  setIsPlaying(false);
  // Each LeafNode's useEffect on isPlaying stops the rAF loop
}
```

Each LeafNodeComponent subscribes to `editorStore.isPlaying` and manages its own rAF loop start/stop.

---

## 7. Integration Points with Existing Code

### src/types/index.ts

No change needed to `LeafNode` type — `mediaId` already exists and can point to either base64 or blob URL. The `mediaTypeMap` lives in the store, not in the tree.

### src/store/gridStore.ts

Changes needed:
1. Add `mediaTypeMap: Record<string, 'image' | 'video'>` to state
2. Update `addMedia` signature to accept `type` parameter
3. Update `removeMedia` to also delete from `mediaTypeMap` and revoke blob URLs
4. Update `clearGrid` to reset `mediaTypeMap`
5. Update `applyTemplate` to reset `mediaTypeMap`

The existing `mediaRegistry: Record<string, string>` shape is unchanged.

### src/store/editorStore.ts

Add: `isPlaying`, `playheadTime`, `totalDuration` state and setters.

### src/lib/media.ts (existing file not read, but inferred)

`autoFillCells` currently handles image files. It needs to:
1. Detect `file.type.startsWith('video/')` 
2. Use `URL.createObjectURL(file)` instead of `FileReader` base64
3. Pass `'video'` type to `addMedia`

### src/Grid/LeafNode.tsx

Changes needed:
1. Accept `video/*` in the file `<input accept>` attribute (change from `image/*` to `image/*,video/*`)
2. Add `videoElRef` and rAF loop
3. Subscribe to `editorStore.isPlaying` to start/stop rAF
4. Register/unregister in `videoElementRegistry` on mount/unmount

**Existing pattern to extend:** The `imgElRef` pattern (hidden HTMLImageElement) is the direct analog. Add `videoElRef` alongside it.

### src/lib/export.ts

Changes needed:
1. Extend `drawLeafToCanvas` to accept `HTMLVideoElement | HTMLImageElement` (or add `drawVideoFrameToCanvas` parallel function)
2. Extend `renderGridToCanvas` to accept `videoElementRegistry` and call the video draw path for video cells
3. Add `exportVideoGrid` function: frame loop + ffmpeg encoding
4. `hasVideoCell` currently checks `startsWith('data:video/')` — needs to check `mediaTypeMap` instead (or check `startsWith('blob:')` from registry)

**Current `hasVideoCell` is already wrong** for the D-01 decision: it checks for `data:video/` but D-01 says videos are stored as blob URLs, not base64. This function must be updated in Phase 6.

### src/Editor/ExportSplitButton.tsx

Changes needed:
1. Change video guard from `setToastState('video-blocked')` to `triggerVideoExport()`
2. Add `hasVideoCell` detection using `mediaTypeMap` (replace the `data:video/` check)
3. Add ffmpeg lazy-load + progress toast states (`'loading-ffmpeg'`, `'encoding'` with percent)
4. Hide PNG/JPEG format controls in popover when video cells are present (D-14)
5. Show `Export MP4` label when video cells present

### src/Editor/Toast.tsx

Add new toast states:
- `'loading-ffmpeg'` — "Loading ffmpeg..." with spinner
- `'encoding'` with a progress percent — "Encoding 23%..." 
- These replace the current `'video-blocked'` state (which becomes `'encoding'` path instead)

### src/Editor/CanvasArea.tsx

Add `PlaybackTimeline` component conditionally below the `CanvasWrapper`:

```tsx
export function CanvasArea() {
  const hasVideos = useGridStore(s => Object.values(s.mediaTypeMap).some(t => t === 'video'));
  // ...
  return (
    <main className="flex flex-col flex-1 items-center overflow-hidden ...">
      <CanvasWrapper />
      {hasVideos && <PlaybackTimeline />}
    </main>
  );
}
```

The `CanvasArea` currently renders just `<CanvasWrapper />` inside a `<main>` with `flex-1 items-start justify-center`. The layout will need `flex-col` to stack timeline below canvas.

### src/Editor/EditorShell.tsx

No structural changes needed — `PlaybackTimeline` lives inside `CanvasArea`, not in `EditorShell`.

### New file: src/Editor/PlaybackTimeline.tsx

Timeline bar component:
- Play/pause button (reads `isPlaying` from editorStore)
- Range scrubber input (range 0 to `totalDuration`, step 0.1)
- Current time / total duration text
- Calls `playAll()` / `pauseAll()` from videoRegistry
- On scrub: `seekAll(value)` + `setPlayheadTime(value)`

### New file: src/lib/videoRegistry.ts

Global registry as described in Section 6.

### New file: src/lib/videoExport.ts (or extend export.ts)

Video export pipeline (frame loop + ffmpeg encoding).

---

## 8. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| `toBlob()` performance: 300+ frames at 1080×1920 causes timeout or browser OOM | HIGH | MEDIUM | Limit to 24fps; add chunked frame processing with yield to event loop; document max recommended video length |
| ffmpeg.wasm `progress` event fires NaN | MEDIUM | HIGH | Always implement log-parsing fallback (confirmed workaround exists) |
| `seeked` event never fires for some video formats | MEDIUM | MEDIUM | Add 500ms timeout fallback per seek promise; log warning |
| COOP/COEP breaks embedded iframe scenarios | LOW | LOW | StoryGrid is not embedded; N/A |
| ffmpeg.wasm WebWorker fails in Safari | HIGH | HIGH | Safari does not support SharedArrayBuffer in most configurations. DOCUMENTED OUT OF SCOPE (requirements: "Safari video export — out of scope"). Detect and show "Video export not supported in Safari. Use Chrome or Firefox." |
| Blob URL not freed on grid clear | MEDIUM | MEDIUM | Always call `URL.revokeObjectURL()` in `removeMedia` for blob URLs |
| filter_complex with quotes in ffmpeg.wasm | LOW | LOW | Do not use shell quoting in exec args (confirmed fix: remove outer double quotes) |
| Video file > 500MB causes tab OOM during frame export | MEDIUM | LOW | Validate video file size on upload; warn if > 200MB |
| rAF loop continues after cell is cleared | MEDIUM | MEDIUM | `useEffect` cleanup always cancels rAF; unregister from videoRegistry on unmount |

---

## 9. Recommended Implementation Approach

### Wave 0 — Infrastructure (no visible UI)
1. Add COOP/COEP headers (`vercel.json`, `public/_headers`, `vite.config.ts`)
2. Verify `self.crossOriginIsolated === true` in dev
3. Add `mediaTypeMap` to `gridStore`
4. Update `addMedia` to accept `type` parameter
5. Update `removeMedia` to revoke blob URLs
6. Create `src/lib/videoRegistry.ts`
7. Add `isPlaying`, `playheadTime`, `totalDuration` to `editorStore`
8. Update `hasVideoCell` in `export.ts` to use `mediaTypeMap`

### Wave 1 — Video upload + canvas preview (VIDE-01, VIDE-02)
1. Update LeafNode file input `accept` to include `video/*`
2. Update `autoFillCells` / upload handler to detect video, create blob URL, call `addMedia(id, blobUrl, 'video')`
3. Add `videoElRef` to `LeafNodeComponent`
4. Build rAF loop; subscribe to `isPlaying`
5. Extend `drawLeafToCanvas` to accept video elements
6. Register video in `videoElementRegistry` on load; unregister on unmount

### Wave 2 — Timeline bar (VIDE-03)
1. Create `PlaybackTimeline` component
2. Wire `playAll` / `pauseAll` via videoRegistry
3. Wire scrubber to `seekAll` + `setPlayheadTime`
4. Add `totalDuration` computation from registered video durations
5. Show/hide based on `hasVideos`

### Wave 3 — ffmpeg export (VIDE-04, VIDE-05, VIDE-06, VIDE-07)
1. Create `videoExport.ts` with frame loop + ffmpeg lazy load
2. Extend `renderGridToCanvas` to handle video cells
3. Implement `seekAllVideosTo` with Promise-based await
4. Wire ffmpeg lazy load + progress to Toast
5. Update `ExportSplitButton` auto-detect logic
6. Hide format/quality controls when in video mode
7. Test with Chrome + Firefox (Safari: show unsupported message)

### Verification checklist
- [ ] `self.crossOriginIsolated` is `true` in dev and production
- [ ] Dropping a .mp4 onto a cell renders looping muted video with correct object-fit
- [ ] Play button starts all video cells simultaneously
- [ ] Scrubber seeks all cells to same position
- [ ] Export button shows "Export MP4" when video cells exist
- [ ] "Loading ffmpeg..." toast appears on first video export
- [ ] Progress updates during encoding (log parsing fallback active)
- [ ] Downloaded file is valid MP4 that plays in Chrome and Firefox at 1080×1920
- [ ] Image-only export still works (no regression)
- [ ] Clearing a video cell revokes the blob URL (check DevTools Memory)

---

## Sources

### Primary (HIGH confidence)
- ffmpegwasm.netlify.app/docs/getting-started/usage — confirmed API, CDN load pattern, progress events
- ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg — confirmed complete method signatures
- npm registry — confirmed @ffmpeg/ffmpeg@0.12.15, @ffmpeg/util@0.12.2, @ffmpeg/core@0.12.10
- developer.mozilla.org/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback — confirmed Baseline 2024, not available in Chrome 90/Safari 15
- developer.mozilla.org/docs/Web/API/URL/revokeObjectURL_static — blob URL lifecycle

### Secondary (MEDIUM confidence)
- github.com/ffmpegwasm/ffmpeg.wasm/issues/120 — confirmed filter_complex works if shell quotes removed
- japj.net/2025/04/21/ffmpeg-wasm-encoding-progress — log-parsing workaround for NaN progress
- phpied.com/video-grids-with-ffmpeg — xstack layout expression syntax (confirmed with official FFmpeg docs)
- Vercel community + nuxt-security.vercel.app — verified vercel.json COOP/COEP header configuration format

### Tertiary (LOW confidence — validate during implementation)
- ffmpeg.wasm progress event NaN issues: confirmed by multiple GitHub issues (#178, #600, #49); log-parsing workaround validated by 2025 article
- seeked event timeout: standard browser behavior; validate per video format

## Metadata

**Confidence breakdown:**
- @ffmpeg/ffmpeg API: HIGH — official docs verified
- COOP/COEP configuration: HIGH — confirmed via Vercel docs + standard spec
- Canvas rAF video rendering: HIGH — standard browser API
- xstack filter graph: MEDIUM — syntax confirmed but exact coordinates for complex grids need testing
- Frame sequence export performance: MEDIUM — benchmarks are estimates; actual timing varies by device
- Progress log parsing: MEDIUM — workaround confirmed but requires exact regex match on ffmpeg output format

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (stable APIs; ffmpeg.wasm 0.12.x unlikely to have breaking changes)
