# Roadmap: StoryGrid

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 + 5.1 INSERTED (shipped 2014-04-07) — see `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 UI Polish & Bug Fixes** — Phases 7–10 (shipped 2014-04-08) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Effects, Overlays & Persistence** — Phases 11–16 (shipped 2026-04-11) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Filters, Video Tools & Playback** — Phases 17–21 (shipped 2026-04-14) — see `.planning/milestones/v1.3-ROADMAP.md`
- 🔄 **v1.4 Mobile-First Overhaul & Instagram Fonts** — Phases 22–26 (in progress)

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

<details>
<summary>✅ v1.3 Filters, Video Tools & Playback (Phases 17–21) — SHIPPED 2026-04-14</summary>

- [x] Phase 17: Data Model Foundation (1/1 plans) — completed 2026-04-11
- [x] Phase 18: Instagram-Style Named Presets (2/2 plans) — completed 2026-04-12
- [x] Phase 19: Auto-Mute Detection & Breadth-First Drop (4/4 plans) — completed 2026-04-13
- [x] Phase 20: Playback UI Polish (1/1 plans) — completed 2026-04-14
- [x] Phase 21: Live Audio Preview (2/2 plans) — completed 2026-04-14

</details>

### v1.4 Mobile-First Overhaul & Instagram Fonts (Phases 22–26)

- [x] **Phase 22: Mobile Header & Touch Polish** — All primary actions in the mobile header toolbar; eliminate 300ms tap delay and pull-to-refresh interference app-wide (completed 2026-04-15)
- [x] **Phase 23: Bottom Sheet Redesign** — Replace drag-pill with a toggle button; auto-expand on cell select; full inner scroll in all snap states (completed 2026-04-15)
- [x] **Phase 24: Mobile Cell Action Tray** — Persistent action strip above the sheet when a cell is selected; Upload, Split H/V, Fit, Clear at ≥44×44px touch targets (completed 2026-04-16)
- [x] **Phase 25: Touch Drag-and-Drop** — Long-press initiation, visual lift, 5-zone drop targets (swap + 4 edges) on mobile (completed 2026-04-16)
- [x] **Phase 26: Instagram-Style Fonts** — 8 Google Fonts loaded async with font-display: swap; font picker renders names in their own typeface (completed 2026-04-16)

## Phase Details

### Phase 22: Mobile Header & Touch Polish
**Goal**: Mobile users can access all primary editor actions and the canvas responds correctly to touch without scroll interference
**Depends on**: Phase 21 (all v1.3 phases complete)
**Requirements**: HEADER-01, HEADER-02, SCROLL-01, SCROLL-02
**Success Criteria** (what must be TRUE):
  1. On a mobile device, the header toolbar shows Export, Undo, Redo, Templates, and Clear buttons — all reachable without opening any panel
  2. Every header toolbar button has a minimum 44×44px tap target with at least 8px spacing to neighboring controls
  3. Pulling down on the canvas area does not trigger the browser's pull-to-refresh gesture
  4. Tapping any interactive element produces an immediate response — no 300ms delay perceptible by the user
**Plans**: 1 plan
Plans:
- [x] 22-01-PLAN.md — Mobile header 5-button toolbar + CSS touch polish
**UI hint**: yes

### Phase 23: Bottom Sheet Redesign
**Goal**: The mobile bottom sheet is reliably accessible and fully scrollable in every state, opened and closed via a toggle button
**Depends on**: Phase 22
**Requirements**: SHEET-01, SHEET-02, SHEET-03, SHEET-04
**Success Criteria** (what must be TRUE):
  1. Tapping a chevron/arrow toggle button opens and closes the bottom sheet — the drag-pill gesture is removed
  2. When the user taps/selects a cell, the bottom sheet automatically expands to full height without any manual interaction
  3. Every control inside the bottom sheet is reachable by scrolling — nothing is cut off at the "half" snap position or at full height
  4. When the sheet is closed, a minimal tab strip remains visible at the bottom of the screen so the user knows the sheet exists
**Plans**: 1 plan
Plans:
- [x] 23-01-PLAN.md — MobileSheet drag→toggle refactor + SheetSnapState narrowing + test updates
**UI hint**: yes

### Phase 24: Mobile Cell Action Tray
**Goal**: A selected cell's most frequent actions are one tap away on mobile without opening the full bottom sheet
**Depends on**: Phase 23
**Requirements**: CELL-01, CELL-02, CELL-03
**Success Criteria** (what must be TRUE):
  1. Tapping any cell on mobile causes a compact action tray to appear above the bottom sheet
  2. The tray contains exactly Upload, Split Horizontal, Split Vertical, Fit toggle, and Clear buttons
  3. Every tray button has a minimum 44×44px tap target with at least 8px gaps between buttons
**Plans**: 1 plan
Plans:
- [x] 24-01-PLAN.md — MobileCellTray component + EditorShell wiring + CELL-01/02/03 unit tests
**UI hint**: yes

### Phase 25: Touch Drag-and-Drop
**Goal**: Mobile users can restructure the grid by long-pressing a cell and dragging it to a new position or slot
**Depends on**: Phase 24
**Requirements**: DRAG-01, DRAG-02, DRAG-03, DRAG-04
**Success Criteria** (what must be TRUE):
  1. Holding a finger on any cell for 500ms or longer initiates a drag — the cell lifts visually (scale increase + reduced opacity)
  2. While a cell is being dragged, all other cells show 5-zone drop targets: a center zone and four edge zones
  3. Releasing over a center zone swaps the dragged cell's content with the target cell's content
  4. Releasing over an edge zone inserts the dragged cell at that edge position in the grid tree
**Plans**: 2 plans
Plans:
- [x] 25-01-PLAN.md — DndContext wiring + LeafNode @dnd-kit migration + ActionBar cleanup + CSS keyframe
- [x] 25-02-PLAN.md — Phase25 tests + phase09 zone test migration + manual verification checkpoint

### Phase 26: Instagram-Style Fonts
**Goal**: Text overlays can use 8 Instagram-aesthetic Google Fonts, each identifiable at a glance in the font picker
**Depends on**: Phase 22
**Requirements**: FONT-01, FONT-02, FONT-03
**Success Criteria** (what must be TRUE):
  1. The text overlay font picker lists all 8 fonts: Bebas Neue, Oswald, Dancing Script, Playfair Display, Space Mono, Pacifico, Barlow Condensed, and Caveat
  2. After a font is applied, text in the overlay renders in that typeface immediately — no invisible-text flash occurs during font load
  3. Each font name in the picker is rendered in its own typeface so the user can visually distinguish styles before selecting
**Plans**: 1 plan
Plans:
- [x] 26-01-PLAN.md — FontPickerList with 8 Instagram fonts + MobileSheet overlay editing
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Mobile Header & Touch Polish | 1/1 | Complete   | 2026-04-15 |
| 23. Bottom Sheet Redesign | 1/1 | Complete   | 2026-04-15 |
| 24. Mobile Cell Action Tray | 1/1 | Complete   | 2026-04-16 |
| 25. Touch Drag-and-Drop | 2/2 | Complete   | 2026-04-16 |
| 26. Instagram-Style Fonts | 1/1 | Complete   | 2026-04-16 |
