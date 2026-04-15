---
phase: 15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/export.ts
  - src/lib/videoExport.ts
  - src/Editor/Toast.tsx
  - src/Editor/ExportSplitButton.tsx
  - src/test/videoExport-audio.test.ts
  - src/test/videoExport-mediabunny.test.ts
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 15 replaces the `HTMLVideoElement` seeking pipeline with a Mediabunny `VideoSampleSink` decode-then-encode approach. The architectural change is sound and well-documented. However, two critical bugs were found: a `VideoFrame` use-after-close race condition in the render loop, and a stale closure in `ExportSplitButton` that causes video exports to use the wrong media type map after media changes. Two additional warnings cover an encoding progress counter that never reaches 100% and a type safety gap in `getSourceDimensions`.

---

## Critical Issues

### CR-01: VideoFrame use-after-close race when image and video cells coexist in one grid

**File:** `src/lib/videoExport.ts:484-490`

**Issue:** `buildFrameMapForTime` calls `sample.toCanvasImageSource()` and stores the result in `frameMap`. According to Mediabunny's documented behavior (Pitfall 2), the returned `VideoFrame` is auto-closed after the next microtask. Immediately after building the map, `renderGridIntoContext` is `await`-ed. Inside `renderNode`, image cells hit `await loadImage(dataUri)` (export.ts line 418) before drawing video cells that appear later in tree order. Each `await` yields to the microtask queue, which is where the auto-close fires. Video cells that are visited after any image-cell `await` will attempt to `drawImage` a closed `VideoFrame`, producing a blank cell or a `DOMException: Failed to execute 'drawImage'`.

This only affects grids with a mix of image cells and video cells where an image cell is encountered before a video cell in depth-first traversal order. A grid with only video cells is not affected.

**Fix:** Replace `toCanvasImageSource()` with an `ImageBitmap` drawn synchronously from the `VideoFrame` before the async render pass, or restructure `renderNode` so all video draws are batched synchronously from the pre-built map before any `await loadImage` call. The simplest safe approach is to pre-rasterize all video frames to `ImageBitmap` objects (which do not auto-close) immediately after decoding, replacing `toCanvasImageSource()` in `buildFrameMapForTime`:

```typescript
// In buildFrameMapForTime — replace toCanvasImageSource() with createImageBitmap
// ImageBitmap is not auto-closed and survives across await points.
async function buildFrameMapForTime(
  decodedVideos: Map<string, { samples: VideoSample[]; duration: number }>,
  timeSeconds: number,
): Promise<Map<string, CanvasImageSource>> {
  const frameMap = new Map<string, CanvasImageSource>();
  for (const [mediaId, { samples, duration }] of decodedVideos) {
    const sample = findSampleForTime(samples, timeSeconds, duration);
    if (sample) {
      const frame = sample.toCanvasImageSource(); // VideoFrame — must close after use
      const bitmap = await createImageBitmap(frame as ImageBitmapSource);
      if (frame instanceof VideoFrame) frame.close();
      frameMap.set(mediaId, bitmap);
    }
  }
  return frameMap;
}
```

Then `await buildFrameMapForTime(...)` in the encode loop, and close/release the `ImageBitmap` values after `renderGridIntoContext` returns.

---

### CR-02: `mediaTypeMap` missing from `useCallback` dependency array — stale closure bug

**File:** `src/Editor/ExportSplitButton.tsx:109,166-181`

**Issue:** `mediaTypeMap` is read inside `handleExport` (passed to `exportVideoGrid` at line 109 and used implicitly in `hasVideos` via `hasVideoCell`). It is not included in the `useCallback` dependency array (lines 166-181). The `handleExport` callback will capture the `mediaTypeMap` value from the render in which it was created. If the user drops a new video cell or replaces a video with an image after the callback was last memoized, the export will use a stale type map — potentially treating a new video cell as an image (or vice versa), leading to a silent wrong export or missing video frames.

**Fix:** Add `mediaTypeMap` to the dependency array:

```typescript
  }, [
    isExporting,
    hasVideos,
    root,
    mediaRegistry,
    mediaTypeMap,          // ADD THIS
    exportFormat,
    exportQuality,
    setIsExporting,
    gap,
    borderRadius,
    backgroundMode,
    backgroundColor,
    backgroundGradientFrom,
    backgroundGradientTo,
    backgroundGradientDir,
  ]);
```

---

## Warnings

### WR-01: Encoding progress counter never reaches 100%

**File:** `src/lib/videoExport.ts:504`

**Issue:** The progress update inside the frame loop is `Math.round((i / totalFrames) * 100)`. For the last iteration `i = totalFrames - 1`, this yields `Math.round(((totalFrames-1) / totalFrames) * 100)` — always strictly less than 100 (e.g., 97% for 30 frames). The UI toast therefore never shows "Encoding 100%" before it is dismissed. This is a logic error, not just a cosmetic issue — callers relying on `percent === 100` to trigger downstream actions would never fire.

**Fix:** Increment before dividing, so the last frame reports 100%:

```typescript
onProgress('encoding', Math.round(((i + 1) / totalFrames) * 100));
```

---

### WR-02: `getSourceDimensions` silently returns `{ w: 0, h: 0 }` for `HTMLCanvasElement` or `SVGImageElement`

**File:** `src/lib/export.ts:144`

**Issue:** The draw helpers (`drawCoverImage`, `drawContainImage`, `drawPannedCoverImage`, `drawPannedContainImage`) all declare their `img` parameter as `CanvasImageSource`. TypeScript's DOM lib includes `HTMLCanvasElement` and `SVGImageElement` in `CanvasImageSource`. If either is ever passed — e.g., via a future code path — the function falls through to the `HTMLImageElement` cast at line 144 and reads `.naturalWidth` / `.naturalHeight`, both of which are `undefined` on `HTMLCanvasElement` and `SVGImageElement`. The returned dimensions would be `{ w: undefined as number, h: undefined as number }`, causing `NaN` in all subsequent aspect-ratio calculations and producing a blank or corrupted cell without any error thrown.

The current codebase only passes `HTMLImageElement`, `VideoFrame`, `OffscreenCanvas`, and `ImageBitmap` through these paths, so this is latent. It becomes a risk if a new code path introduces canvas-to-canvas compositing.

**Fix:** Either narrow the draw-helper parameter types from `CanvasImageSource` to `DrawableSource`, or add an explicit guard in `getSourceDimensions`:

```typescript
// Option A: narrow parameter type (preferred — prevents the bad call at compile time)
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: DrawableSource,   // was: CanvasImageSource
  rect: Rect,
  objPos: ObjPos,
): void { ... }

// Option B: add a guard in getSourceDimensions (defence-in-depth)
if (src instanceof HTMLCanvasElement) {
  return { w: src.width, h: src.height };
}
```

---

## Info

### IN-01: Dead code — `void onDismiss` in Toast component

**File:** `src/Editor/Toast.tsx:99`

**Issue:** `void onDismiss` is a no-op statement. `onDismiss` is already referenced in the `audio-warning` branch (line 77). This statement does not suppress any lint warning in a meaningful way and adds noise.

**Fix:** Remove line 99.

---

### IN-02: `decoding` progress label reuses `encodingPercent` prop — misleading naming

**File:** `src/Editor/Toast.tsx:39` and `src/Editor/ExportSplitButton.tsx:116-117`

**Issue:** The `decoding` toast branch reads `encodingPercent` to display its progress percentage (`Decoding {encodingPercent ?? 0}%...`). The prop is named `encodingPercent` but is used for decoding-stage progress. The `ExportSplitButton` stores this value in `setEncodingPercent` regardless of whether the stage is `decoding` or `encoding`. This is not wrong today but will become confusing if decoding and encoding percentages diverge (e.g., showing two concurrent progress values).

**Fix:** Rename `encodingPercent` to `progressPercent` in `ToastProps`, `Toast`, and `ExportSplitButton` to reflect its shared use across stages.

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
