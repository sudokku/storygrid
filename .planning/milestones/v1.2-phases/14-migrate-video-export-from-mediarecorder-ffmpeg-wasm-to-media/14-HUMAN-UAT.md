---
status: partial
phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
source: [14-VERIFICATION.md]
started: 2026-04-10T21:55:00Z
updated: 2026-04-10T21:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real MP4 audio mixing playback
expected: Audio from multiple video cells with audioEnabled=true is mixed and clearly audible when the exported MP4 is played back in Chrome 94+ (or any modern browser/media player)
result: [pending]

### 2. AUD-06: No audio track when all cells muted
expected: When all video cells have audioEnabled=false (or there are no video cells), the exported MP4 contains no audio stream — confirmed via ffprobe or media player showing no audio track
result: [pending]

### 3. D-03: Audio fallback warning toast
expected: In a browser where AAC encoding is unavailable even after the @mediabunny/aac-encoder polyfill, the export proceeds as video-only and an amber "audio-warning" toast is displayed to the user
result: [pending]

### 4. Firefox VP9 codec
expected: A video exported in Firefox uses the VP9 codec (not AVC/H.264) — confirmed via ffprobe or browser dev tools showing video/webm;codecs=vp9 encoding
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
