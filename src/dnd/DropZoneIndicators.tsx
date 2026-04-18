/**
 * 5-icon drop-zone overlay (REQ: DROP-01, DROP-02, DROP-03).
 *
 * Renders center/top/right/bottom/left icon zones that tile a LeafNode.
 * CRITICAL: overlay elements MUST be `pointer-events: none` so they
 * cannot intercept drop events (ARCHITECTURE.md §6 z-index map; current
 * LeafNode lines 724-755 follow this rule in the Phase 25 implementation).
 *
 * Phase 27 ships this as a skeleton that renders null; Phase 28 implements
 * the 5-icon layout driven by dragStore.overId / dragStore.activeZone, and
 * Phase 29 adds active vs inactive styling.
 */

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
import { useDragStore } from './dragStore';

export interface DropZoneIndicatorsProps {
  cellId: string;
  canvasScale: number;
}

export function DropZoneIndicators({ cellId, canvasScale }: DropZoneIndicatorsProps) {
  const activeZone = useDragStore((s) => (s.overId === cellId ? s.activeZone : null));
  const iconSize = 32 / Math.max(canvasScale, 0.0001);
  const activeClass = 'text-white';
  const inactiveClass = 'text-white/30';

  return (
    <>
      {/* Top edge — insert above */}
      <div
        className="absolute top-0 inset-x-0 h-[20%] flex items-center justify-center pointer-events-none z-20"
        aria-label="Insert above"
        data-testid={`zone-top-${cellId}`}
      >
        <ArrowUp size={iconSize} className={activeZone === 'top' ? activeClass : inactiveClass} />
      </div>
      {/* Bottom edge — insert below */}
      <div
        className="absolute bottom-0 inset-x-0 h-[20%] flex items-center justify-center pointer-events-none z-20"
        aria-label="Insert below"
        data-testid={`zone-bottom-${cellId}`}
      >
        <ArrowDown size={iconSize} className={activeZone === 'bottom' ? activeClass : inactiveClass} />
      </div>
      {/* Left edge — insert left */}
      <div
        className="absolute left-0 inset-y-0 w-[20%] flex items-center justify-center pointer-events-none z-20"
        aria-label="Insert to the left"
        data-testid={`zone-left-${cellId}`}
      >
        <ArrowLeft size={iconSize} className={activeZone === 'left' ? activeClass : inactiveClass} />
      </div>
      {/* Right edge — insert right */}
      <div
        className="absolute right-0 inset-y-0 w-[20%] flex items-center justify-center pointer-events-none z-20"
        aria-label="Insert to the right"
        data-testid={`zone-right-${cellId}`}
      >
        <ArrowRight size={iconSize} className={activeZone === 'right' ? activeClass : inactiveClass} />
      </div>
      {/* Center — swap */}
      <div
        className="absolute inset-[20%] flex items-center justify-center pointer-events-none z-20"
        aria-label="Swap with this cell"
        data-testid={`zone-center-${cellId}`}
      >
        <Maximize2 size={iconSize} className={activeZone === 'center' ? activeClass : inactiveClass} />
      </div>
    </>
  );
}
