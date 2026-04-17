import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DndContext } from '@dnd-kit/core';
import { GridNodeComponent } from '../Grid/GridNode';
import { ContainerNodeComponent } from '../Grid/ContainerNode';
import { LeafNodeComponent } from '../Grid/LeafNode';
import { SafeZoneOverlay } from '../Grid/SafeZoneOverlay';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { createLeaf } from '../lib/tree';
import type { ContainerNode, LeafNode, GridNode } from '../types';

// Phase 28: LeafNodeComponent uses useCellDraggable / useCellDropTarget (from src/dnd),
// which require a DndContext ancestor at mount time.
function withDnd(ui: React.ReactElement) {
  return <DndContext>{ui}</DndContext>;
}

// ---------------------------------------------------------------------------
// Test tree builders
// ---------------------------------------------------------------------------

function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  return { type: 'leaf', id: 'leaf-1', mediaId: null, fit: 'cover', audioEnabled: true, ...overrides };
}

function makeContainer(direction: 'horizontal' | 'vertical' = 'horizontal', children?: GridNode[]): ContainerNode {
  const left = createLeaf();
  const right = createLeaf();
  const kids = children ?? [left, right];
  return {
    type: 'container',
    id: 'container-1',
    direction,
    sizes: kids.map(() => 1 / kids.length),
    children: kids,
  };
}

function setStoreRoot(root: GridNode) {
  useGridStore.setState({
    root,
    mediaRegistry: {},
    history: [{ root }],
    historyIndex: 0,
  });
}

beforeEach(() => {
  useEditorStore.setState({ selectedNodeId: null });
});

// ---------------------------------------------------------------------------
// REND-01: GridNode dispatcher
// ---------------------------------------------------------------------------

describe('GridNode dispatcher (REND-01)', () => {
  it('renders ContainerNode for container type nodes', () => {
    const tree = makeContainer();
    setStoreRoot(tree);
    render(withDnd(<GridNodeComponent id="container-1" />));
    expect(screen.getByTestId('container-container-1')).toBeTruthy();
  });

  it('renders LeafNode for leaf type nodes', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<GridNodeComponent id="leaf-1" />));
    expect(screen.getByTestId('leaf-leaf-1')).toBeTruthy();
  });

  it('is wrapped in React.memo', () => {
    expect((GridNodeComponent as { $$typeof?: symbol }).$$typeof?.toString()).toContain('react.memo');
  });
});

// ---------------------------------------------------------------------------
// REND-02: ContainerNode flex layout
// ---------------------------------------------------------------------------

describe('ContainerNode flex layout (REND-02)', () => {
  it('renders flex-row for horizontal direction', () => {
    const tree = makeContainer('horizontal');
    setStoreRoot(tree);
    render(withDnd(<ContainerNodeComponent id="container-1" />));
    const container = screen.getByTestId('container-container-1');
    expect(container.className).toContain('flex-row');
  });

  it('renders flex-col for vertical direction', () => {
    const tree = makeContainer('vertical');
    setStoreRoot(tree);
    render(withDnd(<ContainerNodeComponent id="container-1" />));
    const container = screen.getByTestId('container-container-1');
    expect(container.className).toContain('flex-col');
  });

  it('renders Divider between each pair of siblings', () => {
    const left = createLeaf();
    const middle = createLeaf();
    const right = createLeaf();
    const tree = makeContainer('horizontal', [left, middle, right]);
    setStoreRoot(tree);
    render(withDnd(<ContainerNodeComponent id="container-1" />));
    // 3 children → 2 dividers
    const dividers = screen.getAllByTestId(/^divider-container-1-/);
    expect(dividers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// REND-04: LeafNode empty state
// ---------------------------------------------------------------------------

describe('LeafNode empty state (REND-04)', () => {
  it('renders dashed border with upload prompt text', () => {
    const leaf = makeLeaf({ mediaId: null });
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    expect(leafEl.className).toContain('border-dashed');
    expect(leafEl.className).toContain('border-[#333333]');
  });

  it('shows "Drop image or use Upload button" text', () => {
    const leaf = makeLeaf({ mediaId: null });
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    expect(screen.getByText('Drop image or use Upload button')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// REND-05: LeafNode media state
// ---------------------------------------------------------------------------

describe('LeafNode media state (REND-05)', () => {
  it('renders canvas element when fit is cover and media is loaded', () => {
    const leaf = makeLeaf({ mediaId: 'test-id', fit: 'cover' });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'test-id': 'data:image/png;base64,abc' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    // Media is now rendered via <canvas>, not <img>
    const canvas = leafEl.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.style.display).not.toBe('none');
  });

  it('renders canvas element when fit is contain and media is loaded', () => {
    const leaf = makeLeaf({ mediaId: 'test-id', fit: 'contain' });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'test-id': 'data:image/png;base64,abc' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    // Media is now rendered via <canvas>, not <img>
    const canvas = leafEl.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.style.display).not.toBe('none');
  });
});

// ---------------------------------------------------------------------------
// REND-06: LeafNode selection
// ---------------------------------------------------------------------------

describe('LeafNode selection and action bar (REND-06)', () => {
  it('shows blue ring-2 border when selected', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    expect(leafEl.className).toContain('ring-2');
    expect(leafEl.className).toContain('ring-[#3b82f6]');
  });

  it('shows no selection border when not selected', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    useEditorStore.setState({ selectedNodeId: null });
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    expect(leafEl.className).not.toContain('ring-2');
  });
});

// ---------------------------------------------------------------------------
// REND-08: SafeZoneOverlay
// ---------------------------------------------------------------------------

describe('SafeZoneOverlay (REND-08)', () => {
  it('renders two dimmed striped regions at safe zone positions (Phase 08 CANVAS-01)', () => {
    render(<SafeZoneOverlay />);
    // Phase 08 replaced the dashed-border treatment with dimmed + diagonal-striped regions
    // keyed by data-testid — see src/test/phase08-p01-safe-zone.test.tsx for the full suite.
    expect(screen.getByTestId('safe-zone-top')).toBeTruthy();
    expect(screen.getByTestId('safe-zone-bottom')).toBeTruthy();
  });

  it('has pointer-events: none so clicks pass through', () => {
    render(<SafeZoneOverlay />);
    const overlay = screen.getByTestId('safe-zone-overlay');
    expect(overlay.className).toContain('pointer-events-none');
  });
});

// ---------------------------------------------------------------------------
// REND-09: Per-node memo wrapping
// ---------------------------------------------------------------------------

describe('Per-node memo and selectors (REND-09)', () => {
  it('GridNodeComponent is React.memo wrapped', () => {
    const type = (GridNodeComponent as { $$typeof?: symbol }).$$typeof;
    expect(type?.toString()).toContain('react.memo');
  });

  it('ContainerNodeComponent is React.memo wrapped', () => {
    const type = (ContainerNodeComponent as { $$typeof?: symbol }).$$typeof;
    expect(type?.toString()).toContain('react.memo');
  });

  it('LeafNodeComponent is React.memo wrapped', () => {
    const type = (LeafNodeComponent as { $$typeof?: symbol }).$$typeof;
    expect(type?.toString()).toContain('react.memo');
  });
});

// ---------------------------------------------------------------------------
// CELL-01 (Phase 10, v1.1 audit): supersedes REND-10
//
// The prior REND-10 test asserted that LeafNode had Tailwind `isolate` on
// the root to create a per-cell stacking context. The Phase 10 audit showed
// this traps the z-50 ActionBar wrapper inside the cell and clips it at
// sibling boundaries at small cell sizes. CELL-01 removes `isolate` so the
// ActionBar can escape per-cell stacking. This test asserts the CELL-01
// invariant: LeafNode root must NOT include `isolate`.
// ---------------------------------------------------------------------------

describe('ActionBar stacking context (CELL-01)', () => {
  it('LeafNode root does NOT include Tailwind `isolate` class', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const leafEl = screen.getByTestId('leaf-leaf-1');
    // Match whole-word `isolate` only (avoid false positives from e.g. `isolated`)
    expect(leafEl.className).not.toMatch(/\bisolate\b/);
  });
});
