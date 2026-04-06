# Requirements: StoryGrid v1.1 — UI Polish & Bug Fixes

> Milestone goal: Fix visual bugs and polish the editing experience — no new features.
> Phase numbering continues from v1.0 (last phase: 6 → v1.1 starts at Phase 7).

---

## Milestone Requirements

### A — Cell Action Bar

- [ ] **CELL-01:** User can always access cell top-bar controls regardless of cell size (controls are never clipped or hidden by the cell boundary)
- [ ] **CELL-02:** Cell action bar controls maintain a stable, consistent size across all screen resolutions (sized with vw/vh or equivalent, not px)

### B — Sidebar / Media

- [ ] **MEDIA-01:** User sees a first-frame thumbnail for video cells in the sidebar panel (matching image thumbnail behavior)

### C — Safe Zone

- [ ] **CANVAS-01:** When "Show Safe Zone" is enabled, unsafe areas display a visually distinct overlay (striped pattern, dimmed region, or similar) with an icon — not just a border outline

### D — Templates

- [ ] **TPL-01:** User can apply a preset template without a confirmation dialog — the template applies immediately and silently

### E — Drop Zone

- [ ] **DROP-01:** User can drop media files anywhere in the workspace area (full area excluding navbar and sidebar), not only on the canvas element
- [ ] **DROP-02:** The workspace drop zone provides clear visual feedback (highlight, label, or overlay) when a file is dragged over it

### F — Empty Cell Empty State

- [ ] **CELL-03:** Empty cell placeholder icon and label scale proportionally on large screens using vw/vh-based sizing

---

## Future Requirements (v1.2 — Effects & Advanced)

- [ ] Per-cell CSS filters: brightness, contrast, saturation, blur, grayscale, sepia, hue-rotate, opacity
- [ ] Text overlays per cell: font family, size, color, alignment, position; rendered in export
- [ ] Save/load projects: serialize tree + settings to JSON; import/export as `.storygrid.json`
- [ ] Aspect ratio presets: 9:16 (default), 1:1 (1080×1080), 4:5 (1080×1350)
- [ ] Multi-slide stories: add/remove/reorder pages, batch export

---

## Out of Scope (v1.1)

- New features of any kind — this milestone is polish and bug fixes only
- Effects & filters — deferred to v1.2
- Text overlays — deferred to v1.2
- Save/load — deferred to v1.2
- Aspect ratios / multi-slide — deferred to v1.2

---

## Traceability

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| CELL-01 | — | TBD by roadmapper |
| CELL-02 | — | TBD by roadmapper |
| MEDIA-01 | — | TBD by roadmapper |
| CANVAS-01 | — | TBD by roadmapper |
| TPL-01 | — | TBD by roadmapper |
| DROP-01 | — | TBD by roadmapper |
| DROP-02 | — | TBD by roadmapper |
| CELL-03 | — | TBD by roadmapper |
