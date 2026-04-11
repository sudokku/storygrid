---
status: awaiting_human_verify
trigger: "Fix catastrophic memory usage during 4-video export"
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Focus

hypothesis: exportVideoGrid pre-decodes ALL frames from ALL videos into memory simultaneously before encoding
test: confirmed via code review and implementation plan
expecting: replacing Phase A (decodeAllVideoSamples) + Phase B lookup with streaming samplesAtTimestamps iterator reduces peak memory from ~9.5GB to ~32MB
next_action: apply streaming pipeline refactor to src/lib/videoExport.ts

## Symptoms

expected: Exporting a 4-video story uses reasonable memory (< 500MB peak)
actual: Browser process uses 24GB, OS freezes for 10-15 seconds during export
errors: No JS error — just OS-level freeze and extreme memory usage
reproduction: Export a story grid with 4 videos (any length ~10s each)
started: After Phase 15 (Mediabunny VideoSampleSink implementation)

## Eliminated

- hypothesis: memory leak in individual bitmap allocation
  evidence: math confirms 4 × 30fps × 10s × 7.9MB = 9.5GB is the fundamental problem — not a leak but intentional pre-decode architecture
  timestamp: 2026-04-11T00:00:00Z

## Evidence

- timestamp: 2026-04-11T00:00:00Z
  checked: src/lib/videoExport.ts lines 486-562
  found: decodeAllVideoSamples (Phase A) pre-decodes all frames for all videos into DecodedFrame[] arrays in memory, then Phase B loops over pre-decoded arrays
  implication: all frames from all videos held simultaneously — catastrophic for 4× 10s 30fps videos

- timestamp: 2026-04-11T00:00:00Z
  checked: mediabunny.d.ts VideoSampleSink.samplesAtTimestamps
  found: signature is AsyncGenerator<VideoSample | null, void, unknown> — takes AnyIterable<number> of timestamps
  implication: can stream one frame per video per export frame using a lazy timestamp generator

- timestamp: 2026-04-11T00:00:00Z
  checked: src/test/videoExport-mediabunny.test.ts
  found: imports computeLoopedTime and findSampleForTime from @/lib/videoExport — both must remain exported
  implication: decodeVideoToSamples, decodeAllVideoSamples, buildFrameMapForTime, disposeAllSamples can be removed; the two exported functions must stay

## Resolution

root_cause: Two-phase architecture in exportVideoGrid pre-decodes ALL frames from ALL videos (decodeAllVideoSamples) and holds all ImageBitmaps in memory simultaneously before the encode loop begins. 4 videos × 30fps × 10s = 1200 frames × 7.9MB = ~9.5GB peak.
fix: Replace pre-decode phase with streaming pipeline using VideoSampleSink.samplesAtTimestamps(makeTimestampGen(...)) — one Input + iterator per video, advancing one frame at a time in the encode loop, releasing each bitmap immediately after encoding. Steady-state memory ~32MB.
verification: TypeScript noEmit clean, 22/22 tests pass (videoExport-mediabunny + videoExport-audio). Awaiting human confirmation that 4-video export no longer freezes the OS.
files_changed: [src/lib/videoExport.ts]
