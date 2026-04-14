---
phase: 12-per-cell-audio-toggle
verified: 2026-04-09T23:59:00Z
status: human_needed
score: 5/5 truths verified (automated); 1 item requires human verification
re_verification: false
human_verification:
  - test: "Export a 2-cell video collage with one cell muted and one unmuted; play the resulting MP4 and confirm only the unmuted cell's audio plays"
    expected: "Audio track in MP4 contains only the unmuted cell's audio; muted cell contributes no sound"
    why_human: "Audio playback fidelity in the exported MP4 requires a human ear — cannot be verified programmatically. Documented as deferred manual verification in 12-03-SUMMARY.md."
  - test: "Export a collage where all video cells are muted; inspect the resulting MP4 with ffprobe or a media player"
    expected: "MP4 contains no audio track at all (not a silent track) per AUD-06"
    why_human: "Requires running full export pipeline in a real browser (MediaRecorder is stubbed in jsdom)."
---

# Phase 12: Per-Cell Audio Toggle — Verification Report

**Phase Goal:** Users can mark individual video cells as audio-on or audio-muted; exported MP4s mix audio only from enabled cells using a Web Audio API graph alongside the existing MediaRecorder pipeline.

**Verified:** 2026-04-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every video cell shows a speaker icon in the ActionBar; clicking it toggles muted/unmuted and the icon updates | VERIFIED | `src/Grid/ActionBar.tsx:120-140` — `mediaType === 'video'` gate, `Volume2`/`VolumeX` swap, `onClick={() => toggleAudioEnabled(nodeId)}`. Tests: 7 passing in `ActionBar.test.tsx:51` describe block. |
| 2 | The sidebar cell panel reflects the same audio toggle state as the ActionBar | VERIFIED | `src/Editor/Sidebar.tsx:322-350` — Playback subsection, same `toggleAudioEnabled` store action, same `audioEnabled` selector, matching icon vocabulary. Tests: 7 passing in `sidebar.test.tsx:208` describe block. |
| 3 | Exporting an MP4 with one cell muted produces audio from only the enabled cells | VERIFIED (code path) / HUMAN (playback fidelity) | `src/lib/videoExport.ts:155-187` `buildAudioGraph` with de-dup; `src/lib/videoExport.ts:319-358` wires `combinedStream = new MediaStream([...videoTracks, audioTrack])`; `buildExportVideoElements` sets `video.muted = !anyLeafWantsAudio`. 9 audio-graph tests passing. **Audio playback requires human ear.** |
| 4 | Exporting an MP4 with all cells muted produces a file with no audio track | VERIFIED (code path) / HUMAN (file inspection) | `hasAudioEnabledVideoLeaf` helper at `videoExport.ts:199`; when false, audio branch is skipped entirely; `combinedStream = stream` (canvas-only). `buildAudioGraph` returns `null` at `videoExport.ts:169` when `audioMediaIds.size === 0`. Tested in `videoExport-audio.test.ts` null-return describe block. |
| 5 | Audio toggle state survives undo/redo | VERIFIED | `src/store/gridStore.ts:218-226` — `toggleAudioEnabled` calls `pushSnapshot(state)` before mutating. Test: `gridStore.test.ts:224` describe block includes `it('undo restores previous audioEnabled value')`. |

**Score:** 5/5 truths verified automatically. Truth 3 has a code-path verified path but the user-facing "only enabled cell's audio plays" claim requires a human ear — routed to human verification, not flagged as a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | LeafNode with required `audioEnabled: boolean` | VERIFIED | Line 20: `audioEnabled: boolean;` (non-optional) |
| `src/lib/tree.ts` | `createLeaf()` defaults `audioEnabled: true` | VERIFIED | Line 95: `audioEnabled: true,` |
| `src/store/gridStore.ts` | `toggleAudioEnabled` action with one history snapshot | VERIFIED | Line 102 (type), 218-226 (impl); `pushSnapshot(state)` called once per toggle |
| `src/Grid/ActionBar.tsx` | Audio toggle button, video-only | VERIFIED | Lines 20-21 imports; line 46 store selector; lines 120-140 conditional render with Volume2/VolumeX |
| `src/Editor/Sidebar.tsx` | Playback subsection in SelectedCellPanel | VERIFIED | Line 8 imports; line 219 selector; lines 322-350 Playback subsection above EffectsPanel |
| `src/lib/videoExport.ts` | `buildAudioGraph`, conditional muted, lifecycle, no-audio skip | VERIFIED | Line 76 conditional mute; line 155 `buildAudioGraph` export; line 199 `hasAudioEnabledVideoLeaf`; lines 319-358 integration; lines 435/442/527 `audioCtx?.close()` in three paths |
| `src/store/gridStore.test.ts` | `toggleAudioEnabled` describe block | VERIFIED | Line 224 describe block; ≥6 tests; 11 `audioEnabled` references |
| `src/Grid/__tests__/ActionBar.test.tsx` | Audio button tests | VERIFIED | Line 51 `describe('ActionBar audio button (12-02)')` with 7 tests |
| `src/test/sidebar.test.tsx` | Playback section tests | VERIFIED | Line 208 `describe('playback section (12-02)')` with 7 tests |
| `src/test/videoExport-audio.test.ts` | Audio graph tests | VERIFIED | 3 describe blocks: null return, wiring, de-duplication; 28 `audioEnabled` references |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `gridStore.toggleAudioEnabled` | `tree.updateLeaf` | `updateLeaf(current(state.root), nodeId, { audioEnabled: !leaf.audioEnabled })` | WIRED | Confirmed at `gridStore.ts:222-224` |
| `gridStore.toggleAudioEnabled` | `pushSnapshot` | single snapshot per toggle | WIRED | `gridStore.ts:221` — one call per action body |
| `ActionBar.tsx` | `gridStore.toggleAudioEnabled` | `onClick` handler | WIRED | `ActionBar.tsx:129` `toggleAudioEnabled(nodeId)` |
| `Sidebar.tsx` | `gridStore.toggleAudioEnabled` | `onClick` handler | WIRED | `Sidebar.tsx:340` `onClick={() => toggleAudioEnabled(nodeId)}` |
| `videoExport.buildExportVideoElements` | `LeafNode.audioEnabled` | `video.muted = !anyLeafWantsAudio` | WIRED | `videoExport.ts:76` derived from `leaves.some(l => l.audioEnabled)` |
| `videoExport.buildAudioGraph` | `exportVideoGrid` | `combinedStream = new MediaStream([...videoTracks, audioTrack])` | WIRED | `videoExport.ts:339-342` |
| `videoExport.exportVideoGrid` | `audioCtx.close()` | recorder.onstop, onerror, render catch | WIRED | Three close sites at lines 435, 442, 527 (satisfies D-19 close-in-all-paths, exceeds the 2 required in Plan 03) |
| `videoExport` | No audio leak to speakers | never `source.connect(audioCtx.destination)` | WIRED | `grep audioCtx.destination` returns 0 matches (D-18 enforced) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ActionBar.tsx` audio button | `audioEnabled`, `mediaType` | `useGridStore` selectors reading `root` tree + `mediaTypeMap` | Yes (real store state from gridStore) | FLOWING |
| `Sidebar.tsx` Playback section | `audioEnabled`, `mediaType` | `useGridStore` selectors, same pattern | Yes | FLOWING |
| `videoExport.exportVideoGrid` combinedStream | `audioDestination.stream.getAudioTracks()[0]` | Real `AudioContext` + `MediaElementAudioSourceNode` graph from live video elements | Yes (graph constructed from actual HTMLVideoElements built from mediaRegistry) | FLOWING |
| `buildExportVideoElements` `video.muted` | `anyLeafWantsAudio` | `leaves.some(l => l.audioEnabled)` over tree | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Full vitest suite green | `npx vitest run` | 47 files, 567 passed, 2 skipped | PASS |
| No unconditional `video.muted = true` | `grep -c "video.muted = true" src/lib/videoExport.ts` | 0 | PASS |
| No `source.connect(audioCtx.destination)` leak | `grep -n "audioCtx.destination" src/lib/videoExport.ts` | 0 matches | PASS |
| ActionBar exposes audio button with Volume2/VolumeX | `grep "Volume2\|VolumeX" src/Grid/ActionBar.tsx` | 2 matches at lines 20-21, 136-137 | PASS |
| Sidebar Playback subsection exists | `grep "Playback" src/Editor/Sidebar.tsx` | Match at line 329 | PASS |
| `buildAudioGraph` exported | `grep "export function buildAudioGraph"` | 1 match at line 155 | PASS |
| `audioCtx?.close` in multiple paths | `grep "audioCtx?.close" src/lib/videoExport.ts` | 3 matches (onstop, onerror, render-catch) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUD-01 | 12-01 | `audioEnabled` boolean on LeafNode, default true | SATISFIED | `types/index.ts:20` + `tree.ts:95` |
| AUD-02 | 12-02 | Speaker icon in ActionBar, video-only | SATISFIED | `ActionBar.tsx:120` `{mediaType === 'video' && …}` with Volume2/VolumeX |
| AUD-03 | 12-02 | Click toggles state, icon updates | SATISFIED | `ActionBar.tsx:129` onClick + conditional icon swap; 7 tests |
| AUD-04 | 12-02 | Sidebar video cell panel exposes the toggle | SATISFIED | `Sidebar.tsx:322-350` Playback subsection with parity behavior |
| AUD-05 | 12-03 | MP4 export mixes audio via Web Audio graph | SATISFIED (code) / HUMAN (playback) | `buildAudioGraph` + `combinedStream` wired; 9 unit tests; manual ear-check flagged |
| AUD-06 | 12-03 | Zero audio-enabled cells → no audio track | SATISFIED | `hasAudioEnabledVideoLeaf` short-circuit at `videoExport.ts:323`; `buildAudioGraph` returns null when `audioMediaIds.size === 0` |
| AUD-07 | 12-03 | Audio clipped to export duration | SATISFIED | Satisfied by construction: recorder.stop on duration end terminates all tracks including the MediaStreamAudioDestinationNode audio track |
| AUD-08 | 12-01 (data-model precondition only) | Audio state persisted in saved projects / `.storygrid` files | DEFERRED (expected) | Per `12-01-PLAN.md` `<note>`, full persistence is Phase 14's responsibility; Phase 12 delivers the data-model precondition (undo/redo survival verified via test). REQUIREMENTS.md already lists AUD-08 as "Pending". **Not a Phase 12 gap.** |
| AUD-09 | 12-01 | Audio export Chrome/Firefox only | SATISFIED | No-op per plan: existing `MediaRecorder` mime-type detection gate already excludes Safari. Plan 01 `success_criteria` explicitly notes this is a no-op. |

**AUD-08 is acknowledged as deferred to Phase 14 and is not a gap for Phase 12.** REQUIREMENTS.md marks it "Pending" in the status table. All other 8 IDs are satisfied by plan artifacts.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments, no empty handlers, no stub returns, no hardcoded empty data in modified files.

- `grep "video.muted = true"` returns 0 — unconditional mute removed per Plan 03 acceptance.
- `grep "audioCtx.destination"` returns 0 — no audio leak to speakers.
- `buildAudioGraph` has real logic (Set de-dup, null-return branch, source.connect wiring).
- `toggleAudioEnabled` has real logic (findNode, type-guard, pushSnapshot, updateLeaf).

### Human Verification Required

See frontmatter `human_verification` block. Two items:

1. **Audio fidelity in exported MP4 (mixed cells)** — export a 2-cell video collage with one muted, play the MP4, confirm only the unmuted cell's audio plays. Documented as deferred in `12-03-SUMMARY.md` and `12-VALIDATION.md`. Requires human ear.
2. **No-audio-track confirmation** — export an all-muted collage and inspect the MP4 (e.g., `ffprobe`) to confirm no audio stream is present (AUD-06 assertion that the track is absent, not silent). Requires running a real browser MediaRecorder pipeline.

### Gaps Summary

No automated gaps. All 5 truths, all 10 artifacts, all 8 key links, all relevant requirements (AUD-01..07, AUD-09) are verified. AUD-08 is intentionally deferred to Phase 14 per documented scope decision and is not a Phase 12 gap.

Two human verification items remain (both anticipated and documented in Plan 03 output — audio playback fidelity cannot be verified programmatically in jsdom).

**Status: `human_needed`** — the phase is code-complete and all automated checks are green, but the audio playback claim requires a human ear before the phase can be declared fully passed.

---

_Verified: 2026-04-09_
_Verifier: Claude (gsd-verifier)_
