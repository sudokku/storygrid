---
status: fixing
trigger: "Export button shows 'Export failed' toast after Phase 15 shipped the Mediabunny VideoSampleSink decode-then-encode pipeline."
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T02:00:00Z
---

## Current Focus

hypothesis: CR-03 confirmed — `toCanvasImageSource()` schedules `queueMicrotask(() => videoFrame.close())` when internal _data is Uint8Array. The subsequent `await createImageBitmap(videoFrame)` yields to microtasks before createImageBitmap can read the frame, so the microtask fires and closes the VideoFrame first. createImageBitmap then receives a closed VideoFrame and throws InvalidStateError.

test: Inspected mediabunny/dist/modules/src/sample.js lines 671-685 — confirmed the Uint8Array branch queues a microtask to close the created VideoFrame. The `await` in `buildFrameMapForTime` drains the microtask queue before the Promise resolves.

expecting: Replacing `toCanvasImageSource()` with `toVideoFrame()` returns a cloned VideoFrame with no auto-close queued. createImageBitmap(clonedFrame) should work reliably across the await.

next_action: Apply fix — change buildFrameMapForTime to use sample.toVideoFrame() instead of sample.toCanvasImageSource()

## Symptoms

expected: Video export runs to completion and triggers file download
actual: "Export failed" toast appears; decoding succeeds (3 videos decoded via VideoSampleSink), but something throws after decoding
errors: |
  Console shows 3x "Fetch finished loading: GET blob:http://localhost:5173/70201af2-..."
  Each at: decodeVideoToSamples @ videoExport.ts:125 → decodeAllVideoSamples @ videoExport.ts:175 → exportVideoGrid @ videoExport.ts:465
  No actual Error message or DOMException text visible in console — just the call stack
reproduction: Open app, upload videos into cells, click Export Video
started: After Phase 15 execution (today)

## Eliminated

- hypothesis: Error occurs during decoding (decodeVideoToSamples / decodeAllVideoSamples)
  evidence: "Fetch finished loading" appears 3x for all 3 videos, meaning decoding completed successfully
  timestamp: 2026-04-11T00:00:00Z

- hypothesis: ExportSplitButton swallows error silently without any console output
  evidence: The catch block is `catch { setToastState('error'); }` — it sets error toast but does NOT console.error. This explains why no error text is seen. The error is real but not logged.
  timestamp: 2026-04-11T00:00:00Z

- hypothesis: CR-01 — VideoFrame auto-closure during async renderGridIntoContext tree traversal
  evidence: Checkpoint response provided actual error text `TypeError: options.formats must be an array of InputFormat` thrown at `new Input(...)` line 128 — error occurs BEFORE any VideoFrame is created. CR-01 analysis was based on no visible error text (bare catch); with the real error now visible, it does not match the VideoFrame scenario.
  timestamp: 2026-04-11T01:00:00Z

## Evidence

- timestamp: 2026-04-11T00:00:00Z
  checked: ExportSplitButton.tsx catch block (line 160)
  found: `catch { setToastState('error'); }` — bare catch, no console.error or error logging
  implication: Any error thrown from exportVideoGrid sets the error toast but is never printed to console. This is why only the "Export failed" toast appears with no error message.

- timestamp: 2026-04-11T00:00:00Z
  checked: buildFrameMapForTime in videoExport.ts (lines 235-251)
  found: Calls sample.toCanvasImageSource() which returns a VideoFrame. Comment says "CRITICAL: toCanvasImageSource() result must be used IMMEDIATELY. The returned VideoFrame is auto-closed in the next microtask." The comment claims "caller uses it synchronously... no await between map build and drawImage." This claim is WRONG.
  implication: The frameMap contains live VideoFrame objects that will auto-close after the first microtask yield.

- timestamp: 2026-04-11T00:00:00Z
  checked: exportVideoGrid Phase B loop (lines 482-504)
  found: `const frameMap = buildFrameMapForTime(...)` followed immediately by `await renderGridIntoContext(...)`. The await itself yields once. Inside renderGridIntoContext → renderNode, there is an `await loadImage(dataUri)` for each image cell that is not already cached. Each such await yields the microtask queue.
  implication: If ANY image cell exists in the grid AND it is processed (in tree-walk order) before OR after a video cell, the await causes the VideoFrame in frameMap to auto-close before or during drawImage. Even if video cells come first, the await at renderGridIntoContext entry itself may be enough depending on VideoFrame lifetime.

- timestamp: 2026-04-11T00:00:00Z
  checked: renderNode in export.ts (lines 388-456)
  found: Video cell path (line 408-411) calls drawLeafToCanvas synchronously — no await. Image cell path (lines 416-420) calls `await loadImage(dataUri)`. The tree is walked depth-first. If an image cell appears before a video cell in traversal order, its await fires first, closing the VideoFrame before the video cell is reached.
  implication: CR-01 is confirmed. Root cause is VideoFrame auto-closure during async tree traversal.

- timestamp: 2026-04-11T00:00:00Z
  checked: imageCache behavior
  found: imageCache is passed in and reused across frames. On frame 0, all images need loadImage (cache miss → await). On frame 1+, images are cached (no await). This means the crash likely only occurs on the first few frames, but that's enough to abort the export.
  implication: Fix is critical for frame 0 (and any frame where cache is cold).

- timestamp: 2026-04-11T01:00:00Z
  checked: mediabunny.d.ts InputOptions type (line 1576-1581)
  found: `formats: InputFormat[]` is a required non-optional field on InputOptions. Current code calls `new Input({ source })` with no `formats` key — omitting a required field causes the runtime validation to throw immediately.
  implication: CR-02 is the actual root cause. Fix: import ALL_FORMATS from mediabunny and pass `formats: ALL_FORMATS` to the Input constructor.

- timestamp: 2026-04-11T01:00:00Z
  checked: checkpoint response symptom — "Only 1 Fetch finished loading this time (previously 3)"
  found: Error now throws on the FIRST video decode attempt (not after all 3 complete). Consistent with Input constructor throwing before any fetch/decode work begins — the fetch at line 125 completes but Input construction at line 128 throws immediately.
  implication: Confirms CR-02 is a constructor-level failure, not a mid-decode failure.

- timestamp: 2026-04-11T02:00:00Z
  checked: mediabunny/dist/modules/src/sample.js toCanvasImageSource() implementation (lines 671-685)
  found: When VideoSample._data is Uint8Array, toCanvasImageSource() creates a VideoFrame then schedules queueMicrotask(() => videoFrame.close()). The auto-close fires after the current synchronous task but before any awaited Promise resolves — meaning `await createImageBitmap(videoFrame)` in buildFrameMapForTime yields to microtasks and the frame is closed before createImageBitmap can read it.
  implication: Root cause of CR-03. Fix: replace toCanvasImageSource() with toVideoFrame() which returns a caller-owned clone with no auto-close scheduled.

- timestamp: 2026-04-11T02:00:00Z
  checked: mediabunny/dist/modules/src/sample.js toVideoFrame() (lines 463-490)
  found: toVideoFrame() always calls `new VideoFrame(this._data, {...})` — creating a proper clone regardless of whether _data is a VideoFrame, Uint8Array, or canvas. The returned frame belongs to the caller; no auto-close is ever queued.
  implication: Safe replacement for toCanvasImageSource() in async contexts. Fix applied in buildFrameMapForTime.

## Resolution

root_cause: Two bugs in sequence. (1) CR-02: `new Input({ source })` omitted the required `formats` field, causing immediate throw. Fixed by adding `formats: ALL_FORMATS`. (2) CR-03: `buildFrameMapForTime` used `sample.toCanvasImageSource()` which, when VideoSample._data is Uint8Array, creates a VideoFrame and schedules `queueMicrotask(() => videoFrame.close())`. The subsequent `await createImageBitmap(videoFrame)` yields to microtasks before the browser reads frame pixels, so the auto-close fires first — producing `InvalidStateError: The image source is not usable`.

fix: (1) Added `ALL_FORMATS` to mediabunny import; changed `new Input({ source })` to `new Input({ source, formats: ALL_FORMATS })`. (2) Replaced `sample.toCanvasImageSource()` with `sample.toVideoFrame()` in buildFrameMapForTime. `toVideoFrame()` returns a cloned VideoFrame owned by the caller with no auto-close microtask scheduled. The clone is explicitly closed after `createImageBitmap()` completes.

verification: pending human verification

files_changed:
  - src/lib/videoExport.ts
