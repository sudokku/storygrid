/**
 * phase05-p02-cell-swap.test.ts
 * Tests for cell swap via @dnd-kit drag handle (D-13 through D-16 — POLH-07)
 *
 * Coverage:
 * - swapCells store action swaps media content between two leaves
 * - swapCells pushes to undo history (historyIndex increments)
 * - ActionBar renders GripVertical drag handle when hasMedia=true
 * - ActionBar renders drag handle even when hasMedia=false (EC-06: gate relaxed in Phase 9)
 * - DndContext onDragEnd calls swapCells for different nodes
 * - DndContext onDragEnd does nothing when dropped on same cell
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ActionBar } from '../Grid/ActionBar';
import { useGridStore } from '../store/gridStore';
import { createLeaf } from '../lib/tree';
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

// ---------------------------------------------------------------------------
// POLH-07-B: ActionBar drag handle button
// ---------------------------------------------------------------------------

describe('ActionBar drag handle (D-13, D-14)', () => {
  it.skip('renders drag handle button when hasMedia=true', () => {
    // Skipped in Phase 28: ActionBar drag handle button (drag-handle-leaf-1) was removed.
    // Drag initiation in Phase 28 is via useCellDraggable on the LeafNode root div.
    // The aria-label 'Drag to move' moved to the root div of LeafNode.
  });

  it.skip('renders drag handle on empty cells (EC-06: gate relaxed in Phase 9)', () => {
    // Skipped in Phase 28: ActionBar drag handle button removed.
    // Phase 28 drag is initiated from LeafNode root div via PointerSensor (8px distance threshold).
  });

  it.skip('drag handle button has aria-label "Drag to move"', () => {
    // Skipped in Phase 28: ActionBar drag handle button removed.
    // aria-label 'Drag to move' now lives on the LeafNode root div (role="gridcell").
  });
});
