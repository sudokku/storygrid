/**
 * @dnd-kit/core adapter for the v1.5 unified DnD engine.
 *
 * ───────────────────────────────────────────────────────────────────────
 * BLOCKING RULES — reintroducing any of these reproduces Phase 25 failures.
 * ───────────────────────────────────────────────────────────────────────
 *
 * RULE 1 — DND-04 (REQUIREMENTS.md): ONE DnD engine. Cell-drag is served by
 *   two coexisting dnd-kit built-in sensors (MouseSensor + TouchSensor)
 *   subclassed for the data-dnd-ignore escape hatch. This replaces the
 *   earlier single-PointerSensor-subclass approach (see
 *   .planning/debug/desktop-drag-dead.md + phase 28 gap-closure plan 28-11):
 *   two PointerSensor subclasses collide under useSyntheticListeners because
 *   both register activators under the identical React event key used by
 *   PointerSensor. MouseSensor binds to 'onMouseDown', TouchSensor to
 *   'onTouchStart' — different keys, no collision. KeyboardSensor remains
 *   OFF — this app has no keyboard-drag affordance.
 *
 * RULE 2 — Pitfall 4 (PITFALLS.md): Activation thresholds.
 *   Touch:  { delay: 250, tolerance: 5 }   (NEVER 500ms — collides with
 *                                            iOS 17.2+ image-action menu
 *                                            at ~500–700ms)
 *   Mouse:  { distance: 8 }                (prevents click-as-drag)
 *
 * RULE 3 — Pitfall 10 (PITFALLS.md): No parallel engines during migration.
 *   Phase 25 wiring (the per-hook draggable / droppable / drag-monitor
 *   helpers in LeafNode.tsx; DndContext + the legacy per-input sensor
 *   classes + KeyboardSensor + the zone-ref React context in
 *   CanvasWrapper.tsx) is removed in the SAME phase that wires this
 *   adapter — Phase 28. Never ship with both.
 *
 * REGRESSION GUARD (gap-closure 28-11): The React event key formerly used by
 *   PointerSensor is BANNED as a string literal in this file. Any revert to
 *   the PointerSensor-collision pattern would reintroduce it. See
 *   28-VERIFICATION.md §Gap-Closure Updates for the full rationale and
 *   grep gate.
 *
 * Phase 27 ships this file as a skeleton only. Phase 28 implements the
 * DndContext host + sensors + onDragStart/onDragOver/onDragEnd/onDragCancel
 * callbacks that wire into dragStore and computeDropZone.
 */

import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { MouseSensor, TouchSensor } from '@dnd-kit/core';
import type { Modifier, MouseSensorOptions, TouchSensorOptions } from '@dnd-kit/core';
import { useEditorStore } from '../../store/editorStore';

/**
 * CellDragMouseSensor — subclasses @dnd-kit/core MouseSensor to add the
 * [data-dnd-ignore] escape hatch (D-26). MouseSensor's activator binds to
 * React 'onMouseDown' — different key than TouchSensor's 'onTouchStart' —
 * so the two coexist under useSyntheticListeners without collision.
 *
 * activationConstraint `{ distance: 8 }` is applied at the useSensor() call
 * site in CanvasWrapper — NEVER encoded on the class itself, NEVER combined
 * with a delay constraint on the same sensor (D-03).
 */
export class CellDragMouseSensor extends MouseSensor {
  static activators = [{
    eventName: 'onMouseDown' as const,
    handler: (
      { nativeEvent: event }: ReactMouseEvent,
      { onActivation }: MouseSensorOptions,
    ): boolean => {
      const target = event.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-dnd-ignore]')) {
        return false;
      }
      if (event.button !== 0) return false;
      onActivation?.({ event });
      return true;
    },
  }];
}

/**
 * CellDragTouchSensor — subclasses @dnd-kit/core TouchSensor to add the
 * [data-dnd-ignore] escape hatch (D-26). Binds to React 'onTouchStart'.
 *
 * activationConstraint `{ delay: 250, tolerance: 5 }` is applied at the
 * useSensor() call site in CanvasWrapper. 250ms is non-negotiable — Pitfall 4
 * documents that 500ms collides with iOS 17.2+ image-action menu.
 */
export class CellDragTouchSensor extends TouchSensor {
  static activators = [{
    eventName: 'onTouchStart' as const,
    handler: (
      { nativeEvent: event }: ReactTouchEvent,
      { onActivation }: TouchSensorOptions,
    ): boolean => {
      const target = event.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-dnd-ignore]')) {
        return false;
      }
      if (event.touches.length === 0) return false;
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
