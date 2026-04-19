import React, { useRef, useCallback } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { SplitDirection } from '../types';

interface DividerProps {
  containerId: string;
  siblingIndex: number;
  direction: SplitDirection;
  sizes: number[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onLocalSizesChange: (sizes: number[] | null) => void;
}

export const Divider = React.memo(function Divider({
  containerId,
  siblingIndex,
  direction,
  sizes,
  containerRef,
  onLocalSizesChange,
}: DividerProps) {
  const resize = useGridStore(s => s.resize);
  const canvasScale = useEditorStore(s => s.canvasScale);

  const dragState = useRef<{
    startPos: number;
    startSizes: number[];
  } | null>(null);
  const lastSizesRef = useRef<number[] | null>(null);

  const isVerticalContainer = direction === 'vertical';
  // vertical container = children stacked vertically = HORIZONTAL divider = row-resize cursor
  // horizontal container = children side by side = VERTICAL divider = col-resize cursor
  const cursorClass = isVerticalContainer ? 'cursor-row-resize' : 'cursor-col-resize';

  const computeNewSizes = useCallback((startSizes: number[], index: number, weightDelta: number): number[] => {
    const newSizes = [...startSizes];
    newSizes[index] += weightDelta;
    newSizes[index + 1] -= weightDelta;
    // Clamp to MIN_CELL_WEIGHT = 0.1
    if (newSizes[index] < 0.1) {
      const excess = 0.1 - newSizes[index];
      newSizes[index] = 0.1;
      newSizes[index + 1] -= excess;
    }
    if (newSizes[index + 1] < 0.1) {
      const excess = 0.1 - newSizes[index + 1];
      newSizes[index + 1] = 0.1;
      newSizes[index] -= excess;
    }
    return newSizes;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragState.current = {
      startPos: isVerticalContainer ? e.clientY : e.clientX,
      startSizes: [...sizes],
    };
  }, [isVerticalContainer, sizes]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || !containerRef.current) return;
    const pixelDelta = isVerticalContainer
      ? e.clientY - dragState.current.startPos
      : e.clientX - dragState.current.startPos;
    const containerPixels = isVerticalContainer
      ? containerRef.current.offsetHeight
      : containerRef.current.offsetWidth;
    const totalWeight = dragState.current.startSizes.reduce((a, b) => a + b, 0);
    // clientX/Y is in viewport pixels; offsetHeight/Width is in unscaled layout pixels.
    // Divide by canvasScale to convert viewport delta → layout delta.
    const weightDelta = (pixelDelta / canvasScale / containerPixels) * totalWeight;
    const newSizes = computeNewSizes(dragState.current.startSizes, siblingIndex, weightDelta);
    lastSizesRef.current = newSizes;
    onLocalSizesChange(newSizes);
  }, [isVerticalContainer, containerRef, siblingIndex, computeNewSizes, onLocalSizesChange, canvasScale]);

  const handlePointerUp = useCallback(() => {
    const lastSizes = lastSizesRef.current;
    if (lastSizes && dragState.current) {
      const finalDelta = lastSizes[siblingIndex] - dragState.current.startSizes[siblingIndex];
      if (Math.abs(finalDelta) > 0.001) {
        resize(containerId, siblingIndex, finalDelta);
      }
    }
    lastSizesRef.current = null;
    dragState.current = null;
    onLocalSizesChange(null);
  }, [containerId, siblingIndex, resize, onLocalSizesChange]);

  return (
    <div
      className={`
        relative flex-shrink-0 ${cursorClass}
        ${isVerticalContainer ? 'h-0 w-full' : 'w-0 h-full'}
      `}
      data-testid={`divider-${containerId}-${siblingIndex}`}
      data-dnd-ignore="true"
    >
      {/* Hit area: 8px wide transparent zone */}
      <div
        className={`
          group/hit absolute z-10
          ${isVerticalContainer
            ? '-top-[20px] left-0 right-0 h-[40px]'
            : '-left-[20px] top-0 bottom-0 w-[40px]'
          }
          ${cursorClass}
        `}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid={`divider-hit-${containerId}-${siblingIndex}`}
        data-dnd-ignore="true"
      >
        {/* Visible 2px line — hidden until canvas hovered (group-hover) */}
        <div
          className={`
            absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ${isVerticalContainer
              ? 'top-[10px] left-0 right-0 h-[2px] bg-[#444444]'
              : 'left-[10px] top-0 bottom-0 w-[2px] bg-[#444444]'
            }
          `}
        />
        {/* Grab handle — appears on this specific divider hover, scaled to constant visual size */}
        <div
          className={`
            absolute opacity-0 group-hover/hit:opacity-100 transition-opacity duration-150
            ${isVerticalContainer
              ? 'top-[8px] left-1/2 -translate-x-1/2 w-[24px] h-[6px] rounded-full bg-[#888888]'
              : 'left-[8px] top-1/2 -translate-y-1/2 h-[24px] w-[6px] rounded-full bg-[#888888]'
            }
          `}
          style={{ transform: `${isVerticalContainer ? 'translateX(-50%)' : 'translateY(-50%)'} scale(${1 / canvasScale})` }}
        />
      </div>
    </div>
  );
});
