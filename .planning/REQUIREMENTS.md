# Requirements: StoryGrid

**Defined:** 2026-03-31
**Core Value:** A user can build a multi-cell photo collage from scratch, fill it with images, and download a pixel-perfect 1080×1920px PNG — entirely in the browser, no account or server required.

## v1 Requirements (MVP — Phases 0–5)

### Scaffolding

- [ ] **SCAF-01**: Project initializes with Vite 8 + React 18 + TypeScript and runs via `npm run dev` without errors
- [ ] **SCAF-02**: All MVP dependencies installed and importable (zustand, immer, tailwindcss ^3.4, @dnd-kit/core, @dnd-kit/sortable, html-to-image, lucide-react, nanoid)
- [ ] **SCAF-03**: Tailwind configured with canvas dimensions (1080×1920) and safe zone values (250px) as CSS variables
- [ ] **SCAF-04**: Folder structure matches spec (Editor/, Grid/, UI/, store/, lib/, types/)
- [ ] **SCAF-05**: App shell renders editor layout with placeholder canvas area, toolbar, and sidebar

### Grid Engine

- [ ] **GRID-01**: TypeScript types defined for GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection
- [ ] **GRID-02**: MediaItem stores a `mediaId` string reference; actual data URI lives in a separate `mediaRegistry` outside the undo-tracked tree
- [ ] **GRID-03**: Pure tree function `createLeaf()` creates an empty leaf node with a unique ID
- [ ] **GRID-04**: Pure tree function `splitNode()` replaces a leaf with a container holding the original + new empty leaf; if direction matches existing container, appends instead of nesting
- [ ] **GRID-05**: Pure tree function `mergeNode()` collapses a container back to a single leaf, preserving first child's media if present
- [ ] **GRID-06**: Pure tree function `removeNode()` removes a leaf and collapses parent if left with one child
- [ ] **GRID-07**: Pure tree function `resizeSiblings()` updates size fractions on a container's children
- [ ] **GRID-08**: Pure tree function `updateLeaf()` immutably updates a leaf's properties
- [ ] **GRID-09**: Pure tree functions `findNode()`, `findParent()`, `getAllLeaves()` work correctly at any nesting depth
- [ ] **GRID-10**: All pure tree functions return new tree — never mutate in place
- [ ] **GRID-11**: Zustand gridStore exposes split/merge/remove/resize/setMedia/updateCell/undo/redo actions
- [ ] **GRID-12**: Undo/redo uses history snapshot array (structuredClone, capped at 50); media registry excluded from snapshots
- [ ] **GRID-13**: Zustand editorStore manages selectedNodeId, zoom, showSafeZone, tool state

### Grid Rendering

- [ ] **REND-01**: GridNode component dispatches to Container or Leaf based on node type; is React.memo'd
- [ ] **REND-02**: Container renders as flex row/column with each child's size driven by `flex: {fraction}` from `sizes[]`
- [ ] **REND-03**: Divider between siblings is draggable via pointer events (setPointerCapture); updates size ratios in real-time; commits resize action on pointerup
- [ ] **REND-04**: Leaf renders empty state with dashed border, upload prompt, and drag-drop target
- [ ] **REND-05**: Leaf renders media state with `<img>` using `object-fit: cover` or `contain` matching `leaf.fit`
- [ ] **REND-06**: Leaf shows blue selection border when selected; hover state reveals floating action bar (Split H, Split V, Remove, Toggle Fit)
- [ ] **REND-07**: Canvas wrapper maintains 9:16 aspect ratio via CSS transform scale; centered in editor area
- [ ] **REND-08**: Optional safe zone overlay shows dashed guides 250px from top and bottom (toggleable)
- [ ] **REND-09**: Each ContainerNode and LeafNode uses React.memo with per-node Zustand slice selectors (no whole-tree subscriptions)
- [ ] **REND-10**: Each LeafNode container has `isolation: isolate` for Safari overflow/border-radius compatibility

### Media & Controls

- [ ] **MEDI-01**: Clicking an empty cell opens a file picker accepting image/* files
- [ ] **MEDI-02**: Dropping an image file onto a cell loads it into that cell (native drag events, not dnd-kit)
- [ ] **MEDI-03**: Uploaded images are converted to base64 data URIs at upload time and stored in mediaRegistry (never blob URLs in tree state)
- [ ] **MEDI-04**: Multi-file selection auto-fills empty cells in document order; creates new cells if files exceed empty cells
- [ ] **MEDI-05**: Cell hover action bar: Split Horizontal, Split Vertical, Remove Cell, Toggle Fit, Clear Media, Replace Media
- [ ] **MEDI-06**: Sidebar shows media thumbnail, fit toggle (cover/contain), background color picker (for contain mode), cell dimension info, Remove Cell, Clear Media buttons
- [ ] **MEDI-07**: Toolbar provides Undo/Redo buttons with Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
- [ ] **MEDI-08**: Toolbar provides zoom control (slider or +/– buttons, 50%–150%)
- [ ] **MEDI-09**: Toolbar provides safe zone toggle, Export button, and New/Clear button

### Export

- [ ] **EXPO-01**: Export renders the grid in a hidden off-screen div (position: absolute; left: -9999px; visibility: hidden) at actual 1080×1920px with no transform scaling
- [ ] **EXPO-02**: html-to-image `toPng()` is called twice; first result discarded (blank-PNG workaround); second result triggers download
- [ ] **EXPO-03**: Export never called on a container with video children (guarded by checking leaf types)
- [ ] **EXPO-04**: Downloaded PNG is exactly 1080×1920px; filename auto-generated as `storygrid-{timestamp}.png`
- [ ] **EXPO-05**: Export settings available: PNG (default) or JPEG with quality slider (0.7–1.0)
- [ ] **EXPO-06**: Progress indicator shown during export ("Preparing…" → "Exporting…"); errors shown as user-friendly message
- [ ] **EXPO-07**: ExportSurface component is always mounted (not conditionally rendered); hidden via visibility:hidden

### Polish & UX

- [ ] **POLH-01**: Preset templates panel with: 2×1 (stacked), 1×2 (side-by-side), 2×2 (quad), 3-row, L-shape, Mosaic layouts
- [ ] **POLH-02**: Global gap slider (0–20px) applies consistent spacing between all cells via CSS gap
- [ ] **POLH-03**: Global border radius slider (0–24px) applied to all leaf cells
- [ ] **POLH-04**: Border color picker for cell borders
- [ ] **POLH-05**: Canvas background color picker; gradient option (two colors + direction)
- [ ] **POLH-06**: Per-cell pan/zoom: double-click selected cell to enter pan mode; drag to reposition (updates object-position); scroll to scale within cell; Escape or click outside to exit
- [ ] **POLH-07**: Cell-swap-by-drag: drag a filled image cell over another cell to swap their media
- [ ] **POLH-08**: Dark editor theme — background #0a0a0a–#141414, surfaces #1a1a1a–#222, borders #333, accent #3b82f6
- [ ] **POLH-09**: Keyboard shortcuts: Ctrl+E (export), Delete/Backspace (remove selected), H (split H), V (split V), F (toggle fit), Escape (deselect)
- [ ] **POLH-10**: First-time onboarding tooltip: "Click a cell to select. Hover for split options. Drop images to fill."
- [ ] **POLH-11**: Gap/border radius/background settings applied correctly in both editor preview and exported PNG
- [ ] **POLH-12**: Editor is responsive at desktop min 1024px; sidebar collapses gracefully at narrower widths

## v2 Requirements (Video & Effects — Phases 6–7)

### Video Support (Phase 6)

- **VIDE-01**: Video files (video/*) accepted in media upload flow
- **VIDE-02**: Video cells render `<video>` with autoplay/muted/loop and object-fit matching leaf.fit
- **VIDE-03**: Timeline bar at bottom: master play/pause syncs all video cells; scrubbing seeks all simultaneously
- **VIDE-04**: @ffmpeg/ffmpeg lazy-loaded only when video cells exist and user clicks Export
- **VIDE-05**: Video export produces valid MP4 (H.264) at 1080×1920 using ffmpeg xstack filter
- **VIDE-06**: COOP/COEP headers configured in vercel.json / _headers for SharedArrayBuffer support
- **VIDE-07**: Export progress shown via ffmpeg progress callback

### Effects & Advanced (Phase 7)

- **EFCT-01**: Per-cell CSS filters: brightness, contrast, saturation, blur, grayscale, sepia, hue-rotate, opacity sliders
- **EFCT-02**: Text overlays per cell: font family, size, color, alignment, position (top/center/bottom); rendered in export
- **EFCT-03**: Multi-slide stories: add/remove/reorder pages; batch export as individual PNGs (zipped) or video segments
- **EFCT-04**: Save/load projects: serialize tree + settings to JSON using mediaId registry; store in localStorage; import/export as `.storygrid.json`
- **EFCT-05**: Aspect ratio presets: 9:16 (default), 1:1 (1080×1080), 4:5 (1080×1350)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend / server-side | Zero backend by design; static-only for instant deploy and privacy |
| User accounts / cloud storage | Local-only; no ops burden; Instagram Stories are ephemeral |
| Real-time collaboration | Single user session; major scope expansion with no v1 value |
| Safari video export | Limited SharedArrayBuffer support; explicitly deferred; documented in Phase 6 AC |
| AI layout suggestions | Anti-feature: high complexity, not core to the manual collage value proposition |
| Sticker / emoji overlays | Anti-feature: adds asset management complexity; not in the Figma-like design tool positioning |
| Direct Instagram publish API | Anti-feature: requires OAuth, app review, scope creep; download-and-upload workflow is sufficient |
| AI background removal | Anti-feature: cloud dependency, high cost, violates zero-backend constraint |
| Animated GIF export | Anti-feature: poor quality at 1080×1920; video export covers this use case |
| React 19 | Peer dependency risk with dnd-kit and html-to-image; no relevant new features for this SPA |
| Tailwind v4 | Requires Safari 16.4+; project targets Safari 15+; breaking config model |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 | Phase 0 | Pending |
| SCAF-02 | Phase 0 | Pending |
| SCAF-03 | Phase 0 | Pending |
| SCAF-04 | Phase 0 | Pending |
| SCAF-05 | Phase 0 | Pending |
| GRID-01 | Phase 1 | Pending |
| GRID-02 | Phase 1 | Pending |
| GRID-03 | Phase 1 | Pending |
| GRID-04 | Phase 1 | Pending |
| GRID-05 | Phase 1 | Pending |
| GRID-06 | Phase 1 | Pending |
| GRID-07 | Phase 1 | Pending |
| GRID-08 | Phase 1 | Pending |
| GRID-09 | Phase 1 | Pending |
| GRID-10 | Phase 1 | Pending |
| GRID-11 | Phase 1 | Pending |
| GRID-12 | Phase 1 | Pending |
| GRID-13 | Phase 1 | Pending |
| REND-01 | Phase 2 | Pending |
| REND-02 | Phase 2 | Pending |
| REND-03 | Phase 2 | Pending |
| REND-04 | Phase 2 | Pending |
| REND-05 | Phase 2 | Pending |
| REND-06 | Phase 2 | Pending |
| REND-07 | Phase 2 | Pending |
| REND-08 | Phase 2 | Pending |
| REND-09 | Phase 2 | Pending |
| REND-10 | Phase 2 | Pending |
| MEDI-01 | Phase 3 | Pending |
| MEDI-02 | Phase 3 | Pending |
| MEDI-03 | Phase 3 | Pending |
| MEDI-04 | Phase 3 | Pending |
| MEDI-05 | Phase 3 | Pending |
| MEDI-06 | Phase 3 | Pending |
| MEDI-07 | Phase 3 | Pending |
| MEDI-08 | Phase 3 | Pending |
| MEDI-09 | Phase 3 | Pending |
| EXPO-01 | Phase 4 | Pending |
| EXPO-02 | Phase 4 | Pending |
| EXPO-03 | Phase 4 | Pending |
| EXPO-04 | Phase 4 | Pending |
| EXPO-05 | Phase 4 | Pending |
| EXPO-06 | Phase 4 | Pending |
| EXPO-07 | Phase 4 | Pending |
| POLH-01 | Phase 5 | Pending |
| POLH-02 | Phase 5 | Pending |
| POLH-03 | Phase 5 | Pending |
| POLH-04 | Phase 5 | Pending |
| POLH-05 | Phase 5 | Pending |
| POLH-06 | Phase 5 | Pending |
| POLH-07 | Phase 5 | Pending |
| POLH-08 | Phase 5 | Pending |
| POLH-09 | Phase 5 | Pending |
| POLH-10 | Phase 5 | Pending |
| POLH-11 | Phase 5 | Pending |
| POLH-12 | Phase 5 | Pending |
| VIDE-01 | Phase 6 | Pending |
| VIDE-02 | Phase 6 | Pending |
| VIDE-03 | Phase 6 | Pending |
| VIDE-04 | Phase 6 | Pending |
| VIDE-05 | Phase 6 | Pending |
| VIDE-06 | Phase 6 | Pending |
| VIDE-07 | Phase 6 | Pending |
| EFCT-01 | Phase 7 | Pending |
| EFCT-02 | Phase 7 | Pending |
| EFCT-03 | Phase 7 | Pending |
| EFCT-04 | Phase 7 | Pending |
| EFCT-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 57 total (SCAF, GRID, REND, MEDI, EXPO, POLH)
- v2 requirements: 12 total (VIDE, EFCT)
- v1 mapped to phases: 57 ✓
- v2 mapped to phases: 12 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation — v2 requirements added to traceability*
