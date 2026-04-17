/**
 * @dnd-kit/core adapter for the v1.5 unified DnD engine.
 *
 * ───────────────────────────────────────────────────────────────────────
 * BLOCKING RULES — reintroducing any of these reproduces Phase 25 failures.
 * ───────────────────────────────────────────────────────────────────────
 *
 * RULE 1 — DND-01 (REQUIREMENTS.md): Single PointerSensor only.
 *   Do NOT add TouchSensor or MouseSensor. dnd-kit docs explicitly forbid
 *   the Touch + Mouse combination; it was a primary cause of Phase 25's
 *   flaky activation (PITFALLS.md Root Cause Hypothesis).
 *
 * RULE 2 — Pitfall 4 (PITFALLS.md): Activation thresholds.
 *   Touch:  { delay: 250, tolerance: 5 }   (NEVER 500ms — collides with
 *                                            iOS 17.2+ image-action menu
 *                                            at ~500–700ms)
 *   Mouse:  { distance: 8 }                (prevents click-as-drag)
 *
 * RULE 3 — Pitfall 10 (PITFALLS.md): No parallel engines during migration.
 *   Phase 25 wiring (useDraggable / useDroppable / useDndMonitor in
 *   LeafNode.tsx; DndContext + MouseSensor + TouchSensor + KeyboardSensor
 *   + DragZoneRefContext in CanvasWrapper.tsx) is removed in the SAME
 *   phase that wires this adapter — Phase 28. Never ship with both.
 *
 * Phase 27 ships this file as a skeleton only. Phase 28 implements the
 * DndContext host + sensors + onDragStart/onDragOver/onDragEnd/onDragCancel
 * callbacks that wire into dragStore and computeDropZone.
 */

import type { PointerEvent as ReactPointerEvent } from 'react';
import { PointerSensor } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { useEditorStore } from '../../store/editorStore';

// ---------------------------------------------------------------------------
// Activator handler options (D-02) — the `onActivation` callback is the only
// field the activators need from `PointerSensorOptions`. Inlined here to keep
// the adapter self-contained without depending on `@dnd-kit/core` exporting
// its internal `PointerSensorOptions` interface verbatim.
// ---------------------------------------------------------------------------
type ActivatorOptions = { onActivation?: (args: { event: Event }) => void };

/**
 * PointerSensorMouse — discriminates on `pointerType === 'mouse'` (D-02).
 * activationConstraint `{ distance: 8 }` is applied at the `useSensor()` call
 * site in Plan 07 — NEVER encoded on the class itself, NEVER combined with a
 * `delay` constraint on the same sensor (D-03 — `AbstractPointerSensor.attach`
 * collapses `{delay, distance}` to delay-only).
 *
 * The activator checks for a `[data-dnd-ignore]` ancestor BEFORE calling
 * `onActivation` (D-26) — this prevents the Divider hit-area and OverlayLayer
 * root (both added by Plan 09) from accidentally starting a cell drag.
 */
export class PointerSensorMouse extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown' as const,
    handler: (
      { nativeEvent: event }: ReactPointerEvent,
      { onActivation }: ActivatorOptions,
    ): boolean => {
      if (event.pointerType !== 'mouse') return false;
      const target = event.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-dnd-ignore]')) {
        return false;
      }
      onActivation?.({ event });
      return true;
    },
  }];
}

/**
 * PointerSensorTouch — discriminates on `pointerType === 'touch' | 'pen'`
 * (D-02). activationConstraint `{ delay: 250, tolerance: 5 }` is applied at
 * the `useSensor()` call site in Plan 07. The 250ms threshold is
 * non-negotiable — Pitfall 4 documents that 500ms collides with the iOS
 * 17.2+ image-action menu.
 *
 * See `PointerSensorMouse` for the rationale on the `[data-dnd-ignore]`
 * ancestor check (D-26).
 */
export class PointerSensorTouch extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown' as const,
    handler: (
      { nativeEvent: event }: ReactPointerEvent,
      { onActivation }: ActivatorOptions,
    ): boolean => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return false;
      const target = event.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-dnd-ignore]')) {
        return false;
      }
      onActivation?.({ event });
      return true;
    },
  }];
}

/**
 * scaleCompensationModifier — divides `transform.x` / `transform.y` by the
 * current `canvasScale` so the drag ghost tracks the exact pointer position
 * despite the ancestor `transform: scale()` on the canvas root (D-08).
 *
 * Reads via `useEditorStore.getState()` imperatively — this function is NOT
 * a React component, so the hook form would throw. The `|| 1` guards the
 * rare `canvasScale === 0` bootstrap window before the ResizeObserver fires
 * (see editorStore.ts initial state). The object spread preserves
 * `scaleX` / `scaleY` from the input `Transform` (D-09 — `adjustScale=false`
 * on `DragOverlay` leaves those untouched here).
 */
export const scaleCompensationModifier: Modifier = ({ transform }) => {
  const scale = useEditorStore.getState().canvasScale || 1;
  return { ...transform, x: transform.x / scale, y: transform.y / scale };
};
