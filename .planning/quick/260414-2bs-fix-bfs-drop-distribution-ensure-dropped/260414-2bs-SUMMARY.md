# Quick Task 260414-2bs Summary

**Task:** Fix BFS drop distribution — ensure dropped files are distributed breadth-first across leaf nodes
**Date:** 2026-04-13
**Status:** Complete

## What was done

### Root cause
`autoFillCells` tracked `lastFilledNodeId` (most recently filled leaf) and split it
on overflow. This created a right-heavy DFS chain: each split went one level deeper
on the same side. Dropping 8 files produced 6 cells at varying depths with the deepest
pair buried 6+ levels in.

### Fix: Two-phase BFS approach

**Phase 1 — Pre-expand** (`src/lib/media.ts`):
- Seed a FIFO queue with all current leaves in BFS order.
- While empty-leaf count < N: dequeue oldest leaf, split it using the **cross-direction
  of its parent** (forces `splitNode` Case C — deeper nesting, never Case B sibling-
  append at same depth). Enqueue original + new sibling at back of queue.
- This guarantees all nodes at depth D are expanded before any at D+1.

**Phase 2 — Fill** (`src/lib/media.ts`):
- Fill empty leaves in BFS order (level-by-level, left-to-right).

**Helper added** (`src/lib/tree.ts`):
- `getParentDirection(root, nodeId)` — returns parent container direction or `null`
  for root nodes. Used to select the cross-direction for each overflow split.

### Result for 8 files from 1 empty leaf
Produces a balanced tree: 4 sub-containers each with 2 leaf nodes, all at depth 3.

```
container (H)
├── container (V)
│   ├── container (H) [M1, M2]
│   └── container (H) [M3, M4]
└── container (V)
    ├── container (H) [M5, M6]
    └── container (H) [M7, M8]
```

## Files changed
- `src/lib/tree.ts` — added `getParentDirection` export
- `src/lib/media.ts` — rewrote `autoFillCells` (two-phase BFS)
- `src/test/media.test.ts` — updated 2 overflow-split tests to match new behaviour

## Tests
- All 13 `media.test.ts` tests pass
- All 19 `phase19-*.test.ts` tests pass
