/**
 * phase05-p02-cell-swap.test.ts
 * Tests for the gridStore.swapCells action (D-13).
 *
 * Coverage:
 * - swapCells store action swaps media content between two leaves
 * - swapCells pushes to undo history (historyIndex increments)
 * - swap is undoable via undo()
 *
 * Phase 28 note: ActionBar drag-handle tests DELETED — DRAG-07 removed the
 * GripVertical button; the entire cell is now the draggable via
 * useCellDraggable in LeafNode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../store/gridStore';
import type { ContainerNode, LeafNode, GridNode } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  return {
    type: 'leaf',
    id: 'leaf-1',
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    audioEnabled: true,
    ...overrides,
  };
}

function makeContainer(leafA: LeafNode, leafB: LeafNode): ContainerNode {
  return {
    type: 'container',
    id: 'container-1',
    direction: 'horizontal',
    sizes: [0.5, 0.5],
    children: [leafA, leafB],
  };
}

function setGridState(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({ root, mediaRegistry: registry, history: [{ root }], historyIndex: 0 });
}

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// POLH-07-A: swapCells store action
// ---------------------------------------------------------------------------

describe('swapCells store action (D-13)', () => {
  it('swaps mediaId between two leaves', () => {
    const leafA = makeLeaf({ id: 'leaf-a', mediaId: 'media-a', fit: 'cover', panX: 10, panY: 0, panScale: 1 });
    const leafB = makeLeaf({ id: 'leaf-b', mediaId: 'media-b', fit: 'contain', panX: 0, panY: 20, panScale: 2 });
    const tree = makeContainer(leafA, leafB);
    setGridState(tree, { 'media-a': 'data:image/png;base64,AAA', 'media-b': 'data:image/png;base64,BBB' });

    useGridStore.getState().swapCells('leaf-a', 'leaf-b');

    const { root } = useGridStore.getState();
    const updatedA = (root as ContainerNode).children[0] as LeafNode;
    const updatedB = (root as ContainerNode).children[1] as LeafNode;

    expect(updatedA.mediaId).toBe('media-b');
    expect(updatedB.mediaId).toBe('media-a');
  });

  it('swaps fit between two leaves', () => {
    const leafA = makeLeaf({ id: 'leaf-a', mediaId: 'media-a', fit: 'cover' });
    const leafB = makeLeaf({ id: 'leaf-b', mediaId: 'media-b', fit: 'contain' });
    const tree = makeContainer(leafA, leafB);
    setGridState(tree, { 'media-a': 'data:image/png;base64,AAA', 'media-b': 'data:image/png;base64,BBB' });

    useGridStore.getState().swapCells('leaf-a', 'leaf-b');

    const { root } = useGridStore.getState();
    const updatedA = (root as ContainerNode).children[0] as LeafNode;
    const updatedB = (root as ContainerNode).children[1] as LeafNode;

    expect(updatedA.fit).toBe('contain');
    expect(updatedB.fit).toBe('cover');
  });

  it('swaps panX, panY, panScale between two leaves', () => {
    const leafA = makeLeaf({ id: 'leaf-a', mediaId: 'media-a', panX: 10, panY: 5, panScale: 1.5 });
    const leafB = makeLeaf({ id: 'leaf-b', mediaId: 'media-b', panX: 30, panY: 20, panScale: 2.0 });
    const tree = makeContainer(leafA, leafB);
    setGridState(tree, { 'media-a': 'data:image/png;base64,AAA', 'media-b': 'data:image/png;base64,BBB' });

    useGridStore.getState().swapCells('leaf-a', 'leaf-b');

    const { root } = useGridStore.getState();
    const updatedA = (root as ContainerNode).children[0] as LeafNode;
    const updatedB = (root as ContainerNode).children[1] as LeafNode;

    expect(updatedA.panX).toBe(30);
    expect(updatedA.panY).toBe(20);
    expect(updatedA.panScale).toBe(2.0);
    expect(updatedB.panX).toBe(10);
    expect(updatedB.panY).toBe(5);
    expect(updatedB.panScale).toBe(1.5);
  });

  it('pushes to undo history (historyIndex increments)', () => {
    const leafA = makeLeaf({ id: 'leaf-a', mediaId: 'media-a' });
    const leafB = makeLeaf({ id: 'leaf-b', mediaId: 'media-b' });
    const tree = makeContainer(leafA, leafB);
    setGridState(tree, { 'media-a': 'data:image/png;base64,AAA', 'media-b': 'data:image/png;base64,BBB' });

    const beforeIndex = useGridStore.getState().historyIndex;
    useGridStore.getState().swapCells('leaf-a', 'leaf-b');
    const afterIndex = useGridStore.getState().historyIndex;

    expect(afterIndex).toBeGreaterThan(beforeIndex);
  });

  it('swap is undoable via undo()', () => {
    const leafA = makeLeaf({ id: 'leaf-a', mediaId: 'media-a' });
    const leafB = makeLeaf({ id: 'leaf-b', mediaId: 'media-b' });
    const tree = makeContainer(leafA, leafB);
    setGridState(tree, { 'media-a': 'data:image/png;base64,AAA', 'media-b': 'data:image/png;base64,BBB' });

    useGridStore.getState().swapCells('leaf-a', 'leaf-b');
    useGridStore.getState().undo();

    const { root } = useGridStore.getState();
    const revertedA = (root as ContainerNode).children[0] as LeafNode;
    const revertedB = (root as ContainerNode).children[1] as LeafNode;

    expect(revertedA.mediaId).toBe('media-a');
    expect(revertedB.mediaId).toBe('media-b');
  });
});
