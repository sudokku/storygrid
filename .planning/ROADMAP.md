# Roadmap: StoryGrid

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 + 5.1 INSERTED (shipped 2014-04-07) — see `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 UI Polish & Bug Fixes** — Phases 7–10 (shipped 2014-04-08) — see `.planning/milestones/v1.1-ROADMAP.md`
- 🚧 **v1.2 Effects, Overlays & Persistence** — Phases 11–14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–6 + 5.1) — SHIPPED 2014-04-07</summary>

- [x] Phase 0: Project Scaffolding (1/1 plans) — completed 2014-03-31
- [x] Phase 1: Grid Tree Engine (2/2 plans) — completed 2014-04-01
- [x] Phase 2: Grid Rendering (3/3 plans) — completed 2014-04-01
- [x] Phase 3: Media Upload & Cell Controls (3/3 plans) — completed 2014-04-01
- [x] Phase 4: Export Engine (2/2 plans) — completed 2014-04-01
- [x] Phase 5: Polish & UX (5/5 plans) — completed 2014-04-02
- [x] Phase 5.1: Mobile-First UI (3/3 plans, INSERTED) — completed 2014-04-04
- [x] Phase 6: Video Support (4/4 plans) — completed 2014-04-05

</details>

<details>
<summary>✅ v1.1 UI Polish & Bug Fixes (Phases 7–10) — SHIPPED 2014-04-08</summary>

- [x] Phase 7: Cell Controls & Display Polish (2/2 plans) — completed 2014-04-07
- [x] Phase 8: Canvas & Workspace UX (3/3 plans) — completed 2014-04-08
- [x] Phase 9: Improve cell movement and swapping (4/4 plans) — completed 2014-04-08
- [x] Phase 10: Restore Cell Controls Sizing & Stacking Fix (2/2 plans, gap closure) — completed 2014-04-08

</details>

### 🚧 v1.2 Effects, Overlays & Persistence (In Progress)

- [x] **Phase 11: Effects & Filters** — Per-cell non-destructive visual effects and preset filters (completed 2014-04-09)
- [x] **Phase 12: Per-Cell Audio Toggle** — Audio on/off per video cell in MP4 export (completed 2014-04-09)
- [x] **Phase 13: Text & Sticker Overlay Layer** — Global overlay layer for text, emoji, and image stickers (completed 2014-04-10)

## Phase Details

### Phase 11: Effects & Filters
**Goal**: Per-cell non-destructive effects rendered identically in preview canvas, PNG export, and MP4 export
**Depends on**: Phase 10 (v1.1 complete)
**Requirements**: EFF-01..EFF-10
**Plans:** 3/3 plans complete
  - [x] 11-01-PLAN.md — Effects data model + store actions (EFF-07, EFF-09)
  - [x] 11-02-PLAN.md — drawLeafToCanvas effects hook + export parity (EFF-08)
  - [x] 11-03-PLAN.md — EffectsPanel sidebar UI — presets carousel + sliders (EFF-01..EFF-06, EFF-10)

### Phase 12: Per-Cell Audio Toggle
**Goal**: Each video cell exposes an audio on/off toggle; exported MP4 mixes only enabled cells
**Depends on**: Phase 11
**Requirements**: AUD-01..AUD-09 (AUD-08 deferred to Phase 14)
**Plans:** 3/3 plans complete
  - [x] 12-01-PLAN.md — audioEnabled field on LeafNode + toggleAudioEnabled store action (AUD-01, AUD-03)
  - [x] 12-02-PLAN.md — ActionBar + Sidebar audio toggle UI (AUD-02, AUD-04)
  - [x] 12-03-PLAN.md — buildAudioGraph + exportVideoGrid audio mix (AUD-05, AUD-06, AUD-07, AUD-09)

### Phase 13: Text & Sticker Overlay Layer
**Goal**: Global overlay layer above the grid — free-positioned text, emoji stickers, and custom image stickers; renders in PNG and MP4 export
**Depends on**: Phase 12
**Requirements**: OVL-01..OVL-17
**Plans:** 5/5 plans complete
  - [x] 13-01-PLAN.md — Overlay data model + overlayStore (OVL-01, OVL-10, OVL-15, OVL-17)
  - [x] 13-02-PLAN.md — OverlayLayer rendering + drag/resize/rotate (OVL-10, OVL-11, OVL-12, OVL-13, OVL-14)
  - [x] 13-03-PLAN.md — Text overlay editing + styling controls (OVL-01..OVL-07)
  - [x] 13-04-PLAN.md — Emoji picker + custom image sticker upload (OVL-08, OVL-09)
  - [x] 13-05-PLAN.md — Export integration — PNG and MP4 (OVL-16)

### Phase 14: Migrate video export from MediaRecorder+ffmpeg.wasm to Mediabunny direct MP4 encoding

**Goal:** Replace two-stage video export (MediaRecorder WebM + ffmpeg.wasm transcode) with Mediabunny direct MP4 encoding via WebCodecs CanvasSource + AudioBufferSource, maintaining full audio parity
**Requirements**: AUD-05, AUD-06, AUD-07
**Depends on:** Phase 13
**Plans:** 2/2 plans complete

Plans:
- [x] 14-01-PLAN.md — Remove ffmpeg deps, reinstall mediabunny + aac-encoder, delete transcodeToMp4, remove COOP/COEP headers
- [x] 14-02-PLAN.md — Rewrite videoExport.ts with Mediabunny pipeline + update Toast/ExportSplitButton/tests (AUD-05, AUD-06, AUD-07)
