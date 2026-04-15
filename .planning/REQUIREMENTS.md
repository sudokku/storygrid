# Requirements: StoryGrid v1.4

**Defined:** 2026-04-15
**Core Value:** A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

## v1.4 Requirements

Requirements for the Mobile-First Overhaul & Instagram Fonts milestone. Informed by Playwright audit (390×844 iPhone 14) and ui-ux-pro-max design system analysis.

### Mobile Header Toolbar

- [ ] **HEADER-01**: User sees Export, Undo, Redo, Templates, and Clear in the mobile header toolbar (replacing the current Export-only header)
- [ ] **HEADER-02**: All header toolbar touch targets are ≥44×44px with ≥8px gaps between them

### Bottom Sheet

- [ ] **SHEET-01**: Bottom sheet opens/closes via a toggle button (chevron/arrow icon), not the drag-pill gesture
- [ ] **SHEET-02**: Bottom sheet auto-expands to full height when a cell is selected
- [ ] **SHEET-03**: All bottom sheet content is scrollable — no controls are cut off in any snap state
- [ ] **SHEET-04**: Bottom sheet collapses to a minimal visible tab strip when closed (not hidden entirely)

### Mobile Cell Controls

- [ ] **CELL-01**: A persistent cell action tray appears above the bottom sheet when any cell is tapped/selected
- [ ] **CELL-02**: Cell action tray exposes Upload, Split Horizontal, Split Vertical, Fit toggle, and Clear buttons
- [ ] **CELL-03**: Cell action tray buttons have ≥44×44px touch targets with ≥8px gaps

### Touch Drag-and-Drop

- [ ] **DRAG-01**: User can initiate a cell drag via long-press (≥500ms threshold) on any cell on mobile
- [ ] **DRAG-02**: Dragged cell shows visual lift feedback (scale-up + reduced opacity) during the drag
- [ ] **DRAG-03**: Valid drop zones appear on all other cells during drag (center = swap, 4 edges = insert)
- [ ] **DRAG-04**: Dropping on center swaps cell content; dropping on an edge inserts the dragged cell at that position

### Instagram-Style Fonts

- [ ] **FONT-01**: Text overlay font picker includes 8 Google Fonts matching Instagram Stories aesthetic: Bebas Neue, Oswald, Dancing Script, Playfair Display, Space Mono, Pacifico, Barlow Condensed, Caveat
- [ ] **FONT-02**: Fonts load asynchronously with `font-display: swap` to avoid invisible text flash (FOIT)
- [ ] **FONT-03**: Font picker displays each font name rendered in its own typeface for visual preview

### Scroll & Touch Polish

- [ ] **SCROLL-01**: Canvas area and app body have `overscroll-behavior: contain` preventing pull-to-refresh interference
- [ ] **SCROLL-02**: All interactive elements use `touch-action: manipulation` to eliminate 300ms tap delay

## Future Requirements

### Playwright-Driven Audit Fixes

- **AUDIT-01**: Additional mobile UX issues found via Playwright automation in later phases
- **AUDIT-02**: Landscape orientation support audit and fixes

### Project Persistence

- **PERS-01..12**: Save/load collage as JSON project file (deferred from v1.2, v1.3, and again from v1.4)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Project persistence (PERS-01..12) | Deferred again — v1.4 focused on mobile UX |
| Desktop drag-and-drop changes | Desktop HTML5 drag already works; only mobile touch needs implementation |
| Video cell touch drag | Scope limited to grid cell restructuring; video playback drag is separate |
| Custom/uploaded fonts in text overlay | Google Fonts sufficient for v1.4; custom upload adds complexity |
| Font size picker redesign | Existing size controls stay; only font family selection changes |
| Safari-specific video export | Ongoing known limitation; deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HEADER-01 | Phase 22 | Pending |
| HEADER-02 | Phase 22 | Pending |
| SCROLL-01 | Phase 22 | Pending |
| SCROLL-02 | Phase 22 | Pending |
| SHEET-01 | Phase 23 | Pending |
| SHEET-02 | Phase 23 | Pending |
| SHEET-03 | Phase 23 | Pending |
| SHEET-04 | Phase 23 | Pending |
| CELL-01 | Phase 24 | Pending |
| CELL-02 | Phase 24 | Pending |
| CELL-03 | Phase 24 | Pending |
| DRAG-01 | Phase 25 | Pending |
| DRAG-02 | Phase 25 | Pending |
| DRAG-03 | Phase 25 | Pending |
| DRAG-04 | Phase 25 | Pending |
| FONT-01 | Phase 26 | Pending |
| FONT-02 | Phase 26 | Pending |
| FONT-03 | Phase 26 | Pending |

**Coverage:**
- v1.4 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 — traceability complete, all 18 requirements mapped to phases 22–26*
