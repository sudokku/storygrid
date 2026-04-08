# StoryGrid

## What This Is

StoryGrid is a fully client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image or video. Zero backend — fully static, deploys to Vercel/Netlify.

**Current State:** v1.1 in progress. v1.0 shipped with full image/video support, mobile-first UI, Canvas API export, and MediaRecorder video export. v1.1 focuses on visual bug fixes and UX polish.

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

### Active

**Current Milestone (v1.1) — UI Polish & Bug Fixes**
- [x] Cell top-bar overflow: fix clipping when cells are small; controls must always be accessible — Validated in Phase 07: cell-controls-display-polish
- [x] Cell action bar sizing: stable vw/vh-based size regardless of screen dimensions — Validated in Phase 07: cell-controls-display-polish
- [x] Sidebar video thumbnail: extract and display first frame as preview image — Validated in Phase 07: cell-controls-display-polish
- [x] Safe zone overlay: replace toggle-only button with visible striped/dimmed unsafe-area indicator with icon — Validated in Phase 08: canvas-workspace-ux
- [x] Template change: remove confirmation alert, apply template silently — Validated in Phase 08: canvas-workspace-ux
- [x] Drop zone: expand to full workspace (excluding navbar/sidebar); clearer visual drop indication — Validated in Phase 08: canvas-workspace-ux
- [ ] Empty cell empty state: scale icon and text with vw/vh for large screens

**Future Milestone (v1.2) — Effects & Advanced**
- [ ] Per-cell CSS filters: brightness, contrast, saturation, blur, grayscale, sepia, hue-rotate, opacity
- [ ] Text overlays per cell: font family, size, color, alignment, position; rendered in export
- [ ] Save/load projects: serialize tree + settings to JSON; import/export as `.storygrid.json`
- [ ] Aspect ratio presets: 9:16 (default), 1:1 (1080×1080), 4:5 (1080×1350)
- [ ] Multi-slide stories: add/remove/reorder pages, batch export

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

Current state (v1.0):
- ~10,683 lines TypeScript/TSX
- Tech stack: Vite 8, React 18.3.1, TypeScript 5.9.3, Zustand 5.0.12, Immer 10.2.0, Tailwind 3.4.19
- 23 plans shipped across 8 phases (7 days, 2026-03-31 → 2026-04-07)

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
| D-16 (cell swap touch) deferred | iOS/Android don't fire HTML5 drag events; dnd-kit TouchSensor is non-trivial refactor | ⚠️ Revisit — document as known gap for v1.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current Milestone: v1.1 UI Polish & Bug Fixes

**Goal:** Fix visual bugs and polish the editing experience — no new features.

**Target issues:**
- Cell top-bar overflow fix and stable vw/vh sizing for action controls
- Sidebar video thumbnail (first-frame extraction)
- Safe zone overlay visual indicator (striped/dimmed unsafe areas with icon)
- Template change alert removal (silent apply)
- Full-workspace drop zone with clear visual indication
- Empty cell icon/text scaling via vw/vh for large screens

---
*Last updated: 2026-04-08 — Phase 09 complete (cell movement and swapping: moveLeafToEdge primitive, atomic moveCell action, 5-zone LeafNode overlay, empty-cell drag handle)*
