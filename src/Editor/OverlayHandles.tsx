import React, { useRef } from 'react';
import type { Overlay } from '../types';

export interface OverlayHandlesProps {
  overlay: Overlay;
  canvasScale: number;
  onUpdate: (updates: Partial<Overlay>) => void;
}

type DragState = {
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type ResizeState = {
  startClientX: number;
  startClientY: number;
  startWidth: number;
};

type RotateState = {
  centerViewportX: number;
  centerViewportY: number;
};

export function OverlayHandles({ overlay, canvasScale, onUpdate }: OverlayHandlesProps) {
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const rotateStateRef = useRef<RotateState | null>(null);

  // ----------------------------------------------------------------
  // Drag body: moves the overlay by converting viewport delta to canvas delta
  // ----------------------------------------------------------------
  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    dragStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: overlay.x,
      startY: overlay.y,
    };
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current === null) return;
    const { startClientX, startClientY, startX, startY } = dragStateRef.current;
    const deltaViewportX = e.clientX - startClientX;
    const deltaViewportY = e.clientY - startClientY;
    const deltaCanvasX = deltaViewportX / canvasScale;
    const deltaCanvasY = deltaViewportY / canvasScale;
    onUpdate({ x: startX + deltaCanvasX, y: startY + deltaCanvasY });
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragStateRef.current = null;
  };

  // ----------------------------------------------------------------
  // Corner resize handle: proportional width resize via hypot distance
  // ----------------------------------------------------------------
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    resizeStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: overlay.width,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current === null) return;
    const { startClientX, startClientY, startWidth } = resizeStateRef.current;
    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;
    const viewportDelta = Math.hypot(dx, dy) * Math.sign(dx + dy);
    const canvasDelta = viewportDelta / canvasScale;
    const newWidth = Math.max(40, startWidth + canvasDelta);
    onUpdate({ width: newWidth });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    resizeStateRef.current = null;
  };

  // ----------------------------------------------------------------
  // Rotation handle: computes angle from overlay center to pointer position
  // ----------------------------------------------------------------
  const handleRotatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    // Find canvas-surface to compute overlay center in viewport coordinates.
    // overlay.x and overlay.y are VISUAL CENTER in canvas pixel space (D-08).
    const canvasSurface = e.currentTarget.closest('[data-testid="canvas-surface"]') as HTMLElement | null;
    let centerViewportX = overlay.x * canvasScale;
    let centerViewportY = overlay.y * canvasScale;
    if (canvasSurface) {
      const rect = canvasSurface.getBoundingClientRect();
      centerViewportX = overlay.x * canvasScale + rect.left;
      centerViewportY = overlay.y * canvasScale + rect.top;
    }
    rotateStateRef.current = { centerViewportX, centerViewportY };
  };

  const handleRotatePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rotateStateRef.current === null) return;
    const { centerViewportX, centerViewportY } = rotateStateRef.current;
    const angleRad = Math.atan2(e.clientY - centerViewportY, e.clientX - centerViewportX);
    const angleDeg = angleRad * (180 / Math.PI);
    // +90 offset: handle sits at 12 o'clock position (-90° in atan2 convention)
    onUpdate({ rotation: angleDeg + 90 });
  };

  const handleRotatePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    rotateStateRef.current = null;
  };

  const handleScale = 1 / canvasScale;

  return (
    <>
      {/* Drag body: covers full overlay area */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          cursor: 'move',
          pointerEvents: 'auto',
        }}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      />

      {/* Corner resize handle: bottom-right */}
      <div
        data-testid="overlay-resize-handle"
        style={{
          position: 'absolute',
          right: -6,
          bottom: -6,
          width: 12,
          height: 12,
          background: '#ffffff',
          border: '1px solid #3b82f6',
          cursor: 'nwse-resize',
          pointerEvents: 'auto',
          transform: `scale(${handleScale})`,
          transformOrigin: 'center',
        }}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
      />

      {/* Rotation handle: above top center */}
      <div
        data-testid="overlay-rotate-handle"
        style={{
          position: 'absolute',
          top: -24,
          left: '50%',
          width: 12,
          height: 12,
          background: '#f59e0b',
          border: '1px solid #d97706',
          borderRadius: '50%',
          cursor: 'grab',
          pointerEvents: 'auto',
          transform: `translateX(-50%) scale(${handleScale})`,
          transformOrigin: 'center',
        }}
        onPointerDown={handleRotatePointerDown}
        onPointerMove={handleRotatePointerMove}
        onPointerUp={handleRotatePointerUp}
      />
    </>
  );
}
