import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { useShallow } from 'zustand/react/shallow';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { GridNodeComponent } from './GridNode';
import { OverlayLayer } from './OverlayLayer';
import {
  DndContext,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent, DragMoveEvent } from '@dnd-kit/core';
import { CellDragMouseSensor, CellDragTouchSensor } from '../dnd/adapter/dndkit';
import { useDragStore, computeDropZone, DragPreviewPortal } from '../dnd';
import type { DropZone } from '../dnd';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const GRADIENT_DIR_MAP = {
  'to-bottom': 'to bottom',
  'to-right': 'to right',
  'diagonal': '135deg',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Test-only export: the pure pointer-derivation + zone-compute logic that
 * handleDragMove invokes on every pointer-move tick during an active drag.
 *
 * Exported as `_test*` because the underscore prefix signals "test-only —
 * do not import in production code". The real handleDragMove callback in
 * CanvasWrapper is the sole production consumer.
 *
 * Gap-closure 28-14 — DEFECT 2 fix: pointer is derived from
 *   active.rect.current.initial + delta
 * which is input-type-agnostic (works identically for Mouse, Touch, Pen
 * sensors). The previous approach cast activatorEvent to PointerEvent and
 * read clientX/Y, which yielded `undefined` on TouchEvent → NaN pointer →
 * always 'center'. See .planning/debug/insert-edge-drop-broken.md.
 */
export function _testComputeZoneFromDragMove(event: {
  active: { id: string | number; rect: { current: { initial: { left: number; top: number; width: number; height: number } | null } } };
  over: { id: string | number } | null;
  delta: { x: number; y: number };
}): { overId: string | null; zone: DropZone | null } {
  const { over, active, delta } = event;

  // Null-over and self-over: the store must clear so indicators disappear.
  if (!over || active.id === over.id) {
    return { overId: null, zone: null };
  }

  // Input-type-agnostic pointer: anchor at the CENTER of the source cell
  // at drag-start (active.rect.current.initial is the viewport-space
  // ClientRect captured by dnd-kit when the drag began, frozen for the
  // drag's lifetime) and add the cumulative move delta. dnd-kit normalizes
  // delta across input types — this derivation is identical for Mouse,
  // Touch, and Pen pointers.
  const initial = active.rect.current.initial;
  if (!initial) return { overId: null, zone: null };
  const pointer = {
    x: initial.left + initial.width / 2 + delta.x,
    y: initial.top + initial.height / 2 + delta.y,
  };

  const targetEl = document.querySelector(`[data-testid="leaf-${over.id}"]`) as HTMLElement | null;
  if (!targetEl) return { overId: null, zone: null };
  const rect = targetEl.getBoundingClientRect();
  const zone: DropZone = computeDropZone(rect, pointer);
  return { overId: String(over.id), zone };
}

export const CanvasWrapper = React.memo(function CanvasWrapper() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoFitScale, setAutoFitScale] = useState(1);
  const zoom = useEditorStore(s => s.zoom);
  const setCanvasScale = useEditorStore(s => s.setCanvasScale);
  const showSafeZone = useEditorStore(s => s.showSafeZone);
  const rootId = useGridStore(s => s.root.id);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);
  const setSelectedOverlayId = useEditorStore(s => s.setSelectedOverlayId);
  const { backgroundMode, backgroundColor, backgroundGradientFrom, backgroundGradientTo, backgroundGradientDir } =
    useEditorStore(useShallow(s => ({
      backgroundMode: s.backgroundMode,
      backgroundColor: s.backgroundColor,
      backgroundGradientFrom: s.backgroundGradientFrom,
      backgroundGradientTo: s.backgroundGradientTo,
      backgroundGradientDir: s.backgroundGradientDir,
    })));

  // D-02/D-03 — SEPARATE activation constraints on different React event keys.
  //   Mouse: { distance: 8 }   (REQ DRAG-04, Pitfall 4)
  //   Touch: { delay: 250, tolerance: 5 }   (REQ DRAG-03, Pitfall 4 — NEVER 500ms)
  // MouseSensor binds to onMouseDown; TouchSensor binds to onTouchStart — no
  // listener-key collision (gap-closure 28-11 reason).
  const sensors = useSensors(
    useSensor(CellDragMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(CellDragTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const moveCell = useGridStore(s => s.moveCell);

  // D-06 — synchronous snapshot on drag start. toDataURL runs inside dnd-kit's
  // onDragStart, BEFORE the first pointer-move frame. Video cells use the current
  // RVO frame drawn to the canvas. Pitfall 9: for VIDEO cells, the rAF draw loop
  // may race this call — LeafNode Plan 08 optionally pauses the loop when
  // sourceId === id.
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const sourceId = String(event.active.id);
    const leafEl = document.querySelector(`[data-testid="leaf-${sourceId}"]`) as HTMLElement | null;
    const canvas = leafEl?.querySelector('canvas') as HTMLCanvasElement | null;
    const rect = leafEl?.getBoundingClientRect();
    const ghostDataUrl = canvas ? canvas.toDataURL() : null;
    const sourceRect = rect
      ? { width: rect.width, height: rect.height, left: rect.left, top: rect.top }
      : null;

    useDragStore.getState().beginCellDrag(sourceId);
    useDragStore.getState().setGhost(ghostDataUrl, sourceRect);
  }, []);

  // Gap-closure 28-14 — DEFECT 1 fix: handleDragOver fires only on droppable
  // enter/leave (dep array [overId] per @dnd-kit/core/dist/core.esm.js:3286),
  // so it cannot be the continuous zone-compute site. Continuous zone refresh
  // now lives in handleDragMove below. handleDragOver is retained for the
  // null-over / self-over CLEAR branch — the store must clear overId when the
  // pointer leaves the target or re-enters the source cell.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || active.id === over.id) {
      useDragStore.getState().setOver(null, null);
    }
    // Non-null over: handleDragMove will compute + write the zone on the
    // next pointer-move tick. We intentionally do NOT write here to avoid
    // racing the first handleDragMove tick with a stale entry-zone.
  }, []);

  // Gap-closure 28-14 — DEFECT 1 + DEFECT 2 fix: continuous pointer-move
  // handler that fires on every pointer-move tick during an active drag
  // (dep array [scrollAdjustedTranslate.x, scrollAdjustedTranslate.y] per
  // @dnd-kit/core/dist/core.esm.js:3210-3243). This replaces handleDragOver
  // as the authoritative zone-compute site. Pointer derivation is
  // input-type-agnostic (active.rect.current.initial + delta) — see
  // _testComputeZoneFromDragMove above for details.
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { overId, zone } = _testComputeZoneFromDragMove(event);
    useDragStore.getState().setOver(overId, zone);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const zone = useDragStore.getState().activeZone;

    // CANCEL-03 (release outside any drop target): over is null -> just end().
    // CANCEL-04 (release on origin cell): over.id === active.id -> no moveCell,
    //   moveCell's own fromId===toId guard would no-op anyway (DND-05 regression
    //   lock), but short-circuit here avoids touching gridStore at all.
    if (over && active.id !== over.id && zone) {
      moveCell(String(active.id), String(over.id), zone);
    }
    useDragStore.getState().end();
  }, [moveCell]);

  const handleDragCancel = useCallback(() => {
    // CANCEL-03: drag was interrupted outside the canvas / by lost pointer capture.
    useDragStore.getState().end();
  }, []);

  // DRAG-02 — body cursor driven by dragStore.status. Inline style variant keeps
  // all changes in this file (no global CSS touched).
  const dragStatus = useDragStore((s) => s.status);
  useEffect(() => {
    if (dragStatus === 'dragging') {
      const prev = document.body.style.cursor;
      document.body.style.cursor = 'grabbing';
      return () => {
        document.body.style.cursor = prev;
      };
    }
  }, [dragStatus]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleResize = debounce((entries: ResizeObserverEntry[]) => {
      const { height, width } = entries[0].contentRect;
      const scaleByH = (height * 0.9) / CANVAS_H;
      const scaleByW = (width * 0.9) / CANVAS_W;
      setAutoFitScale(Math.min(scaleByH, scaleByW));
    }, 50);
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const finalScale = autoFitScale * zoom;

  const canvasBackground = backgroundMode === 'solid'
    ? backgroundColor
    : `linear-gradient(${GRADIENT_DIR_MAP[backgroundGradientDir]}, ${backgroundGradientFrom}, ${backgroundGradientTo})`;

  useEffect(() => {
    setCanvasScale(finalScale);
  }, [finalScale, setCanvasScale]);

  const handleBgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only deselect if the click target is the wrapper itself (D-12)
    if (e.target === e.currentTarget) {
      setSelectedNode(null);
      setPanModeNodeId(null);
      setSelectedOverlayId(null);
    }
  }, [setSelectedNode, setPanModeNodeId, setSelectedOverlayId]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 h-full items-start justify-center overflow-hidden"
      data-testid="canvas-container"
    >
      {/* Phase 28 gap-closure plan 28-12: MeasuringStrategy.Always on droppable.
          Upstream fix for DragOverlay-at-non-1x-scale drift (PITFALLS.md:461,
          dnd-kit issues #50/#205/#250/#393). Replaces the scaleCompensationModifier
          approach which was based on a false premise (see file comment in dndkit.ts). */}
      <DndContext
        sensors={sensors}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="relative group mt-8 flex-shrink-0"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${finalScale})`,
            transformOrigin: 'top center',
            background: canvasBackground,
          }}
          onClick={handleBgClick}
          data-testid="canvas-surface"
        >
          <GridNodeComponent id={rootId} />
          <OverlayLayer />
          {showSafeZone && <SafeZoneOverlay />}
        </div>
        {/* GHOST-06 — DragOverlay must be inside DndContext to subscribe to
            drag state. Mount site moved from EditorShell (CONTEXT.md D-18) to
            here; see 28-07-SUMMARY.md for the supersession rationale. */}
        <DragPreviewPortal />
      </DndContext>
    </div>
  );
});
