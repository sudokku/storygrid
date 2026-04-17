/**
 * Sensor coexistence — Gap 1 regression lock.
 *
 * The Phase 28 initial shipping architecture used TWO PointerSensor subclasses;
 * both registered activators under the identical React event key used by
 * PointerSensor and the second-registered handler silently overwrote the first via
 * useSyntheticListeners (see .planning/debug/desktop-drag-dead.md). This file
 * enforces the fix: CellDragMouseSensor binds to 'onMouseDown' and
 * CellDragTouchSensor binds to 'onTouchStart' — different keys, no collision.
 *
 * Strong proof: vi.spyOn wraps each class's static activator handler BEFORE render.
 * Native mousedown dispatch calls the Mouse handler spy and NOT the Touch handler
 * spy; native touchstart dispatch calls the Touch handler spy and NOT the Mouse
 * handler spy. This proves ROUTING — not just coexistence.
 *
 * This test does NOT simulate real pointer timing — D-31 punts timing semantics to
 * real-device UAT per Pitfall 11 (jsdom timer unreliability).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { DndContext, useSensor, useSensors, useDraggable } from '@dnd-kit/core';
import { CellDragMouseSensor, CellDragTouchSensor } from '../adapter/dndkit';

function Harness() {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: 'test' });
  // Spread listeners LAST on the element (Pitfall 1).
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid="harness-draggable"
    />
  );
}

function Host() {
  const sensors = useSensors(
    useSensor(CellDragMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(CellDragTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  return (
    <DndContext sensors={sensors}>
      <Harness />
    </DndContext>
  );
}

describe('Gap 1 regression — sensor coexistence (different React event keys)', () => {
  it('CellDragMouseSensor.activators[0].eventName is onMouseDown', () => {
    expect(CellDragMouseSensor.activators[0].eventName).toBe('onMouseDown');
  });

  it('CellDragTouchSensor.activators[0].eventName is onTouchStart', () => {
    expect(CellDragTouchSensor.activators[0].eventName).toBe('onTouchStart');
  });

  it('the two event keys differ (lock — any future collision trips this)', () => {
    expect(CellDragMouseSensor.activators[0].eventName).not.toBe(
      CellDragTouchSensor.activators[0].eventName,
    );
  });

  it('neither activator binds to onPointerDown (bug regression lock)', () => {
    expect(CellDragMouseSensor.activators[0].eventName).not.toBe('onPointerDown');
    expect(CellDragTouchSensor.activators[0].eventName).not.toBe('onPointerDown');
  });

  it('both activator handlers are functions', () => {
    expect(typeof CellDragMouseSensor.activators[0].handler).toBe('function');
    expect(typeof CellDragTouchSensor.activators[0].handler).toBe('function');
  });

  describe('routing proof — each native event reaches its respective sensor handler', () => {
    // Spy wrappers installed BEFORE render, so the listener-merge pipeline
    // captures the spies (not the originals). Restored in afterEach.
    let mouseHandlerSpy: ReturnType<typeof vi.spyOn>;
    let touchHandlerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mouseHandlerSpy = vi.spyOn(CellDragMouseSensor.activators[0], 'handler');
      touchHandlerSpy = vi.spyOn(CellDragTouchSensor.activators[0], 'handler');
    });

    afterEach(() => {
      mouseHandlerSpy.mockRestore();
      touchHandlerSpy.mockRestore();
    });

    it('native mousedown invokes the Mouse handler (and NOT the Touch handler)', () => {
      const { getByTestId } = render(<Host />);
      const el = getByTestId('harness-draggable');

      const mouseEvt = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      el.dispatchEvent(mouseEvt);

      expect(mouseHandlerSpy).toHaveBeenCalledTimes(1);
      expect(touchHandlerSpy).not.toHaveBeenCalled();
    });

    it('native touchstart invokes the Touch handler (and NOT the Mouse handler)', () => {
      const { getByTestId } = render(<Host />);
      const el = getByTestId('harness-draggable');

      // jsdom does not implement Touch; fabricate a touchstart with touches len 1.
      const touchEvt = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchEvt, 'touches', {
        value: [{}],
        writable: false,
      });
      Object.defineProperty(touchEvt, 'target', {
        value: el,
        writable: false,
      });
      el.dispatchEvent(touchEvt);

      expect(touchHandlerSpy).toHaveBeenCalledTimes(1);
      expect(mouseHandlerSpy).not.toHaveBeenCalled();
    });
  });
});
