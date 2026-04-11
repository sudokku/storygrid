---
phase: 16-export-metrics-panel
plan: "01"
subsystem: video-export
tags: [metrics, instrumentation, observability, video-export, webcodecs]
dependency_graph:
  requires: []
  provides: [ExportMetrics-interface, onMetrics-callback-in-exportVideoGrid]
  affects: [src/lib/videoExport.ts, src/Editor/ExportSplitButton.tsx]
tech_stack:
  added: []
  patterns:
    - optional-callback-param pattern (same as onWarning/onProgress)
    - VITE_ENABLE_EXPORT_METRICS feature flag for zero-cost production builds
    - local counters (activeBitmaps, activeVideoFrames, nullSamples) inside exportVideoGrid
    - performance.mark/measure gated behind METRICS_ENABLED constant
key_files:
  created:
    - src/types/exportMetrics.ts
  modified:
    - src/lib/videoExport.ts
decisions:
  - Moved imports to top of file and placed METRICS_ENABLED constant after type import
  - Used (performance as unknown as {memory?}).memory typing for Chrome-only API guard
  - emitMetrics fires at decoding/encoding/audio/finalizing — no preparing emit per SPEC
  - activeBitmaps decremented in bitmap cleanup loop after encode (not immediately after close during decode)
  - nullSamples++ only when result.value is falsy AND result.done is false — matches SPEC intent
metrics:
  duration_minutes: 12
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 16 Plan 01: ExportMetrics Type + videoExport.ts Instrumentation Summary

ExportMetrics interface (17 fields) + onMetrics callback wired into the Mediabunny export pipeline at 4 lifecycle points with local resource counters and performance marks.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ExportMetrics interface | 244d1ba | src/types/exportMetrics.ts |
| 2 | Instrument videoExport.ts with onMetrics callback and counters | 1239689 | src/lib/videoExport.ts |

## What Was Built

### Task 1: ExportMetrics Interface

`src/types/exportMetrics.ts` exports a single named interface with all 17 fields organized into 5 sections:

- **Timing**: elapsedMs, decodeSetupMs, lastFrameMs, averageFrameMs
- **Throughput**: framesEncoded, totalFrames, encodeFps
- **Memory (JS heap)**: heapUsedMB, heapTotalMB, heapLimitMB
- **Memory (custom counters)**: activeBitmaps, activeVideoFrames, nullSampleCount
- **Device + Phase**: deviceMemoryGB, cpuCores, phase, videoCount

Phase union type: `'preparing' | 'decoding' | 'encoding' | 'audio' | 'finalizing'`

### Task 2: videoExport.ts Instrumentation

Changes to `exportVideoGrid`:

1. **Signature extended**: `onMetrics?: (metrics: ExportMetrics) => void` added as last optional parameter after `onWarning`.

2. **Feature flag**: `const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true'` at module level — Vite tree-shakes dead branches in production.

3. **Local counters** declared before the try block (so emitMetrics closure can read them at all call sites):
   - `let activeBitmaps = 0` — incremented after createImageBitmap, decremented in cleanup loop
   - `let activeVideoFrames = 0` — incremented after toVideoFrame(), decremented after videoFrame.close()
   - `let nullSamples = 0` — incremented when iter.next() returns falsy value (not done)
   - `let videoMediaIds: Set<string> = new Set()` — populated inside try, referenced by emitMetrics

4. **emitMetrics helper** — inner function closure; no-ops when `onMetrics` is undefined (zero cost).

5. **4 emit points**:
   - `emitMetrics('decoding', 0, totalFrames)` — after buildVideoStreams completes, decodeSetupMs recorded
   - `emitMetrics('encoding', i+1, totalFrames)` — per frame, after videoSource.add()
   - `emitMetrics('audio', totalFrames, totalFrames)` — after audio mixing block
   - `emitMetrics('finalizing', totalFrames, totalFrames)` — after output.finalize()

6. **performance.mark/measure** per frame — gated behind `if (METRICS_ENABLED)`:
   - `performance.mark('frame-encode-start')` before inner video loop
   - `performance.mark('frame-encode-end')` + `performance.measure('frame-encode', ...)` after videoSource.add()
   - `lastFrameMs` and `recentFrameTimes` (rolling window of 30) updated inside METRICS_ENABLED gate

7. **Chrome-only heap guard**: `(performance as unknown as { memory? }).memory` — returns undefined on Firefox/Safari, all heap fields default to 0.

## Verification

- `npx tsc --noEmit` exits 0 — no type errors
- `grep -c "onMetrics" src/lib/videoExport.ts` returns 3 (signature + emitMetrics param + 4 call sites via helper)
- `grep "activeBitmaps" src/lib/videoExport.ts` shows declaration, increment, decrement, and payload use
- `grep "METRICS_ENABLED" src/lib/videoExport.ts` shows feature flag declaration and 3 gate sites
- `videoExport.ts` does NOT import `ExportMetricsPanel` — decoupling preserved (D-09)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs introduced. `onMetrics` is a pure callback; when undefined (production), zero runtime cost.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. `performance.memory` is local Chrome-only data, feature-flagged off in production (T-16-01 accepted in plan threat model).

## Self-Check: PASSED

- `src/types/exportMetrics.ts` exists with all 17 fields
- `src/lib/videoExport.ts` modified — onMetrics param, emitMetrics helper, 4 emit points, resource counters
- Commit 244d1ba: ExportMetrics interface
- Commit 1239689: videoExport.ts instrumentation
- TypeScript compiles clean
