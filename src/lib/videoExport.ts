import { getAllLeaves } from './tree';
import type { GridNode } from '../types';
import type { CanvasSettings } from './export';
import { renderGridToCanvas } from './export';
import { videoElementRegistry } from './videoRegistry';

// ---------------------------------------------------------------------------
// loadFFmpeg — lazy loads @ffmpeg/ffmpeg and @ffmpeg/util from CDN
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadFFmpeg(): Promise<any> {
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

// ---------------------------------------------------------------------------
// seekAllVideosTo — seeks all registered video elements to a given time
// ---------------------------------------------------------------------------

async function seekAllVideosTo(time: number): Promise<void> {
  const promises = Array.from(videoElementRegistry.values()).map(
    video =>
      new Promise<void>(resolve => {
        // Handle case where time is already current (seeked won't fire)
        if (Math.abs(video.currentTime - time) < 0.01) {
          resolve();
          return;
        }
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        // Timeout fallback — some formats may not fire seeked
        const timer = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 500);
        // Clear timeout if seeked fires first
        video.addEventListener('seeked', () => clearTimeout(timer), { once: true });
        video.currentTime = time;
      }),
  );
  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// canvasToUint8Array — converts canvas to PNG bytes
// ---------------------------------------------------------------------------

async function canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('toBlob returned null'));
        return;
      }
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

// ---------------------------------------------------------------------------
// buildVideoElementsByMediaId — maps mediaId -> HTMLVideoElement
//
// videoElementRegistry is keyed by nodeId; we need mediaId-keyed map for
// renderGridToCanvas (which only has access to leaf.mediaId during renderNode).
// ---------------------------------------------------------------------------

function buildVideoElementsByMediaId(
  root: GridNode,
  registry: Map<string, HTMLVideoElement>,
): Map<string, HTMLVideoElement> {
  const map = new Map<string, HTMLVideoElement>();
  const leaves = getAllLeaves(root);
  for (const leaf of leaves) {
    if (leaf.mediaId && registry.has(leaf.id)) {
      map.set(leaf.mediaId, registry.get(leaf.id)!);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// exportVideoGrid — main video export function
// ---------------------------------------------------------------------------

export async function exportVideoGrid(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  settings: CanvasSettings,
  totalDuration: number,
  onProgress: (stage: 'loading-ffmpeg' | 'encoding', percent?: number) => void,
): Promise<Blob> {
  // Safari guard — crossOriginIsolated requires COOP/COEP headers
  if (!crossOriginIsolated) {
    throw new Error(
      'Video export requires Chrome or Firefox. Safari is not supported.',
    );
  }

  onProgress('loading-ffmpeg');
  const ffmpeg = await loadFFmpeg();

  const FPS = 30;
  // Guard against 0-duration (e.g., still loading) — use at least 1 second
  const duration = Math.max(totalDuration, 1);
  const totalFrames = Math.ceil(duration * FPS);

  // Set up log-based progress tracking (progress event is unreliable per research)
  let progressFromLog = 0;
  ffmpeg.on('log', ({ message }: { message: string }) => {
    if (message.includes('time=') && message.includes('speed=')) {
      const match = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const [, h, m, s, cs] = match.map(Number);
        const currentSec = h * 3600 + m * 60 + s + cs / 100;
        progressFromLog = Math.min(
          Math.round((currentSec / duration) * 100),
          100,
        );
        // 80-95% range for encoding phase
        onProgress('encoding', 80 + Math.round((progressFromLog / 100) * 15));
      }
    }
    // Suppress unused warning
    void progressFromLog;
  });

  // Pause all videos before seeking for frame-by-frame export
  for (const video of videoElementRegistry.values()) {
    video.pause();
  }

  const videoElementsByMediaId = buildVideoElementsByMediaId(root, videoElementRegistry);

  // Frame rendering loop: seek all videos, render canvas, write PNG to ffmpeg FS
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeSeconds = frame / FPS;
    await seekAllVideosTo(timeSeconds);

    const frameCanvas = await renderGridToCanvas(
      root,
      mediaRegistry,
      1080,
      1920,
      settings,
      videoElementsByMediaId,
    );

    const pngData = await canvasToUint8Array(frameCanvas);
    await ffmpeg.writeFile(
      `frame${String(frame).padStart(6, '0')}.png`,
      pngData,
    );

    // Progress: 0-80% for frame writing phase
    onProgress('encoding', Math.round((frame / totalFrames) * 80));
  }

  // Encode MP4 (H.264, CRF 23, yuv420p for broad compatibility)
  onProgress('encoding', 80);
  await ffmpeg.exec([
    '-r', String(FPS),
    '-i', 'frame%06d.png',
    '-c:v', 'libx264',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    'output.mp4',
  ]);
  onProgress('encoding', 95);

  // Read output file from virtual FS
  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data], { type: 'video/mp4' });

  // Cleanup virtual FS
  for (let i = 0; i < totalFrames; i++) {
    await ffmpeg
      .deleteFile(`frame${String(i).padStart(6, '0')}.png`)
      .catch(() => {});
  }
  await ffmpeg.deleteFile('output.mp4').catch(() => {});
  ffmpeg.terminate();

  onProgress('encoding', 100);
  return blob;
}
