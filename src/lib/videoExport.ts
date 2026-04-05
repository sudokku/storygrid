import { getAllLeaves } from './tree';
import type { GridNode } from '../types';
import { renderGridToCanvas, type CanvasSettings } from './export';
import { videoElementRegistry } from './videoRegistry';
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  QUALITY_HIGH,
} from 'mediabunny';

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
        if (Math.abs(video.currentTime - timeSeconds) < 0.01) {
          resolve();
          return;
        }
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        // Safety timeout in case the seeked event never fires
        const timer = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 500);
        video.addEventListener('seeked', () => clearTimeout(timer), { once: true });
        video.currentTime = timeSeconds;
      }),
    );
  }
  await Promise.all(promises);
}

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

  const FPS = 30;
  const FRAME_DURATION_SEC = 1 / FPS;
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
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);
  await output.start();

  const videoElementsByMediaId = buildVideoElementsByMediaId(root);

  for (let frame = 0; frame < totalFrames; frame++) {
    const timeSeconds = frame * FRAME_DURATION_SEC;

    // Seek all video elements to this frame's timestamp before rendering
    if (videoElementRegistry.size > 0) {
      await seekAllVideosTo(timeSeconds);
    }

    // Render the grid into a temporary canvas
    const frameCanvas = await renderGridToCanvas(
      root,
      mediaRegistry,
      1080,
      1920,
      settings,
      videoElementsByMediaId,
    );

    // Copy rendered frame onto the stable canvas that CanvasSource holds
    stableCtx.drawImage(frameCanvas, 0, 0);

    // CanvasSource reads stableCanvas pixel data at this point.
    // Timestamps and durations are in SECONDS (not microseconds).
    await videoSource.add(timeSeconds, FRAME_DURATION_SEC);

    onProgress('encoding', Math.round(((frame + 1) / totalFrames) * 100));
  }

  await output.finalize();

  // target.buffer is null until finalize() completes
  const arrayBuffer = target.buffer as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'video/mp4' });
}
