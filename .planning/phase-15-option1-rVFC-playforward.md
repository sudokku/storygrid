# Phase 15 Option 1 — rVFC Play-Forward Frame Capture

## Summary

Replace `seekAllVideosTo` (99.4% of export time) with a `requestVideoFrameCallback`-based
play-forward approach. Instead of seeking each video to an arbitrary timestamp on every frame,
videos are played forward continuously and frames are captured as they arrive via rVFC.

## Performance Expectation

| Scenario | Current | Option 1 |
|---|---|---|
| 24s export, 4 videos | ~3 minutes | ~30–60 seconds |
| Encode time target (20–45s) | ❌ | Borderline |

**Important caveat:** `requestVideoFrameCallback` fires when a frame is *presented to the compositor*,
not when it is decoded. At high `playbackRate`, Chrome skips frames — you cannot reliably extract
every frame faster than real-time using rVFC. This means the export loop is bounded by the video
duration (~24–25s minimum wall-clock) plus render+encode overhead.

With 4 videos playing in parallel at `playbackRate = 1`, the total is approximately equal to the
video duration. This is a meaningful improvement over 3 minutes but may not consistently hit the
20–45s target for shorter exports.

**If the target is strictly 20–45s, use Option 2 (WebCodecs VideoDecoder) instead.**

---

## Root Cause (for reference)

Every `video.currentTime = t` triggers a renderer→browser-process IPC round-trip through Chrome's
media pipeline. The browser must find the keyframe before `t`, decode forward to `t`, and emit a
`seeked` event. For H.264 with 5s keyframe intervals at 30fps, this is up to 433ms per frame.

rVFC eliminates this by letting the browser decode frames sequentially (no seeks), which is the
GPU decoder's natural fast path.

---

## Architecture Change

### Current (broken)
```
for each frame i (0..748):
  await seekAllVideosTo(i / FPS)   // 250ms avg ← bottleneck
  renderGridIntoContext()           // 1ms
  drawOverlaysToCanvas()            // 0ms
  videoSource.add()                 // 0ms
```

### Option 1
```
// Phase A: Play all videos in parallel, capture frames via rVFC
const allFrames = await captureAllFrames(exportVideoElements, totalFrames, FPS)
// Map<mediaId, ImageBitmap[]> — one ImageBitmap per frame index

// Phase B: Encode loop (no seeking, all frames pre-captured)
for each frame i (0..748):
  renderGridFromBitmaps(allFrames, i)  // draw pre-captured bitmaps
  drawOverlaysToCanvas()
  videoSource.add()
```

---

## Implementation Plan

### Step 1 — `captureAllFrames` function (new)

```typescript
async function captureAllFrames(
  exportVideoElements: Map<string, HTMLVideoElement>,
  totalFrames: number,
  fps: number,
): Promise<Map<string, ImageBitmap[]>> {
  const result = new Map<string, ImageBitmap[]>();

  // Capture each video's frames in parallel
  await Promise.all(
    Array.from(exportVideoElements.entries()).map(async ([mediaId, video]) => {
      const frames: ImageBitmap[] = [];
      const neededTimestamps = computeNeededTimestamps(video, totalFrames, fps);

      // Seek to 0 once (cheap — keyframe)
      await seekVideoTo(video, 0);

      for (const targetTime of neededTimestamps) {
        await advanceToTime(video, targetTime);
        frames.push(await createImageBitmap(video));
      }

      result.set(mediaId, frames);
    })
  );

  return result;
}
```

`advanceToTime(video, targetTime)`:
- If `video.currentTime >= targetTime` (loop boundary): seek back to 0 (keyframe, fast)
- Set `video.playbackRate = 1`
- Call `video.play()`
- Register rVFC callback; resolve when `metadata.mediaTime >= targetTime - (0.5/fps)`
- Call `video.pause()`

### Step 2 — `renderGridIntoContext` signature extension

Add overload accepting `Map<string, ImageBitmap>` for the current frame's video bitmaps,
replacing the `exportVideoElements` parameter. The existing path (using HTMLVideoElement)
stays for preview rendering. The export path uses ImageBitmaps.

```typescript
// New parameter shape for export path
type FrameBitmaps = Map<string, ImageBitmap>; // mediaId → bitmap for this frame

export async function renderGridIntoContext(
  ctx: CanvasRenderingContext2D,
  node: GridNode,
  mediaRegistry: MediaRegistry,
  width: number,
  height: number,
  settings: GridSettings,
  videoSource: Map<string, HTMLVideoElement> | FrameBitmaps,  // union
  imageCache: Map<string, HTMLImageElement>,
): Promise<void>
```

Inside, when a leaf has `mediaType === 'video'`, check if `videoSource` is a `FrameBitmaps`
map and draw from the bitmap rather than the live element.

### Step 3 — Memory management

`ImageBitmap` objects are GPU-resident. For 4 videos × 749 frames, memory may be high.
Two options:
- **Pre-capture all** (simpler): ~750 bitmaps × 4 videos × ~500KB each ≈ ~1.5GB. Risky on
  low-RAM devices.
- **Sliding window** (safer): capture the next N=30 frames for each video ahead of the encode
  loop; close bitmaps after they are encoded. More complex but memory-bounded.

**Recommended**: Start with pre-capture all, add a low-memory fallback (window of 30) if OOM
is observed.

### Step 4 — Export loop refactor

```typescript
// Before video loop: capture all frames
onProgress('encoding', 0);
const allFrames = await captureAllFrames(exportVideoElements, totalFrames, FPS);

// Encode loop: zero seeking
for (let i = 0; i < totalFrames; i++) {
  const frameBitmaps = new Map(
    Array.from(allFrames.entries()).map(([id, bitmaps]) => [id, bitmaps[i]])
  );

  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, frameBitmaps, imageCache);
  await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
  await videoSource.add(i / FPS, 1 / FPS);

  // Close bitmaps for this frame immediately (memory)
  for (const bitmap of frameBitmaps.values()) bitmap.close();

  onProgress('encoding', Math.round((i / totalFrames) * 100));
}
```

---

## Files to Change

| File | Change |
|---|---|
| `src/lib/videoExport.ts` | Replace `seekAllVideosTo` loop with `captureAllFrames` + new encode loop |
| `src/lib/videoExport.ts` | Add `captureAllFrames`, `advanceToTime`, `computeNeededTimestamps` functions |
| `src/lib/export.ts` | Extend `renderGridIntoContext` to accept `FrameBitmaps` in addition to `Map<string, HTMLVideoElement>` |
| `src/lib/videoExport.ts` | Remove `seekAllVideosTo` (replaced) |

**No new dependencies.**

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Frame skipping at loop boundary seek | Medium | Loop boundary is a keyframe seek (time=0), so fast |
| OOM on 4 videos × 749 frames pre-capture | Medium | Sliding window fallback |
| rVFC fires late / misses frame | Low | `metadata.mediaTime` comparison with 0.5-frame tolerance |
| Safari incompatibility | Low | rVFC supported in Safari 15.4+; matches existing Safari 15+ target |
| `renderGridIntoContext` refactor breaks preview | Low | Union type preserves existing code path |

---

## Estimated Effort

~3–4 hours implementation, ~1 hour testing.  
New code: ~120 lines. Modified code: ~30 lines.

---

## Verdict

**Choose Option 1 if**: The 30–60s encode time is acceptable and you want minimal architectural
risk. No new dependencies. Straightforward to implement and test.

**Choose Option 2 if**: You need to consistently hit 20–45s, or you want the theoretically
correct solution that also enables future features (e.g. per-frame effects, frame-accurate
trimming). Harder to implement but more robust and faster long-term.
