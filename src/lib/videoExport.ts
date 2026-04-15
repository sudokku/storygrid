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
  type VideoSample,
  type Rotation,
} from 'mediabunny';
// DecodedFrame — ImageBitmap obtained during decode phase (not VideoSample).
// Converting VideoSamples to ImageBitmaps immediately during decode releases
// VTDecoder (macOS hardware decoder) frame buffer memory as soon as each
// sample is consumed, rather than holding thousands of hardware decoder
// buffers in memory until the entire encode loop finishes.
export type DecodedFrame = { timestamp: number; duration: number; bitmap: ImageBitmap };
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import type { ExportMetrics } from '../types/exportMetrics';

const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true';

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
// KEPT for backward compatibility with tests that import it.
// The export pipeline no longer calls this — see buildVideoStreams / makeTimestampGen.
//
// Decodes all frames from a video blob URL using Mediabunny VideoSampleSink.
// Returns a sorted DecodedFrame[] (sorted by timestamp ascending).
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
      const { timestamp, duration } = sample;
      const videoFrame = sample.toVideoFrame();
      const bitmap = await createImageBitmap(videoFrame);
      videoFrame.close();
      sample.close();
      frames.push({ timestamp, duration, bitmap });
    }

    frames.sort((a, b) => a.timestamp - b.timestamp);
    return frames;
  } finally {
    input.dispose();
  }
}

// ---------------------------------------------------------------------------
// makeTimestampGen — async generator that lazily yields looped timestamps
//
// Yields one timestamp per export frame for a single video track.
// Timestamps are absolute (in seconds, matching the video file's own timeline).
//
// firstTimestamp: actual start time of the video track (from track.getFirstTimestamp()).
//   Most videos start at 0, but some have a positive offset. Adding firstTimestamp
//   ensures getPacket() never receives a timestamp before the first packet.
//
// effectiveDuration: playback length = computeDuration - firstTimestamp.
//   computeLoopedTime maps each export frame to a position within this range,
//   then firstTimestamp is added back to get an absolute video timestamp.
//
// VideoSampleSink.samplesAtTimestamps detects the backwards jump at each loop
// point (loopedOffset drops from ~effectiveDuration back to 0) and re-seeks
// the decoder automatically.
// ---------------------------------------------------------------------------

async function* makeTimestampGen(
  fps: number,
  totalDuration: number,
  effectiveDuration: number,
  firstTimestamp: number,
): AsyncGenerator<number> {
  const totalFrames = Math.ceil(totalDuration * fps);
  for (let i = 0; i < totalFrames; i++) {
    yield firstTimestamp + computeLoopedTime(i / fps, effectiveDuration);
  }
}

// ---------------------------------------------------------------------------
// VideoStreamEntry — one active streaming pipeline per video mediaId
// ---------------------------------------------------------------------------

type VideoStreamEntry = {
  input: Input;
  iter: AsyncGenerator<VideoSample | null, void, unknown>;
  duration: number;
  rotation: Rotation;
};

// ---------------------------------------------------------------------------
// applyBitmapRotation — rotate a raw ImageBitmap to match display orientation
//
// Mobile-shot videos often have a clockwise rotation tag in MP4 metadata.
// Browsers apply this automatically in <video> elements, but raw decoded
// VideoSamples/ImageBitmaps come out un-rotated. This function draws the
// bitmap onto a temporary canvas with the correct transform so the resulting
// CanvasImageSource has the expected display dimensions.
//
// rotation is clockwise degrees (0 | 90 | 180 | 270).
// ---------------------------------------------------------------------------

export function applyBitmapRotation(bitmap: ImageBitmap, rotation: Rotation): CanvasImageSource {
  if (rotation === 0) return bitmap;

  const sw = bitmap.width;
  const sh = bitmap.height;
  const outW = rotation === 90 || rotation === 270 ? sh : sw;
  const outH = rotation === 90 || rotation === 270 ? sw : sh;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -sw / 2, -sh / 2);

  return canvas;
}

// ---------------------------------------------------------------------------
// buildVideoStreams — sets up one Input + samplesAtTimestamps iterator per video
//
// No frames are decoded here. Each iterator is a lazy pipeline that decodes
// exactly one frame when .next() is called from the encode loop.
// ---------------------------------------------------------------------------

async function buildVideoStreams(
  videoMediaIds: Set<string>,
  mediaRegistry: Record<string, string>,
  totalDuration: number,
  onProgress: (stage: 'preparing' | 'decoding' | 'encoding', percent?: number) => void,
): Promise<Map<string, VideoStreamEntry>> {
  const streams = new Map<string, VideoStreamEntry>();
  let built = 0;
  for (const mediaId of videoMediaIds) {
    const blobUrl = mediaRegistry[mediaId];
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const source = new BlobSource(blob);
    const input = new Input({ source, formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input.dispose();
      built++;
      continue;
    }
    const firstTimestamp = await track.getFirstTimestamp();
    const endTimestamp = await track.computeDuration();
    const effectiveDuration = Math.max(0, endTimestamp - firstTimestamp);
    const sink = new VideoSampleSink(track);
    const iter = sink.samplesAtTimestamps(
      makeTimestampGen(FPS, totalDuration, effectiveDuration, firstTimestamp),
    );
    streams.set(mediaId, { input, iter, duration: effectiveDuration, rotation: track.rotation });
    built++;
    onProgress('decoding', Math.round((built / videoMediaIds.size) * 100));
  }
  return streams;
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
// ARCHITECTURE (WebCodecs + Mediabunny streaming MP4 encoding):
//
//   1. VideoEncoder guard — hard-fail on unsupported browsers (D-06).
//   2. Create stable 1080×1920 canvas (D-11).
//   3. Codec selection: VP9 on Firefox, AVC elsewhere (D-12).
//   4. Create Mediabunny Output with CanvasSource (video) and optionally
//      AudioBufferSource (audio). Audio track added only when:
//        a. At least one leaf has audioEnabled=true AND is a video cell.
//        b. canEncodeAudio('aac') succeeds (natively or via polyfill).
//   5. output.start() — MUST be after all addTrack calls (Pitfall 5).
//   6. Phase A — build streaming iterators via buildVideoStreams:
//        - One Input + samplesAtTimestamps iterator per unique video mediaId
//        - No frames are decoded here — iterators are lazy
//        - onProgress('decoding', percent) per iterator built
//   7. Phase B — streaming encode loop (one frame decoded per video per export frame):
//        - Advance each video's iterator by one step (.next())
//        - toVideoFrame() → createImageBitmap() → videoFrame.close() → sample.close()
//        - renderGridIntoContext — draw cells onto stable canvas
//        - drawOverlaysToCanvas — draw text/sticker overlays
//        - videoSource.add(timestamp, frameDuration) — encode frame
//        - bitmap.close() immediately after encode — key to memory savings
//        - Steady-state memory: ~8 buffered frames × N videos × 7.9 MB
//   8. Audio mixing (AFTER video loop):
//        - fetch blob URLs for audio-enabled cells
//        - decodeAudioData into AudioBuffers
//        - mix via OfflineAudioContext with looped scheduling (AUD-07)
//        - audioSource.add(mixedBuffer) — encode audio
//   9. output.finalize() — complete MP4 mux.
//  10. Return Blob from target.buffer.
//  11. finally: iter.return() + input.dispose() for each video stream.
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
  onMetrics?: (metrics: ExportMetrics) => void,
): Promise<Blob> {
  // D-06: VideoEncoder guard — hard block on unsupported browsers.
  if (typeof VideoEncoder === 'undefined') {
    throw new Error(
      'Video export requires WebCodecs. Please use Chrome 94+ or Firefox 130+.',
    );
  }

  // --- Metrics instrumentation (D-11: local variables, no global state) ---
  let activeBitmaps = 0;
  let activeVideoFrames = 0;
  let nullSamples = 0;
  let videoMediaIds: Set<string> = new Set();
  const exportStartTime = performance.now();
  let decodeSetupMs = 0;
  let lastFrameMs = 0;
  const recentFrameTimes: number[] = []; // rolling window for averageFrameMs (last 30)

  // Device info (static, read once) — D-10: Chrome-only guards
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const deviceMemoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0;
  const cpuCores = navigator.hardwareConcurrency ?? 0;

  function emitMetrics(phase: ExportMetrics['phase'], framesEncoded: number, totalFrames: number) {
    if (!onMetrics) return;
    const now = performance.now();
    const elapsedMs = now - exportStartTime;
    const encodeFps = elapsedMs > 0 ? (framesEncoded / (elapsedMs / 1000)) : 0;
    const averageFrameMs = recentFrameTimes.length > 0
      ? recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length
      : 0;
    onMetrics({
      elapsedMs,
      decodeSetupMs,
      lastFrameMs,
      averageFrameMs,
      framesEncoded,
      totalFrames,
      encodeFps,
      heapUsedMB: mem ? mem.usedJSHeapSize / 1e6 : 0,
      heapTotalMB: mem ? mem.totalJSHeapSize / 1e6 : 0,
      heapLimitMB: mem ? mem.jsHeapSizeLimit / 1e6 : 0,
      activeBitmaps,
      activeVideoFrames,
      nullSampleCount: nullSamples,
      deviceMemoryGB,
      cpuCores,
      phase,
      videoCount: videoMediaIds.size,
    });
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

  // Declare videoStreams before try so finally can dispose them on error.
  let videoStreams: Map<string, VideoStreamEntry> = new Map();

  try {
    // Pitfall 5: output.start() MUST be after all addTrack calls.
    await output.start();

    // Phase A — build streaming iterators (one Input per video, no pre-decode).
    // No frames are decoded here; each iterator decodes lazily on .next() calls.
    videoMediaIds = collectUniqueVideoMediaIds(root, mediaRegistry, mediaTypeMap);
    const decodeStart = performance.now();
    videoStreams = await buildVideoStreams(videoMediaIds, mediaRegistry, totalDuration, onProgress);
    decodeSetupMs = performance.now() - decodeStart;
    emitMetrics('decoding', 0, Math.ceil(totalDuration * FPS));

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

    // Phase B — streaming encode loop: decode one frame per video per export frame.
    // Steady-state memory: ~8 buffered frames × N videos × 7.9 MB (vs. all frames upfront).
    const totalFrames = Math.ceil(totalDuration * FPS);
    for (let i = 0; i < totalFrames; i++) {
      const frameMap = new Map<string, CanvasImageSource>();
      const bitmapsToClose: ImageBitmap[] = [];

      const frameStart = METRICS_ENABLED ? performance.now() : 0;
      if (METRICS_ENABLED) performance.mark('frame-encode-start');

      // Advance each video's iterator by one step — decodes exactly one frame per video.
      for (const [mediaId, { iter, rotation }] of videoStreams) {
        const result = await iter.next();
        if (result.done) continue;
        if (!result.value) {
          nullSamples++;
          continue;
        }
        const sample = result.value;
        // toVideoFrame() returns a caller-owned VideoFrame clone (no auto-close microtask).
        const videoFrame = sample.toVideoFrame();
        activeVideoFrames++;
        const bitmap = await createImageBitmap(videoFrame);
        activeBitmaps++;
        videoFrame.close(); // free the cloned VideoFrame immediately
        activeVideoFrames--;
        sample.close();     // release VTDecoder / hardware decoder frame buffer NOW
        // applyBitmapRotation corrects for MP4 rotation metadata that <video> elements
        // apply automatically but raw decoded frames do not.
        const source = applyBitmapRotation(bitmap, rotation);
        frameMap.set(mediaId, source);
        bitmapsToClose.push(bitmap);
      }

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

      if (METRICS_ENABLED) {
        performance.mark('frame-encode-end');
        performance.measure('frame-encode', 'frame-encode-start', 'frame-encode-end');
        lastFrameMs = performance.now() - frameStart;
        recentFrameTimes.push(lastFrameMs);
        if (recentFrameTimes.length > 30) recentFrameTimes.shift();
      }
      // Release bitmaps immediately after encode — key to memory savings.
      for (const b of bitmapsToClose) {
        b.close();
        activeBitmaps--;
      }
      emitMetrics('encoding', i + 1, totalFrames);

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
    emitMetrics('audio', totalFrames, totalFrames);

    // Finalize MP4 mux.
    await output.finalize();
    emitMetrics('finalizing', totalFrames, totalFrames);

    return new Blob([target.buffer as ArrayBuffer], { type: 'video/mp4' });
  } finally {
    // Dispose all stream iterators and their Inputs, even on error.
    for (const { input, iter } of videoStreams.values()) {
      try { await iter.return?.(); } catch { /* ignore */ }
      input.dispose();
    }
  }
}
