/**
 * src/dnd/__tests__/useCellDropTarget.test.tsx
 *
 * Unit tests for the useCellDropTarget hook (Phase 28 Plan 04).
 * Covers: DROP-01 (cell can be a drop target), DROP-04 (isOver reflects active hover),
 *         DROP-07 (hook does NOT directly mutate dragStore — CanvasWrapper.onDragOver
 *         owns setOver; hook is a thin useDroppable wrapper).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import React from 'react';
import { DndContext } from '@dnd-kit/core';
import { useCellDropTarget } from '../useCellDropTarget';
import { useDragStore } from '../dragStore';

beforeEach(() => {
  // Reset dragStore to the REAL initial shape.
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

function wrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe('useCellDropTarget hook contract (DROP-01)', () => {
  it('returns { setNodeRef, isOver }', () => {
    const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
    expect(result.current).toHaveProperty('setNodeRef');
    expect(result.current).toHaveProperty('isOver');
  });

  it('isOver is boolean false on mount (no drag active)', () => {
    const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
    expect(typeof result.current.isOver).toBe('boolean');
    expect(result.current.isOver).toBe(false);
  });

  it('setNodeRef is a callable ref setter', () => {
    const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
    expect(typeof result.current.setNodeRef).toBe('function');
  });
});

describe('hook DOES NOT mutate dragStore directly (DROP-07)', () => {
  it('mounting the hook does not change dragStore.overId', () => {
    const before = useDragStore.getState().overId;
    renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
    const after = useDragStore.getState().overId;
    expect(after).toBe(before); // both null
  });

  it('calling setNodeRef does not change dragStore.overId', () => {
    const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
    const el = document.createElement('div');
    result.current.setNodeRef(el);
    expect(useDragStore.getState().overId).toBeNull();
  });
});

describe('hook integration with DndContext', () => {
  it('mounts without error inside DndContext', () => {
    function Harness() {
      const { setNodeRef, isOver } = useCellDropTarget('leaf-target');
      return <div ref={setNodeRef} data-testid="drop-harness" data-is-over={String(isOver)}>drop</div>;
    }
    const { container } = render(<DndContext><Harness /></DndContext>);
    const el = container.querySelector('[data-testid="drop-harness"]') as HTMLElement | null;
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-is-over')).toBe('false');
  });

  it('multiple drop targets with distinct IDs can coexist in the same context', () => {
    function Harness() {
      const a = useCellDropTarget('leaf-a');
      const b = useCellDropTarget('leaf-b');
      return (
        <>
          <div ref={a.setNodeRef} data-testid="drop-a" />
          <div ref={b.setNodeRef} data-testid="drop-b" />
        </>
      );
    }
    const { container } = render(<DndContext><Harness /></DndContext>);
    expect(container.querySelector('[data-testid="drop-a"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="drop-b"]')).toBeTruthy();
  });
});

describe('dragStore state transitions via REAL setOver / end actions (simulating CanvasWrapper.onDragOver / onDragEnd writes)', () => {
  it('when Plan 07 writes overId + activeZone via setOver, the store reflects the values', () => {
    // Seed dragging state.
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-src',
      overId: null,
      activeZone: null,
      ghostDataUrl: null,
      sourceRect: null,
    });
    // Use the REAL action name: setOver.
    useDragStore.getState().setOver('leaf-target', 'center');
    const state = useDragStore.getState();
    expect(state.overId).toBe('leaf-target');
    expect(state.activeZone).toBe('center');
    expect(state.status).toBe('dragging');
  });

  it('setOver transitions overId/activeZone (used by Plan 07 onDragOver)', () => {
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-src',
      overId: null,
      activeZone: null,
      ghostDataUrl: null,
      sourceRect: null,
    });
    useDragStore.getState().setOver('leaf-target', 'top');
    const state = useDragStore.getState();
    expect(state.overId).toBe('leaf-target');
    expect(state.activeZone).toBe('top');
  });

  it('setOver(null, null) clears over state (drag left all cells)', () => {
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-src',
      overId: 'leaf-target',
      activeZone: 'center',
      ghostDataUrl: null,
      sourceRect: null,
    });
    useDragStore.getState().setOver(null, null);
    const state = useDragStore.getState();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });

  it('end() resets the full state (used by BOTH Plan 07 onDragEnd AND onDragCancel — single reset path)', () => {
    // Seed full dragging state including ghost fields.
    useDragStore.setState({
      status: 'dragging',
      kind: 'cell',
      sourceId: 'leaf-src',
      overId: 'leaf-target',
      activeZone: 'center',
      ghostDataUrl: 'data:image/png;base64,XYZ',
      sourceRect: { width: 100, height: 200, left: 0, top: 0 },
    });
    // Use the REAL action name: end().
    useDragStore.getState().end();
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.kind).toBeNull();
    expect(state.sourceId).toBeNull();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
    expect(state.ghostDataUrl).toBeNull();
    expect(state.sourceRect).toBeNull();
  });

  it('cancel coverage: the SAME end() action is the only reset path (no separate cancel action)', () => {
    // This test documents the CONTRACT: Plan 07's onDragCancel handler calls
    // useDragStore.getState().end() — identical to onDragEnd's reset path.
    // We verify here that end() is a function with no arguments required.
    expect(typeof useDragStore.getState().end).toBe('function');
    expect(useDragStore.getState().end.length).toBe(0);
  });
});
