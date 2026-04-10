import { getAllLeaves } from './tree';
import type { GridNode, LeafNode } from '../types';
import { renderGridIntoContext, type CanvasSettings } from './export';
import { drawOverlaysToCanvas } from './overlayExport';
import { useOverlayStore } from '../store/overlayStore';
// transcodeWebmToMp4 removed — ffmpeg.wasm pipeline replaced by Mediabunny in Plan 14-02

// ---------------------------------------------------------------------------
// computeLoopedTime — pure helper for modulo-based video looping
//
// During MediaRecorder export, videos play in real time from time 0. For cells
// whose video is shorter than the total export duration, the render loop uses
// this helper to compute the looped position (matching `loop=true` behavior).
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
// buildAudioGraph (Phase 12 — AUD-05, AUD-06)
//
// Wires audio-enabled video cells into a MediaStreamAudioDestinationNode so
// their audio tracks can be mixed into the exported MediaStream.
//
// Behavior:
//   - Collects UNIQUE mediaIds of leaves where audioEnabled=true and the media
//     is of type 'video' and has a corresponding dedicated export video element.
//   - Returns null when zero such cells exist (AUD-06 skip path — the exported
//     MP4 will have NO audio track, not a silent one).
//   - Creates exactly one MediaElementAudioSourceNode per unique mediaId
//     (sharing across cells is handled by the de-duplication set).
//   - Connects each source ONLY to the returned destination node; never to
//     the AudioContext's real output destination (D-18 — we must not leak
//     audio to the user's speakers during export).
//
// Preconditions:
//   - videoEl.muted must be false for any audio-enabled element. This is
//     guaranteed by buildExportVideoElements which reads the same audioEnabled
//     flag.
// ---------------------------------------------------------------------------

export function buildAudioGraph(
  audioCtx: AudioContext,
  exportVideoElements: Map<string, HTMLVideoElement>,
  leaves: LeafNode[],
  mediaTypeMap: Record<string, 'image' | 'video'>,
): MediaStreamAudioDestinationNode | null {
  // Collect unique mediaIds for audio-enabled video leaves that have a
  // corresponding dedicated export video element.
  const audioMediaIds = new Set<string>();
  for (const leaf of leaves) {
    if (leaf.type !== 'leaf') continue;
    if (!leaf.audioEnabled) continue;
    if (!leaf.mediaId) continue;
    if (mediaTypeMap[leaf.mediaId] !== 'video') continue;
    if (!exportVideoElements.has(leaf.mediaId)) continue;
    audioMediaIds.add(leaf.mediaId);
  }

  // AUD-06: skip graph entirely when zero cells are audio-enabled.
  if (audioMediaIds.size === 0) return null;

  const destination = audioCtx.createMediaStreamDestination();

  for (const mediaId of audioMediaIds) {
    const videoEl = exportVideoElements.get(mediaId);
    if (!videoEl) continue;
    // NOTE: videoEl.muted must be false — set in buildExportVideoElements.
    const source = audioCtx.createMediaElementSource(videoEl);
    source.connect(destination); // D-18: destination node only, NEVER the ctx output.
  }

  return destination;
}

// ---------------------------------------------------------------------------
// hasAudioEnabledVideoLeaf (Phase 12 — AUD-06 skip-path decision helper)
//
// Returns true iff at least one leaf has audioEnabled=true AND its mediaId
// resolves to a 'video' entry in mediaTypeMap. Used by exportVideoGrid to
// decide whether to construct an AudioContext / audio graph at all.
// Keeping this as a single exported helper gives us a unit-testable decision
// point without having to drive the entire MediaRecorder export in jsdom.
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
// Frame rate constants
// ---------------------------------------------------------------------------

const FPS = 30;
const FRAME_DURATION_MS = 1000 / FPS;

// ---------------------------------------------------------------------------
// exportVideoGrid — MediaRecorder-based video export
//
// ARCHITECTURE (MediaRecorder + captureStream + ffmpeg.wasm transcode):
//
//   1. Create dedicated export video elements (NOT the live UI elements).
//   2. Create stable 1080×1920 canvas.
//   3. `canvas.captureStream(FPS)` → live MediaStream.
//   4. `new MediaRecorder(stream, { mimeType })` — tries VP9 WebM first,
//      then VP8 WebM, then generic WebM.
//   5. Rewind all export video elements to time 0, play all simultaneously.
//   6. setInterval every FRAME_DURATION_MS: render current frame to canvas,
//      report progress. For cells with shorter videos, computeLoopedTime maps
//      elapsed time into the video's duration range.
//   7. After totalDuration ms: stop interval, stop all videos, stop recorder.
//   8. recorder ondataavailable → WebM Blob chunks accumulate.
//   8.5. recorder.onstop → WebM Blob → transcodeWebmToMp4 (ffmpeg.wasm)
//        → MP4 Blob with -movflags +faststart → return to caller.
//   9. Destroy dedicated export video elements.
//
// WHY THIS IS CORRECT:
//   - Dedicated elements — completely isolated from the UI.
//   - Videos play at 1× natural speed — zero seek cost.
//   - Memory: O(1) — no frame accumulation, only current canvas pixels.
//   - Total export time ≈ totalDuration (+ transcode time).
//   - No WebCodecs backpressure — MediaRecorder handles encoding internally.
//   - captureStream available: Chrome 51+, Firefox 43+.
//
// OUTPUT FORMAT:
//   MediaRecorder always produces WebM (vp9, vp8, or generic webm).
//   The WebM blob is then transcoded by ffmpeg.wasm (libx264, -movflags
//   +faststart) to produce a QuickTime-compatible H.264 MP4 with the moov
//   atom at the front. This is the only format that opens in macOS QuickTime
//   Player without errors.
//
// LOOPING:
//   - `computeLoopedTime(elapsedSeconds, video.duration)` handles shorter
//     videos. The render loop does NOT use `video.currentTime` directly for
//     loop calculation — it uses elapsed wall-clock time to derive the looped
//     position, then seeks the video element only when a loop wraps around
//     (detected by comparing looped position vs video.currentTime).
//
// ---------------------------------------------------------------------------

export async function exportVideoGrid(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
  settings: CanvasSettings,
  totalDuration: number,
  onProgress: (stage: 'preparing' | 'encoding' | 'transcoding', percent?: number) => void,
): Promise<Blob> {
  // Detect supported WebM mimeType — WebM only; transcode to MP4 via ffmpeg.wasm after recording.
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let selectedMimeType = '';
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      selectedMimeType = mt;
      break;
    }
  }
  if (!selectedMimeType) {
    throw new Error(
      'Video export requires a browser that supports MediaRecorder with WebM. ' +
      'Use Chrome 51+ or Firefox 43+.',
    );
  }

  // Signal UI: export is starting.
  onProgress('preparing');

  // Create DEDICATED export video elements (isolated from UI).
  const exportVideoElements = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);
  const imageCache = new Map<string, HTMLImageElement>();

  // Stable canvas for rendering — MediaRecorder captures from its stream.
  const stableCanvas = document.createElement('canvas');
  stableCanvas.width = 1080;
  stableCanvas.height = 1920;
  const stableCtx = stableCanvas.getContext('2d');
  if (!stableCtx) {
    destroyExportVideoElements(exportVideoElements);
    throw new Error('Canvas 2D context not available');
  }

  // Fix D: captureStream(0) — manual requestFrame() controls exactly when frames are
  // committed to the stream, preventing MediaRecorder from capturing mid-render state.
  const stream = (stableCanvas as unknown as { captureStream(fps: number): MediaStream }).captureStream(0);
  // Extract the video track for manual requestFrame() calls after each completed render.
  // CanvasCaptureMediaStreamTrack.requestFrame() is Chrome-only; absent on Firefox.
  // commitFrame() guards with typeof before calling to avoid a TypeError on Firefox.
  const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const commitFrame = (track: MediaStreamTrack): void => {
    const cct = track as CanvasCaptureMediaStreamTrack;
    if (typeof cct.requestFrame === 'function') cct.requestFrame();
  };

  // -------------------------------------------------------------------------
  // Phase 12: Web Audio graph for per-cell audio (AUD-05, AUD-06)
  //
  // Only construct an AudioContext when at least one video leaf is
  // audio-enabled. If construction OR graph wiring throws, log and fall
  // back to a canvas-only stream (no audio) — export must not fail on audio.
  // -------------------------------------------------------------------------
  let audioCtx: AudioContext | null = null;
  let combinedStream: MediaStream = stream;

  const allLeaves = getAllLeaves(root);
  if (hasAudioEnabledVideoLeaf(allLeaves, mediaTypeMap)) {
    try {
      audioCtx = new AudioContext();
      // Chrome suspended-state workaround (RESEARCH §Pitfall 3).
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const audioDestination = buildAudioGraph(
        audioCtx,
        exportVideoElements,
        allLeaves,
        mediaTypeMap,
      );
      if (audioDestination) {
        const audioTrack = audioDestination.stream.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            audioTrack,
          ]);
        }
      }
    } catch (err) {
      // D-20: log and fall back to no-audio export. Do NOT fail the export.
      console.error(
        '[Phase12 audioGraph] Failed to build audio graph; exporting without audio:',
        err,
      );
      try {
        audioCtx?.close();
      } catch {
        /* noop */
      }
      audioCtx = null;
      combinedStream = stream;
    }
  }

  // Rewind and prepare all dedicated export video elements.
  if (exportVideoElements.size > 0) {
    const rewindPromises: Promise<void>[] = [];
    for (const video of exportVideoElements.values()) {
      rewindPromises.push(
        new Promise<void>(resolve => {
          video.pause();
          if (Math.abs(video.currentTime) < 0.01) {
            resolve();
            return;
          }
          video.addEventListener('seeked', () => resolve(), { once: true });
          video.currentTime = 0;
        }),
      );
    }
    await Promise.all(rewindPromises);
  }

  // Track per-video last-known looped time to detect wrap-around.
  const lastLoopedTime = new Map<string, number>();
  for (const [mediaId] of exportVideoElements) {
    lastLoopedTime.set(mediaId, 0);
  }

  // ---------------------------------------------------------------------------
  // Pre-flight: start video playback and render one frame BEFORE recording.
  //
  // WHY THE ORDER MATTERS:
  //   1. Play all export video elements so they start advancing from time 0.
  //   2. Pre-render one frame into the canvas — this gives the canvas real pixel
  //      data (images + first video frame) before MediaRecorder begins capturing.
  //   3. Only then call recorder.start() — the very first captured frame will
  //      have correct content instead of a blank white canvas.
  //
  // This avoids the "blank first frame" bug where the canvas is empty at the
  // moment MediaRecorder starts its stream capture.
  // ---------------------------------------------------------------------------

  // Start all dedicated export videos playing simultaneously.
  for (const video of exportVideoElements.values()) {
    video.loop = false; // Managed manually in export loop.
  }
  const preflightPlayPromises: Promise<void>[] = [];
  for (const video of exportVideoElements.values()) {
    preflightPlayPromises.push(video.play().catch(() => {
      // Ignore autoplay policy errors — video may already be playing.
    }));
  }
  await Promise.all(preflightPlayPromises);

  // D-23: overlay positions/styles are static over the video duration — read once outside the loop.
  // D-24: read directly from overlayStore.getState() — no prop threading.
  const overlayState = useOverlayStore.getState();
  // T-13-07: overlayImageCache scoped to this export run; prevents per-frame sticker reloads.
  const overlayImageCache = new Map<string, HTMLImageElement>();

  // Fix B: await fonts once before the render loop — not on every frame.
  // This satisfies D-18 (Google Fonts loaded) without the per-frame overhead of
  // drawOverlaysToCanvas awaiting document.fonts.ready on each tick.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Pre-warm imageCache and render first frame to give the canvas valid content.
  await renderGridIntoContext(
    stableCtx, root, mediaRegistry, 1080, 1920, settings,
    exportVideoElements, imageCache,
  );
  // Draw overlays on pre-flight frame (D-22: overlay pass after all cells).
  // fontsAlreadyReady=true: fonts were awaited above, skip per-call await.
  await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
  // Fix D: commit pre-flight frame to the stream before recorder.start().
  commitFrame(videoTrack);

  // The canvas now has a real first frame. Start recording from this point.
  return new Promise<Blob>((resolve, reject) => {
    const chunks: BlobPart[] = [];

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 6_000_000,
    });

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      destroyExportVideoElements(exportVideoElements);
      try { audioCtx?.close(); } catch { /* noop */ } // D-19: close in success path
      const webmBlob = new Blob(chunks, { type: selectedMimeType });
      // Transcode WebM to QuickTime-compatible MP4 via ffmpeg.wasm.
      onProgress('transcoding', 0);
      transcodeWebmToMp4(webmBlob, (percent) => {
        onProgress('transcoding', percent);
      })
        .then((mp4Blob) => {
          onProgress('transcoding', 100);
          resolve(mp4Blob);
        })
        .catch((err) => {
          reject(new Error(`Transcode failed: ${err instanceof Error ? err.message : String(err)}`));
        });
    };

    recorder.onerror = (e: Event) => {
      destroyExportVideoElements(exportVideoElements);
      try { audioCtx?.close(); } catch { /* noop */ } // D-19: close in error path
      reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message ?? 'unknown'}`));
    };

    // Start recording now — the canvas already has the first frame painted.
    recorder.start();

    // startTime is anchored to when recording actually begins. The pre-flight
    // render above is not counted as elapsed export time.
    const startTime = performance.now();
    const totalDurationMs = totalDuration * 1000;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const renderFrame = async () => {
      const elapsed = performance.now() - startTime;

      // Check if export is complete.
      if (elapsed >= totalDurationMs) {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }

        // Stop all dedicated export video elements.
        for (const video of exportVideoElements.values()) {
          video.pause();
        }

        // Render final frame before stopping.
        await renderGridIntoContext(
          stableCtx, root, mediaRegistry, 1080, 1920, settings,
          exportVideoElements, imageCache,
        );
        // D-22: overlay pass after cell draw on final frame.
        // fontsAlreadyReady=true: fonts were awaited once before the loop.
        await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
        // Fix D: commit final frame to the stream before stopping recorder.
        commitFrame(videoTrack);

        recorder.stop();
        // Do not emit 'encoding 100%' here — onstop fires async immediately after
        // and emits 'transcoding 0%', which avoids a confusing flash in the UI.
        return;
      }

      const elapsedSeconds = elapsed / 1000;

      // Handle video loop wrap-around: if a video has ended, seek it back.
      // Also handle manual looping for videos shorter than totalDuration.
      for (const [mediaId, video] of exportVideoElements) {
        if (!video.duration || !isFinite(video.duration)) continue;

        const loopedTime = computeLoopedTime(elapsedSeconds, video.duration);
        const prev = lastLoopedTime.get(mediaId) ?? 0;

        // Detect wrap: looped time went backwards significantly.
        // Threshold: half a frame.
        if (prev - loopedTime > video.duration * 0.5) {
          // Wrapped around — seek back to the start of the loop.
          // Fix C: fastSeek targets the nearest keyframe, reducing seek stall duration.
          if (typeof (video as { fastSeek?: unknown }).fastSeek === 'function') {
            (video as HTMLVideoElement & { fastSeek(time: number): void }).fastSeek(loopedTime);
          } else {
            video.currentTime = loopedTime;
          }
          // Re-play after seek.
          video.play().catch(() => {});
        } else if (video.ended || video.paused) {
          // Video ended naturally or was paused — restart.
          // Fix C: fastSeek targets the nearest keyframe, reducing seek stall duration.
          if (typeof (video as { fastSeek?: unknown }).fastSeek === 'function') {
            (video as HTMLVideoElement & { fastSeek(time: number): void }).fastSeek(loopedTime);
          } else {
            video.currentTime = loopedTime;
          }
          video.play().catch(() => {});
        }

        lastLoopedTime.set(mediaId, loopedTime);
      }

      // Render current frame into the stable canvas.
      // Export video elements are at their natural playback position (or looped
      // position if we re-seeked above). renderGridIntoContext draws from them.
      await renderGridIntoContext(
        stableCtx, root, mediaRegistry, 1080, 1920, settings,
        exportVideoElements, imageCache,
      );
      // D-22/D-23: overlay pass after cell draw on every frame.
      // fontsAlreadyReady=true: fonts were awaited once before the loop.
      await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
      // Fix D: commit fully-rendered frame to the stream.
      commitFrame(videoTrack);

      const percent = Math.min(99, Math.round((elapsed / totalDurationMs) * 100));
      onProgress('encoding', percent);
    };

    // Fix A: isRendering guard prevents concurrent async renderFrame calls.
    // If the previous frame render is still in progress when the next tick fires,
    // the tick is skipped — preventing overlapping canvas writes that corrupt frames.
    let isRendering = false;

    // Use setInterval for subsequent frames. Each tick renders one frame.
    // setInterval is appropriate here: we don't need frame-perfect timing
    // (MediaRecorder captures from the live stream at its own cadence).
    intervalId = setInterval(() => {
      if (isRendering) return;
      isRendering = true;
      renderFrame()
        .catch(err => {
          if (intervalId !== null) clearInterval(intervalId);
          destroyExportVideoElements(exportVideoElements);
          try { audioCtx?.close(); } catch { /* noop */ } // D-19: close on render error
          recorder.stop();
          reject(err);
        })
        .finally(() => { isRendering = false; });
    }, FRAME_DURATION_MS);
  });
}
