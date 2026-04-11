# Project Research Summary

**Project:** StoryGrid v1.3 — Filters, Video Tools & Playback
**Domain:** Browser-based Instagram Story collage editor — incremental feature milestone
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

StoryGrid v1.3 is a well-scoped incremental milestone adding seven features to an existing, working codebase: Instagram-style named presets, boomerang per-cell, video trimming per-cell, live audio preview, playback UI redesign, auto-mute detection for no-audio videos, and breadth-first multi-file drop. The critical research finding is that **zero new npm dependencies are required** — every feature is achievable with browser APIs already present in the target browser matrix (Chrome 90+, Firefox 90+, Safari 15+) and the Mediabunny pipeline already integrated in v1.2. This dramatically reduces integration risk compared to a typical new-feature milestone.

The recommended approach is to build in strict dependency order starting with the data model (four new `LeafNode` fields) before any feature work begins, then tackle the four low-complexity, high-value P1 features first (presets, auto-mute, breadth-first drop, playback UI), then the two MEDIUM-complexity P2 features (live audio, trimming). Boomerang is re-classified as P3/v1.4 due to its HIGH implementation complexity, non-trivial GPU memory management, and tight coupling with the trimming feature that precedes it.

The primary risks are: (1) boomerang's frame-buffer memory pressure on long clips requiring a hard clip-length guard; (2) `AudioContext` autoplay policy violations that silence live audio on first play unless the context is created strictly inside the play-button click handler; (3) Mediabunny timestamp monotonicity — export frame timestamps must always increase even when boomerang source positions reverse; and (4) CSS filter order non-commutativity breaking preset rendering if any code constructs filter strings outside `effectsToFilterString()`. Each has a clear prevention strategy documented in PITFALLS.md.

## Key Findings

### Recommended Stack

No new packages are introduced in v1.3. The existing stack (Vite 8 + React 18 + TypeScript 5.8 + Zustand 5 + Immer 10 + Tailwind CSS v3.4 + Mediabunny) handles all seven features. The browser APIs newly exercised are: `CanvasRenderingContext2D.filter` for additional CSS functions (`sepia()`, `grayscale()`, `hue-rotate()`) already supported in all target browsers; `AudioContext.createMediaElementSource()` for live audio preview; and `HTMLMediaElement.audioTracks` / `mozHasAudio` / `AudioContext.decodeAudioData()` for audio track detection.

**Core technologies in play:**
- `CanvasRenderingContext2D.filter` — CSS filter extension for sepia, grayscale, hue-rotate — supported in Chrome 90+, Firefox 90+, Safari 15+; HIGH confidence
- `AudioContext` + `MediaElementAudioSourceNode` — live audio preview routing; one shared context, one node per video element; already partially used in export path
- `Mediabunny VideoSampleSink.samples(startSecs, endSecs)` — bounded frame iteration for trim and boomerang export; MEDIUM confidence (API shape confirmed, TypeScript types unverified)
- `createImageBitmap()` + rAF frame buffer — boomerang preview; already imported in `videoExport.ts`
- `playbackRate = -1` — explicitly NOT viable; not supported in Chrome or Firefox (Chromium #46939, Firefox #1468019); frame-buffer reversal is the only cross-browser approach

**What NOT to add:** Any LUT library, `HTMLMediaElement.audioTracks` as primary audio detection (behind flags in Chrome/Firefox), `playbackRate = -1` for boomerang, separate `AudioContext` per cell, `MediaRecorder` for boomerang recording.

### Expected Features

**Must have — P1 (table stakes, low complexity):**
- **Instagram-style named presets** — users know Clarendon, Juno, Lark by name; generic labels read as unfinished; only preset definitions change, not the pipeline
- **Auto-mute detection + locked toggle** — grayed-out non-interactive VolumeX is standard UX; clickable mute on a no-audio video is confusing
- **Breadth-first multi-file drop** — dropping 4 files should produce a 2x2 grid, not an L-shape; pure algorithm change in `autoFillCells()`
- **Playback UI visual redesign** — polish only; no new controls; Tailwind class changes in `PlaybackTimeline.tsx`

**Should have — P2 (differentiators, medium complexity):**
- **Live audio preview** — hear actual per-cell audio mix during playback; `MediaElementAudioSourceNode` per unmuted cell; AudioContext lifecycle must be managed carefully
- **Video trimming per-cell** — clip best 3s of 30s clip without leaving editor; `trimStart`/`trimEnd` on `LeafNode`; sidebar drag-handle UI; export integration via Mediabunny bounded frame iteration

**Defer to v1.4 — P3 (high complexity, memory-intensive):**
- **Boomerang per-cell** — depends on trimming being stable; frame-buffer memory pressure on long clips; GPU memory management non-trivial
- Per-cell volume slider, waveform visualization, boomerang with live camera capture

**The six recommended Instagram presets** (sourced from picturepan2/instagram.css): Clarendon, Juno, Lark, Nashville, Lo-fi, Inkwell. PITFALLS.md notes CSS filters cannot replicate LUT-based tone curves — name presets with their own identity rather than Instagram trademarks to avoid user comparison disappointment.

### Architecture Approach

All v1.3 changes integrate into the existing architecture without structural changes. The single-draw-path invariant (`drawLeafToCanvas()` in `src/lib/export.ts`) is preserved — new filter functions flow through `effectsToFilterString()` as before. The `videoElementRegistry` (module-level `Map`, not Zustand) is the shared integration point for both the new live audio hook and the trim/boomerang rAF changes. A new `audioNodeRegistry` and lazy `liveAudioContext` singleton extend the same module-level registry pattern already established in `src/lib/videoRegistry.ts`.

**Major components touched:**
1. **`src/types/index.ts` + `src/lib/tree.ts`** — data model foundation; four new `LeafNode` fields (`boomerang`, `trimStart`, `trimEnd`, `hasAudioTrack`) with defaults in `createLeaf()`; two new tree helpers (`getAllLeavesBFS`, `getNodeDepth`)
2. **`src/lib/effects.ts` + `src/Editor/EffectsPanel.tsx`** — preset redesign; `PresetName` union type renamed; `PRESET_VALUES` updated; `effectsToFilterString()` extended for `sepia()`, `hue-rotate()`, `grayscale()`
3. **`src/lib/videoExport.ts`** — `makeTimestampGen` extended for trim offset and boomerang triangle-wave; new `computeBoomerangTime()` pure helper; two timestamp concepts kept separate (`sourceTimestamp` vs. `exportTimestamp`)
4. **`src/hooks/usePlaybackAudio.ts`** — new hook mounted once from `EditorShell`; creates `AudioContext` on first play gesture; wires `MediaElementAudioSourceNode` per unmuted video cell; tears down on pause
5. **`src/lib/detectAudioTrack.ts`** — new module; async detection via `loadedmetadata`; combined `mozHasAudio || audioTracks.length` check; safe fallback `resolve(true)` on ambiguous result
6. **`src/lib/media.ts`** — `autoFillCells()` rewritten to BFS traversal + depth-based alternating H/V splits

**Known v1.3 limitation:** `buildVideoStreams` creates one Mediabunny decoder `Input` per unique `mediaId`. Boomerang and trim for a `mediaId` shared across two cells apply uniformly. Per-cell trim for shared mediaIds is deferred to a future milestone.

### Critical Pitfalls

1. **CSS filter order non-commutativity** — `brightness(1.2) saturate(1.5)` differs visually from `saturate(1.5) brightness(1.2)`. All filter strings must flow through `effectsToFilterString()` in `effects.ts`; never construct filter strings inline. Lock contract tests before tuning preset values. *Phase: preset redesign.*

2. **Boomerang export timestamp monotonicity** — MP4 `exportTimestamp` (`i / FPS`) must always increase monotonically even when boomerang `sourceTimestamp` reverses. Conflating these two concepts causes Mediabunny to receive non-monotonic PTS values and produce corrupt output. Document them separately; add an assertion in the export loop. *Phase: boomerang export.*

3. **`AudioContext` autoplay suspension** — a context created outside a user gesture starts in `suspended` state and produces silence. Create the `AudioContext` synchronously inside the play button click handler; call `ctx.resume()` on every play press (Safari requires this unconditionally). Never create in `useEffect` or module initializer. *Phase: live audio preview.*

4. **Rapid play/pause creates orphaned `MediaElementAudioSourceNode`s** — this is a singleton per `HTMLVideoElement`; connecting the same element twice throws `InvalidStateError`. Create nodes once per element, gate on/off via `gainNode.gain` or `video.muted`, never by connect/disconnect cycling. *Phase: live audio preview.*

5. **Snapshot field compatibility + Immer draft order** — history snapshots predate new fields; restored snapshots have `undefined` for new fields. Use `leaf.boomerang ?? false` everywhere. Follow strict action order: `current(state.root)` -> guard -> `pushSnapshot` -> mutate. *Phase: every phase adding new fields or store actions.*

## Implications for Roadmap

Based on dependency order from ARCHITECTURE.md and complexity tiers from FEATURES.md:

### Phase 1: Data Model Foundation
**Rationale:** Every other v1.3 feature depends on new `LeafNode` fields; build this first to unblock all subsequent phases and establish snapshot compatibility patterns.
**Delivers:** Four new `LeafNode` fields with defaults in `createLeaf()`; two new tree helpers (`getAllLeavesBFS`, `getNodeDepth`); new store actions (`toggleBoomerang`, `setTrimPoints`, audio track detection action); `computeBoomerangTime()` pure helper unit-tested; snapshot compatibility verified.
**Addresses:** Snapshot compatibility pitfall (Pitfall 11); Immer draft ordering pitfall (Pitfall 12).

### Phase 2: Instagram-Style Named Presets
**Rationale:** Self-contained; highest user-visible impact per effort unit; no cross-feature dependencies; unblocks visual validation of the effects pipeline.
**Delivers:** Six named presets replacing the six generic ones; `effectsToFilterString()` extended for `sepia()`, `hue-rotate()`, `grayscale()`; contract tests updated.
**Uses:** `CanvasRenderingContext2D.filter` (already in pipeline); `picturepan2/instagram.css` filter values.
**Avoids:** CSS filter order non-commutativity (Pitfall 1) — lock test contracts before tuning values; CSS-only vs. LUT fidelity gap (Pitfall 2) — use non-trademark preset names.

### Phase 3: Auto-Mute Detection
**Rationale:** Low complexity; depends only on Phase 1 data model; prevents a confusing UX state for video-heavy users; unblocks live audio preview which relies on `audioEnabled` state being trustworthy.
**Delivers:** `detectAudioTrack.ts` module; async detection on upload via `loadedmetadata`; locked VolumeX toggle (`opacity-40`, `cursor-not-allowed`, `pointer-events: none`) when `hasAudioTrack === false`.
**Avoids:** Audio track detection timing pitfall (Pitfall 9) — must run inside `loadedmetadata`, not synchronously after `createObjectURL`.

### Phase 4: Breadth-First Multi-File Drop
**Rationale:** Self-contained pure algorithm change after Phase 1; high UX impact on first-use flow for users dropping multiple files.
**Delivers:** `getAllLeavesBFS()` and `getNodeDepth()` in `tree.ts`; `autoFillCells()` rewritten to BFS traversal; alternating H/V splits by depth; BFS targets only `mediaId === null` leaves — no restructuring of filled cells.
**Avoids:** BFS drop + existing tree nesting pitfall (Pitfall 10) — only split empty leaves, never occupied ones.

### Phase 5: Playback UI Visual Redesign
**Rationale:** Pure CSS/layout change with no deps; deliver alongside other P1 features so all four ship together; no new controls reduces scope creep risk.
**Delivers:** Redesigned `PlaybackTimeline.tsx` — semi-transparent dark overlay, 2–3px scrubber track, 10–14px thumb with scale-on-drag, monospace time counter, 40–44px play/pause button.
**Uses:** Tailwind CSS v3.4 only; no new libraries.

### Phase 6: Live Audio Preview
**Rationale:** P2 MEDIUM complexity; depends on auto-mute detection (Phase 3) being correct so `audioEnabled` state is reliable; ships before trimming since both features interact with playback state.
**Delivers:** `usePlaybackAudio.ts` hook mounted once from `EditorShell`; shared `AudioContext` singleton created on play gesture; per-cell `MediaElementAudioSourceNode` wired to `ctx.destination`; audio torn down on pause.
**Avoids:** AudioContext autoplay suspension (Pitfall 7); orphaned AudioNode proliferation (Pitfall 8).

### Phase 7: Video Trimming Per-Cell
**Rationale:** P2 MEDIUM-HIGH complexity; depends on Phase 1 data model and Phase 6 rAF loop patterns being stable (both touch `LeafNode.tsx`); highest user value for video-heavy workflows.
**Delivers:** Sidebar trim panel with dual drag handles; `trimStart`/`trimEnd` on `LeafNode`; `recomputeTotalDuration()` trim-aware; export integration via `makeTimestampGen` offset; `effectiveDuration` correctly drives master timeline max.
**Avoids:** Trim total duration mismatch (Pitfall 6); trim GOP alignment latency (Pitfall 5) — accepted cost, no pre-seek workaround.

### Phase Ordering Rationale

- Phase 1 (data model) must precede all others due to field dependencies.
- Phases 2–5 are largely independent after Phase 1 and could be parallelized; sequencing them by value/risk for single-developer execution.
- Phase 6 (live audio) precedes Phase 7 (trimming) because both modify `LeafNode.tsx`'s rAF loop and playback teardown; having the audio hook stable first simplifies trimming integration.
- Boomerang excluded from this roadmap (deferred to v1.4) — depends on Phase 7 trimming being stable; adds significant GPU memory management complexity; `makeTimestampGen` being modified by Phase 7 creates unnecessary merge conflict risk if boomerang is attempted simultaneously.

### Research Flags

Phases requiring verification during execution:
- **Phase 6 (Live Audio):** `MediaElementAudioSourceNode` single-connection constraint needs explicit cross-browser testing on Safari 15; Safari's `ctx.resume()` behavior on every play press — verify in-browser before shipping.
- **Phase 7 (Trimming):** Mediabunny `VideoSampleSink.samples(startSecs, endSecs)` parameter types are MEDIUM confidence. Read actual Mediabunny `.d.ts` files before writing export integration.

Phases with standard, well-documented patterns (no additional research needed):
- **Phase 2 (Presets):** CSS filter values sourced from authoritative open-source library; browser support HIGH from MDN.
- **Phase 3 (Auto-mute):** `loadedmetadata` async pattern already established in codebase (`captureVideoThumbnail`).
- **Phase 4 (BFS drop):** Pure tree algorithm; no browser API uncertainty; unit-testable as a pure function.
- **Phase 5 (Playback UI):** Tailwind-only; no API surface changes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all browser APIs verified on MDN and caniuse for target matrix |
| Features | HIGH | Filter values from authoritative CSS source; audio/video detection from MDN + VideoJS issue tracker |
| Architecture | HIGH | Derived from direct codebase reading, not inference; all integration points verified against actual source files |
| Pitfalls | HIGH | Browser bug tracker references (Chromium #46939, Firefox #1468019); W3C filter spec for order non-commutativity; MDN autoplay policy |

**Overall confidence:** HIGH

### Gaps to Address

- **Mediabunny `VideoSampleSink` TypeScript types:** API shape confirmed from docs but TypeScript parameter names and return types are MEDIUM confidence. Read Mediabunny's `.d.ts` files at the start of Phase 7.
- **Safari `AudioContext` behavior:** Safari 15's autoplay policy requires `ctx.resume()` on every play press even when `ctx.state === 'running'`. Verify in-browser at the start of Phase 6.
- **Chrome audio detection check:** FEATURES.md mentions `webkitAudioDecodedByteCount` as more reliable than `audioTracks` for some Chrome formats. Validate the combined check order (`mozHasAudio || audioTracks.length || webkitAudioDecodedByteCount`) before shipping Phase 3.
- **`computeBoomerangTime()` triangle-wave math:** Write and test this pure function in Phase 1 so it is a verified primitive available for both preview and export. Do not defer to the boomerang feature phase.

## Sources

### Primary (HIGH confidence)
- picturepan2/instagram.css (raw distributed file) — Clarendon, Juno, Lark, Nashville, Lo-fi, Inkwell filter values
- MDN — `CanvasRenderingContext2D.filter`, `AudioContext.createMediaElementSource`, `HTMLMediaElement.audioTracks`, Web Audio API autoplay policy
- Chromium bug #46939 — negative `playbackRate` unsupported in Chrome
- Mozilla bug #1468019 — negative `playbackRate`, no implementation plans
- W3C filter-effects spec — CSS filter application order is sequential left-to-right
- StoryGrid codebase (direct reading) — `src/lib/effects.ts`, `src/lib/export.ts`, `src/lib/videoExport.ts`, `src/lib/media.ts`, `src/lib/tree.ts`, `src/store/gridStore.ts`, `src/types/index.ts`, `src/Grid/LeafNode.tsx`, `src/Editor/PlaybackTimeline.tsx`

### Secondary (MEDIUM confidence)
- Mediabunny docs — `VideoSampleSink.samples(startSecs, endSecs)` bounded iteration confirmed; TypeScript type names unverified
- Paul Kinlan — boomerang frame-buffer approach: https://paul.kinlan.me/simple-boomerang-video/
- Cloudinary boomerang blog — forward + reversed frame concatenation pattern
- VideoJS GitHub issue #7096 — browser-specific `audioTracks` behavior differences

### Tertiary (LOW confidence)
- caniuse — `HTMLMediaElement.audioTracks` behind flags in Chrome/Firefox; conclusion is HIGH confidence, specific flag names in current browser versions are LOW

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
