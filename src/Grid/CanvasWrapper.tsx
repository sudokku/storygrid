import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { useShallow } from 'zustand/react/shallow';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { GridNodeComponent } from './GridNode';
import { OverlayLayer } from './OverlayLayer';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';

// Shared ref context so LeafNode useDndMonitor callbacks can write the active zone
// and CanvasWrapper's onDragEnd can read it when a drop completes.
export const DragZoneRefContext = React.createContext<React.MutableRefObject<'center' | 'top' | 'bottom' | 'left' | 'right'> | null>(null);

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

  // Phase 25: unified sensor config — MouseSensor for desktop, TouchSensor for mobile
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // Shared ref written by LeafNode useDndMonitor, read by onDragEnd
  const activeZoneRef = useRef<'center' | 'top' | 'bottom' | 'left' | 'right'>('center');
  const moveCell = useGridStore(s => s.moveCell);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    moveCell(String(active.id), String(over.id), activeZoneRef.current);
    activeZoneRef.current = 'center';
  }, [moveCell]);

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
      <DragZoneRefContext.Provider value={activeZoneRef}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
        </DndContext>
      </DragZoneRefContext.Provider>
    </div>
  );
});
