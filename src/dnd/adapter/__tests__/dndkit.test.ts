/**
 * Adapter unit tests — Phase 28 Plan 11 (gap-closure: MouseSensor/TouchSensor subclasses).
 *
 * Covers DND-04, DRAG-03, DRAG-04, GHOST-02, GHOST-06, CROSS-01:
 *   • CellDragMouseSensor activator guards button === 0 and [data-dnd-ignore] check.
 *   • CellDragTouchSensor activator guards touches.length >= 1 and [data-dnd-ignore] check.
 *   • Both honor `[data-dnd-ignore]` escape hatch via `closest()` BEFORE onActivation.
 *   • scaleCompensationModifier divides transform.x/y by editorStore.canvasScale,
 *     guards divide-by-zero, preserves scaleX/scaleY fields.
 *
 * Timing semantics (SC-1: 250ms touch, SC-2: 8px mouse) are configured at
 * useSensor() call-sites (CanvasWrapper), not inside these classes — per D-03 these
 * constraints live on `activationConstraint`, not on the class itself.
 * Real-device UAT is the authoritative timing check (D-31).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MouseSensor, TouchSensor } from '@dnd-kit/core';
import { CellDragMouseSensor, CellDragTouchSensor, scaleCompensationModifier } from '../dndkit';
import { useEditorStore } from '../../../store/editorStore';

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

// ---------------------------------------------------------------------------
// scaleCompensationModifier — D-08, D-09
// ---------------------------------------------------------------------------

function makeModifierArgs(transform: { x: number; y: number; scaleX: number; scaleY: number }): any {
  return {
    activatorEvent: null,
    active: null,
    activeNodeRect: null,
    draggingNodeRect: null,
    containerNodeRect: null,
    over: null,
    overlayNodeRect: null,
    scrollableAncestors: [],
    scrollableAncestorRects: [],
    transform,
    windowRect: null,
  };
}

describe('scaleCompensationModifier — D-08 (scale compensation)', () => {
  beforeEach(() => {
    // Reset to default scale between tests
    useEditorStore.getState().setCanvasScale(1);
  });

  it('is a function (Modifier shape)', () => {
    expect(typeof scaleCompensationModifier).toBe('function');
  });

  it('divides transform.x and transform.y by canvasScale=0.5 (preview-size canvas)', () => {
    useEditorStore.getState().setCanvasScale(0.5);
    const result = scaleCompensationModifier(
      makeModifierArgs({ x: 100, y: 200, scaleX: 1, scaleY: 1 }),
    );
    expect(result.x).toBe(200);
    expect(result.y).toBe(400);
  });

  it('is a no-op at canvasScale=1 (desktop at 1:1)', () => {
    useEditorStore.getState().setCanvasScale(1);
    const result = scaleCompensationModifier(
      makeModifierArgs({ x: 42, y: -17, scaleX: 1, scaleY: 1 }),
    );
    expect(result.x).toBe(42);
    expect(result.y).toBe(-17);
  });

  it('divides by canvasScale=0.2 (heavily scaled-down canvas)', () => {
    useEditorStore.getState().setCanvasScale(0.2);
    const result = scaleCompensationModifier(
      makeModifierArgs({ x: 10, y: 20, scaleX: 1, scaleY: 1 }),
    );
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });

  it('preserves scaleX and scaleY from input transform', () => {
    useEditorStore.getState().setCanvasScale(0.5);
    const result = scaleCompensationModifier(
      makeModifierArgs({ x: 10, y: 20, scaleX: 1.5, scaleY: 2.0 }),
    );
    expect(result.scaleX).toBe(1.5);
    expect(result.scaleY).toBe(2.0);
  });

  it('guards divide-by-zero when canvasScale=0 (|| 1 fallback)', () => {
    useEditorStore.getState().setCanvasScale(0);
    const result = scaleCompensationModifier(
      makeModifierArgs({ x: 100, y: 200, scaleX: 1, scaleY: 1 }),
    );
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    // Explicitly NOT Infinity — guard active
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it('reads canvasScale imperatively via getState (not React subscription)', () => {
    // First call with scale=0.5
    useEditorStore.getState().setCanvasScale(0.5);
    const r1 = scaleCompensationModifier(
      makeModifierArgs({ x: 100, y: 100, scaleX: 1, scaleY: 1 }),
    );
    expect(r1.x).toBe(200);

    // Mutate store — modifier must read FRESH value on next call (no stale closure)
    useEditorStore.getState().setCanvasScale(0.25);
    const r2 = scaleCompensationModifier(
      makeModifierArgs({ x: 100, y: 100, scaleX: 1, scaleY: 1 }),
    );
    expect(r2.x).toBe(400);
  });
});
