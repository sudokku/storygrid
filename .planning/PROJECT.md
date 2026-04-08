# StoryGrid

## What This Is

StoryGrid is a fully client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image or video. Zero backend — fully static, deploys to Vercel/Netlify.

**Current State:** v1.1 UI Polish & Bug Fixes shipped 2026-04-08. Cumulative state: v1.0 delivered full image/video support, mobile-first UI, Canvas API export, and MediaRecorder video export; v1.1 polished the editing experience with portal-based ActionBar (always-accessible cell controls at any size), safe-zone visual overlay, friction-free template apply, full-workspace drop zone, and atomic cell MOVE semantics. Next: v1.2 Effects & Advanced (pending scope definition via `/gsd:new-milestone`).

## Core Value

A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

## Requirements

### Validated

**Phase 0 — Scaffolding** (v1.0)
- ✓ Vite + React 18 + TypeScript project initializes and runs — v1.0
- ✓ All MVP dependencies installed (zustand, immer, tailwindcss, @dnd-kit/core, @dnd-kit/sortable, html-to-image, lucide-react, nanoid) — v1.0
- ✓ Folder structure matches the specified layout (Editor, Grid, UI, store, lib, types) — v1.0
- ✓ Tailwind configured with canvas dimensions and safe zone as CSS variables — v1.0
- ✓ App shell renders editor layout (canvas area, toolbar, sidebar) — v1.0

**Phase 1 — Grid Tree Engine** (v1.0)
- ✓ TypeScript types: GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection — v1.0
- ✓ Pure tree functions: createLeaf, splitNode, mergeNode, removeNode, resizeSiblings, updateLeaf, findNode, findParent, getAllLeaves — v1.0
- ✓ Zustand gridStore with split/merge/remove/resize/setMedia/updateCell/undo/redo actions — v1.0
- ✓ Zustand editorStore with selectedNodeId/zoom/showSafeZone/tool state — v1.0
- ✓ Undo/redo via history snapshots (push on every mutating action) — v1.0

**Phase 2 — Grid Rendering** (v1.0)
- ✓ GridNode recursive component dispatches to Container or Leaf — v1.0
- ✓ Container renders flex layout (row/column) with correct child sizing via flex fractions — v1.0
- ✓ Divider is draggable and updates size ratios in real-time via pointer events — v1.0
- ✓ Leaf renders empty state, media state (canvas WYSIWYG), and selected state — v1.0
- ✓ Leaf hover actions: Split H, Split V, Remove, Toggle Fit — v1.0
- ✓ Canvas maintains 9:16 aspect ratio, scales via transform, shows optional safe zone overlay — v1.0

**Phase 3 — Media Upload & Cell Controls** (v1.0)
- ✓ Clicking empty cell opens file picker (image/*) — v1.0
- ✓ Dragging image file onto cell drops it in — v1.0
- ✓ Multi-file upload auto-fills empty cells in order — v1.0
- ✓ Cell hover actions: split H/V, remove, toggle fit, clear media, replace media — v1.0
- ✓ Sidebar shows: media thumbnail, fit toggle, background color picker, cell info, remove/clear buttons — v1.0
- ✓ Toolbar: undo/redo (Ctrl+Z/Ctrl+Shift+Z), zoom control, safe zone toggle, export button, new/clear — v1.0

**Phase 4 — Export Engine** (v1.0)
- ✓ Canvas API tree renderer (replaced html-to-image) — pixel-perfect 1080×1920px — v1.0
- ✓ PNG/JPEG download via anchor click with timestamp filename — v1.0
- ✓ Export settings: PNG/JPEG format, JPEG quality slider — v1.0
- ✓ Export progress indicator ("Preparing…" → "Exporting…") — v1.0
- ✓ Graceful error handling if export fails — v1.0

**Phase 5 — Polish & UX** (v1.0)
- ✓ Preset templates panel: 2×1, 1×2, 2×2, 3-row, L-shape, Mosaic — v1.0
- ✓ Global gap slider (0–20px), border radius slider (0–24px), border color picker — v1.0
- ✓ Canvas background color + gradient option — v1.0
- ✓ Dark editor theme (#0a0a0a–#141414 background, #1a1a1a–#222 surfaces) — v1.0
- ✓ Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+E, Delete, H, V, F, Escape — v1.0
- ✓ First-time onboarding tooltip overlay — v1.0
- ✓ Pan/zoom: double-click to enter pan mode, drag to reposition, scroll to scale — v1.0
- ✓ Cell-swap-by-drag via @dnd-kit — v1.0

**Phase 5.1 — Mobile-First UI** (v1.0, INSERTED)
- ✓ Responsive layout at 768px breakpoint (CSS-driven, no FOUC) — v1.0
- ✓ Bottom sheet replacing sidebar on mobile, drag-to-snap — v1.0
- ✓ Mobile toolbar: wordmark + Export only — v1.0
- ✓ Split H/V in SelectedCellPanel (desktop + mobile sheet) — v1.0
- ✓ Touch-adapted divider hit areas (8px → 22px) — v1.0
- ✓ Pinch-to-zoom in pan mode (native touch events) — v1.0
- ✓ Mobile welcome card ("Build your story.") with shared onboarding dismiss key — v1.0

**Phase 6 — Video Support** (v1.0)
- ✓ Video files accepted (video/*), stored as blob URLs in parallel mediaTypeMap — v1.0
- ✓ Video cells render via canvas rAF loop using hidden video element as drawImage source — v1.0
- ✓ Timeline bar: master play/pause + scrub syncs all videos — v1.0
- ✓ MediaRecorder-based MP4 export (replaced ffmpeg.wasm — no COOP/COEP or 25MB WASM) — v1.0
- ✓ COOP/COEP headers configured in vercel.json + public/_headers — v1.0

**Phase 7 — Cell Controls & Display Polish** (v1.1)
- ✓ Cell top-bar controls always accessible regardless of cell size (CELL-01) — v1.1 (portal architecture finalized in Phase 10)
- ✓ Cell action bar stable button size across screen resolutions (CELL-02) — v1.1 (fixed `w-16 h-16` in viewport-space portal; clamp/vw mechanism superseded — see Key Decisions)
- ✓ Empty cell placeholder scales with viewport using `clamp()` + `ResizeObserver` (CELL-03) — v1.1
- ✓ Video cells show first-frame thumbnail in sidebar (MEDIA-01 display path) — v1.1

**Phase 8 — Canvas & Workspace UX** (v1.1)
- ✓ Safe zone visual overlay with striped/dimmed unsafe areas (CANVAS-01) — v1.1 (new `SafeZoneOverlay` component)
- ✓ Template apply without confirmation dialog (TPL-01) — v1.1
- ✓ Full-workspace drop zone accepting files anywhere outside navbar/sidebar (DROP-01) — v1.1
- ✓ Clear visual drag-over feedback on drop zone (DROP-02) — v1.1

**Phase 9 — Cell Movement & Swapping** (v1.1, context-driven)
- ✓ Pure `moveLeafToEdge` tree primitive with 18 unit tests — v1.1
- ✓ Atomic `gridStore.moveCell` action (insert + remove + collapse in one undo entry) — v1.1
- ✓ 5-zone LeafNode drop overlay (4 edges + center) with accent-blue insertion lines — v1.1
- ✓ EC-06 gate relaxed — empty cells are draggable — v1.1
- ✓ Phase 5 cell-swap regression tests still pass — v1.1

**Phase 10 — v1.1 Audit Gap Closure** (v1.1)
- ✓ ActionBar sizing re-settled as fixed `w-16 h-16` (64px) in viewport-space portal (CELL-02 reframed) — v1.1
- ✓ LeafNode `isolate` removed; stale "no isolate" comment corrected; regression test locks invariant (CELL-01) — v1.1
- ✓ Sidebar Replace input accepts `video/*` with proper blob-URL + mediaType branching (MEDIA-01 upload path) — v1.1

### Active

(No active requirements — v1.1 complete. Run `/gsd:new-milestone` to define v1.2 scope.)

**Future Milestone (v1.2) — Effects & Advanced** (candidates, not yet scoped)
- Per-cell CSS filters: brightness, contrast, saturation, blur, grayscale, sepia, hue-rotate, opacity
- Text overlays per cell: font family, size, color, alignment, position; rendered in export
- Save/load projects: serialize tree + settings to JSON; import/export as `.storygrid.json`
- Aspect ratio presets: 9:16 (default), 1:1 (1080×1080), 4:5 (1080×1350)
- Multi-slide stories: add/remove/reorder pages, batch export

### Out of Scope

- Backend / server-side rendering — zero backend by design; static-only
- User accounts / cloud storage — MVP is local-only; no ops burden
- Real-time collaboration — single user session only
- Safari video export — MediaRecorder codec availability on Safari is limited; explicitly deferred
- AI layout suggestions — high complexity, not core to the manual collage value proposition
- Direct Instagram publish API — OAuth + app review scope creep; download-and-upload is sufficient
- React 19 — peer dependency risk with dnd-kit; no relevant new features for this SPA
- Tailwind v4 — requires Safari 16.4+; project targets Safari 15+

## Context

The grid uses a **recursive split-based tree structure** modeled after Figma's frame splitting. The canvas is always 1080×1920px internally; the editor shows a scaled-down preview via CSS `transform: scale()`. Every leaf renders via a `<canvas>` element sharing the `drawLeafToCanvas()` pipeline — guaranteeing WYSIWYG export parity.

Key technical decisions that shipped:
- Canvas API export (not html-to-image) — deterministic, handles object-fit and transform correctly
- MediaRecorder video export (not ffmpeg.wasm) — no 25MB WASM download, no COOP/COEP requirement
- Blob URLs for video, base64 for images — blob URLs revoked on removeMedia/clearGrid/applyTemplate
- CSS-driven responsive breakpoint (not JS conditional rendering) — avoids FOUC, aligns with Tailwind
- Phase 5.1 inserted before Phase 6 — mobile was primary creation surface for the target audience

Current state (after v1.1):
- ~13,213 lines TypeScript/TSX (up from ~10,683 at v1.0)
- Tech stack: Vite 8, React 18.3.1, TypeScript 5.9.3, Zustand 5.0.12, Immer 10.2.0, Tailwind 3.4.19
- 34 plans shipped across 12 phases total (v1.0: 8 phases / 23 plans, 7 days; v1.1: 4 phases / 11 plans, 2 days)
- Test suite: 489 passing / 2 skipped across 43 test files
- ActionBar is now rendered via `createPortal(document.body)` in viewport space (Phase 7 experiment → stabilized in Phase 10) — not inside the canvas transform
- Cell MOVE/SWAP are now distinct gestures via 5-zone LeafNode drop overlay (Phase 9)

## Constraints

- **Tech Stack**: Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — pre-decided, do not substitute
- **State Library**: Zustand with Immer middleware — immutable updates on nested tree, undo/redo via history array
- **Export (image)**: Custom Canvas API renderer — html-to-image replaced in quick task 260401-oca
- **Export (video)**: MediaRecorder pipeline — ffmpeg.wasm replaced in quick task 260405-s9u
- **Bundle Size**: MVP bundle under 500KB gzipped
- **Browser Support**: Chrome 90+, Firefox 90+, Safari 15+ (MVP). Video export Chrome/Firefox only.
- **Deployment**: Vite static build → dist/ → Vercel or Netlify

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Recursive split-tree (not CSS grid) | Enables arbitrary nesting depth, maps directly to tree data structure, same model as Figma | ✓ Good — clean implementation, pure functions easy to test |
| Dual render (scaled preview + hidden full-res div) | Export must be pixel-perfect 1080×1920; editor must fit viewport | ✓ Good — then replaced with Canvas API direct render |
| Canvas API for export (replaced html-to-image) | Deterministic output, handles object-fit correctly, zero dependency | ✓ Good — no blank-PNG races, consistent results |
| LeafNode renders via `<canvas>` (not `<img>`) | WYSIWYG with export pipeline — same drawLeafToCanvas() path | ✓ Good — eliminated rendering divergence |
| MediaRecorder for video export (replaced ffmpeg.wasm) | No 25MB WASM, no COOP/COEP, faster startup | ✓ Good — simpler stack, faster to load |
| Phase 5.1 inserted before Phase 6 | Mobile is primary creation surface; must ship before video | ✓ Good — right call for target audience |
| No backend / localStorage only | Zero ops, instant deploy, privacy-first | ✓ Good — maintains zero-backend constraint |
| @dnd-kit for D&D, native HTML5 events for file drop | dnd-kit: cell swap; native drag: desktop file drop | ✓ Good — clean separation |
| Blob URLs for video, base64 for images | Images need undo-safe snapshotting; videos are large blobs | ✓ Good — blob URLs revoked on cleanup |
| D-16 (cell swap touch) deferred | iOS/Android don't fire HTML5 drag events; dnd-kit TouchSensor is non-trivial refactor | ⚠️ Still deferred through v1.1 — candidate for v1.2 |
| Portal-based ActionBar (v1.1) | Escapes per-cell stacking contexts via `createPortal(document.body)`; renders in viewport space outside canvas transform | ✓ Good — stable cell controls at any cell size, no clipping by sibling stacking contexts (Phases 7, 10) |
| Fixed-pixel ActionBar sizing (not clamp()/vw) | Portal renders in viewport space → no canvas-scale dependence → fixed `w-16 h-16` (64px) is stable by construction and delivers usable click targets; clamp() produced minuscule buttons at typical viewports | ✓ Good — settled in Phase 10 after course correction (v1.1 audit had flagged the clamp removal as a regression, but the portal pivot made clamp obsolete) |
| Audit gap-closure must verify prior commit rationale | Diff-only audits cannot distinguish a regression from a deliberate architectural pivot | ⚠️ Lesson — v1.1 audit mis-classified `1967219` portal work as a regression; Phase 10 initial execution wasted cycles re-landing clamp() before course-correcting |
| 5-zone LeafNode drop overlay | MOVE (edge insertion) and SWAP (center drop) are distinct semantic gestures; single-undo atomicity via `moveCell` action | ✓ Good — clean separation of n-ary tree mutations (Phase 9) |
| New `SafeZoneOverlay` component | Replaces toggle-only button with visible striped/dimmed unsafe-area indicator | ✓ Good — dramatically clearer UX for story composition (Phase 8) |
| MediaRecorder video export (continued) | No 25MB WASM, no COOP/COEP, faster startup | ✓ Good — validated across v1.1 with no regressions |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Next Milestone: v1.2 Effects & Advanced (pending scope definition)

Scope has not yet been defined. Run `/gsd:new-milestone` to drive questioning → research → requirements → roadmap.

Candidate themes inherited from the v1.1 Future Requirements section:
- Per-cell CSS filters (brightness, contrast, saturation, blur, grayscale, sepia, hue-rotate, opacity)
- Text overlays per cell with font/size/color/position controls; rendered in export
- Save/load projects as `.storygrid.json`
- Aspect ratio presets (9:16 default, 1:1 1080×1080, 4:5 1080×1350)
- Multi-slide stories with add/remove/reorder pages and batch export

Carry-forward from v1.0 known gaps:
- D-16 (cell swap touch on iOS/Android) — still deferred, dnd-kit TouchSensor refactor required

---
*Last updated: 2026-04-08 — v1.1 UI Polish & Bug Fixes milestone shipped (4 phases, 11 plans, 2 days). Portal-based ActionBar stabilized, cell MOVE semantics added, safe-zone/template/drop-zone UX polished. Next: v1.2 Effects & Advanced scope definition.*
