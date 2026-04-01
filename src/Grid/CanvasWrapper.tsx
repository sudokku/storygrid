import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { GridNodeComponent } from './GridNode';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
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

  useEffect(() => {
    setCanvasScale(finalScale);
  }, [finalScale, setCanvasScale]);

  const handleBgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only deselect if the click target is the wrapper itself (D-12)
    if (e.target === e.currentTarget) {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 h-full items-start justify-center overflow-hidden"
      data-testid="canvas-container"
    >
      <div
        className="relative group mt-8 flex-shrink-0"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${finalScale})`,
          transformOrigin: 'top center',
        }}
        onClick={handleBgClick}
        data-testid="canvas-surface"
      >
        <GridNodeComponent id={rootId} />
        {showSafeZone && <SafeZoneOverlay />}
      </div>
    </div>
  );
});
