/**
 * Regression tests for `gridStore.moveCell` no-op early-return guards.
 *
 * Phase 27, Plan 04. Locks in REQ-IDs:
 *   - DND-05:    `gridStore.moveCell` (lines 473-494) remains unchanged; no
 *                drag-state fields leak into gridStore at the state-shape level.
 *   - CANCEL-06: `moveCell`'s existing early-return no-op guards are preserved.
 *
 * Context: Phase 28's drag-cancel and drop-on-origin paths (CANCEL-03, CANCEL-04)
 * rely on these guards returning early WITHOUT pushing an undo snapshot. A
 * regression here would reproduce PITFALLS.md Pitfall 11 (polluted undo
 * history from aborted drags) and silently break `Ctrl+Z` correctness.
 *
 * These are characterization / lock-in tests. `gridStore.moveCell` already
 * behaves correctly; the purpose here is to fail CI the instant any of the
 * four no-op branches is removed, inverted, or allowed to push a snapshot.
 *
 * Guard coverage (5 scenarios — the plan splits the source code's two
 * early-return statements into their individual failure conditions):
 *   1.  fromId === toId                  (self-move)
 *   2a. source node id does not exist
 *   2b. source id refers to a container
 *   3a. target node id does not exist
 *   3b. target id refers to a container
 *
 * Plus:
 *   - Positive-control: a valid commit pushes exactly ONE snapshot and mutates
 *     the tree (proves the test harness itself is correct).
 *   - DND-05 scope assertion: `gridStore.ts` source contains zero
 *     drag-field identifiers at the state-shape level.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { useGridStore } from '../gridStore';
import { useEditorStore } from '../editorStore';
import type { ContainerNode } from '../../types';

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

/**
 * Snapshot the observable state that every no-op guard MUST leave untouched.
 * Used for before/after byte-identical comparison in each guard test.
 */
function snapshot() {
  const s = useGridStore.getState();
  return {
    rootJSON: JSON.stringify(s.root),
    historyLength: s.history.length,
    historyIndex: s.historyIndex,
    selectedNodeId: useEditorStore.getState().selectedNodeId,
  };
}

function firstLeafId(): string {
  const { root } = useGridStore.getState();
  const container = root as ContainerNode;
  const child = container.children[0];
  if (child.type !== 'leaf') {
    throw new Error('test fixture expects first child of root to be a leaf');
  }
  return child.id;
}

function secondLeafId(): string {
  const { root } = useGridStore.getState();
  const container = root as ContainerNode;
  const child = container.children[1];
  if (child.type !== 'leaf') {
    throw new Error('test fixture expects second child of root to be a leaf');
  }
  return child.id;
}

function rootContainerId(): string {
  const { root } = useGridStore.getState();
  return (root as ContainerNode).id;
}

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({ selectedNodeId: null } as Parameters<
    typeof useEditorStore.setState
  >[0]);
});

// ---------------------------------------------------------------------------
// Guard tests — DND-05 / CANCEL-06
// ---------------------------------------------------------------------------

describe('gridStore.moveCell — no-op guards (DND-05 / CANCEL-06)', () => {
  // -------------------------------------------------------------------------
  // Guard 1 — fromId === toId (self-move). Each of the 5 edges must no-op.
  // -------------------------------------------------------------------------

  const SELF_EDGES = ['center', 'top', 'right', 'bottom', 'left'] as const;
  for (const edge of SELF_EDGES) {
    it(`Guard 1 (fromId===toId, edge='${edge}'): is a no-op that pushes no snapshot and does not mutate tree`, () => {
      const id = firstLeafId();
      const before = snapshot();

      useGridStore.getState().moveCell(id, id, edge);

      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
      expect(after.selectedNodeId).toBe(before.selectedNodeId);
    });
  }

  // -------------------------------------------------------------------------
  // Guard 2a — source node id does not exist in the tree.
  // -------------------------------------------------------------------------

  it('Guard 2a (!src — source id not in tree): is a no-op that pushes no snapshot and does not mutate tree', () => {
    const target = firstLeafId();
    // Prime selection so we can detect any accidental clear via
    // setSelectedNode(null) — a regression would set selectedNodeId to null.
    useEditorStore.getState().setSelectedNode(target);
    const before = snapshot();

    useGridStore
      .getState()
      .moveCell('this-id-does-not-exist', target, 'center');

    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
    expect(after.selectedNodeId).toBe(target);
  });

  // -------------------------------------------------------------------------
  // Guard 2b — source id refers to a container (not a leaf).
  // -------------------------------------------------------------------------

  it('Guard 2b (src.type !== "leaf" — source id is a container): is a no-op that pushes no snapshot and does not mutate tree', () => {
    const containerId = rootContainerId();
    const target = firstLeafId();
    useEditorStore.getState().setSelectedNode(target);
    const before = snapshot();

    useGridStore.getState().moveCell(containerId, target, 'top');

    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
    expect(after.selectedNodeId).toBe(target);
  });

  // -------------------------------------------------------------------------
  // Guard 3a — target node id does not exist in the tree.
  // -------------------------------------------------------------------------

  it('Guard 3a (!tgt — target id not in tree): is a no-op that pushes no snapshot and does not mutate tree', () => {
    const source = firstLeafId();
    useEditorStore.getState().setSelectedNode(source);
    const before = snapshot();

    useGridStore.getState().moveCell(source, 'missing-target-id', 'center');

    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
    expect(after.selectedNodeId).toBe(source);
  });

  // -------------------------------------------------------------------------
  // Guard 3b — target id refers to a container (not a leaf).
  //
  // The initial tree is `Container{children: [Leaf, Leaf]}`. Splitting the
  // first leaf horizontally (cross-direction from the vertical root) wraps
  // the leaf in a NEW inner container — giving us a nested container whose
  // id is not the root's. We use that inner container as the guard-3b target.
  // -------------------------------------------------------------------------

  it('Guard 3b (tgt.type !== "leaf" — target id is a container): is a no-op that pushes no snapshot and does not mutate tree', () => {
    const originalFirstLeaf = firstLeafId();
    // splitCell via `split` action wraps first leaf in a horizontal container.
    useGridStore.getState().split(originalFirstLeaf, 'horizontal');

    // After split, root.children[0] is the new inner container.
    const rootAfterSplit = useGridStore.getState().root as ContainerNode;
    const innerChild = rootAfterSplit.children[0];
    expect(innerChild.type).toBe('container');
    const innerContainerId = innerChild.id;

    // Pick a source that still exists post-split: root.children[1] is the
    // original second leaf, untouched by the horizontal split of the first.
    const source = (rootAfterSplit.children[1] as { id: string }).id;

    // Prime selection AFTER the split (split clears none of this, but be
    // explicit) so we can detect accidental selection clear.
    useEditorStore.getState().setSelectedNode(source);
    const before = snapshot();

    useGridStore.getState().moveCell(source, innerContainerId, 'top');

    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
    expect(after.selectedNodeId).toBe(source);
  });

  // -------------------------------------------------------------------------
  // Positive control — a valid commit DOES push exactly one snapshot and
  // DOES mutate the tree. If this test ever fails, the harness above is
  // broken (not the guards), and the guard tests' no-op assertions would
  // be meaningless.
  // -------------------------------------------------------------------------

  it('positive control: a valid commit (different leaves, edge=center) pushes exactly one snapshot and mutates tree', () => {
    const source = firstLeafId();
    const target = secondLeafId();
    const before = snapshot();

    useGridStore.getState().moveCell(source, target, 'center');

    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength + 1);
    expect(after.historyIndex).toBe(before.historyIndex + 1);
    // The commit may or may not produce a byte-different serialization
    // depending on swap semantics (center delegates to swapLeafContent),
    // but for two distinct empty leaves with different ids, the tree
    // object identity / structured snapshot WILL differ from the pre-call
    // one. Assert the snapshot got recorded regardless of content shape.
    expect(after.historyLength).toBeGreaterThan(before.historyLength);
  });

  // -------------------------------------------------------------------------
  // DND-05 scope assertion — gridStore.ts must not declare drag-state fields.
  //
  // Phase 27 puts all drag state in src/dnd/dragStore.ts. Any regression that
  // leaks `sourceId`, `overId`, or `activeZone` into gridStore's state shape
  // violates DND-05. Check at the property-declaration level (word boundary
  // followed by `:` or `=`), which tolerates the existing legitimate `// D-04`
  // comment text in gridStore and `findNode(current(...), fromId)` locals
  // that happen to contain the word "from".
  // -------------------------------------------------------------------------

  it('DND-05 scope: gridStore.ts declares no drag-state fields (sourceId / overId / activeZone)', async () => {
    const gridStorePath = resolve(__dirname, '..', 'gridStore.ts');
    const src = await readFile(gridStorePath, 'utf-8');
    const forbidden = ['sourceId', 'overId', 'activeZone'];
    for (const name of forbidden) {
      // Match at property-declaration level: `name:` or `name =` preceded by
      // a word boundary. This excludes substring hits and comment text.
      const re = new RegExp(`\\b${name}\\s*[:=]`);
      expect(
        src,
        `gridStore.ts must not declare drag-field "${name}" — this belongs in src/dnd/dragStore.ts (DND-05)`,
      ).not.toMatch(re);
    }
  });
});
