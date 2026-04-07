# Phase 2: Grid Rendering - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the recursive React components that turn the grid tree into a visible flex layout: Container renders flex rows/columns, Leaf renders empty/media/selected states, dividers are draggable via pointer events, the canvas scales to fit the editor area, and Safari overflow clipping is isolated. No media upload logic in this phase — images are rendered if present but upload wiring is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Divider Visual & Interaction Model
- **D-01:** Three visibility states — (a) cursor not on canvas: no lines visible; (b) cursor on canvas: 2px dividers visible between all siblings; (c) cursor hovering a specific divider: explicit grab handle appears on that divider.
- **D-02:** Same behavior applies to horizontal dividers between vertically stacked cells.
- **D-03:** Drag uses **local React state only** — no store writes during `pointermove`. A single `resize()` action commits to the store on `pointerup`. This keeps undo/redo clean (one step per drag) and avoids re-renders mid-drag.

### Leaf Action Bar
- **D-04:** The floating action bar appears **top-center inside the cell** on hover.
- **D-05:** **Icons only** with **shadcn/ui Tooltips** (Radix UI `@radix-ui/react-tooltip`) for label discoverability. Icons sourced from lucide-react (already installed — this is what shadcn/ui uses internally).
- **D-06:** Bar fades in/out with a **short hover delay** using `transition-opacity` — prevents flickering when the cursor briefly passes over a cell.
- **D-07:** Phase 2 actions: **Split H, Split V, Remove, Toggle Fit** (cover ↔ contain).

### Canvas Scaling
- **D-08:** Canvas auto-fits to ~90% of the available editor area using `CSS transform: scale()`. Scale factor recalculates on window resize (use `ResizeObserver` on the CanvasArea container).
- **D-09:** `editorStore.zoom` acts as a **multiplier on top of auto-fit** (e.g. zoom=1.0 = auto-fit baseline, zoom=1.5 = 150% of that). The zoom slider in Phase 3 toolbar adjusts this multiplier.
- **D-10:** The inner div is always 1080×1920px; only the `transform: scale()` value changes. This ensures the export surface (Phase 4) can reuse the same div at 1:1 with no layout changes.

### Cell Selection
- **D-11:** Only **leaf nodes are selectable** in Phase 2. Containers do not receive click selection (but are architecturally ready — `selectedNodeId` accepts any node ID for future Phase 5+ container actions).
- **D-12:** **Two deselect gestures:** click the canvas background (CanvasArea wrapper) OR click the already-selected cell again (toggle). Matches Figma behavior.

### Image Rendering
- **D-13:** Leaf renders `<img>` with `object-fit` from `leaf.fit` (cover or contain) and `object-position` from `leaf.objectPosition` (default: `center center`). The `objectPosition` field enables Phase 5 drag-to-reposition with no rendering changes needed then.

### Safari Compatibility
- **D-14:** Each LeafNode wrapper has `isolation: isolate` CSS (REND-10). This is a known Safari fix for overflow/border-radius clipping in nested flex layouts.

### Performance
- **D-15:** Every `ContainerNode` and `LeafNode` component is wrapped in `React.memo`. Each subscribes to its **own node slice** in Zustand (no whole-tree subscriptions). This is mandatory for <16ms re-renders on large grids.

### UI Library
- **D-16:** shadcn/ui (Radix UI primitives) is the chosen UI component library for premium feel. Phase 2 introduces `@radix-ui/react-tooltip` as the first Radix dependency. Future phases may add more Radix primitives via shadcn/ui.

### Claude's Discretion
- Exact grab handle visual (pill, dot, or double-arrow icon) — implement a clean, standard resize cursor affordance
- Divider hit area width (e.g. 8–12px transparent zone around the 2px line) — size for comfortable grab without occluding cell content
- Exact fade timing values (delay duration, transition duration) — keep snappy; ~150ms delay, ~150ms fade
- `ResizeObserver` debounce strategy for canvas scale recalculation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Grid Rendering (REND-01 through REND-10) — full acceptance criteria for this phase

### Project Constraints
- `CLAUDE.md` §Technology Stack — React 18 pinning rationale, Tailwind v3 setup, @dnd-kit notes (divider uses native pointer events, NOT dnd-kit)
- `CLAUDE.md` §Rationale and Gotchas — Tailwind CSS v3.4.x PostCSS setup, React.memo strategy note

### Prior Phase Context
- `.planning/phases/01-grid-tree-engine/01-CONTEXT.md` — sizes as integer weights, flex normalization, initial canvas state (vertical container + 2 leaves)
- `.planning/STATE.md` §Accumulated Context — locked decisions: pointer events for divider, React.memo requirement, dual-render architecture

### Project Reference
- `.planning/PROJECT.md` §Key Decisions — dual render (scaled preview + hidden full-res div), recursive split-tree model

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/index.ts` — `GridNode`, `ContainerNode`, `LeafNode`, `SplitDirection` types fully defined and ready to consume
- `src/store/gridStore.ts` — `useGridStore` with `split`, `remove`, `resize`, `updateCell` actions; `selectedNodeId` in `useEditorStore`
- `src/Editor/CanvasArea.tsx` — hardcoded 270×480 placeholder; Phase 2 replaces this with the scaled canvas
- `src/index.css` — CSS variables `--canvas-width: 1080px`, `--canvas-height: 1920px`, `--safe-zone-top: 250px` already defined

### Established Patterns
- Tailwind utility classes only (no inline styles on layout) — established in Phase 0 for dark theme compatibility
- Vitest + jsdom in `src/test/` — test convention for any rendering tests

### Integration Points
- `src/Grid/` folder exists but is empty — all new Grid components go here
- `src/Editor/CanvasArea.tsx` — imports the root GridNode component; this is the Phase 2 integration point
- Phase 3 will add click handler to empty Leaf (opens file picker) and drag-drop handler — Leaf component must expose these as optional props or use event delegation
- Phase 4 ExportSurface reuses the same 1080×1920 div structure — keep the inner canvas div's structure clean and export-friendly

</code_context>

<specifics>
## Specific Ideas

- Divider visibility tied to canvas hover state — a single CSS class on the CanvasArea wrapper (e.g. `group`) can drive divider opacity via `group-hover:opacity-100` on child dividers, avoiding JS state for this.
- `objectPosition` field on LeafNode is the Phase 5 hook for drag-to-reposition. Phase 2 just renders it; Phase 5 adds the drag interaction that updates it.
- shadcn/ui Tooltip chosen explicitly for premium feel — use it consistently for all action bar button tooltips.

</specifics>

<deferred>
## Deferred Ideas

### Phase 5 — Simplify POLH-06 (pan/zoom)
Replace the "double-click to enter pan mode" with **direct image drag** (axis-constrained based on overflow direction). If the image overflows on the width axis, drag is horizontal-only; if it overflows on the height axis, drag is vertical-only. No zoom needed for MVP pan. The `objectPosition` field rendered in Phase 2 (D-13) provides the hook.

### Future — Container selection
Containers are not selectable in Phase 2, but the architecture is ready (`selectedNodeId` accepts any node ID). When Phase 5+ adds container-level actions (move/delete container), add click handlers to Container component and implement the actions.

</deferred>

---

*Phase: 02-grid-rendering*
*Context gathered: 2026-04-01*
