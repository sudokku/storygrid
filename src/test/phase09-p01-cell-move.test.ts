/**
 * phase09-p01-cell-move.test.ts
 * Tests for moveLeafToEdge pure function (Phase 9 Plan 1).
 *
 * Covers EC-01..EC-18 from .planning/phases/09-improve-cell-movement-and-swapping/09-RESEARCH.md.
 * Two-pass implementation: mapNode wrap target -> removeNode source.
 *
 * Tests intentionally start in the RED state — moveLeafToEdge does not exist yet.
 */
import { describe, it, expect } from 'vitest';
import { moveLeafToEdge, findNode, createLeaf } from '../lib/tree';
import type { GridNode, LeafNode, ContainerNode } from '../types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const leaf = (id: string, overrides: Partial<LeafNode> = {}): LeafNode => ({
  type: 'leaf',
  id,
  mediaId: null,
  fit: 'cover',
  backgroundColor: null,
  panX: 0,
  panY: 0,
  panScale: 1,
  audioEnabled: true,
  ...overrides,
});

const hcontainer = (id: string, children: GridNode[], sizes?: number[]): ContainerNode => ({
  type: 'container',
  id,
  direction: 'horizontal',
  children,
  sizes: sizes ?? children.map(() => 1),
});

const vcontainer = (id: string, children: GridNode[], sizes?: number[]): ContainerNode => ({
  type: 'container',
  id,
  direction: 'vertical',
  children,
  sizes: sizes ?? children.map(() => 1),
});

// ---------------------------------------------------------------------------

describe('moveLeafToEdge', () => {
  it('MOVE-01 (EC-13) happy path: move L1 to right of L4 across disjoint subtrees', () => {
    // root horizontal [ vertical[L1,L2], vertical[L3,L4] ]
    const L1 = leaf('L1', { mediaId: 'm1', fit: 'contain', panX: 0.1 });
    const L2 = leaf('L2');
    const L3 = leaf('L3');
    const L4 = leaf('L4');
    const root = hcontainer('root', [
      vcontainer('v1', [L1, L2]),
      vcontainer('v2', [L3, L4]),
    ]);

    const result = moveLeafToEdge(root, 'L1', 'L4', 'right');

    // Source parent v1 had two children; now has 1 -> collapses.
    // root's first child should become L2 directly (leaf).
    expect(result.type).toBe('container');
    const r = result as ContainerNode;
    expect(r.children[0].id).toBe('L2');
    expect(r.children[0].type).toBe('leaf');

    // Second subtree v2: L4 was replaced with a horizontal container [L4, newLeaf(m1)].
    const v2 = r.children[1] as ContainerNode;
    expect(v2.id).toBe('v2');
    expect(v2.type).toBe('container');
    // v2's second child (was L4) is now a horizontal container
    const wrap = v2.children[1] as ContainerNode;
    expect(wrap.type).toBe('container');
    expect(wrap.direction).toBe('horizontal');
    expect(wrap.sizes).toEqual([1, 1]);
    // Edge right -> source is placed second
    expect((wrap.children[0] as LeafNode).id).toBe('L4');
    const inserted = wrap.children[1] as LeafNode;
    expect(inserted.type).toBe('leaf');
    expect(inserted.mediaId).toBe('m1');
    expect(inserted.fit).toBe('contain');
    expect(inserted.panX).toBe(0.1);
  });

  it('MOVE-02 (EC-01): 3-child source container — no collapse, sizes filtered by index', () => {
    // root horizontal [ vertical[L1,L2,L3] sizes [0.2,0.3,0.5], L4 ]
    const root = hcontainer('root', [
      vcontainer('v1', [leaf('L1'), leaf('L2'), leaf('L3')], [0.2, 0.3, 0.5]),
      leaf('L4'),
    ]);

    const result = moveLeafToEdge(root, 'L2', 'L4', 'right');

    const r = result as ContainerNode;
    const v1 = r.children[0] as ContainerNode;
    expect(v1.type).toBe('container');
    expect(v1.children.map(c => c.id)).toEqual(['L1', 'L3']);
    // sizes filtered by removed index (1), not renormalized
    expect(v1.sizes).toEqual([0.2, 0.5]);
  });

  it('MOVE-03 (EC-02): 2-child source parent collapses, remaining child inherits parent slot weight', () => {
    // root horizontal sizes [0.3, 0.7]
    //   - v1 vertical [L1, L2] (at slot 0, weight 0.3)
    //   - L3 (at slot 1, weight 0.7)
    // Move L1 to right of L3. After: v1 left with 1 child L2 -> collapses.
    // root's children[0] becomes L2, sizes stays [0.3, 0.7] structure
    // but note: root's slot 1 is replaced with wrap container, so root.sizes remains [0.3, 0.7].
    const root = hcontainer(
      'root',
      [vcontainer('v1', [leaf('L1'), leaf('L2')]), leaf('L3')],
      [0.3, 0.7],
    );

    const result = moveLeafToEdge(root, 'L1', 'L3', 'right');

    const r = result as ContainerNode;
    // First child is now L2 directly (collapsed)
    expect(r.children[0].id).toBe('L2');
    expect(r.children[0].type).toBe('leaf');
    // grandparent (root) sizes array length is unchanged; value at parent's old slot preserved
    expect(r.sizes).toEqual([0.3, 0.7]);
  });

  it('MOVE-04 (EC-03): source parent IS root with exactly 2 children — root becomes remaining child', () => {
    // root horizontal [L1, L2]. Target is inside... no, target must be separate leaf.
    // Use: root horizontal [L1, vertical[L2, L3]]. Move L1 to right of L3.
    // After: root's first child L1 removed -> root has 1 child -> root becomes vertical[L2, L3-wrapped]
    const root = hcontainer('root', [
      leaf('L1', { mediaId: 'src' }),
      vcontainer('v1', [leaf('L2'), leaf('L3')]),
    ]);

    const result = moveLeafToEdge(root, 'L1', 'L3', 'right');

    // Root was replaced by its remaining child (v1, now with L3 wrapped)
    expect(result.type).toBe('container');
    const r = result as ContainerNode;
    expect(r.id).toBe('v1');
    expect(r.direction).toBe('vertical');
    // v1's children: [L2, wrap([L3, newLeaf])]
    expect(r.children[0].id).toBe('L2');
    const wrap = r.children[1] as ContainerNode;
    expect(wrap.type).toBe('container');
    expect(wrap.direction).toBe('horizontal');
    expect((wrap.children[0] as LeafNode).id).toBe('L3');
    expect((wrap.children[1] as LeafNode).mediaId).toBe('src');
  });

  it('MOVE-05 (EC-04): source and target share 2-child parent, edge requires direction change', () => {
    // root vertical [ horizontal[L1, L2] ]  (parent h, siblings L1 & L2)
    // Move L1 to 'top' of L2. Pass1 wraps L2 in vertical container inside h-parent.
    // Pass2 removes L1 -> h-parent has 1 child (the wrap) -> collapses.
    // Result: root vertical -> child becomes the wrap directly.
    const root = vcontainer('root', [
      hcontainer('h1', [leaf('L1', { mediaId: 'src' }), leaf('L2')]),
    ]);
    // root is actually a 1-child vertical container (contrived) — use a 2-child root so
    // the collapse behavior plays out properly.
    const root2 = vcontainer('root', [
      hcontainer('h1', [leaf('L1', { mediaId: 'src' }), leaf('L2')]),
      leaf('L3'),
    ]);

    const result = moveLeafToEdge(root2, 'L1', 'L2', 'top');

    // Verify: no errors, result is a container, L1 gone, L2 wrapped vertically above newLeaf
    const r = result as ContainerNode;
    expect(r.type).toBe('container');
    // First child should be the wrap (h1 collapsed). Or it could still have h1 if container semantics differ.
    // Per removeNode semantics: h1 went from 2 children -> 1 child (the wrap) -> collapses.
    // So root.children[0] is now the wrap container (vertical with [newLeaf, L2]).
    const first = r.children[0] as ContainerNode;
    expect(first.type).toBe('container');
    expect(first.direction).toBe('vertical');
    // 'top' means source first
    const insertedLeaf = first.children[0] as LeafNode;
    expect(insertedLeaf.type).toBe('leaf');
    expect(insertedLeaf.mediaId).toBe('src');
    expect((first.children[1] as LeafNode).id).toBe('L2');
    // L1 is fully gone
    expect(findNode(result, 'L1')).toBeNull();
  });

  it('MOVE-06 (EC-05) no-op: fromId === toId — returns exact same root reference', () => {
    const root = hcontainer('root', [leaf('L1'), leaf('L2')]);
    const result = moveLeafToEdge(root, 'L1', 'L1', 'right');
    expect(result).toBe(root);
  });

  it('MOVE-07 no-op: fromId not found — returns root unchanged', () => {
    const root = hcontainer('root', [leaf('L1'), leaf('L2')]);
    const result = moveLeafToEdge(root, 'NOPE', 'L2', 'right');
    expect(result).toBe(root);
  });

  it('MOVE-08 no-op: toId not found — returns root unchanged', () => {
    const root = hcontainer('root', [leaf('L1'), leaf('L2')]);
    const result = moveLeafToEdge(root, 'L1', 'NOPE', 'right');
    expect(result).toBe(root);
  });

  it('MOVE-09 no-op: fromId is a container, not a leaf', () => {
    const root = hcontainer('root', [
      vcontainer('v1', [leaf('L1'), leaf('L2')]),
      leaf('L3'),
    ]);
    const result = moveLeafToEdge(root, 'v1', 'L3', 'right');
    expect(result).toBe(root);
  });

  it('MOVE-10 no-op: toId is a container, not a leaf', () => {
    const root = hcontainer('root', [
      vcontainer('v1', [leaf('L1'), leaf('L2')]),
      leaf('L3'),
    ]);
    const result = moveLeafToEdge(root, 'L3', 'v1', 'right');
    expect(result).toBe(root);
  });

  it("MOVE-11 (EC-17) edge 'top': source placed at children[0], direction vertical", () => {
    const root = hcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'top');

    const r = result as ContainerNode;
    // After: L1 removed (3 children -> 2), L2 wrapped into vertical container.
    // Find the wrap — it replaces L2 in root's children.
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap).toBeDefined();
    expect(wrap.direction).toBe('vertical');
    expect(wrap.children).toHaveLength(2);
    // 'top' -> source first
    expect((wrap.children[0] as LeafNode).mediaId).toBe('src');
    expect((wrap.children[1] as LeafNode).id).toBe('L2');
  });

  it("MOVE-12 (EC-17) edge 'left': source placed at children[0], direction horizontal", () => {
    const root = vcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'left');

    const r = result as ContainerNode;
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap).toBeDefined();
    expect(wrap.direction).toBe('horizontal');
    expect((wrap.children[0] as LeafNode).mediaId).toBe('src');
    expect((wrap.children[1] as LeafNode).id).toBe('L2');
  });

  it("MOVE-13 (EC-17) edge 'bottom': source placed at children[1], direction vertical", () => {
    const root = hcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'bottom');

    const r = result as ContainerNode;
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap).toBeDefined();
    expect(wrap.direction).toBe('vertical');
    expect((wrap.children[0] as LeafNode).id).toBe('L2');
    expect((wrap.children[1] as LeafNode).mediaId).toBe('src');
  });

  it("MOVE-14 (EC-17) edge 'right': source placed at children[1], direction horizontal", () => {
    const root = vcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'right');

    const r = result as ContainerNode;
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap).toBeDefined();
    expect(wrap.direction).toBe('horizontal');
    expect((wrap.children[0] as LeafNode).id).toBe('L2');
    expect((wrap.children[1] as LeafNode).mediaId).toBe('src');
  });

  it('MOVE-15 content copy: all 7 content fields (including objectPosition) are copied', () => {
    const source = leaf('L1', {
      mediaId: 'm1',
      fit: 'contain',
      backgroundColor: '#ff0000',
      panX: 0.25,
      panY: 0.5,
      panScale: 1.5,
      objectPosition: '50% 25%',
    });
    const root = hcontainer('root', [source, leaf('L2'), leaf('L3')]);

    const result = moveLeafToEdge(root, 'L1', 'L2', 'right');
    const r = result as ContainerNode;
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    const inserted = wrap.children[1] as LeafNode;

    expect(inserted.type).toBe('leaf');
    expect(inserted.mediaId).toBe('m1');
    expect(inserted.fit).toBe('contain');
    expect(inserted.backgroundColor).toBe('#ff0000');
    expect(inserted.panX).toBe(0.25);
    expect(inserted.panY).toBe(0.5);
    expect(inserted.panScale).toBe(1.5);
    expect(inserted.objectPosition).toBe('50% 25%');
  });

  it('MOVE-16 fresh ids (D-06): new leaf id !== fromId and new container id !== toId', () => {
    const root = hcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'right');

    const r = result as ContainerNode;
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap.id).toBeTruthy();
    expect(wrap.id).not.toBe('L2');
    const inserted = wrap.children[1] as LeafNode;
    expect(inserted.id).toBeTruthy();
    expect(inserted.id).not.toBe('L1');
  });

  it('MOVE-17 (EC-08) sizes: filtered raw (not renormalized), new container sizes [1,1], all >= MIN_CELL_WEIGHT', () => {
    // Source parent: 3 children, sizes [0.2, 0.3, 0.5]; remove middle (index 1) -> [0.2, 0.5]
    const root = hcontainer('root', [
      vcontainer('v1', [leaf('L1'), leaf('L2'), leaf('L3')], [0.2, 0.3, 0.5]),
      leaf('L4'),
    ]);

    const result = moveLeafToEdge(root, 'L2', 'L4', 'right');
    const r = result as ContainerNode;

    const v1 = r.children[0] as ContainerNode;
    expect(v1.type).toBe('container');
    expect(v1.sizes).toEqual([0.2, 0.5]);
    // Every size >= MIN_CELL_WEIGHT (0.1)
    for (const s of v1.sizes) expect(s).toBeGreaterThanOrEqual(0.1);

    // Wrap container sizes are exactly [1, 1]
    const wrap = r.children[1] as ContainerNode;
    expect(wrap.type).toBe('container');
    expect(wrap.sizes).toEqual([1, 1]);
  });

  it('MOVE-18 (EC-16) nested same-direction containers: horizontal-in-horizontal allowed', () => {
    // root horizontal [L1, L2, L3]. Move L1 to right of L2. New wrap is horizontal — nested
    // inside the horizontal root. Valid (suboptimal but correct).
    const root = hcontainer('root', [leaf('L1', { mediaId: 'src' }), leaf('L2'), leaf('L3')]);
    const result = moveLeafToEdge(root, 'L1', 'L2', 'right');

    const r = result as ContainerNode;
    expect(r.direction).toBe('horizontal');
    // L1 removed from root's direct children
    expect(r.children.find(c => c.id === 'L1')).toBeUndefined();
    // Wrap exists, is horizontal, nested inside horizontal root
    const wrap = r.children.find(c => c.type === 'container') as ContainerNode;
    expect(wrap).toBeDefined();
    expect(wrap.direction).toBe('horizontal');
    expect((wrap.children[0] as LeafNode).id).toBe('L2');
    expect((wrap.children[1] as LeafNode).mediaId).toBe('src');
  });
});
