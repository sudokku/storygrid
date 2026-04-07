# Phase 3: Media Upload & Cell Controls - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the full media interaction layer: clicking/dragging images into cells, a multi-file auto-fill flow, extending the action bar with Upload/Replace, building out the Toolbar (undo/redo + keyboard shortcuts, zoom, safe zone toggle, export button, new/clear), and building the Sidebar as a real properties panel. No export logic (Phase 4) and no visual polish controls (Phase 5) — just the functional controls that make the grid usable with real images.

</domain>

<decisions>
## Implementation Decisions

### Upload Trigger Model
- **D-01:** Clicking a cell **always selects it** — empty or filled. No click-to-upload shortcut on empty cells.
- **D-02:** Upload is triggered via a dedicated **Upload button in the action bar**, positioned **before** the Split H/V buttons. For filled cells the same button becomes "Replace".
- **D-03:** The sidebar also exposes Upload (empty cell) / Replace (filled cell) as a button — consistent with the action bar affordance.

### Multi-File Auto-Fill
- **D-04:** When multiple files are dropped or selected via the file picker, fill **existing empty cells first** in `getAllLeaves()` document order (top-left to bottom-right).
- **D-05:** If files exceed empty cells, **auto-split the last filled cell** (using the existing `split()` action) for each overflow file. Split direction: horizontal (creates a side-by-side pair). Continue until all files are placed.
- **D-06:** The multi-file trigger is the same file picker (MEDI-01) and the canvas-level drop zone (MEDI-02) — both routes feed into the same `autoFillCells()` logic.

### Action Bar (extends Phase 2)
- **D-07:** Phase 3 extends the Phase 2 action bar with two new buttons: **Upload/Replace** (first position) and **Clear Media** (after Toggle Fit). Final bar order: Upload/Replace → Split H → Split V → Toggle Fit → Clear Media → Remove Cell.
- **D-08:** "Clear Media" only appears when the cell has media (`mediaId !== null`). "Upload" label when empty; "Replace" label when filled.

### Sidebar — No Selection State
- **D-09:** When no cell is selected, the sidebar shows **canvas-level controls**: a background color picker and a gap slider. These are Phase 5 placeholder controls — render the UI shells (label + disabled/stub input) so Phase 5 can wire them up without restructuring the sidebar.

### Sidebar — Selected Cell Panel
- **D-10:** Panel section order (top to bottom):
  1. **Media thumbnail** — 16:9 aspect-ratio preview box; shows the image if present, or a muted placeholder icon if empty.
  2. **Fit toggle** — Cover / Contain segmented control (always visible).
  3. **Background color picker** — only visible when `fit === 'contain'`; controls the new `backgroundColor` field on the leaf.
  4. **Cell dimensions** — read-only display of the cell's pixel dimensions at 1080×1920 scale.
  5. **Actions row** — Upload/Replace button + Clear Media button (disabled when no media) + Remove Cell button.

### LeafNode Schema Change
- **D-11:** Add `backgroundColor: string | null` to `LeafNode`. Default: `null` (renders as `#000000` / black letterbox). `updateCell()` in gridStore already supports partial updates — no store action changes needed.

### Toolbar
- **D-12:** Undo/Redo: real buttons wired to `useGridStore` `undo`/`redo` actions, with `Ctrl+Z` / `Ctrl+Shift+Z` keyboard shortcuts (global `keydown` listener on `window`).
- **D-13:** Zoom: `+` / `–` buttons (±10% steps) plus a percentage label showing current zoom. Range: 50%–150%. Adjusts `editorStore.zoom` multiplier (D-09 from Phase 2 context — zoom multiplies on top of auto-fit).
- **D-14:** Safe zone toggle: icon button wired to `editorStore.showSafeZone`. Already implemented in Phase 2 rendering — toolbar just needs the toggle.
- **D-15:** Export button: placeholder button for Phase 4. Shows label "Export" — not wired yet, but renders in correct position.
- **D-16:** New/Clear button: calls a `clearGrid()` action (resets root to `buildInitialTree()`, clears mediaRegistry, resets history). Confirm dialog before clearing.

### Claude's Discretion
- Exact color picker component for background color (native `<input type="color">` is acceptable for Phase 3; Phase 5 can upgrade to a full color picker widget)
- Cell dimension calculation strategy (use the node's `sizes[]` fractions to compute pixel dimensions from 1080×1920)
- Confirm dialog implementation for New/Clear (simple browser `confirm()` is acceptable for Phase 3)
- Auto-split direction for overflow files (horizontal is default per D-05; Claude may choose vertical if the layout better suits the remaining space)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Media & Controls (MEDI-01 through MEDI-09) — full acceptance criteria for this phase

### Project Constraints
- `CLAUDE.md` §Technology Stack — React 18, Tailwind v3, @dnd-kit notes (file-drop uses native HTML5 drag events, NOT dnd-kit)
- `CLAUDE.md` §Rationale and Gotchas §@dnd-kit — "For file-drop-onto-cell, the native HTML5 drag API (onDragOver + onDrop on each Leaf component) may be simpler and more reliable than @dnd-kit for this specific use case"

### Prior Phase Context
- `.planning/phases/02-grid-rendering/02-CONTEXT.md` — Action bar patterns (D-04 through D-07), shadcn/ui Tooltip usage, canvas zoom model (editorStore.zoom as multiplier on auto-fit)
- `.planning/phases/01-grid-tree-engine/01-CONTEXT.md` — mediaId/mediaRegistry split, addMedia/removeMedia/setMedia store actions, updateLeaf/updateCell API

### Project Reference
- `.planning/STATE.md` §Accumulated Context — "All images converted to base64 at upload time (Phase 3) — prerequisite for correct Phase 4 exports"
- `.planning/PROJECT.md` §Key Decisions — mediaId/mediaRegistry design, dual-render architecture (export surface implications)

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Grid/ActionBar.tsx` — Phase 2 action bar with Split H, Split V, Remove, Toggle Fit. Phase 3 adds Upload/Replace (first) and Clear Media (after Toggle Fit). Extend this component.
- `src/Grid/LeafNode.tsx` — Already has `onMouseEnter`/`onMouseLeave` hover state and action bar rendering. Add `onDrop`/`onDragOver` handlers here for drag-drop.
- `src/store/gridStore.ts` — `addMedia(mediaId, dataUri)`, `removeMedia(mediaId)`, `setMedia(nodeId, mediaId)`, `updateCell(nodeId, updates)` already exist. Only new action needed: `clearGrid()`.
- `src/lib/tree.ts` — `getAllLeaves()` returns leaves in document order — use directly for multi-file fill logic.
- `src/Editor/Toolbar.tsx` — Currently all placeholder spans. Replace with real wired controls.
- `src/Editor/Sidebar.tsx` — Currently stub. Replace with the properties panel.
- `src/types/index.ts` — Add `backgroundColor: string | null` to `LeafNode`.

### Established Patterns
- shadcn/ui Tooltips (Radix UI `@radix-ui/react-tooltip`) — use consistently on all new action bar buttons (D-05 from Phase 2 context)
- Tailwind utility classes only — no inline styles on layout
- `React.memo` on all Grid components — keep on any new components in `src/Grid/`
- Per-node Zustand slice selectors — subscribe to own node slice only

### Integration Points
- `src/Grid/LeafNode.tsx` — Add `onDrop`/`onDragOver` for file drag-drop (MEDI-02); hidden `<input type="file">` for click-to-upload via action bar button (MEDI-01)
- `src/Editor/Toolbar.tsx` — Wire undo/redo/zoom/safeZone to stores; add `clearGrid` hook
- `src/Editor/Sidebar.tsx` — Subscribe to `editorStore.selectedNodeId`; render cell panel or canvas panel
- Phase 4 ExportSurface will reuse LeafNode's media rendering — keep `<img>` rendering clean and export-compatible

</code_context>

<specifics>
## Specific Ideas

- Upload/Replace button in action bar: use a camera or upload icon (lucide-react `Upload` or `ImagePlus`). Hidden `<input type="file" accept="image/*">` attached to the LeafNode component, triggered programmatically on button click.
- Multi-file drop on canvas (not just on a specific cell): the CanvasWrapper or CanvasArea could also accept a drop to trigger auto-fill, not just individual cells.
- Cell dimension display in sidebar: compute from the node's fraction path through the tree. e.g. a cell that is 1/2 of a horizontal container in a 1/3 vertical container = 540×640px at 1080×1920.
- `clearGrid()` action: resets `root` to `buildInitialTree()`, clears all `mediaRegistry` entries, resets history to `[{ root: initialTree }]` with `historyIndex: 0`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-media-upload-cell-controls*
*Context gathered: 2026-04-01*
