# Phase 16: Export Metrics Panel

**Type:** Developer tooling / observability  
**Status:** Planned  
**Scope:** New component + instrumentation hooks in the video export pipeline  
**Toggle:** `VITE_ENABLE_EXPORT_METRICS` env flag — zero runtime cost when off

---

## Goal

Add a real-time metrics overlay that appears during video export and displays every observable signal the browser sandbox exposes. Designed to be fully decoupled — it can be deleted in one diff with no impact on the export pipeline.

---

## What the Browser Can (and Cannot) Measure

### Available — Web Standard or Chrome-Specific

| Metric | API | Notes |
|--------|-----|-------|
| JS heap used | `performance.memory.usedJSHeapSize` | Chrome/Edge only. Non-standard. Returns bytes. |
| JS heap total allocated | `performance.memory.totalJSHeapSize` | Chrome/Edge only. |
| JS heap size limit | `performance.memory.jsHeapSizeLimit` | Chrome/Edge only. V8 heap limit, not device RAM. |
| Total device RAM | `navigator.deviceMemory` | Rounded to nearest power of 2 (e.g., 8 GB). Chrome 63+. |
| CPU core count | `navigator.hardwareConcurrency` | Logical threads, not physical cores. |
| High-resolution wall clock | `performance.now()` | Sub-millisecond. Used for timing every phase. |
| User timing marks | `performance.mark()` / `performance.measure()` | Emit custom spans visible in DevTools Performance tab. |
| Main thread frame budget | `requestAnimationFrame` callback timing | Reveals main thread pressure; drops below 60fps when encode is blocking. |
| Total allocated ImageBitmaps | Manual counter in export pipeline | Track `create` − `close` calls to get live count. |
| Total allocated VideoFrames | Manual counter in export pipeline | Track `toVideoFrame()` − `close()` calls. |
| Encode frame throughput | Manual: frames / elapsed seconds | Computed from frame counter + wall clock. |
| Per-frame encode latency | `performance.now()` delta per frame | Time from `renderGridIntoContext` start to `videoSource.add()` resolve. |
| Decode setup latency | `performance.now()` delta for `buildVideoStreams` | Time to fetch + open all video inputs. |
| Null sample rate | Manual counter in export pipeline | Count how many `iter.next()` calls yield `null`. Signals timestamp misalignment. |
| Export output size (running) | `target.buffer.byteLength` (if accessible) | Size of the MP4 buffer as it grows. May not be exposed by Mediabunny's `BufferTarget`. |
| Network: blob fetch time | `performance.getEntriesByType('resource')` | Individual fetch times for video blob URLs. |

### NOT Available from the Browser Sandbox

| Metric | Why | Workaround |
|--------|-----|------------|
| VTDecoder process memory | OS process, not JS | `top -pid $(pgrep "VTDecoderXPCService")` in terminal |
| GPU VRAM usage | No Web API | Chrome DevTools → Task Manager (Shift+Esc) → GPU Process row |
| CPU core utilization % | No Web API | `sudo powermetrics -i 1000 --samplers cpu_power` |
| VideoEncoder queue depth | Mediabunny wraps VideoEncoder; `encodeQueueSize` not forwarded | Check Mediabunny source for future exposure |
| VideoDecoder queue depth | Same reason | Same |
| Per-process renderer memory | Approximate via `performance.memory` | Chrome Task Manager for exact |
| GPU pipeline stalls | No Web API | `chrome://tracing` → GPU category |
| ImageBitmap GPU texture residency | No Web API | Correlate with `performance.memory` delta |

---

## Architecture

### Decoupling Strategy

The export pipeline (`videoExport.ts`) must NOT import or reference the metrics panel. Coupling goes in one direction only: `ExportSplitButton` → metrics panel.

```
ExportSplitButton
    │
    ├── calls exportVideoGrid(... , onMetrics?)
    │       │
    │       └── videoExport.ts fires onMetrics(snapshot) callbacks
    │           (no-op when onMetrics is undefined)
    │
    └── passes metrics state → <ExportMetricsPanel />
```

Removal is a single-file change in `ExportSplitButton.tsx`: delete the `onMetrics` prop and the `<ExportMetricsPanel />` JSX. `videoExport.ts` becomes a no-op (the callback is never registered).

### Feature Flag

Controlled via Vite environment variable:

```
# .env.development (checked in — safe, non-secret)
VITE_ENABLE_EXPORT_METRICS=true

# .env.production (default)
# VITE_ENABLE_EXPORT_METRICS not set → false
```

In code:

```typescript
const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true';
```

Vite tree-shakes dead branches in production build. When `METRICS_ENABLED` is false, `onMetrics` is never passed to `exportVideoGrid`, so all metric collection inside the pipeline is unreachable.

---

## `ExportMetrics` Shape

A plain serializable object — no classes, no WeakRefs, no closures:

```typescript
export interface ExportMetrics {
  // Timing
  elapsedMs: number;           // Wall clock since export started
  decodeSetupMs: number;       // Time for buildVideoStreams to complete
  lastFrameMs: number;         // Time for the last encode frame (render + videoSource.add)
  averageFrameMs: number;      // Rolling average over last 30 frames

  // Throughput
  framesEncoded: number;       // Frames written to encoder so far
  totalFrames: number;         // Total frames to encode (known upfront)
  encodeFps: number;           // framesEncoded / (elapsedMs / 1000)

  // Memory — JS heap (Chrome only; 0 on other browsers)
  heapUsedMB: number;          // performance.memory.usedJSHeapSize / 1e6
  heapTotalMB: number;         // performance.memory.totalJSHeapSize / 1e6
  heapLimitMB: number;         // performance.memory.jsHeapSizeLimit / 1e6

  // Memory — custom counters
  activeBitmaps: number;       // ImageBitmaps created − closed (should stay ≤ N_videos)
  activeVideoFrames: number;   // VideoFrames created − closed (should stay at 0 after each frame)
  nullSampleCount: number;     // Times iter.next() returned null (timestamp alignment failures)

  // Device (static, read once)
  deviceMemoryGB: number;      // navigator.deviceMemory (rounded, Chrome only)
  cpuCores: number;            // navigator.hardwareConcurrency

  // Phase
  phase: 'preparing' | 'decoding' | 'encoding' | 'audio' | 'finalizing';
  videoCount: number;          // Number of video streams being decoded
}
```

### Instrumentation Points in `videoExport.ts`

```typescript
// Signature extension — onMetrics is optional and no-op by default
export async function exportVideoGrid(
  ...,
  onMetrics?: (metrics: ExportMetrics) => void,
): Promise<Blob>
```

Fire `onMetrics` at:
1. **Start of decode setup** — emit `phase: 'decoding'`, record `t0 = performance.now()`
2. **After `buildVideoStreams`** — emit `decodeSetupMs`
3. **Per encode frame** — emit all throughput + memory fields
4. **After audio mix** — emit `phase: 'audio'`
5. **After `output.finalize()`** — emit `phase: 'finalizing'`, final snapshot

Counters for `activeBitmaps` and `activeVideoFrames`:

```typescript
let activeBitmaps = 0;
let activeVideoFrames = 0;
let nullSamples = 0;

// On createImageBitmap: activeBitmaps++
// On bitmap.close():    activeBitmaps--
// On toVideoFrame():    activeVideoFrames++
// On videoFrame.close(): activeVideoFrames--
// On result.value === null: nullSamples++
```

These are local variables in `exportVideoGrid` — no global state, no module-level side effects.

---

## `ExportMetricsPanel` Component

### Layout

Fixed overlay, bottom-right corner, outside the canvas area. Dark translucent background, monospace font. Similar to browser DevTools overlays.

```
┌──────────────────────────────┐
│  EXPORT METRICS         [×]  │
│  ─────────────────────────   │
│  Phase        ENCODING       │
│  Progress     147 / 300      │
│  Encode FPS   28.3 fps       │
│  Frame time   35.3 ms        │
│  Elapsed      5.2 s          │
│  ETA          5.4 s          │
│  ─────────────────────────   │
│  MEMORY                      │
│  JS Heap      312 / 2048 MB  │
│  Heap limit   4096 MB        │
│  Active bitmaps  4           │  ← should stay at N_videos
│  Active frames   0           │  ← should always be 0
│  Null samples    0           │  ← alignment failures
│  ─────────────────────────   │
│  DEVICE                      │
│  RAM          8 GB           │
│  CPU cores    10             │
└──────────────────────────────┘
```

### Toggle Behavior

- Visible when `METRICS_ENABLED && exportState !== 'idle'`
- Dismissible with `[×]` button (hides until next export)
- Keyboard shortcut `Shift+M` toggles visibility during export
- Collapses to a single status line when dismissed (still shows progress %)

### Update Rate

Poll every **250ms** via `setInterval`. Rationale:
- 4 updates/sec is sufficient for human reading
- Faster polling (< 100ms) adds React re-render overhead on the main thread, which competes with the encode loop
- `performance.memory` snapshots update on GC boundaries, not on every read — sampling faster than 250ms rarely sees different values

---

## Pitfalls and Constraints

### P-01: `performance.memory` is Chrome/Edge only
`performance.memory` is not in any W3C spec. Firefox and Safari return `undefined`. Guard every access:
```typescript
const mem = (performance as any).memory;
const heapUsedMB = mem ? mem.usedJSHeapSize / 1e6 : 0;
```
Display "N/A" on non-Chrome browsers.

### P-02: `performance.memory` values lag GC
The browser garbage collects on its own schedule. `usedJSHeapSize` may not drop immediately after `bitmap.close()`. The value reflects the live object graph at the last GC cycle, not real-time allocations. Treat it as a trend indicator, not an exact count.

### P-03: `navigator.deviceMemory` is rounded and capped
Returns the nearest power of 2, capped at 8 GB. A machine with 32 GB returns 8. Not useful for exact memory budget calculation — use only for display.

### P-04: Main thread blocking hides real encode latency
`performance.now()` measures wall clock. During a GPU-heavy encode frame, the main thread may be blocked waiting for `videoSource.add()` to resolve. The `lastFrameMs` metric includes this wait, which is accurate, but means the UI cannot update at all during the blocking period. The 250ms polling interval means the UI will feel "chunky" during heavy frames — this is expected.

### P-05: `activeBitmaps` counter requires discipline
Every `createImageBitmap()` must increment; every `bitmap.close()` must decrement. A missed `close()` in an error path causes the counter to drift. The `finally` block's `bitmap.close()` calls must also decrement. If this counter grows unboundedly, it signals a memory leak in the pipeline.

### P-06: Mediabunny encodes in an internal worker (partially)
Mediabunny may offload some work to `VideoEncoder` which runs in a WebCodecs context. `performance.memory` only measures the JS heap on the main thread. GPU-side buffers (e.g., `ImageBitmap` textures after transfer to VideoEncoder) may not be reflected in `usedJSHeapSize`. The `activeBitmaps` counter is more reliable than heap size for tracking frame buffer pressure.

### P-07: `requestAnimationFrame` stalls during encode
If you use `rAF` for the polling loop, it will not fire when the main thread is 100% busy encoding. Use `setInterval` instead, which uses the timer queue and fires on event loop ticks between tasks.

### P-08: `performance.mark()` spans appear in DevTools even when panel is hidden
If you emit `performance.mark('frame-encode-start')` etc., they accumulate in the Performance timeline buffer. This is useful for DevTools analysis but adds a small overhead per frame (~1µs). Gate them behind `METRICS_ENABLED`.

### P-09: `iter.next()` null count is a leading indicator of bugs, not errors
A non-zero `nullSampleCount` means `getPacket(timestamp)` returned null for some export frame — the timestamp was before the video's first packet or the decoder flushed unexpectedly. This does not throw; it silently skips the frame. The panel makes this visible for the first time.

### P-10: Heap limit is V8's limit, not device RAM
`jsHeapSizeLimit` is typically 2–4 GB regardless of how much RAM the device has. On 32 GB machines, OOM crashes still happen when the JS heap exceeds ~4 GB. This is a V8 constraint, not an OS constraint. Display the limit clearly so users understand why a "32 GB machine" still crashes at 4 GB.

### P-11: `computeDuration()` and `getFirstTimestamp()` add latency to decode setup
Each video now requires two async metadata reads before streaming begins. For 4 videos this adds ~4 × 2 round-trips to the container demuxer. Empirically fast (< 10ms per video for MP4/H.264), but `decodeSetupMs` in the metrics panel makes this measurable.

---

## Files Involved

| File | Change |
|------|--------|
| `src/lib/videoExport.ts` | Add `onMetrics?: (m: ExportMetrics) => void` param; fire callbacks at instrumentation points; add local counters |
| `src/Editor/ExportMetricsPanel.tsx` | New component — the overlay |
| `src/Editor/ExportSplitButton.tsx` | Conditionally render `<ExportMetricsPanel />`; pass `onMetrics` to `exportVideoGrid` when `METRICS_ENABLED` |
| `src/types/exportMetrics.ts` | `ExportMetrics` interface — shared between panel and pipeline |
| `.env.development` | `VITE_ENABLE_EXPORT_METRICS=true` |

### Removal Checklist (if decoupling later)

To completely remove the metrics panel, delete these items in order:

1. Delete `src/Editor/ExportMetricsPanel.tsx`
2. Delete `src/types/exportMetrics.ts`
3. In `ExportSplitButton.tsx`: remove `onMetrics` state, remove `<ExportMetricsPanel />`, remove the `onMetrics` prop passed to `exportVideoGrid`
4. In `videoExport.ts`: remove `onMetrics?` parameter, remove all `onMetrics(...)` call sites, remove local counters (`activeBitmaps`, `activeVideoFrames`, `nullSampleCount`)
5. Delete `.env.development` line `VITE_ENABLE_EXPORT_METRICS=true`

`videoExport.ts` works identically before and after — `onMetrics` is always optional with no side effects.

---

## Supplementary OS-Level Monitoring (Outside App)

For metrics the browser cannot expose, use these terminal commands during an export run:

```bash
# GPU + CPU power (macOS) — run in a separate terminal during export
sudo powermetrics -i 1000 --samplers cpu_power,gpu_power

# Watch VTDecoder process memory specifically
top -pid $(pgrep -n "VTDecoderXPCService")

# Memory pressure from kernel's perspective
vm_stat 1

# Chrome/Brave per-process breakdown (in-browser)
# Shift+Esc → Task Manager → observe GPU Process + Renderer rows
```

For deep GPU traces: open `chrome://tracing`, record with the `gpu`, `cc`, and `v8` categories enabled, then trigger an export. The trace includes VideoDecoder/VideoEncoder timing at the WebCodecs level.

---

## Success Criteria

- [ ] `activeBitmaps` stays ≤ number of video cells throughout encode (validates streaming fix)
- [ ] `activeVideoFrames` stays at 0 after each frame (validates VideoFrame close discipline)
- [ ] `nullSampleCount` stays at 0 for normal exports (validates timestamp alignment)
- [ ] Panel appears automatically when export starts, disappears when export finishes
- [ ] Panel is absent from production build (`VITE_ENABLE_EXPORT_METRICS` not set)
- [ ] Removing the panel requires no changes to `videoExport.ts` beyond deleting the `onMetrics` calls
