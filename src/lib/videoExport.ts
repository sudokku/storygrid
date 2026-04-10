import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  canEncodeAudio,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { getAllLeaves } from './tree';
import type { GridNode, LeafNode } from '../types';
import { renderGridIntoContext, type CanvasSettings } from './export';
import { drawOverlaysToCanvas } from './overlayExport';
import { useOverlayStore } from '../store/overlayStore';

// ---------------------------------------------------------------------------
// computeLoopedTime — pure helper for modulo-based video looping
//
// During export, videos are seeked frame-by-frame. For cells whose video is
// shorter than the total export duration, this helper computes the looped
// position (matching `loop=true` behavior).
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
// buildExportVideoElements
//
// Creates DEDICATED HTMLVideoElement instances for export only.
// These elements:
//   - Are created fresh at export start, NOT connected to the DOM
//   - Load from the same blob URLs already in mediaRegistry (still valid)
//   - Are never exposed to the user or the preview UI
//   - Are played and controlled exclusively by the export loop
//   - Are destroyed via destroyExportVideoElements after export completes
//
// WHY NOT reuse videoElementRegistry (live UI elements):
//   User actions (seek, pause, play) in the preview UI would interfere with
//   the export playback, corrupting the exported video. Dedicated elements
//   are completely isolated from the UI.
//
// Returns: Map<mediaId, HTMLVideoElement> — same shape expected by
//          renderGridIntoContext's videoElements parameter.
// ---------------------------------------------------------------------------

export async function buildExportVideoElements(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
): Promise<Map<string, HTMLVideoElement>> {
  const result = new Map<string, HTMLVideoElement>();
  const leaves = getAllLeaves(root);

  // Collect unique mediaIds that are videos.
  const videoMediaIds = new Set<string>();
  for (const leaf of leaves) {
    if (
      leaf.mediaId &&
      mediaTypeMap[leaf.mediaId] === 'video' &&
      mediaRegistry[leaf.mediaId]
    ) {
      videoMediaIds.add(leaf.mediaId);
    }
  }

  // Create a dedicated HTMLVideoElement for each unique video mediaId.
  const loadPromises: Promise<void>[] = [];
  for (const mediaId of videoMediaIds) {
    const blobUrl = mediaRegistry[mediaId];
    const video = document.createElement('video');
    video.preload = 'auto';
    // Phase 12 (AUD-05): if ANY leaf using this mediaId has audioEnabled=true,
    // unmute the dedicated export element. Shared mediaIds across multiple cells:
    // the element is shared; if any user wants audio, we unmute.
    const anyLeafWantsAudio = leaves.some(
      (l) => l.type === 'leaf' && l.mediaId === mediaId && l.audioEnabled,
    );
    video.muted = !anyLeafWantsAudio;
    video.playsInline = true;
    video.loop = false; // Managed manually in export loop
    video.crossOrigin = 'anonymous';
    video.src = blobUrl;

    result.set(mediaId, video);

    // Wait until the video has at least one decodable frame ready (readyState >= 2,
    // HAVE_CURRENT_DATA). This ensures the first drawImage call in the render loop
    // paints real pixels, not a blank frame.
    //
    // 'canplay' fires at readyState >= 3 (HAVE_FUTURE_DATA) on most browsers,
    // but 'loadeddata' fires at readyState >= 2 (HAVE_CURRENT_DATA) and is
    // sufficient for a single drawImage. We listen for whichever arrives first.
    loadPromises.push(
      new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          // HAVE_CURRENT_DATA (or better) — first frame already available.
          resolve();
          return;
        }
        const done = () => resolve();
        video.addEventListener('loadeddata', done, { once: true });
        video.addEventListener('canplay', done, { once: true });
        video.addEventListener('error', done, { once: true }); // Non-fatal
      }),
    );
    // Trigger loading by calling load() — necessary when the element is not in
    // the DOM (no auto-preload happens for detached elements in some browsers).
    video.load();
  }

  await Promise.all(loadPromises);
  return result;
}

// ---------------------------------------------------------------------------
// destroyExportVideoElements
//
// Cleans up dedicated export video elements after export completes or fails.
// Sets src='' to release the media resource. Does NOT revoke the blob URL —
// the blob URL belongs to mediaRegistry and must remain valid for the editor.
// ---------------------------------------------------------------------------

function destroyExportVideoElements(
  exportVideoElements: Map<string, HTMLVideoElement>,
): void {
  for (const video of exportVideoElements.values()) {
    video.pause();
    video.src = '';
    video.load(); // Resets the element and releases resources
  }
  exportVideoElements.clear();
}

// ---------------------------------------------------------------------------
// hasAudioEnabledVideoLeaf (Phase 12 — AUD-06 skip-path decision helper)
//
// Returns true iff at least one leaf has audioEnabled=true AND its mediaId
// resolves to a 'video' entry in mediaTypeMap. Used by exportVideoGrid to
// decide whether to construct an audio source at all.
// Keeping this as a single exported helper gives us a unit-testable decision
// point without having to drive the entire export in jsdom.
// ---------------------------------------------------------------------------

export function hasAudioEnabledVideoLeaf(
  leaves: LeafNode[],
  mediaTypeMap: Record<string, 'image' | 'video'>,
): boolean {
  for (const leaf of leaves) {
    if (leaf.type !== 'leaf') continue;
    if (!leaf.audioEnabled) continue;
    if (!leaf.mediaId) continue;
    if (mediaTypeMap[leaf.mediaId] !== 'video') continue;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// collectAudioEnabledMediaIds
//
// Returns a Set of unique mediaIds where:
//   - leaf.audioEnabled === true, AND
//   - mediaTypeMap[mediaId] === 'video'
//
// Used to determine which cells to decode audio from for OfflineAudioContext mixing.
// ---------------------------------------------------------------------------

function collectAudioEnabledMediaIds(
  leaves: LeafNode[],
  mediaTypeMap: Record<string, 'image' | 'video'>,
): Set<string> {
  const ids = new Set<string>();
  for (const leaf of leaves) {
    if (leaf.type !== 'leaf') continue;
    if (!leaf.audioEnabled) continue;
    if (!leaf.mediaId) continue;
    if (mediaTypeMap[leaf.mediaId] !== 'video') continue;
    ids.add(leaf.mediaId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// seekAllVideosTo (D-13)
//
// Seeks all export video elements to the given timestamp (in seconds).
// Uses computeLoopedTime to handle videos shorter than totalDuration.
// Each seek uses the 'seeked' event with a 500ms timeout fallback.
// Early-exits if already at the target time (diff < 0.01s).
// ---------------------------------------------------------------------------

async function seekAllVideosTo(
  timeSeconds: number,
  exportVideoElements: Map<string, HTMLVideoElement>,
): Promise<void> {
  const seekPromises: Promise<void>[] = [];
  for (const video of exportVideoElements.values()) {
    const loopedTime = computeLoopedTime(timeSeconds, video.duration);
    seekPromises.push(
      new Promise<void>((resolve) => {
        // Early exit if already at target (guards frame 0, prevents no-fire on same time)
        if (Math.abs(video.currentTime - loopedTime) < 0.01) {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 500); // D-13: 500ms fallback
        video.addEventListener('seeked', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        video.currentTime = loopedTime;
      }),
    );
  }
  await Promise.all(seekPromises);
}

// ---------------------------------------------------------------------------
// mixAudioForExport (D-02, AUD-05, AUD-07)
//
// Decodes audio from each audio-enabled video cell using fetch + decodeAudioData,
// then mixes them together via OfflineAudioContext with looped scheduling.
//
// Returns null when:
//   - audioEnabledMediaIds is empty (AUD-06 skip path)
//   - All cells fail to decode
//
// Audio is clipped to totalDurationSeconds (AUD-07).
// ---------------------------------------------------------------------------

async function mixAudioForExport(
  mediaRegistry: Record<string, string>,
  audioEnabledMediaIds: Set<string>,
  totalDurationSeconds: number,
): Promise<AudioBuffer | null> {
  if (audioEnabledMediaIds.size === 0) return null;

  const SAMPLE_RATE = 48000; // Standard AAC sample rate; matches browser decoder output
  const NUM_CHANNELS = 2; // Stereo

  // Step 1: Decode each video's audio via fetch + decodeAudioData
  // Use a temporary AudioContext for decoding (OfflineAudioContext works too,
  // but we need a real-time one to call decodeAudioData correctly on blob URLs)
  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const decodedBuffers: AudioBuffer[] = [];

  try {
    for (const mediaId of audioEnabledMediaIds) {
      const blobUrl = mediaRegistry[mediaId];
      if (!blobUrl) continue;
      try {
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        // Pitfall 3: skip cells without audio channels
        if (audioBuffer.numberOfChannels > 0) {
          decodedBuffers.push(audioBuffer);
        }
      } catch (err) {
        // Individual cell decode failure: skip this cell, log warning
        console.warn('[audio] Failed to decode audio for', mediaId, err);
      }
    }
  } finally {
    await tempCtx.close();
  }

  if (decodedBuffers.length === 0) return null;

  // Step 2: Render mix in OfflineAudioContext
  const totalSamples = Math.ceil(totalDurationSeconds * SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, totalSamples, SAMPLE_RATE);

  for (const audioBuffer of decodedBuffers) {
    // For each cell, schedule looped playback across totalDuration (AUD-07)
    let offset = 0;
    while (offset < totalDurationSeconds) {
      if (audioBuffer.duration <= 0) break; // Guard against zero-length
      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(offlineCtx.destination);
      sourceNode.start(offset);
      // Clamp to totalDuration (AUD-07: audio is clipped to total duration)
      const end = Math.min(offset + audioBuffer.duration, totalDurationSeconds);
      sourceNode.stop(end);
      offset += audioBuffer.duration;
    }
  }

  return await offlineCtx.startRendering();
}

// ---------------------------------------------------------------------------
// Frame rate constants
// ---------------------------------------------------------------------------

const FPS = 30;

// ---------------------------------------------------------------------------
// exportVideoGrid — Mediabunny CanvasSource + AudioBufferSource pipeline
//
// ARCHITECTURE (WebCodecs + Mediabunny direct MP4 encoding):
//
//   1. VideoEncoder guard — hard-fail on unsupported browsers (D-06).
//   2. Build dedicated export video elements (isolated from UI).
//   3. Create stable 1080×1920 canvas (D-11).
//   4. Codec selection: VP9 on Firefox, AVC elsewhere (D-12).
//   5. Create Mediabunny Output with CanvasSource (video) and optionally
//      AudioBufferSource (audio). Audio track added only when:
//        a. At least one leaf has audioEnabled=true AND is a video cell.
//        b. canEncodeAudio('aac') succeeds (natively or via polyfill).
//   6. output.start() — MUST be after all addTrack calls (Pitfall 5).
//   7. Frame-by-frame encoding loop:
//        - seek all export videos to current frame timestamp (D-13)
//        - renderGridIntoContext — draw cells onto stable canvas
//        - drawOverlaysToCanvas — draw text/sticker overlays
//        - videoSource.add(timestamp, frameDuration) — encode frame
//   8. Audio mixing (AFTER video loop):
//        - fetch blob URLs for audio-enabled cells
//        - decodeAudioData into AudioBuffers
//        - mix via OfflineAudioContext with looped scheduling (AUD-07)
//        - audioSource.add(mixedBuffer) — encode audio
//   9. output.finalize() — complete MP4 mux.
//  10. Return Blob from target.buffer.
//
// D-03: Audio failures are non-fatal. If AAC is unavailable or audio decode
//       fails, export proceeds video-only with an onWarning() call.
//
// OUTPUT FORMAT:
//   Mediabunny produces a direct MP4 (H.264 or VP9) with the moov atom
//   positioned for streaming. No intermediate container conversion needed.
// ---------------------------------------------------------------------------

export async function exportVideoGrid(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
  settings: CanvasSettings,
  totalDuration: number,
  onProgress: (stage: 'preparing' | 'encoding', percent?: number) => void,
  onWarning?: (message: string) => void,
): Promise<Blob> {
  // D-06: VideoEncoder guard — hard block on unsupported browsers.
  if (typeof VideoEncoder === 'undefined') {
    throw new Error(
      'Video export requires WebCodecs. Please use Chrome 94+ or Firefox 130+.',
    );
  }

  // Signal UI: export is starting.
  onProgress('preparing');

  // Build dedicated export video elements (isolated from UI).
  const exportVideoElements = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

  // D-11: Stable 1080×1920 canvas for rendering — CanvasSource captures from it.
  const stableCanvas = document.createElement('canvas');
  stableCanvas.width = 1080;
  stableCanvas.height = 1920;
  const stableCtx = stableCanvas.getContext('2d');
  if (!stableCtx) {
    destroyExportVideoElements(exportVideoElements);
    throw new Error('Canvas 2D context not available');
  }

  // D-12: Codec selection — VP9 on Firefox, AVC on all other browsers.
  const isFirefox = navigator.userAgent.includes('Firefox');
  const videoCodec = isFirefox ? 'vp9' : 'avc';

  // Mediabunny Output setup.
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(stableCanvas, { codec: videoCodec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource);

  // D-01, D-03: Audio setup — optional, non-fatal.
  let audioSource: AudioBufferSource | null = null;
  const allLeaves = getAllLeaves(root);
  if (hasAudioEnabledVideoLeaf(allLeaves, mediaTypeMap)) {
    try {
      // Pitfall 2: Firefox lacks native AAC — use polyfill.
      if (!(await canEncodeAudio('aac'))) {
        registerAacEncoder();
      }
      if (await canEncodeAudio('aac')) {
        audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
        output.addAudioTrack(audioSource);
      } else {
        // D-03: AAC unavailable even after polyfill — warn and proceed video-only.
        onWarning?.('Audio not supported in this browser — exporting video only');
      }
    } catch (err) {
      // D-03: Audio setup failure is non-fatal — export video-only.
      console.warn('[audio] Audio setup failed; exporting video-only:', err);
      onWarning?.('Audio not supported in this browser — exporting video only');
      audioSource = null;
    }
  }

  try {
    // Pitfall 5: output.start() MUST be after all addTrack calls.
    await output.start();

    // Read overlay state once — overlay positions/styles are static over the video duration.
    const overlayState = useOverlayStore.getState();
    // Scoped overlay image cache — prevents per-frame sticker reloads.
    const overlayImageCache = new Map<string, HTMLImageElement>();

    // Await fonts once before the render loop — not on every frame.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }

    // Image cache for grid rendering.
    const imageCache = new Map<string, HTMLImageElement>();

    // Frame encoding loop.
    const totalFrames = Math.ceil(totalDuration * FPS);
    for (let i = 0; i < totalFrames; i++) {
      // D-13: Seek all export videos to current frame timestamp (looped internally).
      await seekAllVideosTo(i / FPS, exportVideoElements);

      // Render grid cells onto stable canvas.
      await renderGridIntoContext(
        stableCtx, root, mediaRegistry, 1080, 1920, settings,
        exportVideoElements, imageCache,
      );

      // Draw text/sticker overlays on top of cells.
      await drawOverlaysToCanvas(
        stableCtx,
        overlayState.overlays,
        overlayState.stickerRegistry,
        overlayImageCache,
        true, // fontsAlreadyReady — awaited above
      );

      // Encode this frame via CanvasSource. Timestamps in SECONDS.
      await videoSource.add(i / FPS, 1 / FPS);

      onProgress('encoding', Math.round((i / totalFrames) * 100));
    }

    // D-01, D-02: Audio mixing — runs AFTER video loop.
    // OfflineAudioContext rendering is fast (offline, not real-time).
    if (audioSource) {
      try {
        const audioEnabledIds = collectAudioEnabledMediaIds(getAllLeaves(root), mediaTypeMap);
        const mixedBuffer = await mixAudioForExport(mediaRegistry, audioEnabledIds, totalDuration);
        if (mixedBuffer) {
          await audioSource.add(mixedBuffer);
        }
      } catch (err) {
        // D-03: Audio mix failure is non-fatal — video is already encoded.
        console.warn('[audio] Audio mix failed; exporting video-only:', err);
      }
    }

    // Finalize MP4 mux.
    await output.finalize();

    return new Blob([target.buffer as ArrayBuffer], { type: 'video/mp4' });
  } finally {
    // Always clean up export video elements, even on error.
    destroyExportVideoElements(exportVideoElements);
  }
}
