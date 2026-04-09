---
phase: 09-improve-cell-movement-and-swapping
plan: 01
subsystem: tree-engine
tags: [tree, pure-function, tdd, move, phase-9]
dependency-graph:
  requires:
    - src/lib/tree.ts (mapNode, findNode, removeNode, createLeaf)
    - src/types/index.ts (GridNode, LeafNode, ContainerNode, SplitDirection)
  provides:
    - src/lib/tree.ts:moveLeafToEdge
    - src/lib/tree.ts:MoveEdge (type)
  affects: []
tech-stack:
  added: []
  patterns:
    - "Two-pass tree rewrite: mapNode wraps target -> removeNode source"
    - "Pure tree function (no Immer, no mutation)"
    - "Content-copy-not-identity-move (fresh nanoid on insert)"
key-files:
  created:
    - src/test/phase09-p01-cell-move.test.ts
  modified:
    - src/lib/tree.ts
decisions:
  - "Implemented as composition of existing mapNode + removeNode primitives — no new traversal written"
  - "Content copy explicitly includes objectPosition (Pitfall 6 from 09-RESEARCH.md)"
  - "No-op cases return the same root object reference (identity preserved for === equality)"
metrics:
  duration: "2min"
  tasks: 2
  files_modified: 2
  tests_added: 18
  completed_date: "2026-04-08"
---

# Phase 9 Plan 1: moveLeafToEdge Pure Primitive Summary

**One-liner:** Pure two-pass tree primitive `moveLeafToEdge(root, fromId, toId, edge)` that wraps the target leaf in a new 50/50 container at the requested edge, then removes the source leaf (collapse-upward handled by existing `removeNode`).

## What Shipped

- **`src/lib/tree.ts`** — new `export function moveLeafToEdge` + `export type MoveEdge = 'top' | 'bottom' | 'left' | 'right'`. Appended after `swapLeafContent`; no existing function touched.
- **`src/test/phase09-p01-cell-move.test.ts`** — 18 unit tests covering EC-01..EC-18:
  - MOVE-01 (EC-13): disjoint subtrees happy path
  - MOVE-02 (EC-01): 3-child source, no collapse, sizes filtered by index
  - MOVE-03 (EC-02): 2-child source collapses, inherits parent slot weight
  - MOVE-04 (EC-03): source parent is root — root becomes remaining child
  - MOVE-05 (EC-04): shared-parent edge with direction change
  - MOVE-06 (EC-05): `fromId === toId` no-op (reference equality)
  - MOVE-07 / MOVE-08: missing-id no-ops
  - MOVE-09 / MOVE-10: non-leaf (container) no-ops
  - MOVE-11..MOVE-14 (EC-17): each of `top` / `bottom` / `left` / `right` — correct direction + child order
  - MOVE-15: content copy covers all 7 fields (mediaId, fit, backgroundColor, panX, panY, panScale, **objectPosition**)
  - MOVE-16 (D-06): new leaf id !== fromId, new container id !== toId
  - MOVE-17 (EC-08): source parent sizes are raw filtered (not renormalized), all >= MIN_CELL_WEIGHT, wrap sizes exactly `[1,1]`
  - MOVE-18 (EC-16): horizontal-in-horizontal nesting allowed

## Signature

```typescript
export type MoveEdge = 'top' | 'bottom' | 'left' | 'right';

export function moveLeafToEdge(
  root: GridNode,
  fromId: string,
  toId: string,
  edge: MoveEdge,
): GridNode;
```

## Pitfalls Caught By Tests

- **EC-04** (MOVE-05): when source and target share the same 2-child parent with an edge that needs a direction change, Pass 1 wraps the target *in place*, Pass 2 then removes the source. The shared parent is left with one child (the wrap) and collapses — verified no stale refs, no infinite loops, source fully gone from tree.
- **EC-17** (MOVE-11..14): child order vs. `edge` mapping was covered exhaustively (`'top'`/`'left'` put source first; `'bottom'`/`'right'` put source second).
- **Pitfall 6 — `objectPosition`** (MOVE-15): `swapLeafContent` historically omits this optional field. `moveLeafToEdge` MUST include it to avoid losing framing on move. Test asserts exact value `'50% 25%'` survives.
- **D-06 fresh ids** (MOVE-16): both the new leaf and the new wrap container get fresh nanoid ids — verified not equal to the source/target ids. This prevents id collisions after the move (since `findNode` walks by id).

## Deviations from Plan / Research Sketch

**None that affect behavior.** Implementation follows the research sketch verbatim, with one minor capture detail:

- The research sketch captured the `targetNode` reference *before* Pass 1 and passed the closed-over reference into the `mapNode` updater. The shipped version uses the parameter delivered by `mapNode` (`targetLeaf`) instead — functionally identical (it's the same node), but reads slightly cleaner and avoids the appearance of a stale closure. Verified equivalent by all 18 tests passing.
- Test helper `leaf()` uses `backgroundColor: null` (not `#000000` as the plan sketched) because the actual `LeafNode` type declares `backgroundColor: string | null`. Plan sketch was a minor oversight; real type used.

## Regression

- `src/test/phase05-p02-cell-swap.test.ts` — all 8 tests still pass. `swapLeafContent` untouched.
- `tsc --noEmit` — clean.

## Commits

- `6e30441` — test(09-01): add failing tests for moveLeafToEdge (RED)
- `112244a` — feat(09-01): implement moveLeafToEdge pure tree primitive (GREEN)

## Self-Check: PASSED

- src/test/phase09-p01-cell-move.test.ts: FOUND
- src/lib/tree.ts (moveLeafToEdge export): FOUND
- commit 6e30441: FOUND
- commit 112244a: FOUND
- phase09 tests: 18/18 pass
- phase05 swap regression: 8/8 pass
- tsc --noEmit: clean
