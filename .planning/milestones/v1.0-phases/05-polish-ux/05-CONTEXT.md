# Phase 5: Polish & UX - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The editor's "completeness" layer: preset templates for quick layout creation, global style controls (gap/border radius/border color/background) visible in both editor and export, per-cell pan/zoom for repositioning images, cell-swap-by-drag via a drag handle button, dark editor theme, keyboard shortcuts, first-time onboarding overlay, and responsive sidebar layout. No video support (Phase 6). No per-cell CSS filters or text overlays (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Style Controls Panel
- **D-01:** A permanent **"Canvas" section** lives at the top of the sidebar, always visible, above the cell-selected panel. It contains: Gap slider, Border Radius slider, Border Color picker, Background picker. No collapse — always visible for fast access.
- **D-02:** The sidebar now has three stacked sections (top-to-bottom): Templates (toolbar popover — not sidebar), Canvas controls, Cell panel (shown when selected).
- **D-03:** Background control: **toggle between Solid and Gradient**. Solid = one color picker. Gradient = two color pickers + direction toggle (top→bottom, left→right, diagonal 135°). CSS `linear-gradient()` applied to the canvas container.
- **D-04:** All style settings (gap, radius, border color, background) must apply identically in both the editor preview and the ExportSurface off-screen div (POLH-11). These values live in `editorStore` (or a new `canvasSettingsStore` — planner's discretion) and are read by both surfaces.

### Templates Panel
- **D-05:** A **"Templates" button** in the toolbar opens a 2×3 popover grid of thumbnail-style buttons. The six presets: 2×1 (stacked), 1×2 (side-by-side), 2×2 (quad), 3-row, L-shape, Mosaic. Thumbnail is a small SVG/div representation of the layout.
- **D-06:** Applying a template to a **non-empty grid** shows a confirm dialog: "Apply [Name] template? This will clear all cells and images." On confirm, replace the entire grid via `clearGrid()` + build new tree. Template application pushes to undo history.
- **D-07:** Applying a template to an **empty grid** (single leaf, no media) applies silently without a dialog.

### Pan/Zoom Interaction
- **D-08:** Pan mode is entered via **double-click** on a selected cell that has media. If the cell is not yet selected, first click selects it; double-click enters pan mode.
- **D-09:** Visual feedback: **other cells get a semi-transparent dimmed overlay** (e.g., `bg-black/40` or similar) when pan mode is active on one cell. The active cell shows a distinct ring (amber/orange — different from the normal blue selection ring).
- **D-10:** Pan/zoom state stored on the leaf node as `panX: number` (percentage offset, -100 to +100), `panY: number`, `panScale: number` (1.0–3.0, clamped). Applied via CSS `transform: translate(panX%, panY%) scale(panScale)` on the `<img>`. This transform renders correctly in both editor and ExportSurface.
- **D-11:** **Drag in pan mode** = reposition (updates panX/panY). **Scroll in pan mode** = zoom (updates panScale). Escape or click-outside exits pan mode without triggering splits or other cell actions.
- **D-12:** The hover action bar (split/remove buttons) is hidden while pan mode is active on a cell. Pan mode state stored in `editorStore` as `panModeNodeId: string | null`.

### Cell Swap
- **D-13:** A **drag handle button** appears in the top-left corner of a filled cell's hover/selected action area (not floating — part of the existing ActionBar). Icon: a drag/move icon (e.g., `GripVertical` from lucide-react or similar). Visible on hover, like other action bar buttons.
- **D-14:** Dragging the handle uses **@dnd-kit** (already installed) to drag the cell over another cell. When dropped on a target cell, **all leaf content is swapped**: mediaId, fit, bgColor, panX, panY, panScale. The grid structure (cell positions, sizes, split directions) stays unchanged.
- **D-15:** Swap is a single undoable action (pushes to undo history).
- **D-16:** Cell swap works between any two cells (empty→filled, filled→empty, filled→filled). Swapping an empty cell with a filled cell effectively moves the media.

### Dark Editor Theme
- **D-17:** Theme colors are **fully specified in requirements** (POLH-08): background `#0a0a0a`–`#141414`, surfaces `#1a1a1a`–`#222`, borders `#333`, accent `#3b82f6`. The toolbar already uses `#1c1c1c` and `#2a2a2a` — apply consistently across all editor chrome. No theming system needed — just update Tailwind utility classes in Editor/Grid components.
- **D-18:** Canvas background (the editor's outer area, not the collage background) should be `#0f0f0f` or similar. The collage canvas container itself shows the user-selected background color (D-03).

### Keyboard Shortcuts
- **D-19:** Shortcuts are **fully specified in requirements** (POLH-09): `Ctrl+E` (export), `Delete`/`Backspace` (remove selected cell), `H` (split horizontal), `V` (split vertical), `F` (toggle fit), `Escape` (deselect / exit pan mode). `Ctrl+Z` / `Ctrl+Shift+Z` are already implemented (Phase 3).
- **D-20:** Shortcuts are global `keydown` listeners (attached at the app level, e.g., in `EditorShell` or `App`). They must be **no-ops when focus is in a text input** to avoid interfering with future text fields.

### First-Time Onboarding Overlay
- **D-21:** A **3-step highlight overlay** shown once on first load, controlled by a `localStorage` key (e.g., `storygrid_onboarding_done`). Once dismissed or completed, never shown again.
- **D-22:** Step structure:
  - Step 1/3: Highlights the canvas area → "Click a cell to select. Hover to see split options."
  - Step 2/3: Highlights a cell's hover zone (or the canvas generally) → "Drop images or click a cell to upload."
  - Step 3/3: Highlights the toolbar Export button → "Export your collage as a PNG."
- **D-23:** Always-visible **[Skip]** button. "Next →" advances steps. On final step, "Done" or "Next" dismisses. Semi-transparent dark backdrop with a highlighted cutout on the focused element.
- **D-24:** Implementation: a full-screen fixed overlay with a `clip-path` or `box-shadow` spotlight on the highlighted element. Popover tooltip card positioned near the highlighted element.

### Responsive Layout
- **D-25:** Editor requires **minimum 1024px width**. At widths 1024–1200px, the sidebar collapses to icon-only or reduced-width mode (exact breakpoint: planner's discretion). Below 1024px, show a "StoryGrid works best on desktop" notice. No mobile layout needed for MVP.

### Claude's Discretion
- Whether gap/radius/border settings live in `editorStore` (extending it) or a new `canvasSettingsStore` — avoid store proliferation but keep concerns reasonably separated
- Template thumbnail rendering: small SVG previews or styled divs — whichever is cleaner
- Exact L-shape and Mosaic tree structures — any reasonable interpretation matching the names
- Drag handle button position within the ActionBar — top-left corner of the bar, visually distinct from split/remove buttons
- Onboarding overlay spotlight technique (box-shadow inset, clip-path, or portal) — choose whatever renders correctly across target browsers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Polish & UX (POLH-01 through POLH-12) — full acceptance criteria for this phase

### Project Constraints
- `CLAUDE.md` §Technology Stack — Tailwind CSS v3, Zustand v5, @dnd-kit/core ^6.3.1 (installed at v10 — same API)
- `CLAUDE.md` §Rationale and Gotchas §@dnd-kit — performance note (irrelevant at ~20 cells), do NOT use @dnd-kit/react (alpha)
- `CLAUDE.md` §Rationale and Gotchas §Zustand 5.0.x — use `useShallow` for shallow comparisons, not custom equality functions

### Prior Phase Context
- `.planning/phases/04-export-engine/04-CONTEXT.md` — ExportSurface architecture (D-10 through D-13); style settings MUST also apply in ExportSurface
- `.planning/phases/03-media-upload-cell-controls/03-CONTEXT.md` — Toolbar layout, Sidebar structure, ActionBar hover actions pattern
- `.planning/phases/02-grid-rendering/02-CONTEXT.md` — CanvasWrapper/canvas scale, React.memo pattern for leaf nodes, editorStore.canvasScale

### Project Reference
- `.planning/PROJECT.md` §Accumulated Context — pan/zoom promoted to Phase 5; cell-swap added to Phase 5; "All Editor layout uses Tailwind utility classes only" (supports dark theme swap)
- `.planning/STATE.md` §Accumulated Context — "Canvas API used instead of html-to-image: zero-dependency, deterministic" (export engine changed in quick task)
- `.planning/STATE.md` §Quick Tasks Completed — Canvas API export (`quick/260401-oca`) replaces html-to-image; ExportSurface renders via canvas now

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Editor/ActionBar.tsx` — existing hover action bar (Split H/V, Remove, Toggle Fit, Clear, Replace). Add drag handle button here for cell swap.
- `src/Editor/Sidebar.tsx` — existing sidebar with NoSelectionPanel + SelectedCellPanel. Add Canvas section above these.
- `src/Editor/Toolbar.tsx` — existing toolbar. Add Templates button + keyboard shortcut handler here or in EditorShell.
- `src/store/editorStore.ts` — add `panModeNodeId`, gap, borderRadius, borderColor, background settings here (or split into canvasSettingsStore)
- `src/Grid/LeafNode.tsx` — extend with panX, panY, panScale; double-click handler for pan mode; CSS transform on img
- `src/types/` — extend LeafNode type with panX, panY, panScale fields
- `src/lib/tree.ts` — add `swapLeafContent()` pure tree function for cell swap action

### Established Patterns
- React.memo on all Grid components — must add memo to any new pan-mode overlay or onboarding component
- Tailwind utility classes only — no inline styles for theming; dark theme is a class update, not a CSS variable toggle
- Zustand per-node selectors — keep cell-swap and pan-mode changes granular to avoid full-tree re-renders
- Native HTML5 drag events for file drops; @dnd-kit for UI-to-UI drag interactions (cell swap)

### Integration Points
- ExportSurface (`src/Editor/ExportSurface.tsx` or similar) — must read gap, borderRadius, borderColor, background from store and apply identically
- `gridStore.ts` — add `swapCells(idA, idB)` action that calls `swapLeafContent()` and pushes to history
- Canvas background CSS: applied to the 1080×1920 canvas container, not the editor shell background

</code_context>

<specifics>
## Specific Ideas

- Pan mode visual: **dimmed overlay on other cells** (user's explicit preference over cursor-only change)
- Cell-swap: **drag handle button in top-left of action bar** — user's explicit preference over long-press or edge gestures
- Cell-swap scope: swap **all leaf content** (media + fit + bgColor + pan/zoom state) — not just media
- Onboarding: **3-step highlight overlay with skip** — user's explicit preference over simple tooltip
- Background gradient: **simple toggle (Solid / Gradient)** with 2 colors + direction toggle (not an angle slider)
- Template application: **confirm dialog for non-empty grids** (user confirmed)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-polish-ux*
*Context gathered: 2026-04-01*
