# StoryGrid

## What This Is

StoryGrid is a fully client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image or video. Zero backend — fully static, deploys to Vercel/Netlify.

**Current State:** v1.4 Mobile-First Overhaul & Instagram Fonts shipped 2026-04-17 (5 phases, 6 plans, 76 commits, +12,160 LOC). Cumulative state: v1.0 delivered full image/video support, mobile-first UI, Canvas API export, and Mediabunny video export; v1.1 polished the editing experience with portal-based ActionBar, safe-zone visual overlay, friction-free template apply, full-workspace drop zone, and atomic cell MOVE semantics; v1.2 added per-cell effects (6 presets + 4 sliders), per-cell audio toggle, text/emoji/sticker overlay layer, Mediabunny direct MP4 pipeline (no COOP/COEP, no ffmpeg.wasm), Mediabunny VideoSampleSink decode-then-encode pipeline (eliminated 99.4% of export seek time), and a developer export metrics panel; v1.3 added Instagram-style named filter presets, auto-mute detection, breadth-first media drop, playback UI polish, and live audio preview; v1.4 overhauled mobile UX (5-button header, toggle-based bottom sheet, cell action tray, touch drag-and-drop) and added 8 Instagram-style Google Fonts for text overlays.

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

**Phase 11 — Effects & Filters** (v1.2)
- ✓ Per-cell effects data model — required `effects: EffectSettings` field on LeafNode (EFF-01, EFF-02, EFF-03, EFF-04, EFF-07) — v1.2
- ✓ Six preset filters (B&W, Sepia, Vivid, Fade, Warm, Cool) with contract-locked numeric tuples (EFF-01, EFF-10) — v1.2
- ✓ Four sliders — brightness, contrast, saturation, blur — with drag-to-one-undo semantics (EFF-02, EFF-03, EFF-04, EFF-05, EFF-09) — v1.2
- ✓ Single-hook draw path — `drawLeafToCanvas` applies `ctx.filter` from `leaf.effects` with blur overdraw + clip, guaranteeing preview ≡ PNG ≡ MP4 (EFF-08) — v1.2
- ✓ Reset effects / Reset cell buttons in the sidebar EffectsPanel (EFF-06) — v1.2
- ✓ UAT confirmed by user — 2-video + 2-image story exported successfully with presets and sliders applied (2026-04-09)

**Phase 12 — Per-Cell Audio Toggle** (v1.2)
- ✓ Required `audioEnabled: boolean` field on LeafNode, defaulting to `true` in `createLeaf()` (AUD-01, AUD-09) — v1.2
- ✓ `toggleAudioEnabled(nodeId)` store action with single-snapshot undo — v1.2
- ✓ Audio toggle button in portal ActionBar, video-only via `mediaTypeMap[leaf.mediaId]`, `Volume2`/`VolumeX` icons with muted state styling (AUD-02, AUD-03) — v1.2
- ✓ Sidebar `Playback` subsection above `EffectsPanel` with matching toggle, shared across desktop + mobile sheet via `SelectedCellPanel` (AUD-04) — v1.2
- ✓ `buildExportVideoElements()` sets `video.muted` per-cell from `audioEnabled` (AUD-05) — v1.2
- ✓ `buildAudioGraph()` wires audio-enabled video cells into `MediaStreamAudioDestinationNode`; `exportVideoGrid()` conditionally merges audio track into canvas MediaStream; AudioContext lifecycle closed in all paths (onstop, onerror, render-catch); no-audio fallback on any error (AUD-06, AUD-07) — v1.2
- ✓ Zero-audio-enabled collage skips audio graph entirely → exported MP4 has NO audio track (not a silent one) (AUD-06) — v1.2
- ✓ 28 new tests across store, ActionBar, Sidebar, and videoExport-audio; full suite 567 passed / 2 skipped — v1.2
- ⏳ AUD-08 (persist `audioEnabled` in project file) deferred to Phase 14 Project Persistence — Phase 12 delivers only the data-model precondition
- ⏳ Human-UAT pending: audio fidelity in exported MP4 + ffprobe no-audio-track confirmation (12-HUMAN-UAT.md)

**Phase 13 — Text & Sticker Overlay Layer** (v1.2)
- ✓ Overlay type union (TextOverlay, EmojiOverlay, StickerOverlay) with VISUAL CENTER coordinate convention — v1.2
- ✓ Zustand+Immer `overlayStore` with 8 actions; `stickerRegistry` side-channel mirrors `mediaRegistry` — v1.2
- ✓ OverlayLayer rendering above the grid; drag, corner-handle resize, rotation handle; `pointer-events-none` on non-selected overlays — v1.2
- ✓ Text overlay inline editing + styling controls (font family/size/color/weight/alignment) — v1.2
- ✓ Emoji picker panel + custom PNG/SVG image sticker upload with DOMPurify sanitization — v1.2
- ✓ Export integration: overlays rendered at 1080×1920 in both PNG and MP4 export paths (OVL-16) — v1.2
- ✓ Overlay selection mutually exclusive with cell selection (OVL-15); Delete key + trash button for removal (OVL-13) — v1.2

**Phase 14 — Migrate video export to Mediabunny** (v1.2)
- ✓ `@ffmpeg/ffmpeg` and `@ffmpeg/util` removed; `mediabunny@^1.40.1` and `@mediabunny/aac-encoder@^1.40.1` installed — v1.2
- ✓ `src/lib/transcodeToMp4.ts` deleted; COOP/COEP headers removed from `vercel.json` and `public/_headers` — v1.2
- ✓ `videoExport.ts` rewritten: Mediabunny `CanvasSource`+`AudioBufferSource` pipeline, OfflineAudioContext audio mixing, VP9/AVC codec selection, non-fatal AAC fallback via `onWarning` callback — v1.2
- ✓ 628 tests pass / 2 skipped; zero COOP/COEP dependency — v1.2

**Phase 15 — Mediabunny VideoSampleSink Decode Pipeline** (v1.2)
- ✓ Extended `export.ts` to handle `VideoFrame` and `OffscreenCanvas` as `CanvasImageSource` drawable types — v1.2
- ✓ Replaced frame-by-frame seeking (99.4% of export time) with Mediabunny `VideoSampleSink` decode-then-encode: all frames decoded upfront, drawn directly during encode loop — v1.2
- ✓ Sequential per-video decode bounds peak GPU memory to one video at a time; `findSampleForTime()` O(log n) frame lookup; GPU memory cleanup in `finally` block — v1.2

**Phase 16 — Export Metrics Panel** (v1.2)
- ✓ `ExportMetrics` interface with 17 fields (timing, throughput, JS heap, active bitmaps/frames, device info) — v1.2
- ✓ `videoExport.ts` instrumented with local counters and `performance.mark` calls via optional `onMetrics` callback — v1.2
- ✓ `ExportMetricsPanel` component: fixed overlay, ref-based 250ms polling (no React re-renders per frame), Shift+M toggle, collapse/expand — v1.2
- ✓ Feature-flagged via `VITE_ENABLE_EXPORT_METRICS`; Vite tree-shaking = zero production cost — v1.2
- ✓ Human-verified on 749-frame export — no memory leaks — v1.2

**Phase 22 — Mobile Header & Touch Polish** (v1.4)
- ✓ HEADER-01: Export, Undo, Redo, Templates, Clear in mobile header toolbar — v1.4
- ✓ HEADER-02: All header touch targets ≥44×44px with ≥8px gaps — v1.4
- ✓ SCROLL-01: `overscroll-behavior: contain` on canvas area prevents pull-to-refresh — v1.4
- ✓ SCROLL-02: `touch-action: manipulation` eliminates 300ms tap delay — v1.4

**Phase 23 — Bottom Sheet Redesign** (v1.4)
- ✓ SHEET-01: Bottom sheet opens/closes via chevron toggle (drag-pill removed) — v1.4
- ✓ SHEET-02: Bottom sheet auto-expands to full height when a cell is selected — v1.4
- ✓ SHEET-03: All bottom sheet content scrollable; nothing cut off in any snap state — v1.4
- ✓ SHEET-04: Bottom sheet collapses to visible tab strip (not hidden) — v1.4

**Phase 24 — Mobile Cell Action Tray** (v1.4)
- ✓ CELL-01: Persistent cell action tray appears above sheet when a cell is tapped — v1.4
- ✓ CELL-02: Tray exposes Upload, Split H, Split V, Fit toggle, Clear — v1.4
- ✓ CELL-03: Tray buttons ≥44×44px with ≥8px gaps — v1.4

**Phase 25 — Touch Drag-and-Drop** (v1.4)
- ✓ DRAG-01: Long-press (≥500ms) initiates cell drag on mobile — v1.4
- ✓ DRAG-02: Dragged cell shows visual lift feedback (opacity + box-shadow) — v1.4
- ✓ DRAG-03: 5-zone drop overlays appear on all cells during drag — v1.4
- ✓ DRAG-04: Center drop = swap; edge drop = insert — v1.4
- ⚠️ Touch drag UX flagged for overhaul in v1.5 — interaction model ships but needs redesign

**Phase 26 — Instagram-Style Fonts** (v1.4)
- ✓ FONT-01: 8 Google Fonts available in text overlay picker — v1.4
- ✓ FONT-02: Fonts load async with `font-display: swap` (no FOIT) — v1.4
- ✓ FONT-03: Each font name rendered in its own typeface for visual preview — v1.4

### Active

*No active milestone requirements — v1.4 complete. Next: `/gsd-new-milestone` to define v1.5.*

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
| Mediabunny direct MP4 encoding (Phase 14) | Two-stage MediaRecorder+ffmpeg.wasm replaced by Mediabunny WebCodecs pipeline — direct MP4 via CanvasSource+AudioBufferSource, OfflineAudioContext audio mix, no WASM, no COOP/COEP | ✓ Good — simpler pipeline, maintains full audio parity (AUD-05, AUD-06, AUD-07) |
| Mediabunny VideoSampleSink for decode (Phase 15) | Used Mediabunny's higher-level decode API instead of raw WebCodecs VideoDecoder — simpler GPU memory management, no low-level codec configuration | ✓ Good — eliminated 99.4% of export time (seeking bottleneck); sequential decode bounds peak GPU memory |
| PERS-01..PERS-12 dropped from v1.2 | Phase 14 slot repurposed for Mediabunny migration; persistence deferred to v1.3 | — Deferred — AUD-08 deferred alongside PERS block |
| Export Metrics Panel feature-flagged (Phase 16) | `VITE_ENABLE_EXPORT_METRICS` + Vite tree-shaking = zero production cost; ref-based polling avoids React re-renders during export | ✓ Good — developer tool with no user-facing cost |
| MobileCellTray as separate component (Phase 24) | ActionBar stays desktop-only (hover-gated); mobile gets dedicated tray — no changes to portal ActionBar architecture | ✓ Good — clean separation, no regression risk to desktop |
| SheetSnapState narrowed to collapsed\|full (Phase 23) | Half-snap removed — simplifies all sheet state transitions and eliminates the "cut-off controls" class of bugs | ✓ Good — dramatically simpler state machine |
| TouchSensor + MouseSensor unified at delay:500 (Phase 25) | Same threshold across pointer devices ensures consistent long-press behavior; no device-specific branching | ✓ Good — consistent UX across desktop and mobile |
| Google Fonts via consolidated `<link>` in index.html (Phase 26) | Single HTTP request for all 8 families with `display=swap`; no JS font loading API needed | ✓ Good — simple, zero runtime overhead |
| Touch drag-and-drop architecture flagged for overhaul (Phase 25) | Current `useDndMonitor`+`DragZoneRefContext` approach works but interaction model needs redesign; deferred to v1.5 | ⚠️ Revisit — quick-task fix post-phase suggests underlying architectural debt |

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
*Last updated: 2026-04-17 after v1.4 milestone — 5 phases / 6 plans shipped. Touch drag-and-drop (DRAG-01..04) shipped but flagged for v1.5 overhaul. PERS-01..12 deferred again. Next milestone: `/gsd-new-milestone`.*
