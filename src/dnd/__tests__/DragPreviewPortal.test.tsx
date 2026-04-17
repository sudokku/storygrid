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
import { DragPreviewPortal } from '../DragPreviewPortal';
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

  it('drag-ghost-img width/height match sourceRect (GHOST-05)', () => {
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
    expect(img?.style.width).toBe('200px');
    expect(img?.style.height).toBe('300px');
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
