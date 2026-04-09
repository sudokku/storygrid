import { describe, it, expect } from 'vitest';
import {
  createLeaf,
  splitNode,
  mergeNode,
  removeNode,
  resizeSiblings,
  updateLeaf,
  buildInitialTree,
  findNode,
  findParent,
  getAllLeaves,
  MIN_CELL_WEIGHT,
} from '../lib/tree';
import type { GridNode, ContainerNode, LeafNode } from '../types';

describe('createLeaf', () => {
  it('returns correct shape', () => {
    const leaf = createLeaf();
    expect(leaf.type).toBe('leaf');
    expect(typeof leaf.id).toBe('string');
    expect(leaf.id.length).toBe(21);
    expect(leaf.mediaId).toBeNull();
    expect(leaf.fit).toBe('cover');
  });

  it('produces unique IDs on successive calls', () => {
    const a = createLeaf();
    const b = createLeaf();
    expect(a.id).not.toBe(b.id);
  });

  it('initializes audioEnabled to true', () => {
    const leaf = createLeaf();
    expect(leaf.audioEnabled).toBe(true);
  });
});

describe('splitNode', () => {
  it('splits a single-leaf root into horizontal container', () => {
    const root: GridNode = createLeaf();
    const result = splitNode(root, root.id, 'horizontal');
    expect(result.type).toBe('container');
    const container = result as ContainerNode;
    expect(container.direction).toBe('horizontal');
    expect(container.sizes).toEqual([1, 1]);
    expect(container.children.length).toBe(2);
    expect(container.children[0].id).toBe(root.id);
    expect(container.children[1].type).toBe('leaf');
  });

  it('appends sibling when parent direction matches (same-direction append)', () => {
    // Build: vertical container with one leaf
    const leafA = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'vertical',
      sizes: [1],
      children: [leafA],
    };
    const result = splitNode(root, leafA.id, 'vertical');
    expect(result.type).toBe('container');
    const container = result as ContainerNode;
    expect(container.direction).toBe('vertical');
    expect(container.children.length).toBe(2);
    expect(container.sizes).toEqual([1, 1]);
    expect(container.children[0].id).toBe(leafA.id);
  });

  it('wraps leaf in new container when parent direction differs (cross-direction wrap)', () => {
    const leafA = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'vertical',
      sizes: [1],
      children: [leafA],
    };
    // Split horizontally — parent is vertical, so cross-direction → wrap
    const result = splitNode(root, leafA.id, 'horizontal');
    expect(result.type).toBe('container');
    const outer = result as ContainerNode;
    expect(outer.direction).toBe('vertical');
    expect(outer.children.length).toBe(1);
    const inner = outer.children[0] as ContainerNode;
    expect(inner.type).toBe('container');
    expect(inner.direction).toBe('horizontal');
    expect(inner.sizes).toEqual([1, 1]);
    expect(inner.children[0].id).toBe(leafA.id);
  });

  it('preserves original leaf mediaId after split', () => {
    const leaf = createLeaf();
    const leafWithMedia: LeafNode = { ...leaf, mediaId: 'media-001' };
    const result = splitNode(leafWithMedia, leafWithMedia.id, 'vertical');
    const container = result as ContainerNode;
    const original = container.children[0] as LeafNode;
    expect(original.mediaId).toBe('media-001');
  });
});

describe('findNode', () => {
  it('finds an existing node by id', () => {
    const leaf = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leaf, createLeaf()],
    };
    const found = findNode(root, leaf.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(leaf.id);
  });

  it('returns null for nonexistent id', () => {
    const root = createLeaf();
    const found = findNode(root, 'nonexistent-id');
    expect(found).toBeNull();
  });
});

describe('findParent', () => {
  it('finds the parent container of a child node', () => {
    const leaf = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leaf, createLeaf()],
    };
    const parent = findParent(root, leaf.id);
    expect(parent).not.toBeNull();
    expect(parent!.id).toBe('root');
  });

  it('returns null for root node itself', () => {
    const root = createLeaf();
    const parent = findParent(root, root.id);
    expect(parent).toBeNull();
  });
});

describe('getAllLeaves', () => {
  it('returns all leaves in a flat tree', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const leaves = getAllLeaves(root);
    expect(leaves.length).toBe(2);
    expect(leaves.map(l => l.id)).toContain(leafA.id);
    expect(leaves.map(l => l.id)).toContain(leafB.id);
  });

  it('returns all leaves in a deeply nested tree (3+ levels)', () => {
    const d1 = createLeaf();
    const d2 = createLeaf();
    const d3 = createLeaf();
    const d4 = createLeaf();
    // 3-level deep tree
    const level3: GridNode = {
      type: 'container',
      id: 'level3',
      direction: 'vertical',
      sizes: [1, 1],
      children: [d3, d4],
    };
    const level2: GridNode = {
      type: 'container',
      id: 'level2',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [d2, level3],
    };
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'vertical',
      sizes: [1, 1],
      children: [d1, level2],
    };
    const leaves = getAllLeaves(root);
    expect(leaves.length).toBe(4);
    const ids = leaves.map(l => l.id);
    expect(ids).toContain(d1.id);
    expect(ids).toContain(d2.id);
    expect(ids).toContain(d3.id);
    expect(ids).toContain(d4.id);
  });
});

describe('immutability', () => {
  it('input root reference is unchanged after splitNode', () => {
    const root: GridNode = createLeaf();
    const originalId = root.id;
    const result = splitNode(root, root.id, 'horizontal');
    // result is a new object
    expect(result).not.toBe(root);
    // original root is still a leaf with its id intact
    expect(root.type).toBe('leaf');
    expect(root.id).toBe(originalId);
  });
});

describe('mergeNode', () => {
  it('collapses a container to its first child leaf', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const result = mergeNode(root, 'root');
    expect(result.type).toBe('leaf');
    expect(result.id).toBe(leafA.id);
  });

  it('preserves first child mediaId when merging', () => {
    const leafA: LeafNode = { type: 'leaf', id: 'leaf-a', mediaId: 'media-123', fit: 'cover' };
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const result = mergeNode(root, 'root') as LeafNode;
    expect(result.mediaId).toBe('media-123');
  });

  it('handles nested container as first child — replaces with that container', () => {
    const innerLeaf = createLeaf();
    const innerContainer: ContainerNode = {
      type: 'container',
      id: 'inner',
      direction: 'vertical',
      sizes: [1],
      children: [innerLeaf],
    };
    const outerLeaf = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [innerContainer, outerLeaf],
    };
    const result = mergeNode(root, 'root');
    expect(result.type).toBe('container');
    expect(result.id).toBe('inner');
  });
});

describe('removeNode', () => {
  it('removes a leaf and collapses parent when one sibling remains', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'vertical',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const result = removeNode(root, leafA.id);
    // Parent collapses to remaining child
    expect(result.type).toBe('leaf');
    expect(result.id).toBe(leafB.id);
  });

  it('returns root unchanged when trying to remove the only node', () => {
    const root = createLeaf();
    const result = removeNode(root, root.id);
    expect(result).toBe(root);
  });

  it('removes from 3-sibling container and shrinks sizes array', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const leafC = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1, 1],
      children: [leafA, leafB, leafC],
    };
    const result = removeNode(root, leafB.id) as ContainerNode;
    expect(result.type).toBe('container');
    expect(result.children.length).toBe(2);
    expect(result.sizes.length).toBe(2);
    expect(result.children.map(c => c.id)).not.toContain(leafB.id);
  });
});

describe('resizeSiblings', () => {
  it('adjusts two adjacent weights by delta', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const result = resizeSiblings(root, 'root', 0, 0.5) as ContainerNode;
    expect(result.sizes[0]).toBeCloseTo(1.5);
    expect(result.sizes[1]).toBeCloseTo(0.5);
  });

  it('clamps minimum weight to MIN_CELL_WEIGHT when delta is too large', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    // delta of 1.5 would push sizes[1] to -0.5, below MIN_CELL_WEIGHT
    const result = resizeSiblings(root, 'root', 0, 1.5) as ContainerNode;
    expect(result.sizes[1]).toBeGreaterThanOrEqual(MIN_CELL_WEIGHT);
    expect(result.sizes[0]).toBeGreaterThanOrEqual(MIN_CELL_WEIGHT);
  });

  it('does not mutate input root', () => {
    const leafA = createLeaf();
    const leafB = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, leafB],
    };
    const originalSizes = [...(root as ContainerNode).sizes];
    resizeSiblings(root, 'root', 0, 0.3);
    expect((root as ContainerNode).sizes).toEqual(originalSizes);
  });
});

describe('updateLeaf', () => {
  it('updates fit property on the target leaf; input unchanged', () => {
    const leaf = createLeaf(); // fit: 'cover'
    const root: GridNode = leaf;
    const result = updateLeaf(root, leaf.id, { fit: 'contain' }) as LeafNode;
    expect(result.fit).toBe('contain');
    // Input unchanged
    expect(leaf.fit).toBe('cover');
    expect(result).not.toBe(leaf);
  });

  it('updates mediaId on the target leaf', () => {
    const leaf = createLeaf();
    const root: GridNode = leaf;
    const result = updateLeaf(root, leaf.id, { mediaId: 'abc-media' }) as LeafNode;
    expect(result.mediaId).toBe('abc-media');
  });
});

describe('buildInitialTree', () => {
  it('returns vertical container with 2 leaf children and sizes [1, 1]', () => {
    const tree = buildInitialTree() as ContainerNode;
    expect(tree.type).toBe('container');
    expect(tree.direction).toBe('vertical');
    expect(tree.sizes).toEqual([1, 1]);
    expect(tree.children.length).toBe(2);
    expect(tree.children[0].type).toBe('leaf');
    expect(tree.children[1].type).toBe('leaf');
  });
});
