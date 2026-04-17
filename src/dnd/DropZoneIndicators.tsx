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

import { ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import type { DropZone } from './dragStore';

interface Props {
  /**
   * D-12: zone the pointer is currently in. In Phase 28 this is NOT used
   * for visual differentiation (D-15 — all 5 icons render in the same
   * base state). Phase 29 wires DROP-02/03 active/inactive styling off
   * this value.
   */
  zone: DropZone | null;
}

export function DropZoneIndicators({ zone: _zone }: Props) {
  const canvasScale = useEditorStore((s) => s.canvasScale);
  const iconSize = 32 / canvasScale;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      data-testid="drop-zones"
    >
      {/* Center — ~60% inset — swap indicator (DROP-01 center zone) */}
      <div
        className="absolute inset-[20%] flex items-center justify-center pointer-events-none"
        data-testid="drop-zone-center"
      >
        <ArrowLeftRight size={iconSize} className="text-white" />
      </div>

      {/* Top band — 20% height (D-13 matches computeDropZone's proportional threshold) */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{ height: '20%' }}
        data-testid="drop-zone-top"
      >
        <ArrowUp size={iconSize} className="text-white" />
      </div>

      {/* Bottom band */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{ height: '20%' }}
        data-testid="drop-zone-bottom"
      >
        <ArrowDown size={iconSize} className="text-white" />
      </div>

      {/* Left band */}
      <div
        className="absolute top-0 bottom-0 left-0 flex items-center justify-center pointer-events-none"
        style={{ width: '20%' }}
        data-testid="drop-zone-left"
      >
        <ArrowLeft size={iconSize} className="text-white" />
      </div>

      {/* Right band */}
      <div
        className="absolute top-0 bottom-0 right-0 flex items-center justify-center pointer-events-none"
        style={{ width: '20%' }}
        data-testid="drop-zone-right"
      >
        <ArrowRight size={iconSize} className="text-white" />
      </div>
    </div>
  );
}
