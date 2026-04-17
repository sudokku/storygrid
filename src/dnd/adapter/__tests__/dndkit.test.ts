/**
 * Adapter unit tests — Phase 28 Plan 02.
 *
 * Covers DND-04, DRAG-03, DRAG-04, GHOST-02, GHOST-06, CROSS-01:
 *   • PointerSensorMouse activator discriminates pointerType === 'mouse' only.
 *   • PointerSensorTouch activator discriminates pointerType === 'touch' | 'pen'.
 *   • Both honor `[data-dnd-ignore]` escape hatch via `closest()` BEFORE onActivation.
 *   • scaleCompensationModifier divides transform.x/y by editorStore.canvasScale,
 *     guards divide-by-zero, preserves scaleX/scaleY fields.
 *
 * Timing semantics (SC-1: 250ms touch, SC-2: 8px mouse) are configured at
 * useSensor() call-sites (Plan 07), not inside these classes — per D-03 these
 * constraints live on `activationConstraint`, not on the class itself.
 * Real-device UAT is the authoritative timing check (D-31).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PointerSensor } from '@dnd-kit/core';
import { PointerSensorMouse, PointerSensorTouch, scaleCompensationModifier } from '../dndkit';
import { useEditorStore } from '../../../store/editorStore';

// ---------------------------------------------------------------------------
// Helpers — activator handler fixtures
// ---------------------------------------------------------------------------

function makePointerEvent(opts: {
  pointerType: 'mouse' | 'touch' | 'pen' | '';
  target?: Element | null;
}) {
  // Mimic the React.PointerEvent shape the activator reads from.
  // Only `nativeEvent` is accessed by the activator; the wrapper shape is opaque.
  return {
    nativeEvent: {
      pointerType: opts.pointerType,
      target: opts.target ?? null,
    } as unknown as PointerEvent,
  } as any;
}

// ---------------------------------------------------------------------------
// Class-identity and inheritance invariants
// ---------------------------------------------------------------------------

describe('PointerSensorMouse — class shape', () => {
  it('extends PointerSensor', () => {
    expect(Object.getPrototypeOf(PointerSensorMouse)).toBe(PointerSensor);
  });

  it('has exactly one activator entry on onPointerDown', () => {
    expect(PointerSensorMouse.activators).toHaveLength(1);
    expect(PointerSensorMouse.activators[0].eventName).toBe('onPointerDown');
    expect(typeof PointerSensorMouse.activators[0].handler).toBe('function');
  });
});

describe('PointerSensorTouch — class shape', () => {
  it('extends PointerSensor', () => {
    expect(Object.getPrototypeOf(PointerSensorTouch)).toBe(PointerSensor);
  });

  it('has exactly one activator entry on onPointerDown', () => {
    expect(PointerSensorTouch.activators).toHaveLength(1);
    expect(PointerSensorTouch.activators[0].eventName).toBe('onPointerDown');
    expect(typeof PointerSensorTouch.activators[0].handler).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// PointerSensorMouse — pointerType discrimination + ignore-check
// ---------------------------------------------------------------------------

describe('PointerSensorMouse.activator — pointerType discrimination (D-02)', () => {
  const handler = PointerSensorMouse.activators[0].handler;

  it('accepts pointerType === "mouse" (returns true and fires onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'mouse' }),
      { onActivation } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('rejects pointerType === "touch" (returns false, no onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'touch' }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('rejects pointerType === "pen" (returns false, no onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'pen' }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('tolerates missing onActivation callback (optional chaining)', () => {
    const result = handler(
      makePointerEvent({ pointerType: 'mouse' }),
      {} as any,
    );
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PointerSensorTouch — pointerType discrimination + ignore-check
// ---------------------------------------------------------------------------

describe('PointerSensorTouch.activator — pointerType discrimination (D-02)', () => {
  const handler = PointerSensorTouch.activators[0].handler;

  it('accepts pointerType === "touch" (returns true and fires onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'touch' }),
      { onActivation } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('accepts pointerType === "pen" (returns true and fires onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'pen' }),
      { onActivation } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('rejects pointerType === "mouse" (returns false, no onActivation)', () => {
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = handler(
      makePointerEvent({ pointerType: 'mouse' }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('tolerates missing onActivation callback (optional chaining)', () => {
    const result = handler(
      makePointerEvent({ pointerType: 'touch' }),
      {} as any,
    );
    expect(result).toBe(true);
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

  it('PointerSensorMouse rejects when target is inside [data-dnd-ignore] (returns false, no onActivation)', () => {
    const target = makeTarget(true);
    let fired = false;
    const onActivation = () => { fired = true; };
    const result = PointerSensorMouse.activators[0].handler(
      makePointerEvent({ pointerType: 'mouse', target }),
      { onActivation } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('PointerSensorMouse rejects when target itself has [data-dnd-ignore]', () => {
    const target = document.createElement('div');
    target.setAttribute('data-dnd-ignore', 'true');
    let fired = false;
    const result = PointerSensorMouse.activators[0].handler(
      makePointerEvent({ pointerType: 'mouse', target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('PointerSensorMouse accepts when no ancestor has [data-dnd-ignore]', () => {
    const target = makeTarget(false);
    let fired = false;
    const result = PointerSensorMouse.activators[0].handler(
      makePointerEvent({ pointerType: 'mouse', target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('PointerSensorTouch rejects when target is inside [data-dnd-ignore]', () => {
    const target = makeTarget(true);
    let fired = false;
    const result = PointerSensorTouch.activators[0].handler(
      makePointerEvent({ pointerType: 'touch', target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('PointerSensorTouch rejects when target is inside [data-dnd-ignore] (pen)', () => {
    const target = makeTarget(true);
    let fired = false;
    const result = PointerSensorTouch.activators[0].handler(
      makePointerEvent({ pointerType: 'pen', target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(false);
    expect(fired).toBe(false);
  });

  it('PointerSensorTouch accepts when no ancestor has [data-dnd-ignore]', () => {
    const target = makeTarget(false);
    let fired = false;
    const result = PointerSensorTouch.activators[0].handler(
      makePointerEvent({ pointerType: 'touch', target }),
      { onActivation: () => { fired = true; } } as any,
    );
    expect(result).toBe(true);
    expect(fired).toBe(true);
  });

  it('tolerates null target (no error, no onActivation) — defensive for mouse', () => {
    let fired = false;
    const result = PointerSensorMouse.activators[0].handler(
      makePointerEvent({ pointerType: 'mouse', target: null }),
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
