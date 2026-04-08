# Phase 9: Improve cell movement and swapping - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing cell drag-and-drop interaction so users can **move** a cell into a new position in the grid tree, not just swap content with another cell. When dragging a cell via the `ActionBar` drag handle and hovering over a target cell, the target reveals **5 drop zones**:

- **Center zone** — drop performs the existing `swapCells` behavior (unchanged).
- **Top / Bottom / Left / Right edge zones** — drop triggers a programmatic split of the target cell in the corresponding direction and inserts the dragged cell there. The dragged cell's original position is removed from the tree, and if its former parent is left with a single child, that parent **collapses upward** (the remaining child takes the parent's slot, inheriting its size weight from the grandparent).

**In scope:**
- New atomic store action `moveCell(fromId, toId, edge)` where `edge ∈ {'center', 'top', 'bottom', 'left', 'right'}` — `'center'` delegates to existing `swapCells` logic for uniformity.
- New pure tree primitive `moveLeafToEdge` in `src/lib/tree.ts` that handles: split-insert at target + remove-from-source + collapse single-child parents.
- New `LeafNode` hit-region rendering during drag-over: thin edge bands (~20% each side) + large center square (~60%). See D-01.
- New visual feedback: thick accent-blue **insertion line** on the active edge, or a "swap" overlay on the center zone. See D-02.
- Desktop-only, native HTML5 drag (consistent with existing `adr-cell-swap-touch.md`).
- All existing swap behavior preserved unchanged.

**Out of scope (deferred):**
- Touch support for cell move/swap (same ADR applies; still deferred).
- Drag-to-reorder within a container (e.g., reorder siblings without changing tree topology) — different interaction model.
- Undo history compaction across compound moves.

</domain>

<decisions>
## Implementation Decisions

### Interaction Model

- **D-01:** Five drop zones per target cell with **thin edge bands + large center** geometry (Q1 → (b)). Recommended ratios: each edge band occupies ~20% of the target's short dimension along its edge; the central square fills the remaining ~60% of the target. Exact numeric thresholds are Claude's discretion — must be tuned so small cells remain usable (enforce a minimum pixel band so edge zones remain hittable on tiny cells). Matches VS Code / JetBrains docking UX.

- **D-02:** Visual feedback while hovering over a zone uses an **insertion-line** style (Q2 → (b)):
  - Edge zones: draw a thick accent-blue line (`#3b82f6`, ~4px, reuses existing accent color from `LeafNode` selected ring) along the target cell's active edge — the line represents where the new divider will appear.
  - Center zone: show a "swap" overlay (centered swap icon from `lucide-react` over a dimmed tint) — reuses existing swap semantics visually.
  - Only one zone is highlighted at a time (the one under the cursor).
  - Insertion line / center overlay render **above grid media** and respect canvas scale (must remain visually stable regardless of `canvasScale`, similar to ActionBar's `scale(1/canvasScale)` pattern — planner/researcher to confirm mechanism).

### Size Math

- **D-03:** Inserted cell size after edge-drop: **50/50** split of the target cell (Q3 → (a)). The parent-level size weight of the target stays unchanged; the newly created container occupies the target's old slot and its two children (target + dragged cell) share equally.
  - This matches the existing `split()` action's default 50/50 behavior — consistency over cleverness.
  - The dragged cell's original size weight is **discarded** (the collapse-upward step in the source parent will redistribute weight there).

### Tree Mutation Semantics

- **D-04:** New atomic action in `gridStore`: `moveCell(fromId: string, toId: string, edge: 'center' | 'top' | 'bottom' | 'left' | 'right')` (Q4 → (a), augmented by (c)).
  - Single `pushSnapshot(state)` → single undo entry (atomic undo UX).
  - `edge === 'center'` short-circuits to the existing `swapLeafContent` path (no tree structure change).
  - Any other edge invokes a new pure helper `moveLeafToEdge(root, fromId, toId, edge)` in `src/lib/tree.ts`.
  - Action is a no-op (returns root unchanged) if `fromId === toId`, if either id is not a leaf, or if the move would produce the same structure.

- **D-05:** `moveLeafToEdge(root, fromId, toId, edge)` is a **pure function** (no Immer, no mutation) — follows the Phase 1 convention for tree helpers (`swapLeafContent`, `splitLeaf`, etc.). It must:
  1. Split the target leaf `toId` at the requested `edge` direction (`top`/`bottom` → vertical split with source inserted as first/second child; `left`/`right` → horizontal split with source inserted as first/second child). The *inserted* child carries the dragged cell's content (mediaId, fit, backgroundColor, panX/Y/Scale).
  2. Remove the source leaf `fromId` from its original parent.
  3. **Collapse-upward rule:** if the source's original parent container is left with exactly one child after removal, replace that container with its remaining child in the grandparent. The remaining child **inherits the removed container's size weight** in the grandparent's `sizes` array. If the root itself becomes a single-child container, the root is replaced by the child.
  4. If removal happens *before* the insert step but the target `toId` was inside the source's parent, operations must be ordered so `toId` is still findable. Implementation hint: compute the new subtree with the target split first, keeping a reference to the source's data; then remap the tree in one pass, replacing `toId` with its split result and removing `fromId` in the same traversal.

- **D-06:** Source-leaf **identity** is discarded on move — the leaf at the target edge gets a fresh `nanoid()` id (same convention as `split()` creates new leaf ids). The dragged cell's *content* (mediaId, fit, backgroundColor, panX/Y/Scale) is what moves, not the node object itself. Rationale: avoids id collisions when the new container wraps the target and simplifies the pure-function implementation.
  - Consequence: any code holding the source `nodeId` after the move will no longer find it. Planner must check if `selectedNodeId` in `editorStore` needs to update to the new leaf's id after `moveCell`.

### Edge Cases (to be mapped exhaustively by research)

- **D-07:** The phase-research agent MUST enumerate edge cases before the planner writes tasks. Known cases so far — researcher should confirm each and find any missed:
  - **EC-01:** Source parent has >2 children after removal → no collapse; only `sizes` array is re-normalized.
  - **EC-02:** Source parent has exactly 2 children → after removing source, the 1 remaining child replaces the parent in the grandparent's children; inherits the parent's size weight.
  - **EC-03:** Source parent IS the root container → same rule; root becomes the remaining child (possibly a leaf, which makes the root a single leaf — must still be a valid root per existing tree contract; planner to verify).
  - **EC-04:** Source and target share the same direct parent (2-child container). Dropping source on an edge of target that requires a direction change (e.g., parent is horizontal, drop on `top` edge of sibling) — the source's old slot disappears via collapse, then target splits into a vertical container. Verify no infinite loop / stale refs.
  - **EC-05:** Dropping on the same edge where the source already lives (no-op) — action returns root unchanged to avoid a wasted undo entry.
  - **EC-06:** Dragged cell has no media (`mediaId: null`). Still allowed — the user is moving an empty placeholder. But note: `ActionBar.tsx:61` currently gates the drag handle on `hasMedia=true`. Planner must decide whether to relax this gate in Phase 9 (probably yes — movement is useful even for empty cells) or keep it restricted. **Preferred:** relax the gate so empty cells are movable, but require explicit planner confirmation.
  - **EC-07:** Target cell is a direct ancestor descendant relationship with source? N/A — both are leaves; only leaves drag/drop.
  - **EC-08:** `MIN_CELL_WEIGHT` / minimum size constraints from Phase 1 must still hold after the 50/50 split and after collapse-upward weight redistribution.
  - **EC-09:** History cap (50 entries) — single atomic `pushSnapshot` per `moveCell`, same rules as other mutating actions.
  - **EC-10:** Undo/redo round-trip — verify that `undo` after a move restores exact tree shape AND sizes AND node ids (since move creates new node ids, undo must restore the pre-move snapshot which has the old ids).
  - **EC-11:** Rapid successive drops / drag cancel — ensure `dragEnter`/`dragLeave` counter pattern works for edge-zone detection, not just the outer cell (Phase 8 D-16 pattern applies recursively here).
  - **EC-12:** Interaction with Phase 8's workspace-level file drop ring — cell-swap drag (`text/cell-id`) must not activate the workspace ring (Phase 8 D-15 already handles this; verify still holds).

### Research Directive (explicit user request)

- **D-08:** Plan-phase research agents MUST cover two areas before planning starts:
  1. **Tree implementation deep-dive** — map every existing function in `src/lib/tree.ts` that mutates structure (`splitLeaf`, `removeLeaf`, `swapLeafContent`, `mapNode`, etc.), their invariants, and which are reusable as building blocks for `moveLeafToEdge`. Output: a reuse matrix + the proposed implementation sketch for `moveLeafToEdge` as composition of existing primitives where possible.
  2. **Edge-case enumeration** — formally enumerate all tree-mutation edge cases that arise when moving a leaf between arbitrary positions in a binary (n-ary) tree, including the cases listed in D-07 and any additional cases the researcher identifies (e.g., sibling reordering quirks, size normalization after partial removal, dragged cell was the target's sibling, dragged cell and target are in disjoint subtrees with different parent directions, etc.). Output: a complete edge-case table that the planner converts to tests.

### Branch / Workflow Discipline (user directive)

- **D-09:** Phase 9 runs **directly on the current branch (`main`)** — no new git worktree, no feature branch, no isolation mode. Commit in-place following the existing atomic-commit convention.
  - **Why:** Phase 8 was executed in an isolated worktree and the subsequent cherry-pick back to main caused integration friction. User explicitly requested this phase stay on the main working tree.
  - Implication for `/gsd:plan-phase 9` and `/gsd:execute-phase 9`: invoke without `isolation: worktree`, no branch split.

### Claude's Discretion

- Exact pixel/percentage thresholds for the edge band vs. center zone (D-01), with the constraint that edge bands remain hittable on small cells.
- Exact insertion-line thickness and inset (D-02), within the "thick, accent-blue, ~4px" guideline.
- Mechanism for canvas-scale-stable insertion line rendering (D-02) — `scale(1/canvasScale)` transform vs. computing raw CSS pixels; planner decides based on the approach used for ActionBar.
- Whether `moveLeafToEdge` is implemented as a composition of existing `split`/`remove` primitives or as a single-pass tree rewrite (D-05) — research should recommend, planner decides.
- Whether `selectedNodeId` follows the moved cell's new id after `moveCell` (D-06) — planner decides based on UX (probably yes — follow the cell the user just moved).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements / Roadmap
- `.planning/ROADMAP.md` §"Phase 9: Improve cell movement and swapping" — phase entry (to be expanded during planning)
- `.planning/REQUIREMENTS.md` — no explicit requirements yet; this phase is driven by CONTEXT.md decisions

### Prior Phase Context (carry-forward)
- `.planning/phases/08-canvas-workspace-ux/08-CONTEXT.md` — Phase 8 drag-and-drop patterns; workspace drop ring coexistence (Phase 8 D-15)
- `.planning/phases/07-cell-controls-display-polish/07-CONTEXT.md` — ActionBar `scale(1/canvasScale)` pattern, overflow-visible cell containers
- `.planning/decisions/adr-cell-swap-touch.md` — desktop-only native HTML5 drag rationale (still binding in Phase 9)

### Key Source Files
- `src/lib/tree.ts:242` — existing `swapLeafContent` pure function (model for new `moveLeafToEdge`)
- `src/lib/tree.ts` — `splitLeaf`, `mapNode`, `findNode`, `removeLeaf` primitives (research target for D-08.1)
- `src/store/gridStore.ts:311` — existing `swapCells` action (model for new `moveCell` action)
- `src/store/gridStore.ts` — `pushSnapshot`, `MIN_CELL_WEIGHT`, history cap logic
- `src/Grid/ActionBar.tsx:61-75` — existing `GripVertical` drag handle with native `draggable` + `dataTransfer.setData('text/cell-id', …)` — gate may need relaxing per EC-06
- `src/Grid/LeafNode.tsx:414-452` — existing `handleDragOver` / `handleDragLeave` / `handleDrop` logic — must be extended to track which of the 5 zones the pointer is over and render the insertion line
- `src/test/phase05-p02-cell-swap.test.ts` — existing swap tests (regression baseline; swap behavior must remain unchanged)
- `src/Grid/CanvasWrapper.tsx` — `canvasScale` subscription for scale-stable overlays

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`swapLeafContent(root, idA, idB)`** (`src/lib/tree.ts:242`) — used verbatim by the `'center'` edge. No changes.
- **`pushSnapshot(state)`** helper in `gridStore` — used by every mutating action; `moveCell` follows the same pattern (one snapshot before the mutation).
- **`current()` from Immer** — already used in `swapCells` / `clearGrid` / etc. to unwrap Draft before calling pure tree functions. `moveCell` will do the same.
- **Accent-blue `#3b82f6`** — already used for selected-cell ring, Phase 8 workspace ring, Cover/Contain toggle. Reused for the insertion line (D-02).
- **`GripVertical` drag handle in ActionBar** — existing drag source, no changes to the source side; only the drop side (`LeafNode.handleDrop`) gains edge-zone detection.
- **Native HTML5 drag + `text/cell-id` dataTransfer** — existing convention; keep using it. Plan-phase 9 researcher should confirm no MIME type change is needed.

### Established Patterns
- **Pure tree functions use spread+map recursion (no Immer)** — Phase 1 decision. `moveLeafToEdge` MUST follow this convention.
- **`mapNode` is the universal tree rewrite primitive** — Phase 1 decision. Use it if the research agent's reuse matrix supports it for `moveLeafToEdge`.
- **`MIN_CELL_WEIGHT = 0.1`** (Phase 1) — size redistribution after collapse-upward must respect this floor. Researcher must verify.
- **Single atomic action per user intent** — `split`, `swap`, `clearGrid`, etc. each produce one history entry. `moveCell` matches this.
- **`ActionBar.scale(1/canvasScale)` transform** (Phase 7) — keeps overlay visually stable as users pinch-zoom; same pattern candidate for the insertion line.
- **Drag-enter/leave counter pattern** (Phase 8 D-16) — needed for reliable zone boundary detection; edge zones are nested inside the cell, so child transitions would otherwise mis-fire `dragLeave`.

### Integration Points
- **`LeafNode.handleDragOver`** (`src/Grid/LeafNode.tsx:414`) — computes cursor position relative to the cell's bounding rect, determines which of the 5 zones is active, and sets local state (e.g., `activeEdge: 'top' | 'bottom' | 'left' | 'right' | 'center' | null`). The insertion-line overlay is driven by this state.
- **`LeafNode.handleDrop`** (`src/Grid/LeafNode.tsx:425`) — reads `activeEdge` at drop time and calls `moveCell(fromId, id, activeEdge)` instead of today's `swapCells(fromId, id)`. File drops unchanged.
- **`gridStore.moveCell` action** — new action next to `swapCells` (`src/store/gridStore.ts:311`).
- **`src/lib/tree.ts` `moveLeafToEdge`** — new pure helper next to `swapLeafContent`.
- **Tests:** new test file `src/test/phase09-p01-cell-move.test.ts` (or equivalent naming) covering all EC-01..EC-12 cases + regression that existing `swapCells` still works.

</code_context>

<specifics>
## Specific Ideas

- The 5-zone "edge band + center square" docking UX is directly inspired by VS Code / JetBrains / Figma panel docking. Users recognize it immediately — no tutorial needed.
- The insertion-line metaphor (thick colored bar where the new divider will appear) is the same affordance used by Figma when reordering layers and by every mature tree/file-manager UI. Preferred over a tinted zone because it explicitly answers "where will my cell land?" rather than just "will it land?".
- 50/50 split after edge-drop intentionally matches the default `split()` behavior — consistency with existing mental model beats size-inheritance cleverness. Users who want non-equal sizes can drag the divider after the move.
- Single atomic `moveCell` action keeps undo clean: one Ctrl+Z reverses a full move (insert + remove + collapse) as one logical unit. Critical for a visual editor where users experiment.
- The explicit research directive (D-08) is the user's ask — they want the research agent to map the binary tree internals AND enumerate edge cases before the planner writes tasks. This is not optional.

</specifics>

<deferred>
## Deferred Ideas

- **Touch-based cell move** — still deferred per `adr-cell-swap-touch.md`; the 5-zone docking UI would need a pointer-events rewrite to work on touch.
- **Drag-to-reorder siblings within a container** (without changing tree topology) — a different interaction model; not requested for Phase 9.
- **Visual ghost/preview of the cell during drag** (seeing the dragged cell's media as a floating thumbnail under the cursor) — nice-to-have; not in scope unless it falls out of the implementation for free.
- **Multi-cell selection and bulk move** — out of scope; single-cell drag only.
- **Keyboard-based cell movement** (e.g., arrow keys to move a selected cell) — separate accessibility feature, not in this phase.

</deferred>

---

*Phase: 09-improve-cell-movement-and-swapping*
*Context gathered: 2026-04-08*
