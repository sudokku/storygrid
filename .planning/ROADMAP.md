# Roadmap: StoryGrid

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 + 5.1 INSERTED (shipped 2026-04-07) — see `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 UI Polish & Bug Fixes** — Phases 7–10 (shipped 2026-04-08) — see `.planning/milestones/v1.1-ROADMAP.md`
- 🚧 **v1.2 Effects, Overlays & Persistence** — Phases 11–14 (in progress, started 2026-04-09)

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
- [x] Phase 8: Canvas & Workspace UX (3/3 plans) — completed 2026-04-07
- [x] Phase 9: Improve cell movement and swapping (4/4 plans) — completed 2026-04-08
- [x] Phase 10: Restore Cell Controls Sizing & Stacking Fix (2/2 plans, gap closure) — completed 2026-04-08

</details>

### 🚧 v1.2 Effects, Overlays & Persistence (Phases 11–14)

- [ ] **Phase 11: Effects & Filters** — Per-cell visual effects (presets + sliders) in preview and export
- [ ] **Phase 12: Per-Cell Audio Toggle** — Audio on/off per video cell, mixed into MP4 export
- [ ] **Phase 13: Text & Sticker Overlay Layer** — Free-position text, emoji, and image sticker overlays
- [ ] **Phase 14: Project Persistence** — Auto-save, named projects, and `.storygrid` file export/import

## Phase Details

### Phase 11: Effects & Filters
**Goal**: Users can apply named filter presets and manual adjustment sliders to individual cells, with changes visible identically in the live preview, PNG export, and MP4 export.
**Depends on**: Phase 10 (v1.1 complete)
**Requirements**: EFF-01, EFF-02, EFF-03, EFF-04, EFF-05, EFF-06, EFF-07, EFF-08, EFF-09, EFF-10
**Success Criteria** (what must be TRUE):
  1. User can tap a preset (e.g., B&W, Vivid) in the sidebar and see the cell change color treatment immediately in the editor preview.
  2. User can drag a brightness, contrast, saturation, or blur slider and see the cell update in real-time; releasing the slider commits one undo entry.
  3. User can click "Reset" and the cell returns to its original unfiltered appearance.
  4. Applying a preset then moving a slider fine-tunes within the preset (preset values load into sliders).
  5. Exporting a PNG or MP4 with effects applied produces output that visually matches the in-editor preview.
**Plans**: 3 plans
Plans:
- [ ] 11-01-PLAN.md — Foundation: effects module, LeafNode type, createLeaf, store actions
- [ ] 11-02-PLAN.md — Render hook: drawLeafToCanvas ctx.filter + blur overdraw + LeafNode subscriber
- [ ] 11-03-PLAN.md — Sidebar UI: EffectsPanel with presets, sliders, reset buttons
**UI hint**: yes

**Plan-phase research flag:** Before writing filter implementation tasks, run a Safari 15 `ctx.filter` smoke test to determine whether `context-filter-polyfill` is needed or whether effects should degrade gracefully on Safari without the polyfill.

**Key pitfalls:**
- `ctx.filter` is silently ignored in Safari 15–17; must decide upfront: polyfill or graceful degradation — cannot retrofit.
- Blur filter bleeds at cell edges when combined with clip paths; draw source image `blurRadius * 2` pixels beyond the cell rect so the clip has real pixels to trim.
- CSS `filter:` on the `<canvas>` DOM element breaks WYSIWYG: preview looks correct but export is unfiltered. Apply ALL effects inside `drawLeafToCanvas()` via `ctx.filter` only.

---

### Phase 12: Per-Cell Audio Toggle
**Goal**: Users can mark individual video cells as audio-on or audio-muted; exported MP4s mix audio only from enabled cells using a Web Audio API graph alongside the existing MediaRecorder pipeline.
**Depends on**: Phase 11
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-06, AUD-07, AUD-08, AUD-09
**Success Criteria** (what must be TRUE):
  1. Every video cell shows a speaker icon in the ActionBar; clicking it toggles muted/unmuted and the icon updates.
  2. The sidebar cell panel reflects the same audio toggle state as the ActionBar.
  3. Exporting an MP4 with one cell muted produces audio from only the enabled cells.
  4. Exporting an MP4 with all cells muted produces a file with no audio track.
  5. Audio toggle state survives undo/redo.
**Plans**: TBD

**Key pitfalls:**
- This is a pipeline rewrite, not a flag: `video.muted = true` on export video elements blocks `createMediaElementAudioSourceNode()`; must set `muted = false` on audio-enabled cells before wiring the Web Audio graph (the Export button click satisfies the user-gesture requirement for AudioContext).
- `createMediaElementAudioSourceNode()` "steals" audio output from the video element; connect to both `audioCtx.destination` (for future preview) and the `MediaStreamDestinationNode` (for export capture).
- If zero cells have audio enabled, skip building the Web Audio graph entirely and pass only the canvas stream to MediaRecorder (no silent audio track).

---

### Phase 13: Text & Sticker Overlay Layer
**Goal**: Users can place, resize, rotate, and delete free-position text, emoji, and image sticker overlays on the canvas; overlays appear identically in the live preview, PNG export, and MP4 video export.
**Depends on**: Phase 12
**Requirements**: OVL-01, OVL-02, OVL-03, OVL-04, OVL-05, OVL-06, OVL-07, OVL-08, OVL-09, OVL-10, OVL-11, OVL-12, OVL-13, OVL-14, OVL-15, OVL-16, OVL-17
**Success Criteria** (what must be TRUE):
  1. User can add a text overlay, type content, change font/size/color/weight/alignment, drag it anywhere on the canvas, and see it rendered correctly in both editor and PNG export.
  2. User can open the emoji picker, select an emoji, and drag the resulting sticker to any position.
  3. User can upload a PNG or SVG file as an image sticker; the sticker is draggable, resizable via corner handle, and rotatable via top handle.
  4. User can reorder overlays front-to-back via Bring Forward / Send Backward; the visual stacking in preview matches the exported order.
  5. Clicking a cell clears overlay selection; clicking an overlay clears cell selection (mutual exclusion is enforced).
**Plans**: TBD
**UI hint**: yes

**Key pitfalls:**
- Overlay coordinates must be stored in canvas pixel space (0–1080 x 0–1920), not viewport pixels. The `canvas-surface` CSS transform scales all children automatically; storing viewport-space coordinates would require re-projection on every resize.
- Sticker base64 must go into a `stickerRegistry` (mirroring `mediaRegistry`) with only an ID reference in the overlay node; inlining base64 into the overlay store causes history snapshot bloat (50 entries × sticker size).
- User-uploaded SVG content must be sanitized with DOMPurify before storing or rendering to prevent XSS; the `Image()` → blob URL path is safe for rendering but sanitization must happen at upload time.

---

### Phase 14: Project Persistence
**Goal**: Users never lose work across page reloads; they can save named projects, manage a project list, and export/import `.storygrid` JSON files to share or back up projects.
**Depends on**: Phase 13 (overlay store must exist before serialization format is locked)
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, PERS-07, PERS-08, PERS-09, PERS-10, PERS-11, PERS-12
**Success Criteria** (what must be TRUE):
  1. Reloading the page restores the exact project state (grid, media, effects, overlays, audio flags) that was visible before the reload.
  2. User can save the project with a name, see it in the My Projects panel, rename it, load it, and delete it.
  3. User can export a `.storygrid` file, open it in a fresh browser session by importing it, and see the project fully restored (images present; video cells show a re-upload placeholder).
  4. When localStorage is full or Safari private browsing blocks writes, a toast message appears and no data is silently lost.
  5. Each project in the My Projects panel shows a thumbnail preview generated at save time.
**Plans**: TBD
**UI hint**: yes

**Plan-phase research flag:** At plan-phase time, measure the serialized state size of a representative project (5–6 images, effects, overlays) to decide whether localStorage alone is sufficient or whether `idb-keyval` (IndexedDB) is required as the primary storage backend. Research recommends idb-keyval for projects with base64 images; validate with an actual size check before writing persistence implementation tasks.

**Key pitfalls:**
- `QuotaExceededError` from localStorage must be caught explicitly; the write call will throw synchronously, and the default behavior is a silent crash that leaves the user with no feedback.
- Safari private browsing mode throws a `SecurityError` on any `localStorage.setItem()` call; must wrap all persistence writes in try/catch and surface a toast.
- Video blob URLs must be stripped before serialization (they expire on tab close); export `.storygrid` files must omit video blob entries and load video cells in a "re-upload required" state.

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Project Scaffolding | v1.0 | 1/1 | Complete | 2026-03-31 |
| 1. Grid Tree Engine | v1.0 | 2/2 | Complete | 2026-04-01 |
| 2. Grid Rendering | v1.0 | 3/3 | Complete | 2026-04-01 |
| 3. Media Upload & Cell Controls | v1.0 | 3/3 | Complete | 2026-04-01 |
| 4. Export Engine | v1.0 | 2/2 | Complete | 2026-04-01 |
| 5. Polish & UX | v1.0 | 5/5 | Complete | 2026-04-02 |
| 5.1. Mobile-First UI | v1.0 | 3/3 | Complete | 2026-04-04 |
| 6. Video Support | v1.0 | 4/4 | Complete | 2026-04-05 |
| 7. Cell Controls & Display Polish | v1.1 | 2/2 | Complete | 2026-04-07 |
| 8. Canvas & Workspace UX | v1.1 | 3/3 | Complete | 2026-04-07 |
| 9. Improve cell movement and swapping | v1.1 | 4/4 | Complete | 2026-04-08 |
| 10. Restore Cell Controls Sizing & Stacking Fix | v1.1 | 2/2 | Complete | 2026-04-08 |
| 11. Effects & Filters | v1.2 | 0/3 | Not started | - |
| 12. Per-Cell Audio Toggle | v1.2 | 0/? | Not started | - |
| 13. Text & Sticker Overlay Layer | v1.2 | 0/? | Not started | - |
| 14. Project Persistence | v1.2 | 0/? | Not started | - |
