# Roadmap: StoryGrid

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 + 5.1 INSERTED (shipped 2026-04-07) — see `.planning/milestones/v1.0-ROADMAP.md`
- 🔄 **v1.1 UI Polish & Bug Fixes** — Phases 7–10 (in progress; Phase 10 added 2026-04-08 to close audit gaps)

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

### v1.1 UI Polish & Bug Fixes

- [x] **Phase 7: Cell Controls & Display Polish** — Fix cell action bar overflow, size stability, empty cell scaling, and video thumbnails in sidebar (completed 2026-04-07)
- [ ] **Phase 8: Canvas & Workspace UX** — Replace safe zone with visual overlay, remove template confirmation, expand drop zone to full workspace
- [x] **Phase 9: Improve cell movement and swapping** — Add 5-zone drag (edges + center) so users can MOVE a cell into a new tree position, not just swap content (completed 2026-04-08)
- [x] **Phase 10: Restore Cell Controls Sizing & Stacking Fix** — Re-land reverted CELL-02 clamp() sizing, resolve CELL-01 `isolate` stacking-context risk, and unblock sidebar video uploads (gap closure from v1.1 audit) (completed 2026-04-08)

## Phase Details

### Phase 7: Cell Controls & Display Polish
**Goal**: Cell controls are always accessible and correctly sized; empty cells scale naturally; video cells show a thumbnail in the sidebar
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: CELL-01, CELL-02, CELL-03, MEDIA-01
**Success Criteria** (what must be TRUE):
  1. Cell action bar controls remain fully visible and clickable regardless of how small a cell is resized
  2. Action bar icons and buttons appear the same physical size across a small laptop screen and a large external monitor
  3. Empty cells show a centered icon and label that scale proportionally as the viewport grows — no fixed-size relics on 4K displays
  4. Video cells display a still thumbnail (first frame) in the sidebar panel, matching the behavior of image cells
**Plans:** 2/2 plans complete
  - [x] 07-01-PLAN.md — Cell controls overflow + clamp-based sizing (CELL-01, CELL-02, CELL-03)
  - [x] 07-02-PLAN.md — Video first-frame thumbnail in sidebar (MEDIA-01)
**UI hint**: yes

### Phase 8: Canvas & Workspace UX
**Goal**: Safe zone is visually obvious, templates apply without friction, and file drops are accepted anywhere in the workspace
**Depends on**: Phase 7
**Requirements**: CANVAS-01, TPL-01, DROP-01, DROP-02
**Success Criteria** (what must be TRUE):
  1. When "Show Safe Zone" is toggled on, unsafe areas are covered by a visible striped or dimmed overlay with an icon — not a plain border outline
  2. Clicking a preset template applies it immediately with no confirmation dialog or alert
  3. User can drag a media file from the desktop and drop it anywhere in the workspace area (not only directly on the canvas element) and the file is accepted
  4. While dragging a file over the workspace, the drop zone area shows a clear visual highlight or label indicating it will accept the file
**Plans:** 3 plans
  - [x] 08-01-PLAN.md — Safe Zone visual overlay (CANVAS-01)
  - [x] 08-02-PLAN.md — Workspace drop zone + drag-over ring (DROP-01, DROP-02)
  - [x] 08-03-PLAN.md — Template apply regression test (TPL-01)
**UI hint**: yes

### Phase 9: Improve cell movement and swapping
**Goal**: Users can MOVE a cell into any of 4 edge positions (split-insert + remove + collapse-upward) in addition to the existing center-drop swap — single atomic undo, full tree-layer correctness for n-ary trees, EC-06 empty-cell moves supported
**Depends on**: Phase 8
**Requirements**: none explicit — context-driven phase (D-01..D-09 in 09-CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. Dragging a cell by its ActionBar handle and hovering over another cell reveals 5 drop zones: 4 thin edge bands (top/bottom/left/right) and a large center
  2. Hovering an edge shows a thick accent-blue (#3b82f6) insertion line ~4px along that edge; hovering center shows a dimmed swap-icon overlay; only one highlight at a time
  3. Dropping on an edge splits the target into a new 50/50 container with the dragged cell's content at the requested side; the source leaf is removed; if the source parent is left with 1 child it collapses upward
  4. Dropping on the center preserves existing swap behavior unchanged
  5. A single Ctrl+Z atomically reverses an entire move (insert + remove + collapse)
  6. Empty cells are draggable (EC-06 gate relaxed)
  7. File drops onto cells still work unchanged (Phase 8 D-15 coexistence)
  8. Phase 5 cell-swap regression tests still pass
**Plans:** 4 plans
  - [x] 09-01-PLAN.md — Pure `moveLeafToEdge` tree primitive + 18 unit tests (Wave 1, independent)
  - [x] 09-02-PLAN.md — `gridStore.moveCell` atomic action + 9 store tests (Wave 2, depends on 09-01)
  - [x] 09-03-PLAN.md — LeafNode 5-zone hit detection + insertion-line/swap overlay + moveCell dispatch (Wave 3, depends on 09-02)
  - [x] 09-04-PLAN.md — ActionBar gate relaxation (EC-06) + Phase 5 regression test update (Wave 3, parallel with 09-03)
**Branch discipline**: runs directly on `main` (D-09 — no worktree, no feature branch)
**UI hint**: yes

### Phase 10: Restore Cell Controls Sizing & Stacking Fix
**Goal**: Close v1.1 audit gaps — re-land the CELL-02 viewport-stable button sizing reverted in 1476df2, resolve the CELL-01 stacking-context risk introduced by `isolate` on LeafNode root, and extend the sidebar Replace input to accept video files (MEDIA-01 polish)
**Depends on**: Phase 9
**Requirements**: CELL-01, CELL-02, MEDIA-01 (polish)
**Gap Closure**: Closes gaps from `.planning/v1.1-MILESTONE-AUDIT.md` — CELL-02 unsatisfied, CELL-01 partial, Flow E broken, Sidebar video-upload tech debt
**Success Criteria** (what must be TRUE):
  1. `ActionBar.tsx` button size is driven by `clamp(28px, 2.2vw, 36px)` (or equivalent vw-based sizing); the fixed `w-16 h-16` and `ICON_SIZE = 32` constants are gone
  2. Resizing the viewport from a small laptop to a 4K display keeps ActionBar buttons within the 28-36px range (Flow E passes in real browser)
  3. `LeafNode.tsx` root no longer creates a stacking context that clips the ActionBar at sibling boundaries — either `isolate` is removed or CELL-01 is re-verified to remain visually correct in a real browser at small cell sizes
  4. The stale "no isolate" comment at `LeafNode.tsx:678` is corrected to match actual className state
  5. Sidebar Replace file input accepts video files (`accept` includes `video/*`), matching ActionBar / drag-drop upload paths
  6. Phase 7 regression tests still pass; new real-browser check (or equivalent) confirms ActionBar visibility at small cell + sibling boundaries
**Branch discipline**: runs directly on `main` (no worktree, no feature branch)
**UI hint**: yes
**Plans:** 2/2 plans complete
  - [x] 10-01-actionbar-clamp-sizing-PLAN.md — Re-land clamp(28px, 2.2vw, 36px) ActionBar sizing (CELL-02)
  - [x] 10-02-leafnode-stacking-sidebar-video-PLAN.md — Remove LeafNode `isolate`, fix stale comment, extend Sidebar accept to video/* (CELL-01, MEDIA-01)

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
| 7. Cell Controls & Display Polish | v1.1 | 2/2 | Complete   | 2026-04-07 |
| 8. Canvas & Workspace UX | v1.1 | 0/3 | Planned | - |
| 9. Improve cell movement and swapping | v1.1 | 0/4 | Planned | - |
| 10. Restore Cell Controls Sizing & Stacking Fix | v1.1 | 2/2 | Complete    | 2026-04-08 |
