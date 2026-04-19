/**
 * Tests for useCellDraggable hook — Phase 30
 * Requirements: D-02 (style object), CROSS-02 (touchAction), CROSS-03 (WebkitTouchCallout)
 *
 * These tests are RED in Wave 0: Wave 1 (Plan 30-02) adds the `style` field
 * to UseCellDraggableResult, which turns them green.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCellDraggable } from './useCellDraggable';
import { useDragStore } from './dragStore';

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    useDraggable: () => ({
      attributes: { role: 'gridcell', tabIndex: 0 },
      listeners: { onPointerDown: vi.fn() },
      isDragging: false,
      setNodeRef: vi.fn(),
      transform: null,
      node: { current: null },
    }),
  };
});

beforeEach(() => {
  useDragStore.setState({
    status: 'idle',
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
    ghostUrl: null,
    sourceW: 0,
    sourceH: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    lastDropId: null,
    // prevSheetSnapState: null  <-- add after Wave 1 (Plan 30-04 will update this reset)
  });
});

describe('useCellDraggable — style object (D-02)', () => {
  it('returns a style property', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'));
    expect(result.current).toHaveProperty('style');
  });

  it('style.touchAction is "none" (CROSS-02)', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'));
    expect(result.current.style.touchAction).toBe('none');
  });

  it('style.WebkitTouchCallout is "none" (CROSS-03)', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'));
    // WebkitTouchCallout is a non-standard CSS property — cast needed:
    expect((result.current.style as Record<string, unknown>).WebkitTouchCallout).toBe('none');
  });
});

describe('useCellDraggable — return shape completeness', () => {
  it('returns attributes, listeners, isDragging, setNodeRef, and style', () => {
    const { result } = renderHook(() => useCellDraggable('leaf-1'));
    expect(result.current).toHaveProperty('attributes');
    expect(result.current).toHaveProperty('listeners');
    expect(typeof result.current.isDragging).toBe('boolean');
    expect(typeof result.current.setNodeRef).toBe('function');
    expect(typeof result.current.style).toBe('object');
  });
});
