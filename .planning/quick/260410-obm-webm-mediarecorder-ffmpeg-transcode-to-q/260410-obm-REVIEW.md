---
phase: 260410-obm
reviewed: 2026-04-10T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - src/lib/transcodeToMp4.ts
  - src/lib/videoExport.ts
  - src/Editor/Toast.tsx
  - src/Editor/ExportSplitButton.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 260410-obm: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** quick (full file read — 4 files)
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The WebM MediaRecorder + ffmpeg.wasm transcode pipeline is structurally sound. The singleton pattern, cleanup in `finally`, WebM-only MIME list, `transcoding` stage wiring, and `mp4` extension are all correct. One critical issue exists in the ffmpeg singleton: a newly created `FFmpeg` instance is never cached when `ffmpegInstance` exists but `ffmpegInstance.loaded` is false, meaning each failed/interrupted load creates a fresh orphaned instance while the stale unloaded singleton stays null-equivalent indefinitely. Three warnings cover: the `onLog` handler not being attached on singleton reuse, a missing `mediaTypeMap` dependency in the `useCallback` in `ExportSplitButton`, and the unhandled case where `recorder.stop()` is called twice (once from the render loop error path and once from the interval teardown). Two info items cover dead code and a minor type-cast pattern.

---

## Critical Issues

### CR-01: FFmpeg singleton never updated when load fails — stale null reference on retry

**File:** `src/lib/transcodeToMp4.ts:16-32`

**Issue:** `getFFmpeg()` checks `ffmpegInstance && ffmpegInstance.loaded`. If a previous call created a new `FFmpeg()` but `ffmpeg.load()` threw before reaching `ffmpegInstance = ffmpeg` (line 31), `ffmpegInstance` remains `null`. On the next call, `getFFmpeg` correctly enters the branch again and creates another instance — this path is fine. However, if `ffmpeg.load()` throws AFTER `ffmpegInstance = ffmpeg` is assigned (assignment is on line 31, after `await ffmpeg.load()` on line 26), then `ffmpegInstance` will never be set because the exception unwinds past line 31. That part is safe.

The real bug is the inverse: `ffmpegInstance` is assigned only after a successful load. But the guard on line 16 is `ffmpegInstance && ffmpegInstance.loaded`. If an external caller somehow holds a reference and calls `ffmpeg.terminate()` (or the browser GCs the WASM module), `ffmpegInstance.loaded` becomes `false` while `ffmpegInstance` is non-null. In that state, `getFFmpeg` creates a **new** `FFmpeg` instance, calls `load()` on it, but then assigns it to `ffmpegInstance` — so the old unloaded instance is correctly replaced. This is actually fine.

**Actual bug — `onLog` handler lost on reuse:** When `ffmpegInstance` is already loaded (line 16 returns early), the `onLog` callback passed by the caller is silently ignored. The `ffmpeg.on('log', ...)` call only happens during initial load. Subsequent calls to `transcodeWebmToMp4` with a different `onLog` will produce no log output, which can make debugging transcode failures opaque. More concretely: the progress handler IS cleaned up per call (lines 107-109), but the log handler is not, meaning if a caller passes `onLog` on first use, that handler stacks permanently.

**Fix:**
```typescript
// In getFFmpeg — remove the log registration from here entirely.
// Instead, let the caller manage log listeners directly on the returned instance.
// OR: clear and re-register on every call:
async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    // Re-register log handler for this call (previous handler may differ).
    // ffmpeg.off() with no handler argument is not available in 0.12.x;
    // instead keep a module-level logHandler ref and swap it.
    if (logHandler) ffmpegInstance.off('log', logHandler);
    if (onLog) {
      logHandler = ({ message }: { message: string }) => onLog(message);
      ffmpegInstance.on('log', logHandler);
    } else {
      logHandler = null;
    }
    return ffmpegInstance;
  }
  // ... rest of load path
}
```

---

## Warnings

### WR-01: `mediaTypeMap` missing from `useCallback` dependency array

**File:** `src/Editor/ExportSplitButton.tsx:153-168`

**Issue:** `handleExport` closes over `mediaTypeMap` (line 105 — passed to `exportVideoGrid`) and `mediaTypeMap` (line 43 — passed to `hasVideoCell`). `mediaTypeMap` is read from `useGridStore` on line 31 but is absent from the `useCallback` deps array at lines 153-168. If `mediaTypeMap` changes (user drops a new video into a cell), `handleExport` will use a stale snapshot of `mediaTypeMap`, potentially triggering the wrong export path (image vs video) or passing outdated type information to `exportVideoGrid`.

`hasVideos` (line 43) is computed outside `useCallback` and is in scope via closure, but it is also not in the deps array. Because `hasVideos` derives from `root` and `mediaTypeMap` — both of which are listed — this is a secondary concern. The primary missing dep is `mediaTypeMap` itself.

**Fix:**
```typescript
}, [
  isExporting,
  hasVideos,
  root,
  mediaRegistry,
  mediaTypeMap,        // ADD THIS
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

### WR-02: `recorder.stop()` callable twice — potential double-stop in error path

**File:** `src/lib/videoExport.ts:592-600`

**Issue:** The `setInterval` error handler (lines 592-600) calls both `recorder.stop()` (line 597) and `reject(err)` when a render frame throws. If the interval fires multiple frames before `isRendering` is set (race between the interval clearing on line 593 and the next tick), or if `renderFrame()` rejects after `recorder.stop()` has already been called by the normal completion path (lines 523), `recorder.stop()` is called on an already-stopped recorder. Per the MediaRecorder spec, calling `stop()` on an inactive recorder throws an `InvalidStateError`. This would swallow the original `err` and surface an unrelated DOMException instead.

**Fix:**
```typescript
// Track recorder state with a flag to prevent double-stop:
let recorderStopped = false;

// In the normal stop path (line 523):
if (!recorderStopped) { recorderStopped = true; recorder.stop(); }

// In the error path (line 597):
if (!recorderStopped) { recorderStopped = true; recorder.stop(); }
```

### WR-03: `onProgress('encoding', 100)` called after `recorder.stop()` — ordering hazard

**File:** `src/lib/videoExport.ts:523-525`

**Issue:** Lines 523-525 call `recorder.stop()` and then immediately `onProgress('encoding', 100)`. The `recorder.onstop` handler (line 463) calls `onProgress('transcoding', 0)` synchronously at the start. Because `recorder.stop()` is asynchronous (onstop fires in a future microtask/macrotask), the sequence is: `onProgress('encoding', 100)` → [later] `onProgress('transcoding', 0)`. This is the correct order and works fine. However, `onProgress('encoding', 100)` sets the toast to `encoding` at 100%, then `transcoding` at 0% appears only after onstop fires. If the onstop handler is delayed (large WebM blob, slow Blob construction), the UI briefly shows "Encoding 100%..." with no indication that transcoding is about to start. This is a UX timing gap, not a crash, but can be confusing.

More concretely: if the onstop delay is long, the `finally` block in `handleExport` (line 149) will set `isExporting = false` before `onstop` fires — because `onstop` fires asynchronously, and the outer Promise does not resolve until `transcodeWebmToMp4` completes. Actually re-reading: the outer Promise is not resolved until `resolve(mp4Blob)` inside `onstop` (line 473), so `isExporting` stays true throughout. The `onProgress('encoding', 100)` before `recorder.stop()` is nonetheless misleading — move it after, or replace with a `transcoding` signal.

**Fix:**
```typescript
// Replace lines 523-525:
recorder.stop();
// onProgress('encoding', 100) removed — onstop immediately signals 'transcoding'
// so the '100%' encoding state would flash for only one tick anyway.
```

---

## Info

### IN-01: `void onDismiss` silences linter but `onDismiss` is never used

**File:** `src/Editor/Toast.tsx:78`

**Issue:** `onDismiss` is declared in `ToastProps` and accepted as a prop, but is only referenced via `void onDismiss` (line 78) to suppress an "unused variable" lint warning. The `error` toast (lines 62-75) has a "Try again" button wired to `onRetry` but no dismiss/close button wired to `onDismiss`. The prop is part of the public API but dead in the rendered output. Either wire it to a close button on the error toast, or remove it from `ToastProps`.

**Fix:** Add a close button to the error toast, or remove the prop if intentionally deferred:
```tsx
// Option A — wire it:
<button onClick={onDismiss} className="ml-1 text-xs text-neutral-500 hover:text-neutral-300">
  ✕
</button>

// Option B — remove from interface and call site if not needed yet.
```

### IN-02: `Uint8Array as unknown as ArrayBuffer` cast is unnecessary

**File:** `src/lib/transcodeToMp4.ts:100`

**Issue:** `new Blob([outputData as unknown as ArrayBuffer], ...)` — The `Blob` constructor accepts `BlobPart[]`, and `BlobPart` includes `ArrayBuffer | ArrayBufferView | Blob | string`. `Uint8Array` is an `ArrayBufferView`, so it is a valid `BlobPart` directly. The double cast through `unknown` works at runtime but hides the actual type and is misleading — `Uint8Array` does not need to be treated as `ArrayBuffer`.

**Fix:**
```typescript
return new Blob([outputData as Uint8Array], { type: 'video/mp4' });
// Or simply, if readFile is typed as FileData = Uint8Array | string:
return new Blob([outputData instanceof Uint8Array ? outputData : new TextEncoder().encode(outputData)], { type: 'video/mp4' });
```

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick (pattern scan + full file read)_
