# Phase 1: Grid Tree Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 01-grid-tree-engine
**Areas discussed:** Sizes representation, mediaRegistry placement, Initial canvas state, Test organization

---

## Sizes Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized fractions | sizes[] summing to 1; renders directly as flex values | |
| Integer weights | sizes[] of arbitrary integers; render normalizes via weight/sum | ✓ |

**User's choice:** Integer weights (`[1, 1, 1]`)
**Notes:** "The integer weights approach seems more native and closer to the css grid logic." User also asked for a detailed explanation of how resizing behaves in nested vs. flat 3-column layouts before deciding — confirmed that GRID-04's same-direction append (flat siblings) is the idiomatic path to equal columns.

---

## mediaRegistry Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside gridStore, outside history | Registry in gridStore state, excluded from snapshots | ✓ |
| Separate mediaStore | Dedicated Zustand store; cleaner separation | |

**User's choice:** Inside gridStore, excluded from history snapshots
**Notes:** No additional clarification needed.

---

## Initial Canvas State

| Option | Description | Selected |
|--------|-------------|----------|
| Single blank leaf | Root is one empty LeafNode | |
| Two stacked cells | Vertical container with two empty leaves | ✓ |

**User's choice:** Two stacked cells
**Notes:** Feels more immediately useful and demonstrates the split concept on first open.

---

## Test Organization

| Option | Description | Selected |
|--------|-------------|----------|
| src/test/ grouped | All tests in src/test/ alongside Phase 0 tests | ✓ |
| Co-located *.test.ts | Test files next to source modules | |

**User's choice:** `src/test/` grouped
**Notes:** No additional clarification needed. Three new test files: tree-functions, grid-store, editor-store.

---

## Claude's Discretion

- Minimum size clamp for resizeSiblings()
- Exact TypeScript discriminated union shape for GridNode
- History snapshot timing details

## Deferred Ideas

None.
