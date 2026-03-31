# Phase 1: Grid Tree Engine - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete data model and logic layer for the recursive split-tree: TypeScript types, pure tree manipulation functions, and two Zustand stores (gridStore + editorStore). No UI in this phase — everything built here is consumed by Phase 2 rendering.

</domain>

<decisions>
## Implementation Decisions

### Node Size Representation
- **D-01:** `ContainerNode.sizes` is an array of **integer weights** (e.g. `[1, 1]`, `[1, 1, 1]`). Values are arbitrary positive numbers — NOT required to sum to 1.
- **D-02:** Rendering normalizes to flex values at display time: `flex = weight / sum(weights)`. `resizeSiblings()` adjusts the two adjacent weights by a delta; all other siblings are untouched.
- **D-03:** On append (GRID-04 same-direction split), push `1` to sizes — this naturally maintains equal weighting with existing siblings.
- **Rationale:** Integer weights feel more native and closer to CSS grid logic. `push(1)` on append is more readable than `push(1/newCount)` + renormalize.

### Media Registry
- **D-04:** `mediaRegistry: Record<string, string>` lives **inside gridStore** as a top-level field but is **excluded from undo/redo history snapshots**. History snapshots contain only the tree (`root: GridNode`).
- **D-05:** `structuredClone` snapshots never include `mediaRegistry` — only the tree node hierarchy and `mediaId` strings.

### Initial Canvas State
- **D-06:** The app opens with a **vertical container holding two empty leaf cells** as the default tree state: `{ type: 'container', direction: 'vertical', sizes: [1, 1], children: [leafA, leafB] }`.
- **Rationale:** Shows the split concept immediately on first open; feels more immediately useful than a single blank cell.

### Test Organization
- **D-07:** Phase 1 tests go in `src/test/` alongside existing Phase 0 tests:
  - `src/test/tree-functions.test.ts` — pure tree function coverage
  - `src/test/grid-store.test.ts` — gridStore actions and undo/redo
  - `src/test/editor-store.test.ts` — editorStore state management

### Claude's Discretion
- Minimum size clamp for `resizeSiblings()` (e.g. 0.05 minimum weight or pixel threshold) — implement a reasonable default
- Exact TypeScript discriminated union structure for `GridNode = ContainerNode | LeafNode`
- History snapshot timing: push on every mutating action (per GRID-12); rapid resize is debounced at the divider level in Phase 2, not here

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Grid Engine (GRID-01 through GRID-13) — full acceptance criteria for this phase

### Project Constraints
- `CLAUDE.md` §Technology Stack — Zustand 5.0.x + Immer 10.x notes, nanoid v5 ESM-only caveat, TypeScript 5.8 pinning

### State Context
- `.planning/STATE.md` §Accumulated Context — roadmap-level decisions (mediaId/registry split, append behavior, snapshot strategy)

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/index.ts` — placeholder, ready to be filled with GridNode types
- `src/store/index.ts` — placeholder, ready for gridStore + editorStore
- `src/lib/index.ts` — placeholder, ready for pure tree functions
- `src/test/setup.ts` — Vitest setup already configured (jsdom, globals)

### Established Patterns
- Vitest with jsdom environment — configured in `vite.config.ts`; use `describe/it/expect` globals
- All Phase 0 tests in `src/test/` — maintain this convention

### Integration Points
- Phase 2 will import `GridNode`, `ContainerNode`, `LeafNode` types and `useGridStore`/`useEditorStore` hooks directly
- `sizes` array consumed by Phase 2 Container component: `flex: weight / totalWeight` per child
- `mediaRegistry` consumed by Phase 3 upload flow and Phase 4 export surface

</code_context>

<specifics>
## Specific Ideas

- Integer weights `[1, 1, 1]` are intentionally similar to CSS `grid-template-columns: 1fr 1fr 1fr` — this mental model guides both implementation and debugging.
- The "3 equal columns" case is best achieved via GRID-04's append behavior (same-direction split → flat siblings), not nested containers.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-grid-tree-engine*
*Context gathered: 2026-04-01*
