# Requirements: StoryGrid v1.5

**Defined:** 2026-04-17
**Milestone:** Unified Drag-and-Drop UX
**Core Value:** A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

## v1.5 Requirements

Requirements for a wholesale rebuild of cell-to-cell drag-and-drop: unified desktop/touch behavior, polished visual affordances, ESC-to-cancel, zero platform-conditional code paths. Informed by `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS) and the Phase 25 post-mortem. File drop, overlay drag, and divider resize remain on their current native-pointer implementations.

### Engine (DND-*)

- [ ] **DND-01**: DnD engine is built on `@dnd-kit/core@^6.3.1` with a **single `PointerSensor`** — no `TouchSensor` + `MouseSensor` combination anywhere in the app.
- [ ] **DND-02**: Ephemeral drag state (active cell id, pointer position, drag zone, ghost dataURL) lives in a separate vanilla Zustand `dragStore`, not in `gridStore`.
- [ ] **DND-03**: All DnD code lives under a new `src/dnd/` module (adapter, hooks, pure `computeDropZone` util, `DragPreviewPortal`, zone icons).
- [ ] **DND-04**: Phase 25 `@dnd-kit` wiring in `LeafNode.tsx` is removed in the **same phase** that wires the new engine — no parallel DnD engines mounted simultaneously.
- [ ] **DND-05**: `gridStore.moveCell` (lines 473-494) and existing tree primitives (`moveLeafToEdge`, `splitNode`, `mergeNode`) remain unchanged — the new engine invokes them on drop commit only.
- [ ] **DND-06**: `@dnd-kit/modifiers` is installed and used to compensate for the canvas `transform: scale()` factor when translating pointer → canvas coordinates.

### Drag Start Affordance (DRAG-*)

- [ ] **DRAG-01**: Every draggable leaf cell shows `cursor: grab` on hover at all times (no focus/selection prerequisite).
- [ ] **DRAG-02**: Document body toggles to `cursor: grabbing` while a drag is active.
- [ ] **DRAG-03**: Touch activation requires a **250ms press-and-hold with 5px tolerance**. Phase 25's 500ms is replaced.
- [ ] **DRAG-04**: Mouse activation requires **8px pointer distance** after mousedown (prevents click-as-drag).
- [ ] **DRAG-05**: Drag-start wobble animation fires on activation: `scale: 1.00 → 1.05 → 1.02` over 150ms with `cubic-bezier(0.34, 1.56, 0.64, 1.0)` (back-out spring).
- [ ] **DRAG-06**: Drag preview gets a visible lift: `scale 1.04` + drop shadow.
- [ ] **DRAG-07**: The entire cell body is the drag-activation region — no dedicated handle icon, no focus/tap gating.

### Ghost / Preview (GHOST-*)

- [ ] **GHOST-01**: Ghost image source is generated via `canvas.toDataURL()` on drag-start and rendered as an `<img>` (NOT via `cloneNode`, which produces empty canvases).
- [ ] **GHOST-02**: Ghost follows the pointer with **grab-point offset preserved** — the ghost stays under the exact sub-pixel location where the drag started (no pickup jump).
- [ ] **GHOST-03**: Ghost opacity is **80%** (semi-opaque, per user brief).
- [ ] **GHOST-04**: Ghost renders at its **source-cell size** (no 280×280 cap, no dynamic cap).
- [ ] **GHOST-05**: Ghost contains the artwork only — no action bar, handles, selection outline, or other chrome.
- [ ] **GHOST-06**: Ghost renders via `@dnd-kit/core`'s `DragOverlay` portal into `document.body` (viewport space — outside the scaled canvas) to avoid double-scale.
- [ ] **GHOST-07**: Source cell dims to **40% opacity** during drag (per Atlassian Design System spec).

### Drop Target Feedback (DROP-*)

- [ ] **DROP-01**: Every hover cell renders 5 drop zones: 1 center (swap) + 4 edges (insert top/right/bottom/left). Zones fully tile the cell — no dead space between them.
- [ ] **DROP-02**: Active zone (pointer over it) styling: **100% white icon + scale 1.1 + soft drop-shadow glow**.
- [ ] **DROP-03**: Inactive zones styling: **30% white icon** (`text-white/30`), no scale, no glow.
- [ ] **DROP-04**: When the pointer is over any of a cell's 5 zones, that cell gains a **2px accent-color outline**.
- [ ] **DROP-05**: No insertion line is drawn on edge drops — icons alone convey intent.
- [ ] **DROP-06**: Active zone re-computes live on every `pointermove` via a single pure `computeDropZone(pointer, cellRect, scale)` function.
- [ ] **DROP-07**: Ghost stays under the pointer during hover — no magnetism toward zone centers.
- [ ] **DROP-08**: On successful drop commit, the landed cell shows a **700ms accent-color flash** (fades out with Atlassian `largeDurationMs`).

### Cancel / Abort (CANCEL-*)

- [ ] **CANCEL-01**: Pressing **ESC** during an active drag cancels the drop and returns the cell to its origin.
- [ ] **CANCEL-02**: Snap-back animation on cancel: **200ms** with `cubic-bezier(0.15, 1.0, 0.3, 1.0)` easing, animating the ghost's transform from current point back to origin rect.
- [ ] **CANCEL-03**: Releasing the pointer **outside the `GridCanvas` element** (toolbar, tray, sidebar, browser chrome) triggers cancel with snap-back.
- [ ] **CANCEL-04**: Releasing on the **origin cell** (no-op) triggers the same snap-back animation as cancel. No undo-history entry is created.
- [ ] **CANCEL-05**: Zones fully tile each cell; a pointer inside any cell always resolves to exactly one of its 5 zones (no dead-zone cancels).
- [ ] **CANCEL-06**: `gridStore.moveCell`'s existing early-return no-op guards (lines 473-494) remain unchanged.

### Cross-device Unification (CROSS-*)

- [ ] **CROSS-01**: A single pointer-event stream drives both desktop and touch — no separate `mousedown` / `touchstart` handler branches.
- [ ] **CROSS-02**: Draggable cells carry `touch-action: none` while drag is available, preventing iOS/Android scroll hijack.
- [ ] **CROSS-03**: Draggable cells carry `-webkit-touch-callout: none` to suppress the iOS long-press image-action menu.
- [ ] **CROSS-04**: Document body gains `user-select: none` during an active drag to prevent text selection and iOS loupe.
- [ ] **CROSS-05**: `contextmenu` events are `preventDefault`'d while drag is active (suppresses right-click menu mid-drag).
- [ ] **CROSS-06**: `navigator.vibrate(10)` fires on successful drag activation (after the 250ms touch hold).
- [ ] **CROSS-07**: `navigator.vibrate(15)` fires on successful drop commit.
- [ ] **CROSS-08**: The mobile `MobileCellTray` / bottom sheet **auto-collapses to tab-strip on drag-start** and restores to its previous snap state on drag-end / drag-cancel.

## Future Requirements (Post-v1.5)

Features deliberately scoped out of v1.5 but tracked for later phases:

- **P2 — Polish**
  - Ghost magnetism toward active zone center (~100ms ease)
  - Insertion-line indicator on edge drops (2px line + 8px terminal dots)
  - Word labels on drop-zone icons when zone width >120px
  - Touch ghost `-40px Y` offset (iOS Photos "above finger" pattern) — reconsider if grab-point-preserved offset proves awkward on touch
  - Spring-ease "thunk" settle on landed cell (alternative to 700ms color flash)
- **P3 — Engine Unification**
  - Fold file-drop-onto-cell into the @dnd-kit engine (currently native HTML5 DnD from Phase 8)
  - Fold overlay-layer drag into the @dnd-kit engine
  - Fold divider resize into the @dnd-kit engine
- **P3 — Accessibility**
  - Keyboard-only drag (Space + arrow keys) with ARIA live-region announcements
- **P3 — Power Users**
  - Multi-select drag (shift-click multiple cells, group move)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-select drag | Recursive split-tree + partial-subtree moves is genuinely hard; ≤~20 cells rarely need it. User rule-out for v1.5. |
| Keyboard-only DnD (Space + arrows) | Full a11y keyboard reorder requires focus management + ARIA tree model — separate milestone. User rule-out for v1.5. |
| Auto-scroll near viewport edges | Canvas fits viewport (9:16 scaled). Scrolling doesn't help — canvas is always fully visible. |
| Rotation tilt on drag ghost (Trello-style) | Ghost IS the artwork; rotating misrepresents final composition. Atlassian explicitly recommends against it except for Trello cards. |
| "Make room" pre-drop animation | HIGH complexity for split-tree (where drop can swap, split, or insert). Revisit post-v1.5. |
| Snap-to-grid alignment | No fixed grid exists — every cell boundary is arbitrary. The 5-zone overlay IS the snap model. |
| "Drag to trash" delete gesture | Redundant with explicit Remove button in action bar / MobileCellTray. Adds drop-target ambiguity. |
| Browser-native `draggable="true"` | No activation threshold, loses touch without polyfill, unreliable ESC-cancel. Replaced entirely by pointer-events engine. |
| Native `setDragImage` for ghost | Cannot be styled or animated; broken on Safari for `<img>`; doesn't fire on touch. |
| Drag-between-panels | StoryGrid has one canvas; no sidebar hosts cells. |
| Dedicated 6-dot drag handle | Whole-cell activation is the chosen model — more discoverable on a collage canvas than Notion-style handles. |
| File drop, overlay drag, divider resize rewrite | User decision: include only if unification yields debugging/maintenance gains. These three stay on their current native-pointer implementations for v1.5. |

## Blocking Anti-Patterns (from Phase 25 post-mortem)

These are build-time/test-time requirements — not features, but must-nots that the new engine cannot violate:

- **No `TouchSensor` + `MouseSensor` simultaneously** — dnd-kit docs explicitly forbid it. Single `PointerSensor` only (DND-01).
- **No spread-then-explicit-handler on the same JSX element** — e.g., `<div {...listeners} onPointerDown={x}>` lets React overwrite the dnd-kit handler. Spreads must come LAST or be merged via a wrapper.
- **No drag state in `gridStore`** — pointer-tick writes would pollute undo/redo history. Separate vanilla Zustand `dragStore` (DND-02).
- **No parallel DnD engines mid-migration** — remove old wiring in the same phase that introduces the new engine (DND-04).
- **No `cloneNode` on `<canvas>` leaves** — produces empty canvases. Use `toDataURL()` + `<img>` (GHOST-01).

## Traceability

| Category | Count | Source |
|----------|-------|--------|
| DND-* engine | 6 | STACK.md, ARCHITECTURE.md, PITFALLS.md |
| DRAG-* activation | 7 | FEATURES.md Category A + F8 |
| GHOST-* preview | 7 | FEATURES.md Category B |
| DROP-* drop target | 8 | FEATURES.md Categories C + F1 |
| CANCEL-* cancel/abort | 6 | FEATURES.md Category D |
| CROSS-* cross-device | 8 | FEATURES.md Categories E + F7 |
| **Total** | **42** | |

Requirements map to the 4-phase minimum roadmap shape (Phase 27 Foundation → 28 Cell-to-Cell → 29 ESC + Visual Polish → 30 Mobile Handle + Tray). ROADMAP.md will assign each REQ to a phase.
