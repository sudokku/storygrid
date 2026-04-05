import { getAllLeaves } from './tree';
import type { GridNode } from '../types';
import { renderGridIntoContext, type CanvasSettings } from './export';
import { videoElementRegistry } from './videoRegistry';
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
} from 'mediabunny';

// ---------------------------------------------------------------------------
// computeLoopedTime — pure helper for modulo-based video looping
//
// The editor uses `video.loop = true` so the browser handles looping natively
// during playback. The export pipeline manually seeks frame-by-frame via
// `video.currentTime = X`, bypassing the browser's loop mechanism entirely.
// This function replicates what `loop=true` would do during a manual seek.
//
// Edge cases:
//   - duration === 0: metadata not loaded — fall back to 0
//   - duration is NaN or Infinity: invalid metadata — fall back to 0
// ---------------------------------------------------------------------------

export function computeLoopedTime(timeSeconds: number, duration: number): number {
  if (!duration || !isFinite(duration) || duration <= 0) {
    return 0;
  }
  return timeSeconds % duration;
}

// ---------------------------------------------------------------------------
// buildVideoElementsByMediaId
//
// videoElementRegistry maps nodeId -> HTMLVideoElement.
// renderGridToCanvas expects mediaId -> HTMLVideoElement.
// We need to look up the mediaId for each nodeId via the gridStore snapshot.
// Since videoExport runs outside React, read the store directly.
// ---------------------------------------------------------------------------

function buildVideoElementsByMediaId(root: GridNode): Map<string, HTMLVideoElement> {
  const result = new Map<string, HTMLVideoElement>();
  const leaves = getAllLeaves(root);
  for (const leaf of leaves) {
    if (leaf.mediaId && videoElementRegistry.has(leaf.id)) {
      result.set(leaf.mediaId, videoElementRegistry.get(leaf.id)!);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// seekAllVideosTo — seek all registered video elements to the given time
// ---------------------------------------------------------------------------

async function seekAllVideosTo(timeSeconds: number): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const video of videoElementRegistry.values()) {
    promises.push(
      new Promise<void>((resolve) => {
        // Wrap the seek target so shorter videos loop seamlessly.
        // The editor uses video.loop=true for playback, but the export pipeline
        // manually seeks frame-by-frame, bypassing the browser's loop mechanism.
        const effectiveTime = computeLoopedTime(timeSeconds, video.duration);

        // Skip seek if already within half a frame of the target position.
        // FRAME_DURATION_SEC * 0.5 (0.0167s at 30fps) is more useful than the
        // previous hardcoded 0.01 — prevents unnecessary seeks on consecutive frames.
        if (Math.abs(video.currentTime - effectiveTime) < FRAME_DURATION_SEC * 0.5) {
          resolve();
          return;
        }
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        // Safety timeout reduced from 500ms to 100ms.
        // For local blob URL videos (already buffered), seeks complete in <50ms.
        const timer = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 100);
        video.addEventListener('seeked', () => clearTimeout(timer), { once: true });
        video.currentTime = effectiveTime;
      }),
    );
  }
  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Frame rate constants — used by both seekAllVideosTo and exportVideoGrid
// ---------------------------------------------------------------------------

const FPS = 30;
const FRAME_DURATION_SEC = 1 / FPS;

// ---------------------------------------------------------------------------
// exportVideoGrid — main entry point
// ---------------------------------------------------------------------------

export async function exportVideoGrid(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  settings: CanvasSettings,
  totalDuration: number,
  onProgress: (stage: 'encoding', percent?: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export requires Chrome 94+ or Firefox 130+.');
  }

  // Firefox H.264 VideoEncoder bug: isConfigSupported() returns true but encode()
  // throws DOMException at runtime. Force VP9 on Firefox (Bugzilla #1918769).
  const isFirefox = navigator.userAgent.includes('Firefox');
  const codec = isFirefox ? 'vp9' : 'avc';

  const totalFrames = Math.max(1, Math.ceil(totalDuration * FPS));

  // CanvasSource requires a single stable canvas element across all add() calls.
  // renderGridToCanvas creates a new canvas each time, so we render into a temp
  // canvas and then drawImage onto the stable one that CanvasSource holds.
  const stableCanvas = document.createElement('canvas');
  stableCanvas.width = 1080;
  stableCanvas.height = 1920;
  const stableCtx = stableCanvas.getContext('2d');
  if (!stableCtx) throw new Error('Canvas 2D context not available');

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  const videoSource = new CanvasSource(stableCanvas, {
    codec,
    bitrate: 6_000_000,                    // 6 Mbps — sufficient for Instagram Story
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'quality',
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource);
  await output.start();

  const videoElementsByMediaId = buildVideoElementsByMediaId(root);

  // Image cache persists across all frames — images decoded once, not per frame.
  const imageCache = new Map<string, HTMLImageElement>();

  for (let frame = 0; frame < totalFrames; frame++) {
    const timeSeconds = frame * FRAME_DURATION_SEC;

    // Seek all video elements to this frame's timestamp before rendering
    if (videoElementRegistry.size > 0) {
      await seekAllVideosTo(timeSeconds);
    }

    // Render directly into the stable canvas — no intermediate canvas allocation.
    // CanvasSource reads stableCanvas pixel data after this call.
    await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, videoElementsByMediaId, imageCache);

    // Timestamps and durations are in SECONDS (not microseconds).
    await videoSource.add(timeSeconds, FRAME_DURATION_SEC);

    onProgress('encoding', Math.round(((frame + 1) / totalFrames) * 100));
  }

  await output.finalize();

  // target.buffer is null until finalize() completes
  const arrayBuffer = target.buffer as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'video/mp4' });
}
