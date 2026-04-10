// transcodeToMp4.ts — Lazy-load ffmpeg.wasm and transcode WebM to QuickTime-compatible MP4

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Singleton ffmpeg instance — cached after first load.
let ffmpegInstance: FFmpeg | null = null;

/**
 * Get or create the singleton FFmpeg instance.
 * Loads @ffmpeg/core from unpkg CDN (single-threaded, no COOP/COEP required).
 */
async function getFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Transcode a WebM blob to a QuickTime-compatible H.264 MP4.
 *
 * Uses:
 *   -c:v libx264       — H.264 video codec
 *   -preset fast        — good speed/quality balance
 *   -crf 23             — constant quality factor
 *   -r 30               — explicit 30fps (known constant from MediaRecorder)
 *   -pix_fmt yuv420p   — required for QuickTime + iOS compatibility
 *   -movflags +faststart — moov atom at front (the actual QuickTime fix)
 *   -c:a aac            — AAC audio codec (no-op if no audio track in input)
 *   -b:a 192k           — audio bitrate
 *
 * Note: -c:a aac is safe to include even when the WebM blob has no audio track.
 * ffmpeg silently ignores audio codec flags when no audio stream is present in
 * the input, so there is no need to conditionally omit them.
 *
 * @param webmBlob - The WebM blob from MediaRecorder
 * @param onProgress - Progress callback (0-100)
 * @returns MP4 Blob with correct moov placement
 */
export async function transcodeWebmToMp4(
  webmBlob: Blob,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // Register progress handler before exec — ffmpeg.on() is additive, so clean up
  // after each call by removing the listener to avoid stacking handlers on reuse.
  let progressHandler: ((event: { progress: number; time: number }) => void) | null = null;

  if (onProgress) {
    progressHandler = ({ progress }: { progress: number; time: number }) => {
      // progress is 0.0-1.0; clamp to 0-99 while in-progress (100 is set by caller on resolve).
      onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
    };
    ffmpeg.on('progress', progressHandler);
  }

  try {
    // Write input WebM to ffmpeg virtual filesystem.
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);

    // Transcode WebM to MP4 with QuickTime-compatible settings.
    // -c:a aac is safe to include even when no audio track exists in the input.
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '192k',
      'output.mp4',
    ]);

    // Read output MP4 from virtual filesystem.
    // readFile returns FileData (Uint8Array | string); cast via unknown to satisfy
    // strict ArrayBuffer typing in Blob constructor.
    const outputData = await ffmpeg.readFile('output.mp4');

    // Convert Uint8Array to Blob.
    return new Blob([outputData as unknown as ArrayBuffer], { type: 'video/mp4' });
  } finally {
    // Clean up virtual filesystem files.
    await ffmpeg.deleteFile('input.webm').catch(() => {});
    await ffmpeg.deleteFile('output.mp4').catch(() => {});

    // Remove the progress handler to prevent stacking on subsequent calls.
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler);
    }
  }
}
