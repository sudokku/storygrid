# StoryGrid

## What This Is

StoryGrid is a client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image (MVP) or video (v1). Zero backend — fully static, deploys to Vercel/Netlify.

## Core Value

A user can build a multi-cell photo collage from scratch, fill it with images, and download a pixel-perfect 1080×1920px PNG — entirely in the browser, no account or server required.

## Requirements

### Validated

**Phase 0 — Scaffolding** (Validated in Phase 00: project-scaffolding)
- [x] Vite + React 18 + TypeScript project initializes and runs
- [x] All MVP dependencies installed (zustand, immer, tailwindcss, @dnd-kit/core, @dnd-kit/sortable, html-to-image, lucide-react, nanoid)
- [x] Folder structure matches the specified layout (Editor, Grid, UI, store, lib, types)
- [x] Tailwind configured with canvas dimensions and safe zone as CSS variables
- [x] App shell renders editor layout (canvas area, toolbar, sidebar)

### Active

**Phase 1 — Grid Tree Engine**
- [ ] TypeScript types: GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection
- [ ] Pure tree functions: createLeaf, splitNode, mergeNode, removeNode, resizeSiblings, updateLeaf, findNode, findParent, getAllLeaves
- [ ] Zustand gridStore with split/merge/remove/resize/setMedia/updateCell/undo/redo actions
- [ ] Zustand editorStore with selectedNodeId/zoom/showSafeZone/tool state
- [ ] Undo/redo via history snapshots (push on every mutating action)

**Phase 2 — Grid Rendering**
- [ ] GridNode recursive component dispatches to Container or Leaf
- [ ] Container renders flex layout (row/column) with correct child sizing via flex fractions
- [ ] Divider is draggable and updates size ratios in real-time via pointer events
- [ ] Leaf renders empty state (dashed border, upload prompt), media state (img with object-fit), and selected state (blue border)
- [ ] Leaf hover actions: Split H, Split V, Remove, Toggle fit
- [ ] Canvas maintains 9:16 aspect ratio, scales via transform, shows optional safe zone overlay

**Phase 3 — Media Upload & Cell Controls**
- [ ] Clicking empty cell opens file picker (image/*)
- [ ] Dragging image file onto cell drops it in
- [ ] Multi-file upload auto-fills empty cells in order
- [ ] Cell hover actions: split H/V, remove, toggle fit, clear media, replace media
- [ ] Sidebar shows: media thumbnail, fit toggle, background color picker, cell info, remove/clear buttons
- [ ] Toolbar: undo/redo (with Ctrl+Z/Ctrl+Shift+Z), zoom control, safe zone toggle, export button, new/clear

**Phase 4 — Export Engine**
- [ ] Off-screen hidden div renders grid at actual 1080×1920px
- [ ] html-to-image toPng() captures the off-screen div
- [ ] PNG downloads via <a> tag with timestamp filename
- [ ] Export settings: PNG/JPEG format, JPEG quality slider
- [ ] Export progress indicator shown during capture
- [ ] Graceful error handling if export fails

**Phase 5 — Polish & UX**
- [ ] Preset templates panel: 2×1, 1×2, 2×2, 3-row, L-shape, Mosaic
- [ ] Global gap slider (0–20px between cells)
- [ ] Border radius slider (0–24px on leaf cells)
- [ ] Border color picker
- [ ] Canvas background color + gradient option
- [ ] Dark editor theme (background #0a0a0a–#141414, surfaces #1a1a1a–#222)
- [ ] Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+E, Delete, H, V, F, Escape
- [ ] First-time onboarding tooltip/overlay
- [ ] Responsive editor (desktop min 1024px, sidebar collapses on smaller)

**Phase 6 (v1) — Video Support**
- [ ] Video files accepted in media upload (video/*)
- [ ] Video cells render <video> with autoplay/muted/loop, matching object-fit
- [ ] Playback timeline at bottom: master play/pause, scrubbing syncs all videos
- [ ] ffmpeg.wasm lazy-loaded for video export
- [ ] Video export: MP4 (H.264) at 1080×1920 using xstack filter
- [ ] COOP/COEP headers configured in Vercel/Netlify

**Phase 7 (v1+) — Effects & Advanced**
- [ ] Per-cell CSS filters: brightness, contrast, saturation, blur, grayscale, sepia, hue rotation, opacity
- [ ] Cell zoom & pan: drag to reposition, scroll to scale within cell (object-position)
- [ ] Text overlays per cell: font, size, color, alignment, position
- [ ] Multi-slide stories: add/remove/reorder pages, batch export
- [ ] Save/load projects: serialize to JSON, store in localStorage, import/export as .storygrid.json
- [ ] Aspect ratio presets: 9:16 (default), 1:1, 4:5

### Out of Scope

- Backend / server-side rendering — zero backend by design; static-only
- User accounts / cloud storage — MVP is local-only
- Real-time collaboration — single user session only
- Safari video export — limited SharedArrayBuffer support; explicitly deferred

## Context

The grid uses a **recursive split-based tree structure** modeled after Figma's frame splitting. The canvas is always 1080×1920px internally; the editor shows a scaled-down preview via CSS `transform: scale()`. The dual-render approach (scaled preview + hidden full-res div for export) is a key architectural decision.

Key technical notes:
- Instagram safe zones: ~250px from top and bottom (show as toggleable dashed guides)
- COOP/COEP headers only required for v1 video (ffmpeg.wasm SharedArrayBuffer)
- localStorage IS available for save/load (this is a standalone Vite app, not an artifact)
- React.memo must be used aggressively on tree nodes to achieve <16ms re-renders

## Constraints

- **Tech Stack**: Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — pre-decided, do not substitute
- **State Library**: Zustand with Immer middleware — immutable updates on nested tree, undo/redo via history array
- **Export (MVP)**: html-to-image `toPng()` — fallback to Canvas API if CSS fidelity issues arise
- **Video Export (v1)**: @ffmpeg/ffmpeg + @ffmpeg/util — lazy-loaded, ~25MB WASM core
- **Bundle Size**: MVP bundle under 500KB gzipped; ffmpeg.wasm excluded from initial bundle
- **Browser Support**: Chrome 90+, Firefox 90+, Safari 15+ (MVP). Video export Chrome/Firefox only.
- **Deployment**: Vite static build → dist/ → Vercel or Netlify

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Recursive split-tree (not CSS grid) | Enables arbitrary nesting depth, maps directly to tree data structure, same model as Figma | — Pending |
| Dual render (scaled preview + hidden full-res div) | Export must be pixel-perfect 1080×1920; editor must fit viewport | — Pending |
| html-to-image for MVP export | Simplest approach; no canvas drawing logic needed for complex CSS layouts | — Pending |
| No backend / localStorage only | Zero ops, instant deploy, privacy-first — Instagram Stories are ephemeral anyway | — Pending |
| @dnd-kit for D&D | More flexible than react-dnd, works with pointer events, supports custom sensors | — Pending |
| ffmpeg.wasm lazy-loaded (v1 only) | 25MB WASM shouldn't hit MVP users; only loaded when video export is triggered | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 — Phase 00 complete*
