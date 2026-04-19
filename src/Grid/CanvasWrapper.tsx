import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { useShallow } from 'zustand/react/shallow';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { GridNodeComponent } from './GridNode';
import { OverlayLayer } from './OverlayLayer';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core';
import { useDragStore, computeDropZone, DragPreviewPortal } from '../dnd';

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

  const moveCell = useGridStore(s => s.moveCell);

  // DRAG-03 + DRAG-04 + DND-01: single PointerSensor engine; two configs registered so
  // the touch (delay/tolerance) constraint and mouse (distance) constraint can both apply.
  // dnd-kit evaluates sensors in registration order and the first to satisfy its constraint wins.
  // 500ms hold activates drag without requiring pointer movement (UX: hold-to-drag).
  // Tolerance 8px allows minor hand tremor; the distance sensor remains as a fallback
  // so a deliberate quick flick (≥8px) still works.
  const touchSensor = useSensor(PointerSensor, {
    activationConstraint: { delay: 500, tolerance: 8 },
  });
  const mouseSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  // CANCEL-01 / D-06: KeyboardSensor enables ESC to cancel an active pointer drag.
  // This does NOT violate DND-01 — DND-01 forbids TouchSensor+MouseSensor combo;
  // KeyboardSensor serves a separate purpose (cancel gesture only).
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(touchSensor, mouseSensor, keyboardSensor);

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    // active.node does not exist in dnd-kit v6.3.1 — query via data-testid instead.
    const node = document.querySelector(`[data-testid="leaf-${String(active.id)}"]`) as HTMLElement | null;
    if (!node || node.closest('[data-dnd-ignore="true"]')) {
      return;
    }
    const sourceId = String(active.id);
    // GHOST-01: capture ghost from the cell's <canvas> element.
    const canvas = node.querySelector('canvas') as HTMLCanvasElement | null;
    let ghostUrl: string | null = null;
    try {
      ghostUrl = canvas?.toDataURL('image/png') ?? null;
    } catch {
      ghostUrl = null; // tainted canvas safety; should not occur for local media
    }
    // GHOST-04: ghost dimensions = source cell viewport rect (no cap).
    const rect = node.getBoundingClientRect();
    useDragStore.getState().beginCellDrag(sourceId, ghostUrl, rect.width, rect.height);
    // DRAG-02: body cursor → grabbing.
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragMove = useCallback(({ over, activatorEvent, delta }: DragMoveEvent) => {
    if (!over) {
      useDragStore.getState().setOver(null, null);
      return;
    }
    // PITFALL 2: zone coords come ONLY from this callback's args — no parallel listener.
    const rect = over.rect as unknown as DOMRect;
    const ev = activatorEvent as PointerEvent;
    const pointer = { x: ev.clientX + delta.x, y: ev.clientY + delta.y };
    const zone = computeDropZone(rect, pointer);
    useDragStore.getState().setOver(String(over.id), zone);
  }, []);

  const handleDragEnd = useCallback(({ over }: DragEndEvent) => {
    const { sourceId, activeZone } = useDragStore.getState();
    // Guard: drag was aborted at start (e.g., dnd-ignore) — no move, just cleanup.
    if (!sourceId) {
      useDragStore.getState().end();
      document.body.style.cursor = '';
      return;
    }
    // CANCEL-03: released outside any drop target → cancel with no move.
    if (!over) {
      useDragStore.getState().end();
      document.body.style.cursor = '';
      return;
    }
    const toId = String(over.id);
    // CANCEL-04: dropped on origin cell → no move, no undo entry.
    if (toId === sourceId) {
      useDragStore.getState().end();
      document.body.style.cursor = '';
      return;
    }
    moveCell(sourceId, toId, activeZone ?? 'center');
    // D-08: end() first, then setLastDrop() — end() resets all fields including
    // lastDropId. Calling setLastDrop after end() keeps lastDropId populated for
    // the 700ms timeout while all other drag state is cleared.
    useDragStore.getState().end();
    useDragStore.getState().setLastDrop(toId);
    document.body.style.cursor = '';
    // Clear the flash after 700ms (DROP-08 Atlassian largeDurationMs).
    setTimeout(() => useDragStore.getState().clearLastDrop(), 700);
  }, [moveCell]);

  const handleDragCancel = useCallback(() => {
    useDragStore.getState().end();
    document.body.style.cursor = '';
  }, []);

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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
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
          id="grid-canvas"
        >
          <GridNodeComponent id={rootId} />
          <OverlayLayer />
          {showSafeZone && <SafeZoneOverlay />}
        </div>
        <DragPreviewPortal />
      </DndContext>
    </div>
  );
});
