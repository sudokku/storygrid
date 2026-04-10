---
phase: quick-260410-obm
verified: 2026-04-10T00:00:00Z
status: human_needed
score: 5/6 must-haves verified
human_verification:
  - test: "Export a video composition in Chrome — observe the full toast sequence"
    expected: "Toast progresses Preparing -> Encoding N% -> Transcoding N% -> file downloads as storygrid-TIMESTAMP.mp4"
    why_human: "Cannot drive MediaRecorder + ffmpeg.wasm transcode in a static grep check; requires a live browser with a real composition"
  - test: "Open the downloaded .mp4 in macOS QuickTime Player"
    expected: "File plays without error; no 'moov atom not found' dialog"
    why_human: "QuickTime compatibility requires actual playback verification; the -movflags +faststart flag is present in the ffmpeg args but only a real transcode+open confirms the moov atom placement"
---

# Quick Task 260410-obm: Verification Report

**Task Goal:** WebM MediaRecorder + ffmpeg transcode to QuickTime-compatible MP4
**Verified:** 2026-04-10T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MediaRecorder only attempts WebM MIME types (no video/mp4 variants) | VERIFIED | `videoExport.ts` lines 276-280: mimeTypes array contains exactly `video/webm;codecs=vp9`, `video/webm;codecs=vp8`, `video/webm` — zero mp4 entries |
| 2 | After MediaRecorder produces a WebM blob, ffmpeg.wasm transcodes it to H.264 MP4 | VERIFIED | `videoExport.ts` lines 466-478: `recorder.onstop` creates a WebM blob and immediately calls `transcodeWebmToMp4`; `transcodeToMp4.ts` lines 81-92: ffmpeg.exec uses `-c:v libx264 -movflags +faststart` |
| 3 | Exported MP4 has moov atom at front (faststart) and opens in macOS QuickTime Player | HUMAN NEEDED | `-movflags +faststart` is present in the ffmpeg args (`transcodeToMp4.ts` line 87); actual QuickTime compatibility requires manual playback verification |
| 4 | Toast shows 'Transcoding' stage with progress after encoding completes | VERIFIED | `Toast.tsx` line 7: `ToastState` includes `'transcoding'`; lines 53-60: renders "Transcoding N%..." spinner; `ExportSplitButton.tsx` lines 112-114: `stage === 'transcoding'` sets state and percent |
| 5 | Downloaded file is always .mp4 regardless of browser | VERIFIED | `ExportSplitButton.tsx` line 123: `const ext = 'mp4'` — unconditional string literal |
| 6 | mediabunny is not in package.json dependencies | VERIFIED | `package.json` dependencies and devDependencies scanned — no `mediabunny` entry found |

**Score:** 5/6 truths verified (1 requires human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/transcodeToMp4.ts` | ffmpeg.wasm lazy-load + WebM-to-MP4 transcode function | VERIFIED | Exists, 112 lines, exports `transcodeWebmToMp4`, singleton FFmpeg instance, CDN load from unpkg, progress handler with cleanup |
| `src/lib/videoExport.ts` | WebM-only MediaRecorder + transcoding integration | VERIFIED | Exists, 603 lines, imports and calls `transcodeWebmToMp4` in `recorder.onstop`, WebM-only mimeTypes, `onProgress` type includes `'transcoding'` |
| `src/Editor/Toast.tsx` | transcoding toast state | VERIFIED | Exists, `ToastState` type includes `'transcoding'`, renders "Transcoding N%..." block at lines 53-60 |
| `src/Editor/ExportSplitButton.tsx` | transcoding progress callback + always-.mp4 download | VERIFIED | Exists, handles `'transcoding'` stage in progress callback (lines 112-114), `ext = 'mp4'` unconditional (line 123), popover says "Exports as MP4 (H.264)" (line 221) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/videoExport.ts` | `src/lib/transcodeToMp4.ts` | `import transcodeWebmToMp4` | WIRED | Line 6: `import { transcodeWebmToMp4 } from './transcodeToMp4'`; called at line 469 |
| `src/Editor/ExportSplitButton.tsx` | `src/Editor/Toast.tsx` | `ToastState includes transcoding` | WIRED | `ToastState` type imported line 9; `'transcoding'` handled in progress callback line 112; toast rendered lines 289-294 |
| `src/lib/transcodeToMp4.ts` | `@ffmpeg/ffmpeg + @ffmpeg/util` | `FFmpeg + fetchFile` | WIRED | Lines 3-4: `import { FFmpeg } from '@ffmpeg/ffmpeg'`; `import { fetchFile } from '@ffmpeg/util'`; both packages present in `package.json` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `transcodeToMp4.ts` | `outputData` (Uint8Array from ffmpeg VFS) | `ffmpeg.readFile('output.mp4')` after `ffmpeg.exec([...])` | Yes — ffmpeg writes real transcoded bytes | FLOWING |
| `videoExport.ts` | `mp4Blob` (Blob returned to caller) | `transcodeWebmToMp4(webmBlob, ...)` resolved promise | Yes — flows from real ffmpeg output | FLOWING |
| `ExportSplitButton.tsx` | `blob` → download link | `exportVideoGrid(...)` return value | Yes — real Blob passed to `URL.createObjectURL` | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for the transcode pipeline — requires running browser + ffmpeg.wasm WASM load; not testable without a live server. TypeScript compilation is the closest static check available.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No `video/mp4` in mimeTypes | `grep -c "video/mp4" src/lib/videoExport.ts` | 0 matches | PASS |
| `mediabunny` absent from package.json | `grep mediabunny package.json` | no output | PASS |
| `transcodeWebmToMp4` exported | `grep "export async function transcodeWebmToMp4" src/lib/transcodeToMp4.ts` | found at line 56 | PASS |
| `-movflags +faststart` in ffmpeg args | `grep "movflags" src/lib/transcodeToMp4.ts` | found at line 87 | PASS |
| `ext = 'mp4'` unconditional | `grep "const ext" src/Editor/ExportSplitButton.tsx` | `const ext = 'mp4'` at line 123 | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `transcodeToMp4.ts` | 27-28 | CDN URLs use `esm` path instead of `umd` path specified in the plan | Info | The plan specified `dist/umd/ffmpeg-core.js` but the actual file uses `dist/esm/ffmpeg-core.js`; both are valid distribution formats from unpkg — the ESM variant is appropriate for a Vite ESM project and is not a functional regression |

No blocker or warning anti-patterns found. All state variables that could be stubs (`chunks`, `webmBlob`, `mp4Blob`) are populated by real data paths.

### Human Verification Required

#### 1. Full video export pipeline in Chrome

**Test:** Create a composition with at least one video cell, click Export Video, observe the toast.
**Expected:** Toast shows "Preparing...", then "Encoding N%...", then "Transcoding N%...", then dismisses. File downloads as `storygrid-TIMESTAMP.mp4`.
**Why human:** MediaRecorder and ffmpeg.wasm require a live browser environment with WASM support. The CDN load of `@ffmpeg/core@0.12.6` from unpkg must succeed at runtime.

#### 2. macOS QuickTime Player compatibility

**Test:** Open the downloaded `.mp4` in macOS QuickTime Player.
**Expected:** Video plays without any error dialog (no "The document 'storygrid-….mp4' could not be opened" or moov atom warning).
**Why human:** The `-movflags +faststart` flag is correctly present in the ffmpeg exec args, but only an actual transcode-and-open confirms the moov atom is placed at the front of the container.

### Gaps Summary

No functional gaps found. All code paths are correctly implemented and wired. The single human verification item (QuickTime compatibility) is a runtime behavior check — the static implementation evidence (`-movflags +faststart`, `libx264`, `yuv420p`) is all present and correct.

---

_Verified: 2026-04-10T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
