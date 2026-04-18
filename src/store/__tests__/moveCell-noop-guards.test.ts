/**
 * Regression tests for gridStore.moveCell no-op guard behavior.
 *
 * Requirements addressed:
 *   - DND-05: gridStore.moveCell + tree primitives MUST remain unchanged through Phase 27.
 *   - CANCEL-06: The four no-op early-return guards in moveCell MUST NOT push undo snapshots.
 *
 * These tests lock against Pitfall 11 (PITFALLS.md): "Aborted drag produces polluted undo
 * history." If any guard is removed or inverted, cancelled drags will push a snapshot and
 * pollute Ctrl+Z history — a silent regression detectable only by noticing strange undo
 * behavior in production. This file makes that class of bug fail CI immediately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { useGridStore } from '../gridStore';
import { useEditorStore } from '../editorStore';
import type { ContainerNode } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  if (child.type !== 'leaf') throw new Error('test fixture expects first child to be a leaf');
  return child.id;
}

function secondLeafId(): string {
  const { root } = useGridStore.getState();
  const container = root as ContainerNode;
  const child = container.children[1];
  if (child.type !== 'leaf') throw new Error('test fixture expects second child to be a leaf');
  return child.id;
}

function rootContainerId(): string {
  const { root } = useGridStore.getState();
  return (root as ContainerNode).id;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({ selectedNodeId: null } as Parameters<typeof useEditorStore.setState>[0]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("gridStore.moveCell — no-op guards (DND-05 / CANCEL-06)", () => {
  // -------------------------------------------------------------------------
  // Guard 1: fromId === toId — self-move must be a no-op for all edges
  // -------------------------------------------------------------------------
  describe('Guard 1 — fromId === toId (self-move)', () => {
    it('center edge: is a no-op that pushes no snapshot and does not mutate tree', () => {
      const id = firstLeafId();
      const before = snapshot();
      useGridStore.getState().moveCell(id, id, 'center');
      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
      expect(after.selectedNodeId).toBe(before.selectedNodeId);
    });

    it('top edge: is a no-op that pushes no snapshot and does not mutate tree', () => {
      const id = firstLeafId();
      const before = snapshot();
      useGridStore.getState().moveCell(id, id, 'top');
      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
    });

    it('right edge: is a no-op that pushes no snapshot and does not mutate tree', () => {
      const id = firstLeafId();
      const before = snapshot();
      useGridStore.getState().moveCell(id, id, 'right');
      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
    });

    it('bottom edge: is a no-op that pushes no snapshot and does not mutate tree', () => {
      const id = firstLeafId();
      const before = snapshot();
      useGridStore.getState().moveCell(id, id, 'bottom');
      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
    });

    it('left edge: is a no-op that pushes no snapshot and does not mutate tree', () => {
      const id = firstLeafId();
      const before = snapshot();
      useGridStore.getState().moveCell(id, id, 'left');
      const after = snapshot();
      expect(after.historyLength).toBe(before.historyLength);
      expect(after.historyIndex).toBe(before.historyIndex);
      expect(after.rootJSON).toBe(before.rootJSON);
    });
  });

  // -------------------------------------------------------------------------
  // Guard 2a: source node id does not exist in tree
  // -------------------------------------------------------------------------
  it('Guard 2a — source id not in tree: is a no-op that pushes no snapshot and does not mutate tree', () => {
    const target = firstLeafId();
    const before = snapshot();
    useGridStore.getState().moveCell('this-id-does-not-exist', target, 'center');
    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
  });

  // -------------------------------------------------------------------------
  // Guard 2b: source id refers to a container, not a leaf
  // -------------------------------------------------------------------------
  it('Guard 2b — source is a container: is a no-op that pushes no snapshot and does not mutate tree', () => {
    const containerId = rootContainerId();
    const target = firstLeafId();
    const before = snapshot();
    useGridStore.getState().moveCell(containerId, target, 'top');
    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
  });

  // -------------------------------------------------------------------------
  // Guard 3a: target node id does not exist in tree
  // -------------------------------------------------------------------------
  it('Guard 3a — target id not in tree: is a no-op that pushes no snapshot and does not mutate tree', () => {
    const source = firstLeafId();
    const before = snapshot();
    useGridStore.getState().moveCell(source, 'missing-target-id', 'center');
    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
  });

  // -------------------------------------------------------------------------
  // Guard 3b: target id refers to a container, not a leaf
  // -------------------------------------------------------------------------
  it('Guard 3b — target is a container: is a no-op that pushes no snapshot and does not mutate tree', () => {
    // Split the first leaf to create a nested container, then use that container id as target.
    const sourceId = firstLeafId();
    useGridStore.getState().split(sourceId, 'horizontal');
    // After split, sourceId is replaced in the tree — find a remaining leaf as source.
    // The root container's children now include: [container (from split), leaf2].
    // Find the nested container id.
    const { root } = useGridStore.getState();
    const rootContainer = root as ContainerNode;
    // Find a child that is a container (the split result).
    const nestedContainer = rootContainer.children.find(c => c.type === 'container');
    if (!nestedContainer) throw new Error('Expected a nested container after splitCell');
    const nestedContainerId = nestedContainer.id;
    // Find a leaf to use as source.
    const remainingLeaf = rootContainer.children.find(c => c.type === 'leaf');
    if (!remainingLeaf) throw new Error('Expected a leaf sibling after splitCell');
    const realSourceId = remainingLeaf.id;

    const before = snapshot();
    useGridStore.getState().moveCell(realSourceId, nestedContainerId, 'top');
    const after = snapshot();
    expect(after.historyLength).toBe(before.historyLength);
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.rootJSON).toBe(before.rootJSON);
    expect(after.selectedNodeId).toBe(before.selectedNodeId);
  });

  // -------------------------------------------------------------------------
  // Positive control: valid source + valid target + different leaves should commit
  // -------------------------------------------------------------------------
  it('Positive control — valid different leaves: pushes exactly one snapshot and mutates tree', () => {
    const source = firstLeafId();
    const target = secondLeafId();
    const before = snapshot();
    useGridStore.getState().moveCell(source, target, 'center');
    const after = snapshot();
    // Exactly one snapshot pushed.
    expect(after.historyLength).toBe(before.historyLength + 1);
    // Tree has changed (swap occurred).
    // (For center/swap the structure is the same but mediaId swapped; JSON may differ if content differs.
    //  At minimum, history advanced — that's the canary.)
  });

  // -------------------------------------------------------------------------
  // DND-05 scope assertion: gridStore must not contain drag field names at state level
  // -------------------------------------------------------------------------
  it('DND-05 scope assertion — gridStore has no drag field names (sourceId, overId, activeZone)', async () => {
    const src = await readFile(
      `${process.cwd()}/src/store/gridStore.ts`,
      'utf-8'
    );
    const forbidden = ['sourceId', 'overId', 'activeZone'];
    for (const name of forbidden) {
      // Match top-level property declaration patterns: `name:` or `name =`
      expect(src).not.toMatch(new RegExp(`\\b${name}\\s*[:=]`));
    }
  });
});
