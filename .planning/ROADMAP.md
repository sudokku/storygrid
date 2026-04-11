# Roadmap: StoryGrid

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 + 5.1 INSERTED (shipped 2014-04-07) — see `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 UI Polish & Bug Fixes** — Phases 7–10 (shipped 2014-04-08) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Effects, Overlays & Persistence** — Phases 11–16 (shipped 2026-04-11) — see `.planning/milestones/v1.2-ROADMAP.md`
- 🔄 **v1.3 Filters, Video Tools & Playback** — Phases 17–21 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–6 + 5.1) — SHIPPED 2026-04-07</summary>

- [x] Phase 0: Project Scaffolding (1/1 plans) — completed 2026-03-31
- [x] Phase 1: Grid Tree Engine (2/2 plans) — completed 2026-04-01
- [x] Phase 2: Grid Rendering (3/3 plans) — completed 2026-04-01
- [x] Phase 3: Media Upload & Cell Controls (3/3 plans) — completed 2026-04-01
- [x] Phase 4: Export Engine (2/2 plans) — completed 2026-04-01
- [x] Phase 5: Polish & UX (5/5 plans) — completed 2026-04-02
- [x] Phase 5.1: Mobile-First UI (3/3 plans, INSERTED) — completed 2026-04-04
- [x] Phase 6: Video Support (4/4 plans) — completed 2026-04-05

</details>

<details>
<summary>✅ v1.1 UI Polish & Bug Fixes (Phases 7–10) — SHIPPED 2026-04-08</summary>

- [x] Phase 7: Cell Controls & Display Polish (2/2 plans) — completed 2026-04-07
- [x] Phase 8: Canvas & Workspace UX (3/3 plans) — completed 2026-04-08
- [x] Phase 9: Improve cell movement and swapping (4/4 plans) — completed 2026-04-08
- [x] Phase 10: Restore Cell Controls Sizing & Stacking Fix (2/2 plans, gap closure) — completed 2026-04-08

</details>

<details>
<summary>✅ v1.2 Effects, Overlays & Persistence (Phases 11–16) — SHIPPED 2026-04-11</summary>

- [x] Phase 11: Effects & Filters (3/3 plans) — completed 2026-04-09
- [x] Phase 12: Per-Cell Audio Toggle (3/3 plans) — completed 2026-04-09
- [x] Phase 13: Text & Sticker Overlay Layer (5/5 plans) — completed 2026-04-10
- [x] Phase 14: Migrate Video Export to Mediabunny (2/2 plans) — completed 2026-04-10
- [x] Phase 15: Mediabunny VideoSampleSink Decode Pipeline (2/2 plans) — completed 2026-04-11
- [x] Phase 16: Export Metrics Panel (2/2 plans) — completed 2026-04-11

</details>

### v1.3 Filters, Video Tools & Playback

- [ ] **Phase 17: Data Model Foundation** — Add `hasAudioTrack` to LeafNode; verify snapshot compatibility for all new v1.3 fields
- [ ] **Phase 18: Instagram-Style Named Presets** — Replace 6 generic presets with named Instagram-aesthetic filters; extend filter pipeline for sepia/hue-rotate/grayscale
- [ ] **Phase 19: Auto-Mute Detection & Breadth-First Drop** — Detect no-audio videos at upload; lock toggle UI; rewrite multi-file drop to BFS order
- [ ] **Phase 20: Playback UI Polish** — Tailwind-class-only visual redesign of PlaybackTimeline; no logic changes
- [ ] **Phase 21: Live Audio Preview** — Web Audio mix of unmuted video cells during editor playback via AudioContext + MediaElementAudioSourceNode

## Phase Details

### Phase 17: Data Model Foundation
**Goal**: New LeafNode fields land with defaults and snapshot compatibility verified, unblocking all v1.3 feature phases
**Depends on**: Phase 16 (last v1.2 phase)
**Requirements**: MUTE-04
**Success Criteria** (what must be TRUE):
  1. `LeafNode` has a `hasAudioTrack: boolean` field defaulting to `true` in `createLeaf()`
  2. Undo/redo correctly restores `hasAudioTrack` after a mutating action — a restored snapshot never has `undefined` for the field
  3. All existing tests pass with no regressions against prior LeafNode shape
  4. `leaf.hasAudioTrack ?? true` defensive reads are verified to never produce `undefined` on pre-existing snapshots
**Plans:** 1 plan
Plans:
- [ ] 17-01-PLAN.md — Add hasAudioTrack to LeafNode type + createLeaf + test factories; TDD tests for undo/redo + legacy snapshot

### Phase 18: Instagram-Style Named Presets
**Goal**: Users can choose from 6 named Instagram-aesthetic presets that produce visually distinct results through the existing single-draw-path pipeline
**Depends on**: Phase 17
**Requirements**: PRESET-01, PRESET-02, PRESET-03, PRESET-04
**Success Criteria** (what must be TRUE):
  1. The Effects panel shows 6 named presets: Clarendon, Lark, Juno, Reyes, Moon, Inkwell — replacing the previous generic labels
  2. Each preset produces a visually distinct result using `brightness`, `contrast`, `saturate`, `sepia`, `hue-rotate`, and/or `grayscale` CSS filter functions
  3. A cell with a preset applied and slider adjustments exports identically in canvas preview, PNG, and MP4 — no divergence between render paths
  4. Resetting a preset clears the named preset selection while leaving brightness/contrast/saturation/blur slider values unchanged
  5. Filter string construction flows exclusively through `effectsToFilterString()` — no inline filter string construction anywhere in the codebase
**Plans**: TBD
**UI hint**: yes

### Phase 19: Auto-Mute Detection & Breadth-First Drop
**Goal**: No-audio video cells show a locked non-interactive mute icon, and multi-file drops fill the grid in breadth-first order
**Depends on**: Phase 17
**Requirements**: MUTE-01, MUTE-02, MUTE-03, DROP-01, DROP-02, DROP-03
**Success Criteria** (what must be TRUE):
  1. Uploading a video with no audio stream sets `hasAudioTrack: false` on the LeafNode; uploading a video with audio leaves it `true`
  2. A no-audio video cell displays a grayed-out, non-interactive VolumeX icon in the portal ActionBar — the icon does not respond to clicks
  3. A no-audio video cell displays a grayed-out, non-interactive audio toggle in the SelectedCellPanel sidebar
  4. Dropping 4 files onto an empty canvas fills cells level by level (breadth-first) — a 2×2 grid is populated before any deeper cell is created
  5. When auto-fill must create new cells beyond existing empty ones, splits alternate H/V by node depth — even depth splits horizontal, odd depth splits vertical
  6. Dropping a single file directly onto a specific leaf cell continues to target that cell exactly
**Plans**: TBD

### Phase 20: Playback UI Polish
**Goal**: The PlaybackTimeline has a visually polished appearance aligned with contemporary story editor conventions, with zero changes to playback logic
**Depends on**: Phase 17
**Requirements**: PLAY-01, PLAY-02, PLAY-03
**Success Criteria** (what must be TRUE):
  1. The PlaybackTimeline renders a semi-transparent dark background, a refined scrubber track (2–3px height), and a thumb that scales on drag
  2. The play/pause button, scrubber, and time display are visually cohesive and legible on the editor's dark background
  3. All changes are Tailwind class modifications only — no TypeScript, event handler, store subscription, or playback logic changes
**Plans**: TBD
**UI hint**: yes

### Phase 21: Live Audio Preview
**Goal**: Users hear the per-cell audio mix through their speakers during editor playback — the same cells that are muted in the UI are silent in the preview
**Depends on**: Phase 19 (requires `hasAudioTrack` reliable from MUTE-01)
**Requirements**: LAUD-01, LAUD-02, LAUD-03, LAUD-04, LAUD-05
**Success Criteria** (what must be TRUE):
  1. Pressing play in the editor produces audible output from all unmuted video cells with detected audio tracks
  2. Audio stops when playback is paused or when the story timeline reaches its end
  3. Cells with `audioEnabled: false` or `hasAudioTrack: false` contribute no audio to the live preview mix
  4. The AudioContext is created synchronously inside the play button's click handler — audio is never silenced by the browser's autoplay policy
  5. Rapidly pausing and resuming playback does not throw `InvalidStateError` — each HTMLVideoElement is connected to at most one MediaElementAudioSourceNode per AudioContext lifetime; nodes are gated via gain rather than recreated
**Plans**: TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Data Model Foundation | 0/1 | Not started | - |
| 18. Instagram-Style Named Presets | 0/? | Not started | - |
| 19. Auto-Mute Detection & Breadth-First Drop | 0/? | Not started | - |
| 20. Playback UI Polish | 0/? | Not started | - |
| 21. Live Audio Preview | 0/? | Not started | - |
