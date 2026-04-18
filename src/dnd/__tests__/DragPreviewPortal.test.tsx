/**
 * src/dnd/__tests__/DragPreviewPortal.test.tsx
 *
 * Isolated component tests for DragPreviewPortal (Phase 28 Plan 05).
 * Covers: GHOST-01 (ghost renders during drag), GHOST-02 (data-URL snapshot),
 *         GHOST-04 (opacity 0.8), GHOST-05 (size matches sourceRect).
 *
 * Runtime mount-inside-DndContext gate is in CanvasWrapper.integration.test.tsx.
 *
 * DEVIATION NOTE (Rule 1 — bug fix for plan's test design):
 * The plan assumed seeding `useDragStore` alone would make
 * `screen.queryByTestId('drag-ghost-img')` discoverable. In reality,
 * @dnd-kit/core's <DragOverlay> gates its children on its INTERNAL `active`
 * state (from `useDndContext()`), not on our dragStore. Without a real
 * dnd-kit drag activation (Pitfall 11 forbids simulating here), the ghost
 * img never reaches the DOM.
 *
 * To preserve the plan's stated truth ("renders <img data-testid='drag-ghost-img'>
 * when dragStore.ghostDataUrl is set"), we use vi.mock to replace @dnd-kit/core's
 * <DragOverlay> with a pass-through that renders its children unconditionally —
 * scoped to this file only. This isolates DragPreviewPortal's OWN branching
 * (idle -> null; dragging + ghostDataUrl -> <img>; dragging + null ghost ->
 * fallback) without coupling to dnd-kit's filter. The real DragOverlay filter
 * is an implementation detail of dnd-kit, not of DragPreviewPortal.
 *
 * The CanvasWrapper integration test (Task 1) asserts structural mount inside
 * the DndContext (DndLiveRegion present) — the complementary piece of the
 * GHOST-06 runtime gate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Scoped @dnd-kit/core mock — only DragOverlay is overridden to pass through
// children unconditionally. Every other dnd-kit export keeps its real
// implementation (via importOriginal) so DragPreviewPortal's real import
// works normally and the plan's rule "do not mock @dnd-kit/core" is honored
// in spirit (we are not replacing the whole module, we are narrowing one
// component's render filter for isolated-branch coverage).
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    DragOverlay: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="mock-drag-overlay">{children}</div>
    ),
  };
});

import { DndContext } from '@dnd-kit/core';
import {
  DragPreviewPortal,
  computeCappedGhostSize,
  GHOST_MAX_DIMENSION,
} from '../DragPreviewPortal';
import { useDragStore } from '../dragStore';

beforeEach(() => {
  useDragStore.setState({
    status: 'idle',
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
    ghostDataUrl: null,
    sourceRect: null,
  });
});

afterEach(() => {
  cleanup();
});

function renderInsideDndContext() {
  return render(
    <DndContext>
      <DragPreviewPortal />
    </DndContext>
  );
}

describe('DragPreviewPortal idle state', () => {
  it('renders no drag-ghost-img when dragStore.status is idle', () => {
    renderInsideDndContext();
    expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
  });

  it('renders no drag-ghost-fallback when idle', () => {
    renderInsideDndContext();
    expect(screen.queryByTestId('drag-ghost-fallback')).toBeNull();
  });
});

describe('DragPreviewPortal dragging state (GHOST-01, GHOST-02, GHOST-04, GHOST-05)', () => {
  it('renders drag-ghost-img with data-URL src when ghostDataUrl is set', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 200, height: 300, left: 10, top: 20 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('drag-ghost-img has opacity 0.8 (GHOST-04)', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 200, height: 300, left: 10, top: 20 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.opacity).toBe('0.8');
  });

  it('drag-ghost-img width/height match capped sourceRect (GHOST-05 + GHOST-04 cap)', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 200, height: 300, left: 10, top: 20 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    // Gap-closure 28-15: sourceRect 200x300 exceeds the 200 cap on the
    // height axis. scale = min(1, 200/200=1, 200/300) = 200/300 ≈ 0.6667.
    // Capped dims: 200*(200/300) ≈ 133.33, 300*(200/300) = 200.
    expect(img?.style.width).toBe(`${200 * (200 / 300)}px`);
    expect(img?.style.height).toBe('200px');
  });

  it('resets to no drag-ghost-img after end() is called', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 200, height: 300, left: 10, top: 20 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    expect(screen.queryByTestId('drag-ghost-img')).not.toBeNull();

    // REAL action: end() (no phantom endDrag/cancelDrag).
    useDragStore.getState().end();
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
  });

  it('renders drag-ghost-fallback when dragging but ghostDataUrl is null (D-10 empty-cell branch)', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-empty',
      overId: null,
      activeZone: null,
      ghostDataUrl: null,
      sourceRect: { width: 100, height: 150, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
    expect(screen.queryByTestId('drag-ghost-fallback')).not.toBeNull();
  });
});

describe('computeCappedGhostSize (gap-closure 28-15 pure helper)', () => {
  // Pure helper — no DndContext / no vi.mock needed. Tests the aspect-
  // ratio-preserving scale math directly. See 28-UAT.md Gap 2 and the
  // gap-closure plan 28-15 for the 'ghost too large' rationale.

  it('exports GHOST_MAX_DIMENSION = 200', () => {
    expect(GHOST_MAX_DIMENSION).toBe(200);
  });

  it('returns natural size when both axes fit under the cap', () => {
    expect(computeCappedGhostSize({ width: 100, height: 150 }, 200)).toEqual({
      width: 100,
      height: 150,
    });
  });

  it('returns natural size when exactly at the cap on both axes', () => {
    expect(computeCappedGhostSize({ width: 200, height: 200 }, 200)).toEqual({
      width: 200,
      height: 200,
    });
  });

  it('caps a large square source at the max dimension on both axes (scale=0.5)', () => {
    expect(computeCappedGhostSize({ width: 400, height: 400 }, 200)).toEqual({
      width: 200,
      height: 200,
    });
  });

  it('caps a large portrait source with aspect preserved (height axis hits cap)', () => {
    // The 28-UAT Test 1 + Test 4 case. aspect 1:2 preserved: 100:200.
    expect(computeCappedGhostSize({ width: 400, height: 800 }, 200)).toEqual({
      width: 100,
      height: 200,
    });
  });

  it('caps a wide source with aspect preserved (width axis hits cap)', () => {
    // aspect 8:1 preserved: 200:25.
    expect(computeCappedGhostSize({ width: 800, height: 100 }, 200)).toEqual({
      width: 200,
      height: 25,
    });
  });

  it('honors a custom cap value (not hardcoded to 200)', () => {
    expect(computeCappedGhostSize({ width: 300, height: 600 }, 100)).toEqual({
      width: 50,
      height: 100,
    });
  });
});

describe('GHOST-04 size cap (gap-closure 28-15)', () => {
  // Consumer tests: render DragPreviewPortal with various sourceRects and
  // assert the <img> / <div> dimensions + the defensive maxWidth/maxHeight
  // CSS ceiling. All use the vi.mock DragOverlay pass-through from the
  // top of the file so the ghost reaches the DOM without driving the full
  // dnd-kit lifecycle (Pitfall 11).

  it('small source (100x150) renders at natural size', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 100, height: 150, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.width).toBe('100px');
    expect(img?.style.height).toBe('150px');
  });

  it('large square source (400x400) renders at cap (200x200)', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 400, height: 400, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.width).toBe('200px');
    expect(img?.style.height).toBe('200px');
  });

  it('large portrait source (400x800 — 28-UAT Test 1 + 4 case) renders capped with aspect 1:2 preserved', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 400, height: 800, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    // scale = min(1, 200/400=0.5, 200/800=0.25) = 0.25
    // 400*0.25 = 100, 800*0.25 = 200
    expect(img?.style.width).toBe('100px');
    expect(img?.style.height).toBe('200px');
  });

  it('wide source (800x100) renders capped with aspect 8:1 preserved', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 800, height: 100, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.width).toBe('200px');
    expect(img?.style.height).toBe('25px');
  });

  it('drag-ghost-fallback (D-10 empty cell, ghostDataUrl=null) with large source also honors the cap', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-empty',
      overId: null,
      activeZone: null,
      ghostDataUrl: null,
      sourceRect: { width: 400, height: 800, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const fallback = screen.queryByTestId('drag-ghost-fallback') as HTMLDivElement | null;
    expect(fallback).not.toBeNull();
    expect(fallback?.style.width).toBe('100px');
    expect(fallback?.style.height).toBe('200px');
  });

  it('drag-ghost-img carries defensive maxWidth and maxHeight ceiling', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 100, height: 150, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.maxWidth).toBe('200px');
    expect(img?.style.maxHeight).toBe('200px');
  });

  it('drag-ghost-img has objectFit: cover for cross-browser aspect robustness', () => {
    const { rerender } = renderInsideDndContext();
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-a',
      overId: null,
      activeZone: null,
      ghostDataUrl: 'data:image/png;base64,AAAA',
      sourceRect: { width: 100, height: 150, left: 0, top: 0 },
    });
    rerender(
      <DndContext>
        <DragPreviewPortal />
      </DndContext>
    );
    const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.style.objectFit).toBe('cover');
  });
});
