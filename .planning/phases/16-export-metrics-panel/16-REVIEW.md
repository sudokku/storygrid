---
phase: 16
status: issues-found
critical: 0
high: 0
medium: 2
low: 2
info: 0
---

# Phase 16 Code Review

## Summary

Phase 16 adds a developer-only export metrics overlay (feature-flagged via `VITE_ENABLE_EXPORT_METRICS`) to the video export pipeline. The architecture is sound and the production safety story is solid (Vite tree-shakes the flag at build time). Two medium-severity issues were found: `activeBitmaps` is reported before bitmaps are released, causing every per-frame emit to show an inflated count; and `mediaTypeMap` is missing from `handleExport`'s `useCallback` dependency array, creating a stale-closure risk. Two low-severity issues also identified around `performance.mark` buffer overflow and interval cleanup ordering.

---

## Findings

### MEDIUM — `activeBitmaps` over-reports at every per-frame emit

**File:** `src/lib/videoExport.ts:597`

**Issue:** `emitMetrics('encoding', i + 1, totalFrames)` is called at line 597, BEFORE the bitmap-release loop at lines 600-603:

```typescript
emitMetrics('encoding', i + 1, totalFrames);   // line 597 — activeBitmaps still inflated

for (const b of bitmapsToClose) {
  b.close();
  activeBitmaps--;                               // lines 600-603 — decremented after emit
}
```

During every frame of a 2-video export the emitted `activeBitmaps` will be 2, not 0. The spec comment on `ExportMetrics.activeBitmaps` says it "should stay ≤ N_videos" — but developers reading the panel will always see `N_videos` during encoding, never 0, and cannot tell from the panel whether bitmaps are actually leaking. The final `emitMetrics('finalizing', ...)` call (line 631) correctly shows 0 because it runs after the loop ends with all bitmaps released. The 749-frame human verification showed "Active bitmaps: 0" only at the finalizing snapshot — the per-frame panel updates were never 0 during encoding.

**Fix:** Move `emitMetrics` after the bitmap-release loop:

```typescript
// Release bitmaps immediately after encode — key to memory savings.
for (const b of bitmapsToClose) {
  b.close();
  activeBitmaps--;
}

// Emit after release so activeBitmaps reflects post-cleanup state.
emitMetrics('encoding', i + 1, totalFrames);

onProgress('encoding', Math.round(((i + 1) / totalFrames) * 100));
```

---

### MEDIUM — `mediaTypeMap` missing from `handleExport` useCallback dependency array

**File:** `src/Editor/ExportSplitButton.tsx:174,236-251`

**Issue:** `handleExport` uses `mediaTypeMap` directly at line 174 (passed to `exportVideoGrid`) and at line 45 via `hasVideoCell` (which feeds `hasVideos`). The `useCallback` dep array at lines 236-251 includes `root`, `mediaRegistry`, `exportFormat`, but not `mediaTypeMap`.

```typescript
const blob = await exportVideoGrid(
  root,
  mediaRegistry,
  mediaTypeMap,   // used here — not in deps
  ...
```

In practice `mediaTypeMap` changes whenever a new video is added or its type is re-detected. If a user drops a new video after the component has mounted (updating `mediaTypeMap` without updating the other deps), `handleExport` will call `exportVideoGrid` with a stale `mediaTypeMap` that is missing the new video entry, causing the newly dropped video to be silently skipped during export.

**Fix:** Add `mediaTypeMap` to the dependency array:

```typescript
}, [
  isExporting,
  hasVideos,
  root,
  mediaRegistry,
  mediaTypeMap,      // add this
  exportFormat,
  exportQuality,
  setIsExporting,
  gap,
  borderRadius,
  backgroundMode,
  backgroundColor,
  backgroundGradientFrom,
  backgroundGradientTo,
  backgroundGradientDir,
]);
```

---

### LOW — `performance.mark` entries accumulate and overflow the browser's performance buffer

**File:** `src/lib/videoExport.ts:549,591-592`

**Issue:** Each frame appends two marks (`frame-encode-start`, `frame-encode-end`) and one measure (`frame-encode`) to the browser's Performance Timeline buffer via `performance.mark()` and `performance.measure()`. The default buffer size in Chrome is 150 entries (`performance.setResourceTimingBufferSize` default). For a 749-frame export: 749 × 3 = 2247 entries. Once the buffer overflows (after ~50 frames), older entries are silently evicted. This defeats the stated purpose — DevTools Performance tab will only show the most recent ~50 frame measures, not the full export timeline.

**Fix:** Clear marks after each frame (they've already been consumed by `performance.measure`):

```typescript
if (METRICS_ENABLED) {
  performance.mark('frame-encode-end');
  performance.measure('frame-encode', 'frame-encode-start', 'frame-encode-end');
  lastFrameMs = performance.now() - frameStart;
  recentFrameTimes.push(lastFrameMs);
  if (recentFrameTimes.length > 30) recentFrameTimes.shift();
  // Clear marks so the performance buffer doesn't overflow on long exports
  performance.clearMarks('frame-encode-start');
  performance.clearMarks('frame-encode-end');
  performance.clearMeasures('frame-encode');
}
```

---

### LOW — Metrics interval may fire once after `isExporting` transitions to false

**File:** `src/Editor/ExportSplitButton.tsx:97-123`

**Issue:** The polling `useEffect` has two distinct behaviors on the same `isExporting` change:

1. When `isExporting` becomes `false`: the effect runs its body (stop interval, freeze snapshot), then returns without registering a cleanup.
2. When `isExporting` was `true` and is now `false`: React first runs the previous effect's cleanup (which clears the interval), then runs the new body.

The ordering is correct for React's model. However, there is a race window: the 250ms interval timer that fired right before `setIsExporting(false)` may have already been dispatched to the macrotask queue. React's state flush and the effect re-run are synchronous only within the same render batch, but `clearInterval` in the cleanup cannot cancel an already-queued callback. As a result, `setMetricsSnapshot` may be called one final time after the "stop polling" body runs, setting the snapshot to the same value it was just set to by the `if (metricsRef.current)` block. The outcome (the correct final snapshot) is the same either way, but it causes an extra state update and re-render.

This is very unlikely to cause a visible problem (the snapshot values would be identical) but it is a latent inconsistency.

**Fix:** Add a `stopped` flag guard to the interval callback to make it idempotent after cleanup:

```typescript
metricsIntervalRef.current = setInterval(() => {
  if (metricsRef.current) {
    setMetricsSnapshot({ ...metricsRef.current });
  }
}, 250);
```

The simpler fix is to set `metricsIntervalRef.current = null` before clearing:

```typescript
return () => {
  const id = metricsIntervalRef.current;
  metricsIntervalRef.current = null;
  if (id) clearInterval(id);
};
```

Then guard the interval body:

```typescript
metricsIntervalRef.current = setInterval(() => {
  if (metricsRef.current && metricsIntervalRef.current !== null) {
    setMetricsSnapshot({ ...metricsRef.current });
  }
}, 250);
```

This prevents a stale callback from updating state after the interval was logically stopped.
