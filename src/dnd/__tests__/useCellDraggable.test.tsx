/**
 * src/dnd/__tests__/useCellDraggable.test.tsx
 *
 * Unit tests for the useCellDraggable hook (Phase 28 Plan 03).
 * Covers: DRAG-01 (any cell draggable), DRAG-07 (entire cell is handle),
 *         GHOST-01 (hook returns listeners for the leaf element to spread).
 *
 * Sensor config assertions (D-31) cover DRAG-03 (mouse distance:8),
 * DRAG-04 (touch delay:250, tolerance:5), CROSS-01 (mouse/touch parity).
 *
 * Note per Pitfall 11: we do NOT simulate pointermove sequences with fake timers.
 * The REAL contract is (a) the hook's return shape, (b) the sensor classes' existence
 * and distinctness. Activation timing is verified at the source-code level (grep on
 * CanvasWrapper.tsx asserts `activationConstraint: { distance: 8 }` etc. — see Plan 07).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import React from 'react';
import { DndContext } from '@dnd-kit/core';
import { useCellDraggable } from '../useCellDraggable';
import { CellDragMouseSensor, CellDragTouchSensor } from '../adapter/dndkit';
import { useDragStore } from '../dragStore';

beforeEach(() => {
  // Reset dragStore to the REAL initial shape (all fields, including kind).
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

describe('useCellDraggable hook contract (DRAG-01, DRAG-07)', () => {
  it('returns { attributes, listeners, isDragging, setNodeRef }', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
    expect(result.current).toHaveProperty('attributes');
    expect(result.current).toHaveProperty('listeners');
    expect(result.current).toHaveProperty('isDragging');
    expect(result.current).toHaveProperty('setNodeRef');
  });

  it('listeners is always a spreadable object (never undefined)', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
    expect(result.current.listeners).toBeTypeOf('object');
    expect(result.current.listeners).not.toBeNull();
  });

  it('isDragging is false on mount (no drag started)', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
    expect(result.current.isDragging).toBe(false);
  });

  it('setNodeRef is a callable ref setter', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
    expect(typeof result.current.setNodeRef).toBe('function');
  });
});

describe('CellDragMouseSensor config (DRAG-03)', () => {
  it('is a class (constructable sensor)', () => {
    expect(typeof CellDragMouseSensor).toBe('function');
  });

  it('exposes activators array with at least one entry', () => {
    const activators = (CellDragMouseSensor as unknown as { activators: unknown[] }).activators;
    expect(Array.isArray(activators)).toBe(true);
    expect(activators.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CellDragTouchSensor config (DRAG-04)', () => {
  it('is a class (constructable sensor)', () => {
    expect(typeof CellDragTouchSensor).toBe('function');
  });

  it('exposes activators array with at least one entry', () => {
    const activators = (CellDragTouchSensor as unknown as { activators: unknown[] }).activators;
    expect(Array.isArray(activators)).toBe(true);
    expect(activators.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Mouse + Touch sensor parity (CROSS-01)', () => {
  it('both sensors are distinct classes (two activation paths, same downstream store)', () => {
    expect(CellDragMouseSensor).not.toBe(CellDragTouchSensor);
  });
});

describe('hook integration with DndContext', () => {
  it('mounts without error inside DndContext', () => {
    function Harness() {
      const { setNodeRef, listeners, attributes } = useCellDraggable('leaf-1');
      return (
        <div ref={setNodeRef} {...attributes} {...listeners} data-testid="harness">
          drag me
        </div>
      );
    }
    const { container } = render(<DndContext><Harness /></DndContext>);
    expect(container.querySelector('[data-testid="harness"]')).toBeTruthy();
  });

  it('does not throw when id is empty string (dnd-kit treats any string as a valid id)', () => {
    function Harness() {
      const { setNodeRef } = useCellDraggable('');
      return <div ref={setNodeRef} data-testid="empty-id-harness">empty</div>;
    }
    const { container } = render(<DndContext><Harness /></DndContext>);
    expect(container.querySelector('[data-testid="empty-id-harness"]')).toBeTruthy();
  });
});
