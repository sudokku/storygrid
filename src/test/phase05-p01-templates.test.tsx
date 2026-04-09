import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLeaf,
  buildTemplate,
  swapLeafContent,
  getAllLeaves,
} from '../lib/tree';
import type { ContainerNode, LeafNode, GridNode } from '../types';
import { useGridStore } from '../store/gridStore';

// jsdom compatibility: mock URL.revokeObjectURL (not provided by jsdom)
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

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
      backgroundColor: '#ff0000', panX: 10, panY: 20, panScale: 1.5, audioEnabled: true,
    };
    const leafB: LeafNode = {
      type: 'leaf', id: 'b', mediaId: 'media-b', fit: 'contain',
      backgroundColor: '#00ff00', panX: -5, panY: 15, panScale: 2.0, audioEnabled: true,
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
  it('A: empty grid -> empty template (no media, fresh leaves)', () => {
    // Initial state: vertical container with 2 empty leaves, empty registry
    const template = buildTemplate('2x2');
    useGridStore.getState().applyTemplate(template);

    const { root, mediaRegistry } = useGridStore.getState();
    expect(root.id).toBe(template.id);
    const leaves = getAllLeaves(root);
    expect(leaves).toHaveLength(4);
    leaves.forEach(l => expect(l.mediaId).toBeNull());
    expect(Object.keys(mediaRegistry)).toHaveLength(0);
  });

  it('B: grid with fewer media than template leaves — migrates in DFS order', () => {
    const { root } = useGridStore.getState();
    const container = root as ContainerNode;
    const leafA = container.children[0] as LeafNode;
    const leafB = container.children[1] as LeafNode;

    useGridStore.getState().addMedia('m1', 'data:image/png;base64,aaa');
    useGridStore.getState().addMedia('m2', 'data:image/png;base64,bbb');
    useGridStore.getState().setMedia(leafA.id, 'm1');
    useGridStore.getState().setMedia(leafB.id, 'm2');

    useGridStore.getState().applyTemplate(buildTemplate('2x2'));

    const { root: newRoot, mediaRegistry } = useGridStore.getState();
    const newLeaves = getAllLeaves(newRoot);
    expect(newLeaves).toHaveLength(4);
    expect(newLeaves[0].mediaId).toBe('m1');
    expect(newLeaves[1].mediaId).toBe('m2');
    expect(newLeaves[2].mediaId).toBeNull();
    expect(newLeaves[3].mediaId).toBeNull();
    expect(mediaRegistry['m1']).toBe('data:image/png;base64,aaa');
    expect(mediaRegistry['m2']).toBe('data:image/png;base64,bbb');
  });

  it('C: grid with more media than template leaves — surplus pruned and blobs revoked', () => {
    // Start from 2x2 template applied as root
    useGridStore.getState().applyTemplate(buildTemplate('2x2'));
    const leaves4 = getAllLeaves(useGridStore.getState().root);
    expect(leaves4).toHaveLength(4);

    // Add 4 media — m3 and m4 are blob URLs to verify revocation
    useGridStore.getState().addMedia('m1', 'data:image/png;base64,aaa');
    useGridStore.getState().addMedia('m2', 'data:image/png;base64,bbb');
    useGridStore.getState().addMedia('m3', 'blob:http://localhost/ccc');
    useGridStore.getState().addMedia('m4', 'blob:http://localhost/ddd');
    useGridStore.getState().setMedia(leaves4[0].id, 'm1');
    useGridStore.getState().setMedia(leaves4[1].id, 'm2');
    useGridStore.getState().setMedia(leaves4[2].id, 'm3');
    useGridStore.getState().setMedia(leaves4[3].id, 'm4');

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useGridStore.getState().applyTemplate(buildTemplate('1x2'));

    const { root: newRoot, mediaRegistry, mediaTypeMap, thumbnailMap } = useGridStore.getState();
    const newLeaves = getAllLeaves(newRoot);
    expect(newLeaves).toHaveLength(2);
    expect(newLeaves.map(l => l.mediaId)).toEqual(['m1', 'm2']);
    expect(Object.keys(mediaRegistry).sort()).toEqual(['m1', 'm2']);
    expect(Object.keys(mediaTypeMap).sort()).toEqual(['m1', 'm2']);
    // thumbnailMap should not contain dropped ids
    expect(thumbnailMap['m3']).toBeUndefined();
    expect(thumbnailMap['m4']).toBeUndefined();

    // Blob URLs for dropped ids should have been revoked
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/ccc');
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/ddd');
    // Kept ids were data URIs — not revoked
    expect(revokeSpy).not.toHaveBeenCalledWith('data:image/png;base64,aaa');
    expect(revokeSpy).not.toHaveBeenCalledWith('data:image/png;base64,bbb');

    revokeSpy.mockRestore();
  });

  it('D: only raw mediaId is migrated — no pan/zoom/fit/bg carries over', () => {
    const { root } = useGridStore.getState();
    const container = root as ContainerNode;
    const leafA = container.children[0] as LeafNode;

    useGridStore.getState().addMedia('m1', 'data:image/png;base64,aaa');
    useGridStore.getState().setMedia(leafA.id, 'm1');
    useGridStore.getState().updateCell(leafA.id, {
      fit: 'contain',
      backgroundColor: '#ff0000',
      panX: 50,
      panY: 25,
      panScale: 2,
    });

    useGridStore.getState().applyTemplate(buildTemplate('2x1'));

    const newLeaves = getAllLeaves(useGridStore.getState().root);
    expect(newLeaves[0].mediaId).toBe('m1');
    expect(newLeaves[0].fit).toBe('cover');
    expect(newLeaves[0].objectPosition).toBe('center center');
    expect(newLeaves[0].backgroundColor).toBeNull();
    expect(newLeaves[0].panX).toBe(0);
    expect(newLeaves[0].panY).toBe(0);
    expect(newLeaves[0].panScale).toBe(1);
  });

  it('E: migrated blob mediaRegistry entries are NOT revoked', () => {
    const { root } = useGridStore.getState();
    const container = root as ContainerNode;
    const leafA = container.children[0] as LeafNode;

    useGridStore.getState().addMedia('m1', 'blob:http://localhost/abc');
    useGridStore.getState().setMedia(leafA.id, 'm1');

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useGridStore.getState().applyTemplate(buildTemplate('2x1'));

    const { mediaRegistry } = useGridStore.getState();
    expect(mediaRegistry['m1']).toBe('blob:http://localhost/abc');
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:http://localhost/abc');

    revokeSpy.mockRestore();
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
