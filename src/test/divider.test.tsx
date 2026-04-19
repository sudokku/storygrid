import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Divider } from '../Grid/Divider';
import { useGridStore } from '../store/gridStore';
import { createLeaf } from '../lib/tree';
import type { ContainerNode } from '../types';

// Helper to build a container with two leaf children
function buildContainerTree(): ContainerNode {
  const left = createLeaf();
  const right = createLeaf();
  return {
    type: 'container',
    id: 'root',
    direction: 'horizontal',
    sizes: [0.5, 0.5],
    children: [left, right],
  };
}

function renderDivider(
  overrides: Partial<React.ComponentProps<typeof Divider>> = {}
) {
  const containerRef = { current: document.createElement('div') };
  // Set offsetWidth so pixel->weight conversion is deterministic
  Object.defineProperty(containerRef.current, 'offsetWidth', { value: 1000, configurable: true });
  Object.defineProperty(containerRef.current, 'offsetHeight', { value: 1000, configurable: true });

  const onLocalSizesChange = vi.fn();

  const props = {
    containerId: 'root',
    siblingIndex: 0,
    direction: 'horizontal' as const,
    sizes: [0.5, 0.5],
    containerRef,
    onLocalSizesChange,
    ...overrides,
  };

  const result = render(<Divider {...props} />);
  return { ...result, onLocalSizesChange, containerRef };
}

describe('Divider drag interaction (REND-03)', () => {
  beforeEach(() => {
    // Reset the store
    const tree = buildContainerTree();
    useGridStore.setState({
      root: tree,
      mediaRegistry: {},
      history: [{ root: tree }],
      historyIndex: 0,
    });
    // Spy/mock resize
    const mockResize = vi.fn();
    useGridStore.setState({ resize: mockResize } as Partial<ReturnType<typeof useGridStore.getState>>);
  });

  it('renders with 40px hit area and 2px visible line (expanded for touch, D-04)', () => {
    renderDivider();
    // The hit area element should exist with the divider hit testid
    const hitArea = screen.getByTestId('divider-hit-root-0');
    expect(hitArea).toBeTruthy();
    // It has the w-[40px] class for horizontal container (vertical divider) — expanded from 22px for touch
    expect(hitArea.className).toContain('w-[40px]');
    // D-05: touch-action: none prevents browser scroll hijack during divider drag
    expect((hitArea as HTMLElement).style.touchAction).toBe('none');
  });

  it('calls setPointerCapture on pointerdown', () => {
    renderDivider();
    const hitArea = screen.getByTestId('divider-hit-root-0');
    const mockSetPointerCapture = vi.fn();
    hitArea.setPointerCapture = mockSetPointerCapture;

    fireEvent.pointerDown(hitArea, { pointerId: 1, clientX: 100, clientY: 0 });

    expect(mockSetPointerCapture).toHaveBeenCalledWith(1);
  });

  it('updates local sizes during pointermove (no store write)', () => {
    const { onLocalSizesChange } = renderDivider();
    const hitArea = screen.getByTestId('divider-hit-root-0');
    hitArea.setPointerCapture = vi.fn();

    // Start drag at x=500 (center)
    fireEvent.pointerDown(hitArea, { pointerId: 1, clientX: 500, clientY: 0 });
    // Move 100px to the right
    fireEvent.pointerMove(hitArea, { clientX: 600, clientY: 0 });

    expect(onLocalSizesChange).toHaveBeenCalled();
    const newSizes = onLocalSizesChange.mock.calls[0][0] as number[];
    expect(newSizes[0]).toBeGreaterThan(0.5);
    expect(newSizes[1]).toBeLessThan(0.5);
    // Verify no store resize was called during move
    expect(useGridStore.getState().resize).not.toHaveBeenCalled?.();
  });

  it('commits resize to store on pointerup', () => {
    renderDivider();
    const hitArea = screen.getByTestId('divider-hit-root-0');
    hitArea.setPointerCapture = vi.fn();

    // Drag 100px right (on a 1000px container, that's +0.1 weight)
    fireEvent.pointerDown(hitArea, { pointerId: 1, clientX: 500, clientY: 0 });
    fireEvent.pointerMove(hitArea, { clientX: 600, clientY: 0 });
    fireEvent.pointerUp(hitArea);

    const resizeFn = useGridStore.getState().resize;
    expect(resizeFn).toHaveBeenCalledWith('root', 0, expect.any(Number));
    const callArgs = (resizeFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('root');
    expect(callArgs[1]).toBe(0);
    // delta should be ~0.1 (100px / 1000px * 1.0 totalWeight)
    expect(Math.abs(callArgs[2] as number)).toBeGreaterThan(0.001);
  });

  it('shows grab handle on hover (CSS class present)', () => {
    renderDivider();
    const hitArea = screen.getByTestId('divider-hit-root-0');
    // The grab handle element should be inside the hit area
    const grabHandle = hitArea.querySelector('.rounded-full');
    expect(grabHandle).toBeTruthy();
    // It has group-hover/hit:opacity-100 class (grab handle appears on hit area hover)
    expect(grabHandle?.className).toContain('group-hover/hit:opacity-100');
  });

  it('uses col-resize cursor for horizontal containers (vertical divider)', () => {
    renderDivider({ direction: 'horizontal' });
    const divider = screen.getByTestId('divider-root-0');
    expect(divider.className).toContain('cursor-col-resize');
  });

  it('uses row-resize cursor for vertical containers (horizontal divider)', () => {
    renderDivider({ direction: 'vertical' });
    const divider = screen.getByTestId('divider-root-0');
    expect(divider.className).toContain('cursor-row-resize');
  });
});
