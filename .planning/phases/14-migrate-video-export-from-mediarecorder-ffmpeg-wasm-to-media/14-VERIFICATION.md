---
phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
verified: 2026-04-10T21:58:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Export an MP4 from a composition with 2+ video cells (at least one audio-enabled)"
    expected: "MP4 file downloads with mixed audio from audio-enabled cells; audio plays back for the full export duration"
    why_human: "CanvasSource + AudioBufferSource pipeline requires real WebCodecs hardware support; jsdom environment cannot run VideoEncoder or OfflineAudioContext with real media"
  - test: "Export an MP4 where all cells have audio disabled"
    expected: "MP4 file has no audio track (not a silent track)"
    why_human: "AUD-06 skip-path verified in code logic but requires real video/audio tooling to confirm the muxed file truly has no audio track"
  - test: "Trigger the D-03 fallback: open in a browser that cannot encode AAC after polyfill"
    expected: "Export completes as video-only; amber 'audio-warning' toast appears after download with message 'Audio not supported in this browser — exported video only'"
    why_human: "Requires a browser environment where canEncodeAudio('aac') returns false even after registerAacEncoder() — cannot simulate in jsdom"
  - test: "Export on Firefox 130+"
    expected: "VP9 codec used (not AVC); MP4 plays back in Firefox"
    why_human: "D-12 codec selection is a navigator.userAgent branch — cannot verify actual VP9 encoding output in test environment"
---

# Phase 14: Migrate Video Export to Mediabunny — Verification Report

**Phase Goal:** Replace two-stage video export (MediaRecorder WebM + ffmpeg.wasm transcode) with Mediabunny direct MP4 encoding via WebCodecs CanvasSource + AudioBufferSource, maintaining full audio parity
**Verified:** 2026-04-10T21:58:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All automated checks pass. The implementation is substantive and fully wired. Human verification is needed to confirm actual MP4 output quality and audio mixing in a real browser environment.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | @ffmpeg/ffmpeg and @ffmpeg/util are no longer in package.json | VERIFIED | grep confirms absence; only mediabunny + @mediabunny/aac-encoder present |
| 2 | mediabunny and @mediabunny/aac-encoder are in package.json dependencies | VERIFIED | `"mediabunny": "^1.40.1"`, `"@mediabunny/aac-encoder": "^1.40.1"` |
| 3 | src/lib/transcodeToMp4.ts does not exist | VERIFIED | `ls` confirms file deleted |
| 4 | vercel.json has no COOP/COEP headers | VERIFIED | File deleted entirely |
| 5 | public/_headers has no COOP/COEP headers | VERIFIED | File deleted entirely |
| 6 | Video export uses Mediabunny CanvasSource pipeline, not MediaRecorder | VERIFIED | videoExport.ts imports CanvasSource, AudioBufferSource from mediabunny; zero MediaRecorder/captureStream references in src/ |
| 7 | Audio from audio-enabled video cells is mixed via OfflineAudioContext and encoded via Mediabunny AudioBufferSource | VERIFIED | mixAudioForExport() uses OfflineAudioContext; audioSource.add(mixedBuffer) in exportVideoGrid |
| 8 | If zero cells have audio enabled, exported MP4 has no audio track (AUD-06) | VERIFIED | hasAudioEnabledVideoLeaf guard — audioSource stays null, addAudioTrack never called |
| 9 | Audio is clipped to totalDuration (AUD-07) | VERIFIED | OfflineAudioContext created with `Math.ceil(totalDurationSeconds * SAMPLE_RATE)` samples; stop() clamped to totalDuration |
| 10 | Toast no longer shows Transcoding state | VERIFIED | ToastState = `'preparing' \| 'exporting' \| 'error' \| 'encoding' \| 'audio-warning' \| null` — no 'transcoding' |
| 11 | ExportSplitButton no longer handles transcoding stage | VERIFIED | onProgress handler only has 'preparing'/'encoding' branches; no 'transcoding' string anywhere in file |
| 12 | Firefox uses VP9 codec; Chrome uses AVC | VERIFIED | `navigator.userAgent.includes('Firefox')` → `videoCodec = isFirefox ? 'vp9' : 'avc'` |
| 13 | If AudioEncoder/AAC is unavailable, export proceeds video-only with warning (D-03) | VERIFIED | try/catch around canEncodeAudio/registerAacEncoder; onWarning?.() called; audioSource = null on failure |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/lib/videoExport.ts` | Complete Mediabunny-based video+audio export pipeline | VERIFIED | 477 lines; exports exportVideoGrid, computeLoopedTime, buildExportVideoElements, hasAudioEnabledVideoLeaf |
| `src/Editor/Toast.tsx` | ToastState with audio-warning (no transcoding) | VERIFIED | ToastState type confirmed; 'audio-warning' branch renders amber warning with dismiss button |
| `src/Editor/ExportSplitButton.tsx` | Export handler without transcoding stage | VERIFIED | audioWarningRef, onWarning callback, audio-warning toast after download — all present |
| `src/test/phase04-02-task1.test.tsx` | Updated tests for new pipeline | VERIFIED | VideoEncoder guard test replaces MediaRecorder guard; 2 new audio-warning Toast tests |
| `package.json` | mediabunny + aac-encoder deps; no ffmpeg deps | VERIFIED | Confirmed both directions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/lib/videoExport.ts | mediabunny | import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, QUALITY_HIGH, canEncodeAudio } | VERIFIED | Lines 1-9 of videoExport.ts |
| src/lib/videoExport.ts | @mediabunny/aac-encoder | import { registerAacEncoder } | VERIFIED | Line 10 of videoExport.ts |
| src/Editor/ExportSplitButton.tsx | src/lib/videoExport.ts | exportVideoGrid call at line 106 | VERIFIED | `const blob = await exportVideoGrid(...)` — 7 arguments including onWarning |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| videoExport.ts | mixedBuffer | mixAudioForExport() → OfflineAudioContext.startRendering() | Yes — decoded from real blob URLs via fetch+decodeAudioData | FLOWING |
| videoExport.ts | target.buffer | BufferTarget accumulates Mediabunny MP4 output | Yes — Mediabunny writes encoded frames | FLOWING |
| ExportSplitButton.tsx | blob | exportVideoGrid return value | Yes — Blob([target.buffer], {type:'video/mp4'}) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build compiles cleanly | npm run build | "built in 1.08s" — exit 0 | PASS |
| All 628 tests pass | npm run test -- --run | 55 test files, 628 passed, 2 skipped | PASS |
| videoExport.ts has no banned patterns | grep MediaRecorder/captureStream/transcodeToMp4/@ffmpeg | 0 matches | PASS |
| Toast has no 'transcoding' | grep transcoding Toast.tsx | 0 matches | PASS |
| ExportSplitButton has no 'transcoding' | grep transcoding ExportSplitButton.tsx | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUD-05 | 14-02-PLAN.md | MP4 video export mixes audio from all cells where audio is enabled | SATISFIED | mixAudioForExport() + AudioBufferSource.add() in exportVideoGrid |
| AUD-06 | 14-02-PLAN.md | Zero audio-enabled cells → no audio track in exported MP4 | SATISFIED | hasAudioEnabledVideoLeaf guard; addAudioTrack only called when true |
| AUD-07 | 14-02-PLAN.md | Audio clipped to total video export duration | SATISFIED | OfflineAudioContext length = ceil(totalDuration * 48000); stop() clamped to totalDuration |

**Note on traceability table:** REQUIREMENTS.md traceability maps AUD-05/06/07 to Phase 12 (the original MediaRecorder implementation). Phase 14 re-implements the same behaviors via Mediabunny. The functional requirements are fully satisfied; the traceability table was not updated to reflect Phase 14 as a re-implementation. This is a documentation-only discrepancy and does not affect goal achievement.

### Anti-Patterns Found

No blockers or stubs found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

All potential empty returns in videoExport.ts (`return null` in mixAudioForExport) are conditional guard paths, not stubs — they reflect valid no-audio conditions (AUD-06).

### Human Verification Required

#### 1. Real MP4 audio mixing playback

**Test:** Open the app in Chrome 94+. Create a composition with 2+ video cells (both audio-enabled). Set totalDuration to 5s. Click "Export Video". Open the downloaded MP4 in a media player.
**Expected:** Audio from both video cells is audible and mixed for the full 5 seconds. No audio glitches at the loop point.
**Why human:** OfflineAudioContext mixing and AudioBufferSource encoding require real hardware VideoEncoder/AudioEncoder; jsdom cannot run WebCodecs.

#### 2. AUD-06: No audio track when all cells muted

**Test:** Create a composition where every video cell has audio toggled off (speaker icon shows muted). Export video. Inspect the MP4 with `ffprobe` or open in a media player.
**Expected:** MP4 has no audio stream whatsoever (ffprobe shows only video stream).
**Why human:** Requires real MP4 binary inspection; test environment cannot produce actual encoded output.

#### 3. D-03: Audio fallback warning toast

**Test:** Find or simulate a browser where `canEncodeAudio('aac')` returns false after `registerAacEncoder()` (e.g., a browser with WebCodecs but no AAC encoder support). Export video.
**Expected:** Export completes with video-only output. An amber "Audio not supported in this browser — exported video only" toast appears after download. Clicking "OK" dismisses it.
**Why human:** D-03 fallback path requires specific browser codec support conditions that cannot be reproduced in jsdom.

#### 4. Firefox VP9 codec output

**Test:** Open the app in Firefox 130+. Export a video composition. Inspect the output file's video codec.
**Expected:** Video stream uses VP9 codec (not H.264/AVC).
**Why human:** D-12 navigator.userAgent branch is verified in source, but actual VP9 encoding requires real Firefox + WebCodecs stack.

### Gaps Summary

No gaps. All automated must-haves verified. Phase goal is structurally achieved — the two-stage MediaRecorder+ffmpeg.wasm pipeline has been fully replaced by Mediabunny CanvasSource+AudioBufferSource. Audio parity (AUD-05/06/07) is implemented via OfflineAudioContext mixing. Four items require human browser testing to confirm runtime behavior.

---

_Verified: 2026-04-10T21:58:00Z_
_Verifier: Claude (gsd-verifier)_
