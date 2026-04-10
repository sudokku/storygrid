import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  canEncodeAudio,
  BlobSource,
  Input,
  VideoSampleSink,
  ALL_FORMATS,
} from 'mediabunny';
// DecodedFrame — ImageBitmap obtained during decode phase (not VideoSample).
// Converting VideoSamples to ImageBitmaps immediately during decode releases
// VTDecoder (macOS hardware decoder) frame buffer memory as soon as each
// sample is consumed, rather than holding thousands of hardware decoder
// buffers in memory until the entire encode loop finishes.
export type DecodedFrame = { timestamp: number; duration: number; bitmap: ImageBitmap };
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { getAllLeaves } from './tree';
import type { GridNode, LeafNode } from '../types';
import { renderGridIntoContext, type CanvasSettings } from './export';
import { drawOverlaysToCanvas } from './overlayExport';
import { useOverlayStore } from '../store/overlayStore';

// ---------------------------------------------------------------------------
// computeLoopedTime — pure helper for modulo-based video looping
//
// During export, videos are decoded frame-by-frame. For cells whose video is
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
// collectUniqueVideoMediaIds
//
// Returns a Set of unique mediaIds that are video type and have valid
// blob URLs in mediaRegistry. Used by decodeAllVideoSamples.
// ---------------------------------------------------------------------------

function collectUniqueVideoMediaIds(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
): Set<string> {
  const result = new Set<string>();
  const leaves = getAllLeaves(root);
  for (const leaf of leaves) {
    if (leaf.mediaId && mediaTypeMap[leaf.mediaId] === 'video' && mediaRegistry[leaf.mediaId]) {
      result.add(leaf.mediaId);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// decodeVideoToSamples (D-01, D-02, Pitfall 3)
//
// Decodes all frames from a video blob URL using Mediabunny VideoSampleSink.
// Pipeline: fetch blob URL → BlobSource → Input → getPrimaryVideoTrack →
//           VideoSampleSink → iterate samples() async generator → sort by timestamp.
//
// Returns a sorted VideoSample[] array (sorted by timestamp ascending).
// VideoSample.timestamp is in SECONDS [VERIFIED: mediabunny.d.ts line 3023].
//
// D-07: Propagates errors as hard failures — no fallback to seeking.
// ---------------------------------------------------------------------------

export async function decodeVideoToSamples(blobUrl: string): Promise<DecodedFrame[]> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  const source = new BlobSource(blob);
  const input = new Input({ source, formats: ALL_FORMATS });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return [];

    const sink = new VideoSampleSink(track);
    const frames: DecodedFrame[] = [];

    for await (const sample of sink.samples()) {
      // Read timestamp/duration before closing the sample.
      const { timestamp, duration } = sample;
      // toVideoFrame() returns a caller-owned VideoFrame clone (no auto-close microtask).
      const videoFrame = sample.toVideoFrame();
      // Rasterize to ImageBitmap — does not auto-close, survives async gaps.
      const bitmap = await createImageBitmap(videoFrame);
      videoFrame.close(); // free the cloned VideoFrame immediately
      sample.close();     // release VTDecoder / hardware decoder frame buffer NOW
      frames.push({ timestamp, duration, bitmap });
    }

    // Sort by presentation timestamp — decode order != presentation order for H.264 B-frames (D-08)
    frames.sort((a, b) => a.timestamp - b.timestamp);
    return frames;
  } finally {
    // Dispose input AFTER generator exhausts — cancels pending reads, closes decoders
    // [VERIFIED: mediabunny.d.ts line 1518].
    input.dispose();
  }
}

// ---------------------------------------------------------------------------
// decodeAllVideoSamples (D-04, D-05, D-13)
//
// Decodes all unique video mediaIds sequentially (one at a time to limit
// peak GPU memory). Reports progress via onProgress('decoding', percent).
//
// Returns a Map<mediaId, { samples, duration }> where duration is computed
// from the last sample's timestamp + duration field.
// ---------------------------------------------------------------------------

async function decodeAllVideoSamples(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
  onProgress: (stage: 'preparing' | 'decoding' | 'encoding', percent?: number) => void,
): Promise<Map<string, { samples: DecodedFrame[]; duration: number }>> {
  const result = new Map<string, { samples: DecodedFrame[]; duration: number }>();
  const videoMediaIds = collectUniqueVideoMediaIds(root, mediaRegistry, mediaTypeMap);
  let decoded = 0;

  // D-04: Sequential decode — one video at a time to limit peak GPU memory
  for (const mediaId of videoMediaIds) {
    const blobUrl = mediaRegistry[mediaId];
    const samples = await decodeVideoToSamples(blobUrl);

    // Compute duration from last sample (last sample timestamp + its duration)
    const duration = samples.length > 0
      ? samples[samples.length - 1].timestamp + samples[samples.length - 1].duration
      : 0;

    result.set(mediaId, { samples, duration });
    decoded++;
    onProgress('decoding', Math.round((decoded / videoMediaIds.size) * 100));
  }

  return result;
}

// ---------------------------------------------------------------------------
// findSampleForTime (D-08, D-09)
//
// Given a sorted VideoSample[] and a target export time (in seconds),
// finds the sample whose timestamp is <= loopedTime (nearest floor).
//
// computeLoopedTime works in seconds; VideoSample.timestamp is in seconds.
// NO unit conversion needed [VERIFIED: mediabunny.d.ts line 3023].
// ---------------------------------------------------------------------------

export function findSampleForTime(
  samples: DecodedFrame[],
  exportTimeSeconds: number,
  videoDurationSeconds: number,
): DecodedFrame | null {
  if (samples.length === 0) return null;

  // computeLoopedTime works in seconds; VideoSample.timestamp is in seconds
  // NO unit conversion needed [VERIFIED: mediabunny.d.ts line 3023]
  const loopedTime = computeLoopedTime(exportTimeSeconds, videoDurationSeconds);

  // Find last sample with timestamp <= loopedTime (sorted ascending)
  let best = samples[0];
  for (const s of samples) {
    if (s.timestamp <= loopedTime) {
      best = s;
    } else {
      break;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// buildFrameMapForTime
//
// Builds a Map<mediaId, ImageBitmap> for a specific export frame time.
//
// CR-01 / CR-03 FIX: toCanvasImageSource() is NOT used here.
//
// When VideoSample._data is a Uint8Array, toCanvasImageSource() creates a
// temporary VideoFrame and queues queueMicrotask(() => videoFrame.close()).
// The subsequent `await createImageBitmap(videoFrame)` yields to the microtask
// queue before the browser reads the frame pixels, so the microtask fires and
// closes the VideoFrame first — producing InvalidStateError.
//
// Fix: use toVideoFrame() instead. It always returns a brand-new cloned
// VideoFrame that the caller owns. No auto-close microtask is ever scheduled.
// The cloned VideoFrame is passed to createImageBitmap() and then explicitly
// closed immediately after to free GPU memory.
//
// The resulting ImageBitmap does NOT auto-close and safely survives async gaps
// (e.g. renderGridIntoContext awaiting image loads for non-video cells).
//
// Callers are responsible for closing each ImageBitmap after rendering to
// release GPU memory (call bitmap.close() after renderGridIntoContext returns).
// ---------------------------------------------------------------------------

// buildFrameMapForTime — synchronous frame lookup (no async rasterization needed).
//
// ImageBitmaps were already created during the decode phase (decodeVideoToSamples).
// This function just looks up the right pre-rasterized bitmap for each video at
// the given time. The returned bitmaps are owned by decodedVideos and must NOT
// be closed by callers — disposeAllSamples closes them all at the end.
function buildFrameMapForTime(
  decodedVideos: Map<string, { samples: DecodedFrame[]; duration: number }>,
  timeSeconds: number,
): Map<string, CanvasImageSource> {
  const frameMap = new Map<string, CanvasImageSource>();
  for (const [mediaId, { samples, duration }] of decodedVideos) {
    const frame = findSampleForTime(samples, timeSeconds, duration);
    if (frame) {
      frameMap.set(mediaId, frame.bitmap);
    }
  }
  return frameMap;
}

// ---------------------------------------------------------------------------
// disposeAllSamples (D-06)
//
// Closes all VideoSample frames to release GPU memory after the encode loop.
// Replaces destroyExportVideoElements from the seeking pipeline.
// ---------------------------------------------------------------------------

function disposeAllSamples(
  decodedVideos: Map<string, { samples: DecodedFrame[]; duration: number }>,
): void {
  for (const { samples } of decodedVideos.values()) {
    for (const f of samples) {
      f.bitmap.close();
    }
  }
  decodedVideos.clear();
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
//   2. Create stable 1080×1920 canvas (D-11).
//   3. Codec selection: VP9 on Firefox, AVC elsewhere (D-12).
//   4. Create Mediabunny Output with CanvasSource (video) and optionally
//      AudioBufferSource (audio). Audio track added only when:
//        a. At least one leaf has audioEnabled=true AND is a video cell.
//        b. canEncodeAudio('aac') succeeds (natively or via polyfill).
//   5. output.start() — MUST be after all addTrack calls (Pitfall 5).
//   6. Phase A — decode all videos via VideoSampleSink:
//        - decodeAllVideoSamples: fetch → BlobSource → Input → VideoSampleSink
//        - onProgress('decoding', percent) per video decoded
//   7. Phase B — frame-by-frame encoding loop (zero seeking):
//        - buildFrameMapForTime — lookup sorted VideoSample[] by timestamp
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
  onProgress: (stage: 'preparing' | 'decoding' | 'encoding', percent?: number) => void,
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

  // D-11: Stable 1080×1920 canvas for rendering — CanvasSource captures from it.
  const stableCanvas = document.createElement('canvas');
  stableCanvas.width = 1080;
  stableCanvas.height = 1920;
  const stableCtx = stableCanvas.getContext('2d');
  if (!stableCtx) {
    throw new Error('Canvas 2D context not available');
  }

  // D-12: Codec selection — VP9 on Firefox, AVC on all other browsers.
  const isFirefox = navigator.userAgent.includes('Firefox');
  const videoCodec = isFirefox ? 'vp9' : 'avc';

  // Mediabunny Output setup.
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(stableCanvas, {
    codec: videoCodec,
    bitrate: QUALITY_HIGH,
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'realtime',
    bitrateMode: 'variable',
  });
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

  // Declare decodedVideos before try so finally can access it.
  let decodedVideos: Map<string, { samples: DecodedFrame[]; duration: number }> = new Map();

  try {
    // Pitfall 5: output.start() MUST be after all addTrack calls.
    await output.start();

    // Phase A — decode all videos via VideoSampleSink (D-04, D-05, D-13)
    decodedVideos = await decodeAllVideoSamples(root, mediaRegistry, mediaTypeMap, onProgress);

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

    // Phase B — frame encoding loop (zero seeking).
    const totalFrames = Math.ceil(totalDuration * FPS);
    for (let i = 0; i < totalFrames; i++) {
      // Synchronous lookup — bitmaps were rasterized during Phase A.
      const frameMap = buildFrameMapForTime(decodedVideos, i / FPS);

      // Render grid cells onto stable canvas.
      await renderGridIntoContext(
        stableCtx, root, mediaRegistry, 1080, 1920, settings,
        frameMap, imageCache,
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

      // WR-01 FIX: use (i+1) so progress reaches 100% on the last frame.
      onProgress('encoding', Math.round(((i + 1) / totalFrames) * 100));

      // Yield to the browser event loop every 10 frames so other tabs and
      // UI remain responsive during long exports.
      if ((i + 1) % 10 === 0) await new Promise<void>(r => setTimeout(r, 0));
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
    // Always dispose all decoded video samples, even on error (D-06).
    disposeAllSamples(decodedVideos);
  }
}
