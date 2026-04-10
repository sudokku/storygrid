---
phase: quick-260410-aay
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/videoExport.ts
autonomous: true
requirements:
  - FIX-avc1-warning
must_haves:
  truths:
    - "Chrome console no longer emits the avc1 codec description change warning during video export"
    - "Video export still produces a valid MP4 in Chrome 130+"
    - "Firefox and Safari fallback paths are unaffected"
  artifacts:
    - path: "src/lib/videoExport.ts"
      provides: "Updated mimeTypes array and comment block with avc3 codec string"
      contains: "avc3.42E01E"
  key_links:
    - from: "mimeTypes array (line 273)"
      to: "MediaRecorder.isTypeSupported() loop (line 281)"
      via: "same codec string used for both the preferred entry and the support check"
      pattern: "avc3\\.42E01E"
---

<objective>
Replace `avc1.42E01E` with `avc3.42E01E` in the MediaRecorder codec preference list to suppress the Chrome console warning about H.264 codec description changes.

Purpose: With `avc1`, SPS/PPS parameter sets are stored once in the MP4 `moov` box header and must remain constant. Chrome warns when the encoder regenerates them (which can happen at stream start even on a fixed-resolution canvas). With `avc3`, SPS/PPS are embedded in-band per fragment, making per-fragment changes valid by design. One-line fix, zero functional change.

Output: Updated `src/lib/videoExport.ts` with `avc3.42E01E` in both the mimeTypes array entry and the comment block above it.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/lib/videoExport.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap avc1 to avc3 in mimeTypes array and update comment block</name>
  <files>src/lib/videoExport.ts</files>
  <action>
    Make two changes in `src/lib/videoExport.ts`:

    1. Line 249 (comment): Update the OUTPUT FORMAT comment to read `avc3.42E01E` instead of `avc1.42E01E`:
       ```
       //   1. video/mp4;codecs=avc3.42E01E  — Chrome 130+ supports H.264 MP4 directly
       ```
       Also update the description text for why avc3 is preferred. Replace the existing line 250-251 description with:
       ```
       //      via MediaRecorder. avc3 embeds SPS/PPS in-band per fragment, suppressing
       //      the Chrome codec-description-change warning. Same H.264 CBP L3.0 output.
       ```

    2. Line 274 (mimeTypes array): Change the first entry from:
       ```typescript
       'video/mp4;codecs=avc1.42E01E', // H.264 MP4 — Chrome 130+
       ```
       to:
       ```typescript
       'video/mp4;codecs=avc3.42E01E', // H.264 MP4 — Chrome 130+ (avc3: in-band SPS/PPS, suppresses codec-description-change warning)
       ```

    The `isTypeSupported()` detection loop on line 281 and all other recording logic remain untouched. No other file references `avc1` or `avc3`.
  </action>
  <verify>
    <automated>grep -n "avc3.42E01E" /Users/radu/Developer/storygrid/src/lib/videoExport.ts && ! grep -n "avc1" /Users/radu/Developer/storygrid/src/lib/videoExport.ts</automated>
  </verify>
  <done>
    - `src/lib/videoExport.ts` contains `avc3.42E01E` in both the mimeTypes array and the comment block
    - No remaining `avc1` references anywhere in the file
    - `npm run build` completes without TypeScript errors
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser codec support | MediaRecorder.isTypeSupported() gates use of avc3 — no untrusted input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-aay-01 | Denial of Service | avc3 not supported on older Chrome | accept | isTypeSupported() fallback chain handles this; avc3 added in Chrome 130 alongside avc1 |
</threat_model>

<verification>
1. Run `npm run build` — must exit 0 with no TypeScript errors
2. Manual smoke test: open app in Chrome 130+, export a video, confirm no "codec description change" warning in DevTools console
3. Confirm MP4 downloads and plays correctly
</verification>

<success_criteria>
- `src/lib/videoExport.ts` uses `avc3.42E01E` (not `avc1`) as the first mimeTypes entry
- No `avc1` string anywhere in the file
- Build passes clean
- Chrome DevTools shows no "avc1 codec description" warning during video export
</success_criteria>

<output>
After completion, create `.planning/quick/260410-aay-fix-avc1-codec-description-change-warnin/260410-aay-SUMMARY.md`
</output>
