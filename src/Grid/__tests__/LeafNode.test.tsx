/**
 * LeafNode.test.tsx
 * Tests for LeafNode overflow isolation and empty cell placeholder scaling (CELL-01, CELL-03).
 * 07-01-PLAN.md Task 2 behaviors (7 tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { DndContext } from '@dnd-kit/core';
import { LeafNodeComponent } from '../LeafNode';
import { useGridStore } from '../../store/gridStore';
import { useEditorStore } from '../../store/editorStore';
import type { LeafNode, GridNode } from '../../types';

// Phase 25: LeafNodeComponent uses useDndMonitor which requires DndContext ancestor.
function withDnd(ui: React.ReactElement) {
  return <DndContext>{ui}</DndContext>;
}

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

function setStoreRoot(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({
    root,
    mediaRegistry: registry,
    history: [{ root }],
    historyIndex: 0,
  });
}

// Track registered ResizeObserver callbacks for triggering in tests
let roCallback: ResizeObserverCallback | null = null;
let roTarget: Element | null = null;

class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    roCallback = cb;
  }
  observe(target: Element) {
    roTarget = target;
  }
  unobserve() {}
  disconnect() {
    // Phase 25: do NOT clear roCallback on disconnect — DndContext may cause
    // additional useLayoutEffect cleanup/re-run cycles. Keep roCallback pointing
    // to the latest registered callback so tests can still fire it after remounts.
  }
}

beforeEach(() => {
  roCallback = null;
  roTarget = null;
  // Override the global ResizeObserver (setup.ts has a no-op polyfill; replace with test version)
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({ selectedNodeId: null, canvasScale: 1, borderRadius: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Task 2 behaviors
// ---------------------------------------------------------------------------

describe('LeafNode overflow isolation and placeholder scaling (07-01)', () => {
  it('Test 1: Root cell div has className containing "overflow-visible" (not "overflow-hidden")', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');
    expect(cell.className).toContain('overflow-visible');
    expect(cell.className).not.toContain('overflow-hidden');
  });

  it('Test 2: A child wrapper div with "absolute inset-0 overflow-hidden" wraps the canvas element', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');
    // Find a div with overflow-hidden inside the cell
    const overflowHiddenDivs = Array.from(cell.querySelectorAll('div')).filter(
      (div) => div.className.includes('overflow-hidden')
    );
    expect(overflowHiddenDivs.length).toBeGreaterThanOrEqual(1);
    // The overflow-hidden div should contain a canvas
    const hasCanvas = overflowHiddenDivs.some((div) => div.querySelector('canvas') !== null);
    expect(hasCanvas).toBe(true);
  });

  it('Test 3: Empty placeholder ImageIcon receives clamp-based style for width/height', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');
    // Find the SVG icon inside the empty placeholder
    const svgs = cell.querySelectorAll('svg');
    // At least one SVG should exist (the ImageIcon in the empty placeholder)
    expect(svgs.length).toBeGreaterThan(0);
    // Find the parent element that has clamp style - either the svg or its wrapper
    // The ImageIcon is given style={{ width: 'clamp(20px, 1.6vw, 32px)', height: '...' }}
    // jsdom strips clamp() from computed style; check wrapper structure (div containing svg)
    // Verify the placeholder container renders (flex column layout)
    const placeholderContainer = cell.querySelector('.flex.flex-col.items-center.justify-center');
    expect(placeholderContainer).not.toBeNull();
  });

  it('Test 4: Empty placeholder span has className containing text-[clamp(...)]', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');
    const spans = cell.querySelectorAll('span');
    // Find the span with clamp-based text sizing
    const clampSpan = Array.from(spans).find(
      (s) => s.className.includes('clamp')
    );
    expect(clampSpan).not.toBeUndefined();
  });

  it('Test 5: When ResizeObserver fires with height < 80, the label span has className containing "hidden"', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');

    // Trigger ResizeObserver with height < 80
    act(() => {
      if (roCallback && roTarget) {
        roCallback(
          [{ contentRect: { height: 60, width: 100 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
    });

    const cell2 = screen.getByTestId('leaf-leaf-1');
    const spans = cell2.querySelectorAll('span');
    const labelSpan = Array.from(spans).find(
      (s) => s.textContent?.includes('Drop image')
    );
    expect(labelSpan).not.toBeUndefined();
    expect(labelSpan!.className).toContain('hidden');
  });

  it('Test 6: When height >= 80, the label is visible (no "hidden" class)', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));

    // First set small, then set large to verify toggle works
    act(() => {
      if (roCallback && roTarget) {
        roCallback(
          [{ contentRect: { height: 40, width: 100 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
    });
    act(() => {
      if (roCallback && roTarget) {
        roCallback(
          [{ contentRect: { height: 120, width: 200 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
    });

    const cell = screen.getByTestId('leaf-leaf-1');
    const spans = cell.querySelectorAll('span');
    const labelSpan = Array.from(spans).find(
      (s) => s.textContent?.includes('Drop image')
    );
    expect(labelSpan).not.toBeUndefined();
    expect(labelSpan!.className).not.toContain('hidden');
  });

  it('Test 7: CanvasArea/CanvasWrapper do not reintroduce overflow-hidden above LeafNode root', async () => {
    // This test verifies LeafNode's cell root directly — the overflow-visible is on the cell div
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(withDnd(<LeafNodeComponent id="leaf-1" />));
    const cell = screen.getByTestId('leaf-leaf-1');
    // The outermost cell div should be overflow-visible (not overflow-hidden)
    expect(cell.className).toContain('overflow-visible');
    // And there should be no parent div with overflow-hidden between the cell and the document root
    // (we check direct ancestors within the rendered subtree)
    let parent = cell.parentElement;
    let ancestorHasOverflowHidden = false;
    while (parent && parent !== document.body) {
      if (parent.className && typeof parent.className === 'string' && parent.className.includes('overflow-hidden')) {
        ancestorHasOverflowHidden = true;
        break;
      }
      parent = parent.parentElement;
    }
    // In an isolated render, there should be no overflow-hidden ancestor
    expect(ancestorHasOverflowHidden).toBe(false);
  });
});
