# Roadmap: StoryGrid

## Overview

StoryGrid builds in eight phases: scaffolding the Vite + React + TypeScript foundation, implementing the recursive split-tree engine and its Zustand stores, rendering the grid with live-draggable dividers, wiring up media upload and cell controls, shipping a pixel-perfect PNG export engine, polishing the UX with templates and pan/zoom, then extending to video support (v2) and advanced effects (v2+). Every v1 requirement maps to exactly one phase; phases 6-7 are deferred v2 work.

## Phases

**Phase Numbering:**
- Integer phases (0-7): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked INSERTED)

- [x] **Phase 0: Project Scaffolding** - Initialize Vite + React + TypeScript project with full dependency set and editor shell (completed 2026-03-31)
- [ ] **Phase 1: Grid Tree Engine** - Pure tree functions, Zustand stores (grid + editor), mediaId/registry split, undo/redo
- [ ] **Phase 2: Grid Rendering** - Recursive React components, pointer-event dividers, canvas transform, Safari fixes
- [x] **Phase 3: Media Upload & Cell Controls** - File picker, drag-drop, base64 conversion, action bar, sidebar, toolbar (completed 2026-04-01)
- [x] **Phase 4: Export Engine** - Canvas API tree renderer, PNG/JPEG download, progress toast, split-button UI (completed 2026-04-01)
- [x] **Phase 5: Polish & UX** - Templates, gap/radius/bg controls, pan/zoom, cell-swap, dark theme, keyboard shortcuts (completed 2026-04-02)
- [ ] **Phase 6: Video Support (v2)** - Video cells, playback timeline, ffmpeg.wasm MP4 export, COOP/COEP headers
- [ ] **Phase 7: Effects & Advanced (v2+)** - Per-cell filters, text overlays, multi-slide, save/load JSON, aspect ratio presets

## Phase Details

### Phase 0: Project Scaffolding
**Goal**: A working Vite + React + TypeScript development environment with all MVP dependencies installed and an editor shell visible in the browser
**Depends on**: Nothing (first phase)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05
**Success Criteria** (what must be TRUE):
  1. `npm run dev` starts without errors and opens the app in a browser
  2. All MVP dependencies (zustand, immer, tailwindcss, @dnd-kit/core, html-to-image, lucide-react, nanoid) are importable without TypeScript errors
  3. The browser shows a three-region editor layout: canvas area, toolbar, and sidebar (placeholder content is fine)
  4. Tailwind CSS variables for canvas dimensions (1080x1920) and safe zone (250px) are defined and accessible
  5. Folder structure matches spec (Editor/, Grid/, UI/, store/, lib/, types/) with index files present
**Plans**: 1 plan
Plans:
- [x] 00-01-PLAN.md — Scaffold project, install deps, create editor shell, write validation tests

### Phase 1: Grid Tree Engine
**Goal**: A fully tested pure-function tree library and two Zustand stores (gridStore + editorStore) that manage the recursive split-tree with undo/redo and a mediaId/registry separation
**Depends on**: Phase 0
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, GRID-05, GRID-06, GRID-07, GRID-08, GRID-09, GRID-10, GRID-11, GRID-12, GRID-13
**Success Criteria** (what must be TRUE):
  1. Calling `splitNode()` on a leaf produces a container with two children; calling it again on the same axis appends rather than nests
  2. Undo/redo steps through tree mutations correctly; redo stack clears on new action
  3. Media data URIs never appear in undo history snapshots — only `mediaId` strings are snapshotted
  4. `getAllLeaves()` returns the correct set of leaf nodes at any nesting depth with no duplicates
  5. All pure tree functions return new tree references and never mutate the input
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Types + pure tree functions with TDD (GRID-01 through GRID-10)
- [x] 01-02-PLAN.md — gridStore + editorStore with undo/redo and TDD (GRID-11, GRID-12, GRID-13)

### Phase 2: Grid Rendering
**Goal**: The grid tree renders visually as a nested flex layout; dividers are draggable in real-time via pointer events; the canvas scales correctly in the editor; Safari overflow clipping works
**Depends on**: Phase 1
**Requirements**: REND-01, REND-02, REND-03, REND-04, REND-05, REND-06, REND-07, REND-08, REND-09, REND-10
**Success Criteria** (what must be TRUE):
  1. Splitting a cell renders a visible divider between siblings; dragging the divider resizes both siblings in real-time with no lag
  2. Leaf cells show a dashed-border empty state; filled cells show the image with correct object-fit (cover or contain)
  3. Selected leaf shows a blue border; hovering reveals the floating action bar (Split H, Split V, Remove, Toggle Fit)
  4. The canvas maintains a 9:16 aspect ratio and scales via CSS transform to fit the viewport; the optional safe-zone guides toggle on/off
  5. No whole-tree re-renders occur on single-node state changes (each node subscribes to its own slice only)
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Foundation: type fix, shadcn init, dark theme, CanvasWrapper, SafeZoneOverlay, test scaffolds
- [x] 02-02-PLAN.md — Core grid components: GridNode, ContainerNode, Divider, LeafNode, ActionBar
- [x] 02-03-PLAN.md — Integration tests and visual verification checkpoint

### Phase 3: Media Upload & Cell Controls
**Goal**: Users can fill cells with images via click-to-upload or drag-and-drop; images are stored as base64 data URIs; the sidebar and toolbar provide complete cell management controls
**Depends on**: Phase 2
**Requirements**: MEDI-01, MEDI-02, MEDI-03, MEDI-04, MEDI-05, MEDI-06, MEDI-07, MEDI-08, MEDI-09
**Success Criteria** (what must be TRUE):
  1. Clicking an empty cell opens the OS file picker; selecting an image fills that cell immediately
  2. Dropping an image file onto a cell fills it; dropping multiple files onto the canvas fills empty cells in order
  3. All uploaded images are stored as base64 data URIs in the mediaRegistry — no blob URLs exist in any store state
  4. The sidebar shows the selected cell's thumbnail, fit toggle, background color picker, dimension info, and Remove/Clear buttons
  5. Ctrl+Z undoes the last tree mutation; Ctrl+Shift+Z redoes it; the toolbar zoom control scales the canvas preview
**Plans**: 3 plans
Plans:
- [x] 03-01-PLAN.md — Core data + upload infrastructure: type extension, clearGrid, media utilities, ActionBar + LeafNode wiring (MEDI-01, MEDI-02, MEDI-03, MEDI-04, MEDI-05)
- [x] 03-02-PLAN.md — Toolbar + Sidebar: wired controls, properties panel, keyboard shortcuts (MEDI-06, MEDI-07, MEDI-08, MEDI-09)
- [x] 03-03-PLAN.md — Integration tests: media utilities, ActionBar, Toolbar, Sidebar, keyboard shortcuts (MEDI-01 through MEDI-09)

### Phase 4: Export Engine
**Goal**: Users can export the current grid as a pixel-perfect 1080x1920px PNG (or JPEG) that downloads directly from the browser, with progress feedback and graceful error handling
**Depends on**: Phase 3
**Requirements**: EXPO-01, EXPO-02, EXPO-03, EXPO-04, EXPO-05, EXPO-06, EXPO-07
**Success Criteria** (what must be TRUE):
  1. Clicking Export downloads a PNG file named `storygrid-{timestamp}.png` that is exactly 1080x1920px when opened in an image viewer
  2. The export progress UI transitions through "Preparing..." -> "Exporting..." -> completion (or an error message) -- the button never appears to hang
  3. JPEG export at a user-selected quality level produces a smaller file than PNG for the same canvas
  4. The ExportSurface div is always present in the DOM (never conditionally mounted); it is hidden via visibility:hidden and does not affect the editor layout
  5. Export is blocked (with a clear message) if any cell contains a video -- the image-only path never attempts to capture video frames
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — Foundation: ExportModeContext, editorStore export state, Grid component export-mode suppression, ExportSurface, export core logic, EditorShell wiring (EXPO-01, EXPO-02, EXPO-03, EXPO-04, EXPO-07)
- [x] 04-02-PLAN.md — Export UI: ExportSplitButton with popover, Toast notifications, Toolbar integration, visual verification (EXPO-05, EXPO-06)

### Phase 5: Polish & UX
**Goal**: The editor feels complete: preset templates speed up layout creation, global style controls (gap, radius, background) work in both preview and export, pan/zoom lets users reposition images within cells, and the dark theme + keyboard shortcuts give it a professional feel
**Depends on**: Phase 4
**Requirements**: POLH-01, POLH-02, POLH-03, POLH-04, POLH-05, POLH-06, POLH-07, POLH-08, POLH-09, POLH-10, POLH-11, POLH-12
**Success Criteria** (what must be TRUE):
  1. Clicking a preset template (e.g., 2x2) instantly replaces the canvas with the correct layout and empty cells
  2. Moving the gap slider changes spacing between all cells live in the editor; the exported PNG reflects the same spacing
  3. Double-clicking a selected cell enters pan mode; dragging repositions the image within the cell; Escape exits without accidental splits
  4. Dragging a filled cell over another filled cell swaps their images
  5. All 8 keyboard shortcuts (Ctrl+E, Delete, H, V, F, Escape, Ctrl+Z, Ctrl+Shift+Z) work without focus on a text input
**Plans**: 5 plans
Plans:
- [x] 05-01-PLAN.md — Types, stores, templates popover, canvas settings panel, grid rendering (POLH-01, POLH-02, POLH-03, POLH-04, POLH-05)
- [x] 05-02-PLAN.md — Dark theme, keyboard shortcuts, responsive sidebar (POLH-08, POLH-09, POLH-12)
- [x] 05-03-PLAN.md — Pan/zoom interaction, cell swap via @dnd-kit drag handle (POLH-06, POLH-07)
- [x] 05-04-PLAN.md — Export canvas settings integration, onboarding overlay (POLH-10, POLH-11)
- [x] 05-05-PLAN.md — Wire export call, visual verification checkpoint (all POLH requirements)
**UI hint**: yes

### Phase 6: Video Support (v2)
**Goal**: Users can add video files to cells, preview them playing in sync, and export the composition as an MP4 using ffmpeg.wasm -- with COOP/COEP headers correctly configured for SharedArrayBuffer
**Depends on**: Phase 5
**Requirements**: VIDE-01, VIDE-02, VIDE-03, VIDE-04, VIDE-05, VIDE-06, VIDE-07
**Success Criteria** (what must be TRUE):
  1. Dropping a video file onto a cell renders a looping, muted video with the correct object-fit
  2. The timeline bar's play/pause button starts and pauses all video cells simultaneously; scrubbing seeks all videos to the same position
  3. Clicking Export with video cells present triggers ffmpeg.wasm loading (not before); a progress bar reflects ffmpeg encoding progress
  4. The exported file is a valid MP4 at 1080x1920px that plays in Chrome and Firefox
  5. COOP/COEP headers are active in the deployed build and do not break image-only usage (no CORP errors for self-hosted assets)
**Plans**: TBD

### Phase 7: Effects & Advanced (v2+)
**Goal**: Power users can apply per-cell CSS filters, add text overlays, work with multiple story slides, save/load projects as JSON, and switch between Instagram aspect ratio presets
**Depends on**: Phase 6
**Requirements**: EFCT-01, EFCT-02, EFCT-03, EFCT-04, EFCT-05
**Success Criteria** (what must be TRUE):
  1. Adjusting a cell's brightness or saturation slider updates the cell's appearance in real-time and is reflected in the exported image
  2. Adding a text overlay to a cell renders the text at the specified position, font, and color -- and the text appears in the exported PNG/MP4
  3. A project (tree + settings + media registry) can be exported as a `.storygrid.json` file and re-imported to restore the exact same canvas state
  4. Switching to the 1:1 aspect ratio preset reflows the canvas to 1080x1080px; the grid tree and cell contents are preserved
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Project Scaffolding | 1/1 | Complete   | 2026-03-31 |
| 1. Grid Tree Engine | 0/2 | Not started | - |
| 2. Grid Rendering | 1/3 | In Progress|  |
| 3. Media Upload & Cell Controls | 3/3 | Complete   | 2026-04-01 |
| 4. Export Engine | 2/2 | Complete   | 2026-04-01 |
| 5. Polish & UX | 4/5 | In Progress|  |
| 6. Video Support (v2) | 0/TBD | Not started | - |
| 7. Effects & Advanced (v2+) | 0/TBD | Not started | - |
