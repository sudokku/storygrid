---
phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - package.json
  - src/Editor/ExportSplitButton.tsx
  - src/Editor/Toast.tsx
  - src/lib/videoExport.ts
  - src/test/phase04-02-task1.test.tsx
  - src/test/videoExport-audio.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase replaces the previous MediaRecorder/ffmpeg.wasm video export pipeline with a Mediabunny CanvasSource + AudioBufferSource pipeline. The implementation is well-structured overall: dedicated export video elements, proper cleanup in `finally`, non-fatal audio handling, and clean separation of concerns. No critical security issues or data-loss bugs were found. The findings below are warnings around edge cases in the encoding loop and error handling that could produce silent failures or corrupted output in edge cases.

---

## Warnings

### WR-01: `target.buffer` cast to `ArrayBuffer` is unsafe — may be `null` at finalize

**File:** `src/lib/videoExport.ts:472`
**Issue:** `target.buffer as ArrayBuffer` silently assumes `BufferTarget.buffer` is a non-null `ArrayBuffer` after `output.finalize()`. The Mediabunny API does not appear to guarantee the buffer is populated on all code paths (e.g., if `finalize()` is called on a zero-frame output, or if the underlying WritableStream flushed to an empty state). If `target.buffer` is `null` or `undefined`, `new Blob([null])` produces a Blob with the string `"null"` — a corrupt MP4 that downloads silently without throwing.

**Fix:**
```ts
const buf = target.buffer;
if (!buf) {
  throw new Error('Video export failed: output buffer is empty after finalize');
}
return new Blob([buf], { type: 'video/mp4' });
```

---

### WR-02: `onProgress` called with `percent` after 100% is never reached — off-by-one in progress reporting

**File:** `src/lib/videoExport.ts:451`
**Issue:** The progress call inside the loop is `Math.round((i / totalFrames) * 100)`. For `i = totalFrames - 1` (last frame), this yields `Math.round(((totalFrames-1) / totalFrames) * 100)`, which is at most 99% for any `totalFrames > 1`. The UI progress counter therefore never reaches 100% before the toast is dismissed. This is a logic error — the user sees "Encoding 99%..." immediately before the toast disappears.

**Fix:**
```ts
// After the loop, report 100% completion before finalize
onProgress('encoding', 100);
await output.finalize();
```
Or change the in-loop call to use `i + 1`:
```ts
onProgress('encoding', Math.round(((i + 1) / totalFrames) * 100));
```

---

### WR-03: Audio mixing failure silently drops audio without calling `onWarning`

**File:** `src/lib/videoExport.ts:462-466`
**Issue:** When the `audioSource.add(mixedBuffer)` call or `mixAudioForExport` throws, the catch block logs to console but does NOT call `onWarning`. This is inconsistent with the stated D-03 design: audio failures are non-fatal but should surface a warning to the user. By the time this catch fires, the video is encoded; the user downloads a silent MP4 without any notification.

```ts
} catch (err) {
  // D-03: Audio mix failure is non-fatal — video is already encoded.
  console.warn('[audio] Audio mix failed; exporting video-only:', err);
  // onWarning is NOT called here
}
```

**Fix:**
```ts
} catch (err) {
  console.warn('[audio] Audio mix failed; exporting video-only:', err);
  onWarning?.('Audio not supported in this browser — exporting video only');
}
```

---

### WR-04: `ExportSplitButton` missing `mediaTypeMap` in `useCallback` dependency array

**File:** `src/Editor/ExportSplitButton.tsx:163-178`
**Issue:** `mediaTypeMap` is read from the store at line 33 and passed to `exportVideoGrid` at line 109, but it is absent from the `useCallback` deps array. If the `mediaTypeMap` reference updates (e.g., a new video is added to the grid after the component first renders), the stale closure will pass the old `mediaTypeMap` to the export function. This could cause video cells to be misclassified as images.

**Fix:** Add `mediaTypeMap` to the `useCallback` dependency array:
```ts
], [
  isExporting,
  hasVideos,
  root,
  mediaRegistry,
  mediaTypeMap,          // <-- add this
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

## Info

### IN-01: `void onDismiss` suppression is a no-op code smell

**File:** `src/Toast.tsx:90`
**Issue:** `void onDismiss;` is used to suppress a potential "unused variable" lint warning. The `onDismiss` prop is received but only used in the `audio-warning` branch; in the `error` branch it is intentionally not called. The `void` expression idiom is unconventional and makes the intent unclear to a reader. The prop is already typed as required — marking it optional with `?` in the interface or simply removing the void statement (if lint is not actually flagging it) would be cleaner.

**Fix:** Remove the `void onDismiss;` statement. If a lint rule requires it to be referenced, mark the prop optional in `ToastProps` (`onDismiss?: () => void`) since it is only functionally used in one branch, or document the intent with a comment.

---

### IN-02: `makeLeaf` helper in `videoExport-audio.test.ts` omits `objectPosition` — shape mismatch with actual `LeafNode` type

**File:** `src/test/videoExport-audio.test.ts:13-34`
**Issue:** The `makeLeaf` factory sets `panX`, `panY`, `panScale`, and `effects` (fields added in later phases) but omits `objectPosition` which is defined as an optional field in `LeafNode`. This is not a bug since the field is optional, but it makes the factory inconsistent with the phase 4 test helper in `phase04-02-task1.test.tsx` (line 25) which does set `objectPosition: 'center center'`. Minor divergence that could confuse future test authors.

**Fix:** Add `objectPosition: 'center center'` to the defaults in `makeLeaf` for consistency:
```ts
objectPosition: 'center center',
```

---

### IN-03: `makeVideoEl` helper is declared but used only in a trivial self-referential test

**File:** `src/test/videoExport-audio.test.ts:36-41`
**Issue:** `makeVideoEl` was presumably created for use in `buildExportVideoElements` tests, but none of the actual behavior tests use it — the real video elements are created internally by `buildExportVideoElements`. The only test that uses it is a guard test that verifies the helper itself. This is dead test infrastructure; it adds noise without covering a real code path.

**Fix:** Remove `makeVideoEl` and its guard test unless there is a planned test that requires pre-constructed video element references.

---

_Reviewed: 2026-04-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
