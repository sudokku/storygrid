import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLeaf,
  buildTemplate,
  swapLeafContent,
  getAllLeaves,
} from '../lib/tree';
import type { ContainerNode, LeafNode, GridNode } from '../types';
import { useGridStore } from '../store/gridStore';

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// createLeaf returns pan fields
// ---------------------------------------------------------------------------

describe('createLeaf pan fields', () => {
  it('returns panX: 0, panY: 0, panScale: 1', () => {
    const leaf = createLeaf();
    expect(leaf.panX).toBe(0);
    expect(leaf.panY).toBe(0);
    expect(leaf.panScale).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// swapLeafContent
// ---------------------------------------------------------------------------

describe('swapLeafContent', () => {
  it('swaps mediaId, fit, backgroundColor, panX, panY, panScale between two leaves', () => {
    const leafA: LeafNode = {
      type: 'leaf', id: 'a', mediaId: 'media-a', fit: 'cover',
      backgroundColor: '#ff0000', panX: 10, panY: 20, panScale: 1.5,
    };
    const leafB: LeafNode = {
      type: 'leaf', id: 'b', mediaId: 'media-b', fit: 'contain',
      backgroundColor: '#00ff00', panX: -5, panY: 15, panScale: 2.0,
    };
    const root: GridNode = {
      type: 'container', id: 'root', direction: 'vertical', sizes: [1, 1],
      children: [leafA, leafB],
    };

    const result = swapLeafContent(root, 'a', 'b') as ContainerNode;
    const newA = result.children[0] as LeafNode;
    const newB = result.children[1] as LeafNode;

    // A now has B's content
    expect(newA.mediaId).toBe('media-b');
    expect(newA.fit).toBe('contain');
    expect(newA.backgroundColor).toBe('#00ff00');
    expect(newA.panX).toBe(-5);
    expect(newA.panY).toBe(15);
    expect(newA.panScale).toBe(2.0);

    // B now has A's content
    expect(newB.mediaId).toBe('media-a');
    expect(newB.fit).toBe('cover');
    expect(newB.backgroundColor).toBe('#ff0000');
    expect(newB.panX).toBe(10);
    expect(newB.panY).toBe(20);
    expect(newB.panScale).toBe(1.5);
  });

  it('returns root unchanged if idA not found', () => {
    const leaf = createLeaf();
    const root: GridNode = leaf;
    const result = swapLeafContent(root, 'nonexistent', leaf.id);
    expect(result).toBe(root);
  });

  it('returns root unchanged if idB not found', () => {
    const leaf = createLeaf();
    const root: GridNode = leaf;
    const result = swapLeafContent(root, leaf.id, 'nonexistent');
    expect(result).toBe(root);
  });

  it('returns root unchanged if nodeA is not a leaf (is container)', () => {
    const inner = createLeaf();
    const container: ContainerNode = {
      type: 'container', id: 'c1', direction: 'vertical', sizes: [1], children: [inner],
    };
    const leaf = createLeaf();
    const root: GridNode = {
      type: 'container', id: 'root', direction: 'horizontal', sizes: [1, 1],
      children: [container, leaf],
    };
    const result = swapLeafContent(root, 'c1', leaf.id);
    expect(result).toBe(root);
  });
});

// ---------------------------------------------------------------------------
// buildTemplate
// ---------------------------------------------------------------------------

describe('buildTemplate', () => {
  it('2x1: returns vertical container with 2 leaves', () => {
    const tree = buildTemplate('2x1') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('vertical');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].type).toBe('leaf');
    expect(tree.children[1].type).toBe('leaf');
    expect(tree.sizes).toEqual([1, 1]);
  });

  it('1x2: returns horizontal container with 2 leaves', () => {
    const tree = buildTemplate('1x2') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('horizontal');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].type).toBe('leaf');
    expect(tree.children[1].type).toBe('leaf');
  });

  it('2x2: returns vertical container with 2 horizontal children each having 2 leaves', () => {
    const tree = buildTemplate('2x2') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('vertical');
    expect(tree.children).toHaveLength(2);
    const row1 = tree.children[0] as ContainerNode;
    const row2 = tree.children[1] as ContainerNode;
    expect(row1.type).toBe('container');
    expect(row1.direction).toBe('horizontal');
    expect(row1.children).toHaveLength(2);
    expect(row2.type).toBe('container');
    expect(row2.direction).toBe('horizontal');
    expect(row2.children).toHaveLength(2);
  });

  it('3-row: returns vertical container with 3 leaves', () => {
    const tree = buildTemplate('3-row') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('vertical');
    expect(tree.children).toHaveLength(3);
    tree.children.forEach(c => expect(c.type).toBe('leaf'));
  });

  it('l-shape: returns horizontal container with sizes [2,1], first child leaf, second child vertical container with 2 leaves', () => {
    const tree = buildTemplate('l-shape') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('horizontal');
    expect(tree.sizes).toEqual([2, 1]);
    expect(tree.children[0].type).toBe('leaf');
    const secondChild = tree.children[1] as ContainerNode;
    expect(secondChild.type).toBe('container');
    expect(secondChild.direction).toBe('vertical');
    expect(secondChild.children).toHaveLength(2);
  });

  it('mosaic: returns vertical container, first child horizontal with 3 leaves, second child horizontal with 2 leaves', () => {
    const tree = buildTemplate('mosaic') as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('vertical');
    const row1 = tree.children[0] as ContainerNode;
    const row2 = tree.children[1] as ContainerNode;
    expect(row1.direction).toBe('horizontal');
    expect(row1.children).toHaveLength(3);
    expect(row2.direction).toBe('horizontal');
    expect(row2.children).toHaveLength(2);
  });

  it('buildTemplate generates all leaves with panX: 0, panY: 0, panScale: 1', () => {
    const tree = buildTemplate('2x2');
    const leaves = getAllLeaves(tree);
    leaves.forEach(leaf => {
      expect(leaf.panX).toBe(0);
      expect(leaf.panY).toBe(0);
      expect(leaf.panScale).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// gridStore.applyTemplate
// ---------------------------------------------------------------------------

describe('gridStore.applyTemplate', () => {
  it('replaces root with template tree and clears mediaRegistry', () => {
    // Set up media in registry
    useGridStore.getState().addMedia('m1', 'data:...');
    const template = buildTemplate('2x1');
    useGridStore.getState().applyTemplate(template);

    const { root, mediaRegistry } = useGridStore.getState();
    expect(root).toBe(template);
    expect(Object.keys(mediaRegistry)).toHaveLength(0);
  });

  it('pushes snapshot — undo restores previous tree', () => {
    const originalRoot = useGridStore.getState().root;
    const template = buildTemplate('2x1');
    useGridStore.getState().applyTemplate(template);

    const { historyIndex } = useGridStore.getState();
    expect(historyIndex).toBeGreaterThan(0);

    useGridStore.getState().undo();

    const { root } = useGridStore.getState();
    expect(root.id).toBe(originalRoot.id);
  });
});

// ---------------------------------------------------------------------------
// gridStore.swapCells
// ---------------------------------------------------------------------------

describe('gridStore.swapCells', () => {
  it('swaps leaf content between two cells and pushes snapshot', () => {
    // Initial state: vertical container with 2 leaves
    const { root } = useGridStore.getState();
    const container = root as ContainerNode;
    const idA = container.children[0].id;
    const idB = container.children[1].id;

    // Give leaf A some media
    useGridStore.getState().setMedia(idA, 'media-a');

    const { historyIndex: beforeIndex } = useGridStore.getState();
    useGridStore.getState().swapCells(idA, idB);
    const { historyIndex: afterIndex } = useGridStore.getState();

    expect(afterIndex).toBe(beforeIndex + 1);

    // After swap, leaf B should have media-a and leaf A should be empty
    const { root: newRoot } = useGridStore.getState();
    const newContainer = newRoot as ContainerNode;
    const newA = newContainer.children[0] as LeafNode;
    const newB = newContainer.children[1] as LeafNode;
    expect(newA.mediaId).toBeNull();
    expect(newB.mediaId).toBe('media-a');
  });
});
