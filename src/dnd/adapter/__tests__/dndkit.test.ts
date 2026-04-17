/**
 * Adapter unit tests — Phase 28 Plan 11 (gap-closure: MouseSensor/TouchSensor subclasses).
 * Updated by gap-closure plan 28-12: scaleCompensationModifier removed (amplification-as-correct
 * contract disavowed). See src/dnd/adapter/dndkit.ts file comment for rationale.
 *
 * Covers DND-04, DRAG-03, DRAG-04, GHOST-06, CROSS-01:
 *   • CellDragMouseSensor activator guards button === 0 and [data-dnd-ignore] check.
 *   • CellDragTouchSensor activator guards touches.length >= 1 and [data-dnd-ignore] check.
 *   • Both honor `[data-dnd-ignore]` escape hatch via `closest()` BEFORE onActivation.
 *
 * Timing semantics (SC-1: 250ms touch, SC-2: 8px mouse) are configured at
 * useSensor() call-sites (CanvasWrapper), not inside these classes — per D-03 these
 * constraints live on `activationConstraint`, not on the class itself.
 * Real-device UAT is the authoritative timing check (D-31).
 */
import { describe, it, expect } from 'vitest';
import { MouseSensor, TouchSensor } from '@dnd-kit/core';
import { CellDragMouseSensor, CellDragTouchSensor } from '../dndkit';

// ---------------------------------------------------------------------------
// Helpers — activator handler fixtures
// ---------------------------------------------------------------------------

function makeMouseEvent(opts: { button?: number; target?: Element | null } = {}) {
  return {
    nativeEvent: {
      button: opts.button ?? 0,
      target: opts.target ?? null,
    } as unknown as MouseEvent,
  } as any;
}

function makeTouchEvent(opts: { touchesLen?: number; target?: Element | null } = {}) {
  return {
    nativeEvent: {
      touches: { length: opts.touchesLen ?? 1 } as unknown as TouchList,
      target: opts.target ?? null,
    } as unknown as TouchEvent,
  } as any;
}

// ---------------------------------------------------------------------------
// Class-identity and inheritance invariants
// ---------------------------------------------------------------------------

describe('CellDragMouseSensor — class shape', () => {
  it('extends MouseSensor', () => {
    expect(Object.getPrototypeOf(CellDragMouseSensor)).toBe(MouseSensor);
  });

  it('has exactly one activator entry on onMouseDown', () => {
    expect(CellDragMouseSensor.activators).toHaveLength(1);
    expect(CellDragMouseSensor.activators[0].eventName).toBe('onMouseDown');
    expect(typeof CellDragMouseSensor.activators[0].handler).toBe('function');
  });
});

describe('CellDragTouchSensor — class shape', () => {
  it('extends TouchSensor', () => {
    expect(Object.getPrototypeOf(CellDragTouchSensor)).toBe(TouchSensor);
  });

  it('has exactly one activator entry on onTouchStart', () => {
    expect(CellDragTouchSensor.activators).toHaveLength(1);
    expect(CellDragTouchSensor.activators[0].eventName).toBe('onTouchStart');
    expect(typeof CellDragTouchSensor.activators[0].handler).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// CellDragMouseSensor — primary-button guard
// ---------------------------------------------------------------------------

describe('CellDragMouseSensor.activator — primary-button guard', () => {
  const handler = CellDragMouseSensor.activators[0].handler;

  it('accepts button === 0 and invokes onActivation', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makeMouseEvent({ button: 0 }),
      { onActivation } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('rejects button !== 0 (right-click) and does NOT invoke onActivation', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makeMouseEvent({ button: 2 }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CellDragTouchSensor — touches guard
// ---------------------------------------------------------------------------

describe('CellDragTouchSensor.activator — touches guard', () => {
  const handler = CellDragTouchSensor.activators[0].handler;

  it('accepts touches.length === 1 and invokes onActivation', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makeTouchEvent({ touchesLen: 1 }),
      { onActivation } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('rejects touches.length === 0 and does NOT invoke onActivation', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makeTouchEvent({ touchesLen: 0 }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// data-dnd-ignore escape hatch (D-26) — BEFORE onActivation fires
// ---------------------------------------------------------------------------

describe('[data-dnd-ignore] escape hatch — D-26 (ignore-check BEFORE onActivation)', () => {
  function makeTarget(ignoreAncestor: boolean): Element {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    if (ignoreAncestor) parent.setAttribute('data-dnd-ignore', 'true');
    parent.appendChild(child);
    return child;
  }

  it('CellDragMouseSensor rejects when target is inside [data-dnd-ignore] (returns false, no onActivation)', () => {
    const target = makeTarget(true);
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = CellDragMouseSensor.activators[0].handler(
      makeMouseEvent({ button: 0, target }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('CellDragMouseSensor rejects when target itself has [data-dnd-ignore]', () => {
    const target = document.createElement('div');
    target.setAttribute('data-dnd-ignore', 'true');
    let fired = false;
    const result = CellDragMouseSensor.activators[0].handler(
      makeMouseEvent({ button: 0, target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('CellDragMouseSensor accepts when no ancestor has [data-dnd-ignore]', () => {
    const target = makeTarget(false);
    let fired = false;
    const result = CellDragMouseSensor.activators[0].handler(
      makeMouseEvent({ button: 0, target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('CellDragTouchSensor rejects when target is inside [data-dnd-ignore]', () => {
    const target = makeTarget(true);
    let fired = false;
    const result = CellDragTouchSensor.activators[0].handler(
      makeTouchEvent({ touchesLen: 1, target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('CellDragTouchSensor accepts when no ancestor has [data-dnd-ignore]', () => {
    const target = makeTarget(false);
    let fired = false;
    const result = CellDragTouchSensor.activators[0].handler(
      makeTouchEvent({ touchesLen: 1, target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('tolerates null target (no error, proceeds to button/touches check) — defensive for mouse', () => {
    let fired = false;
    const result = CellDragMouseSensor.activators[0].handler(
      makeMouseEvent({ button: 0, target: null }),
      { onActivation: () => { fired = true; } } as any,
    );
    // Null target cannot fail the ignore-check (no closest to call), so activation proceeds.
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });
});

