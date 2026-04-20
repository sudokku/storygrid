---
phase: 33-ios-safari-video-compatibility-fix-export-codec-pre-flight-v
plan: "03"
subsystem: video-export
tags: [mediabunny, webcodecs, ios-safari, audiocontext, codec-preflight, tdd]

requires:
  - phase: 33-ios-safari-video-compatibility-fix-export-codec-pre-flight-v
    provides: plan-01 audioEnabled default false and detectAudioTrack accuracy

provides:
  - Runtime codec pre-flight via getFirstEncodableVideoCodec replacing UA sniff
  - AudioContext pre-created synchronously before first await in exportVideoGrid
  - mixAudioForExport accepts caller-provided AudioContext to avoid re-creation
  - User-visible error thrown when no video encoder found in browser

affects:
  - video-export
  - ios-safari-compatibility
  - audio-mixing

tech-stack:
  added: []
  patterns:
    - "D-01: getFirstEncodableVideoCodec(['avc','vp9','av1']) priority order replaces UA sniff"
    - "D-04A: AudioContext pre-created synchronously before first await in gesture handler"
    - "shouldCloseCtx ownership pattern: caller passes context, callee tracks whether it owns close responsibility"
    - "TDD RED/GREEN cycle for export pipeline changes: stub canvas getContext in jsdom tests"

key-files:
  created:
    - src/test/videoExport-codec.test.ts
  modified:
    - src/lib/videoExport.ts

key-decisions:
  - "Codec priority order is ['avc','vp9','av1'] — iOS Safari natively supports AVC, resolves first without UA sniff"
  - "AudioContext pre-creation wrapped in try/catch: failure is non-fatal (proceeds video-only per D-03 pattern)"
  - "gestureAudioContext.close() in finally uses non-awaited call (fire-and-forget) — consistent with existing pattern"
  - "Canvas mock in jsdom tests uses vi.spyOn(document, 'createElement') with per-element getContext stub to bypass jsdom canvas limitation"

requirements-completed:
  - D-01
  - D-04A

duration: 7min
completed: "2026-04-20"
---

# Phase 33 Plan 03: iOS Safari Video Compatibility — Codec Pre-flight Summary

**Runtime codec pre-flight via `getFirstEncodableVideoCodec(['avc','vp9','av1'])` replacing UA sniff, and synchronous `AudioContext` pre-creation before first `await` to preserve iOS Safari user gesture window.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-20T10:34:22Z
- **Completed:** 2026-04-20T10:41:40Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Removed `isFirefox`/`navigator.userAgent` UA sniff completely from `videoExport.ts`
- Added `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {width:1080, height:1920, bitrate})` as the codec selection mechanism — iOS Safari returns 'avc' natively without any UA detection
- Added null-return guard that throws `'No supported video encoder found in this browser.'` giving users a clear, actionable error
- Pre-created `gestureAudioContext` synchronously before the first `await getFirstEncodableVideoCodec(...)` call, ensuring the iOS Safari user gesture window is not invalidated
- Refactored `mixAudioForExport` to accept a `providedCtx` parameter with `shouldCloseCtx` ownership tracking — caller-owned contexts are not closed by the callee
- All 3 TDD tests GREEN: null-codec error path, codec call argument verification, AudioContext ordering before first await

## Task Commits

1. **Task 1: Create videoExport-codec.test.ts with failing RED tests** - `0cdcac1` (test)
2. **Task 2: Implement codec pre-flight and AudioContext pre-creation** - `8ec2814` (feat)

## Files Created/Modified

- `src/test/videoExport-codec.test.ts` — New test file with D-01 and D-04A tests; includes canvas stub for jsdom compatibility
- `src/lib/videoExport.ts` — Removed UA sniff; added `getFirstEncodableVideoCodec` import and await; added `gestureAudioContext` pre-creation; added `providedCtx`/`shouldCloseCtx` to `mixAudioForExport`

## Decisions Made

- Codec priority `['avc', 'vp9', 'av1']`: AVC first because iOS Safari supports it natively and will resolve immediately. VP9 second for Firefox. AV1 third as future-proof fallback.
- `gestureAudioContext` creation wrapped in try/catch: if `AudioContext` constructor throws (e.g., browser restriction), audio mixing is skipped gracefully rather than aborting export.
- Canvas mock approach in tests: `vi.spyOn(document, 'createElement')` intercepts `'canvas'` tag and stubs `getContext` to return a non-null fake context. This allows the codec pre-flight code path to be reached without requiring the optional `canvas` npm package in jsdom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added canvas mock to test file for jsdom compatibility**
- **Found during:** Task 1/2 (test verification)
- **Issue:** `document.createElement('canvas').getContext('2d')` returns `null` in jsdom (no `canvas` npm package), causing the function to throw `'Canvas 2D context not available'` before reaching the codec pre-flight code. Tests could not pass without bypassing this guard.
- **Fix:** Added `stubCanvas()` helper in the test file that spies on `document.createElement` and returns a fake `CanvasRenderingContext2D` for canvas elements. Called in `beforeEach` for both describe blocks.
- **Files modified:** `src/test/videoExport-codec.test.ts`
- **Verification:** All 3 tests GREEN after adding stub.
- **Committed in:** `8ec2814` (Task 2 feat commit, test file was amended alongside implementation)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing test infrastructure for jsdom canvas)
**Impact on plan:** Required to make tests functional in jsdom environment. No scope creep; the canvas stub is test-only and does not affect production code.

## Issues Encountered

- jsdom's `HTMLCanvasElement.getContext()` is not implemented without the optional `canvas` npm package. This caused the codec pre-flight tests to fail with an unrelated error before reaching the assertions. Resolved by adding a lightweight canvas stub in `beforeEach`.

## Known Stubs

None — all code paths are wired to real implementations.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/test/videoExport-codec.test.ts` exists: FOUND
- `src/lib/videoExport.ts` modified: FOUND
- Commit `0cdcac1` (RED tests): FOUND
- Commit `8ec2814` (GREEN implementation): FOUND
- `grep -c 'isFirefox' src/lib/videoExport.ts` → 0: PASS
- `grep -c 'getFirstEncodableVideoCodec' src/lib/videoExport.ts` → 2: PASS
- `grep -c 'gestureAudioContext' src/lib/videoExport.ts` → 5: PASS
- `grep -c 'shouldCloseCtx' src/lib/videoExport.ts` → 2: PASS
- `npx vitest run src/test/videoExport-codec.test.ts` → 3/3 PASS
- `npx tsc --noEmit` → clean

## Next Phase Readiness

- D-01 and D-04A requirements satisfied; iOS Safari codec selection now uses runtime pre-flight
- Plan 02 (wave 1) runs in parallel — no dependency conflict
- Phase 33 complete after waves 1 and 2 merge

---
*Phase: 33-ios-safari-video-compatibility-fix-export-codec-pre-flight-v*
*Completed: 2026-04-20*
