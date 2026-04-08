/**
 * ActionBar.test.tsx
 * Tests for ActionBar clamp-based sizing (CELL-02) per 07-01-PLAN.md.
 * Coverage: D-04, D-05, D-06.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ActionBar } from '../ActionBar';
import { useGridStore } from '../../store/gridStore';
import type { GridNode, LeafNode } from '../../types';

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
    ...overrides,
  };
}

function setStoreRoot(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({
    root,
    mediaRegistry: registry,
    history: [{ root }],
    historyIndex: 0,
  });
}

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// ActionBar clamp-based sizing tests (CELL-02, D-04, D-05, D-06)
// ---------------------------------------------------------------------------

describe('ActionBar clamp-based sizing (07-01)', () => {
  it('Test 1: ActionBar root container renders with flex and gap classes preserved', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
    const bar = screen.getByTestId('action-bar-leaf-1');
    expect(bar).toBeInTheDocument();
    expect(bar.className).toContain('flex');
    expect(bar.className).toContain('gap-1');
  });

  it('Test 2: Buttons use fixed w-8 h-8 sizing (portal-aware, viewport-space)', () => {
    // ActionBar renders via createPortal to document.body in viewport space (per quick-260407-q2s).
    // It does not get scaled by the canvas transform, so it uses fixed 32px button sizing
    // with 16px lucide icons. Yesterday's portal architecture means clamp/scale compensation
    // is unnecessary — re-introducing it (Phase 10-01) made buttons unusably small at typical
    // viewports and was reverted.
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.className).toContain('w-8');
      expect(btn.className).toContain('h-8');
    }
    // Also verify the bar itself still renders (structural integrity)
    expect(screen.getByTestId('action-bar-leaf-1')).toBeInTheDocument();
  });

  it('Test 3: Each lucide icon receives a numeric size prop (not undefined)', () => {
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    // lucide icons render as SVG elements; verify they are present in the DOM
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // Each SVG should have width and height attributes (set by lucide from size prop)
    for (const svg of Array.from(svgs)) {
      expect(svg.getAttribute('width')).not.toBeNull();
      expect(svg.getAttribute('height')).not.toBeNull();
    }
  });

  it('Test 4: All 7 buttons render with correct aria-labels (drag, upload, split-h, split-v, fit-toggle, clear-media, remove)', () => {
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Drag to move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split horizontal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split vertical' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to contain/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear media' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove cell' })).toBeInTheDocument();
  });
});
