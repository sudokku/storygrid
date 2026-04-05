---
phase: quick
plan: 260405-uiy
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/videoExport.ts
  - src/test/videoExport-loop.test.ts
autonomous: true
must_haves:
  truths:
    - "Shorter videos loop seamlessly in exported video when longer video determines total duration"
    - "Video export frame capture seeks shorter videos to correct looped position"
  artifacts:
    - path: "src/lib/videoExport.ts"
      provides: "Loop-aware seek logic in seekAllVideosTo"
      contains: "% video.duration"
    - path: "src/test/videoExport-loop.test.ts"
      provides: "Test verifying modulo seek for shorter videos"
  key_links:
    - from: "src/lib/videoExport.ts"
      to: "videoElementRegistry"
      via: "seekAllVideosTo iterates registered video elements"
      pattern: "video\\.duration"
---

<objective>
Fix video export flicker when a shorter video reaches the end of the longer video's duration.

Purpose: During video export, `seekAllVideosTo(timeSeconds)` seeks all video elements to the raw timestamp. When `timeSeconds` exceeds a shorter video's duration, the seek goes past the video's end, producing undefined frame data (flicker). The fix is to wrap seek times with `timeSeconds % video.duration` so shorter videos loop correctly — matching the editor's native `video.loop = true` behavior.

Output: Patched `seekAllVideosTo` with modulo-based looping, plus a unit test confirming the behavior.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/videoExport.ts
@src/lib/videoRegistry.ts
@src/lib/export.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix seekAllVideosTo to loop shorter videos via modulo arithmetic</name>
  <files>src/lib/videoExport.ts, src/test/videoExport-loop.test.ts</files>
  <behavior>
    - Test 1: When timeSeconds < video.duration, seek target equals timeSeconds (no modulo needed)
    - Test 2: When timeSeconds > video.duration (e.g., time=7s, duration=3s), seek target equals timeSeconds % duration (7 % 3 = 1s)
    - Test 3: When timeSeconds equals exact multiple of duration (e.g., time=6s, duration=3s), seek target equals 0 (not duration) — video restarts cleanly
    - Test 4: When video.duration is 0 or NaN/Infinity (edge case — metadata not loaded), seek target falls back to 0
  </behavior>
  <action>
    1. In `src/lib/videoExport.ts`, modify the `seekAllVideosTo` function:
       - Before setting `video.currentTime = timeSeconds`, compute the effective seek time:
         ```
         const dur = video.duration;
         const effectiveTime = (dur && isFinite(dur) && dur > 0)
           ? timeSeconds % dur
           : 0;
         ```
       - Replace `video.currentTime = timeSeconds` with `video.currentTime = effectiveTime`
       - Also update the early-exit comparison: compare against `effectiveTime` instead of raw `timeSeconds`

    2. Create `src/test/videoExport-loop.test.ts` that tests the modulo seek logic:
       - Extract the seek-time computation into a pure exported helper function `computeLoopedTime(timeSeconds: number, duration: number): number` at the top of videoExport.ts for testability
       - Test the four behaviors listed above
       - Use `describe('computeLoopedTime', ...)` with simple expect assertions

    The key insight: the editor uses `video.loop = true` so the browser handles looping natively during playback. But the export pipeline manually seeks frame-by-frame via `video.currentTime = X`, bypassing the browser's loop mechanism entirely. The modulo arithmetic replicates what `loop=true` would do.
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx vitest run src/test/videoExport-loop.test.ts</automated>
  </verify>
  <done>
    - `computeLoopedTime` returns correct modulo-wrapped times for all cases
    - `seekAllVideosTo` uses `computeLoopedTime` to wrap seek targets
    - Shorter videos in export will loop seamlessly instead of flickering at their end
  </done>
</task>

</tasks>

<verification>
- `npx vitest run src/test/videoExport-loop.test.ts` passes all 4 test cases
- `npx vitest run` passes (no regressions)
- Manual: export a grid with a 3s video and a 10s video; shorter video should loop smoothly in the output MP4
</verification>

<success_criteria>
- seekAllVideosTo wraps seek times using modulo of each video's individual duration
- Edge cases handled (zero/NaN/Infinity duration)
- Unit tests verify the looping math
- No regressions in existing export tests
</success_criteria>

<output>
After completion, create `.planning/quick/260405-uiy-fix-video-export-loop-flicker-when-short/260405-uiy-SUMMARY.md`
</output>
