import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { OverlayHandles } from '../OverlayHandles';
import type { TextOverlay } from '../../types';

const makeTextOverlay = (overrides: Partial<TextOverlay> = {}): TextOverlay => ({
  id: 'o1',
  type: 'text',
  x: 100,
  y: 100,
  width: 200,
  rotation: 0,
  zIndex: 1,
  content: 'Hello',
  fontFamily: 'Geist',
  fontSize: 72,
  color: '#ffffff',
  fontWeight: 'regular',
  textAlign: 'center',
  ...overrides,
});

afterEach(() => cleanup());

describe('OverlayHandles', () => {
  it('Test 1 (OVL-10 drag): viewport delta converted to canvas delta at scale=1', () => {
    const onUpdate = vi.fn();
    const overlay = makeTextOverlay({ x: 100, y: 100 });
    const { container } = render(
      <OverlayHandles overlay={overlay} canvasScale={1} onUpdate={onUpdate} />
    );
    // The drag body is the first div in the fragment
    const dragBody = container.querySelector('div') as HTMLElement;
    fireEvent.pointerDown(dragBody, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(dragBody, { clientX: 50, clientY: 25 });
    expect(onUpdate).toHaveBeenCalledWith({ x: 150, y: 125 });
  });

  it('Test 2 (OVL-10 drag with scale): canvasScale=0.5 doubles canvas delta', () => {
    const onUpdate = vi.fn();
    const overlay = makeTextOverlay({ x: 100, y: 100 });
    const { container } = render(
      <OverlayHandles overlay={overlay} canvasScale={0.5} onUpdate={onUpdate} />
    );
    const dragBody = container.querySelector('div') as HTMLElement;
    fireEvent.pointerDown(dragBody, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(dragBody, { clientX: 50, clientY: 25 });
    // viewport delta 50,25 / scale 0.5 = canvas delta 100,50
    expect(onUpdate).toHaveBeenCalledWith({ x: 200, y: 150 });
  });

  it('Test 3 (OVL-11 resize corner): proportional width resize via hypot', () => {
    const onUpdate = vi.fn();
    const overlay = makeTextOverlay({ width: 200 });
    const { getByTestId } = render(
      <OverlayHandles overlay={overlay} canvasScale={1} onUpdate={onUpdate} />
    );
    const resizeHandle = getByTestId('overlay-resize-handle');
    fireEvent.pointerDown(resizeHandle, { clientX: 0, clientY: 0 });
    // Move so dx=dy=0, dx+dy=80 → hypot(40,0)*sign(40) = 40 canvas delta → 240
    fireEvent.pointerMove(resizeHandle, { clientX: 40, clientY: 0 });
    const calls = onUpdate.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall).toHaveProperty('width');
    expect(lastCall.width).toBeGreaterThanOrEqual(40); // min clamp applied
    expect(lastCall.width).toBeGreaterThan(200); // grew from 200
  });

  it('Test 4 (OVL-12 rotate): rotation handle produces a numeric rotation value', () => {
    const onUpdate = vi.fn();
    const overlay = makeTextOverlay({ x: 100, y: 100, width: 200 });
    const { getByTestId } = render(
      <OverlayHandles overlay={overlay} canvasScale={1} onUpdate={onUpdate} />
    );
    const rotateHandle = getByTestId('overlay-rotate-handle');
    fireEvent.pointerDown(rotateHandle, { clientX: 100, clientY: 100 });
    // Move pointer to position 90° clockwise from center
    fireEvent.pointerMove(rotateHandle, { clientX: 200, clientY: 100 });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rotation: expect.any(Number) })
    );
    // Verify the angle is a finite number
    const rotationValue = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0].rotation;
    expect(isFinite(rotationValue)).toBe(true);
  });

  it('Test 5: setPointerCapture guards — no throw when method is undefined', () => {
    const onUpdate = vi.fn();
    const overlay = makeTextOverlay();
    const { container } = render(
      <OverlayHandles overlay={overlay} canvasScale={1} onUpdate={onUpdate} />
    );
    const dragBody = container.querySelector('div') as HTMLElement;
    // Simulate jsdom lacking setPointerCapture (undefined on the element)
    Object.defineProperty(dragBody, 'setPointerCapture', { value: undefined, writable: true });
    Object.defineProperty(dragBody, 'releasePointerCapture', { value: undefined, writable: true });
    // Should not throw
    expect(() => {
      fireEvent.pointerDown(dragBody, { clientX: 0, clientY: 0 });
      fireEvent.pointerMove(dragBody, { clientX: 10, clientY: 10 });
      fireEvent.pointerUp(dragBody, { clientX: 10, clientY: 10 });
    }).not.toThrow();
  });
});
