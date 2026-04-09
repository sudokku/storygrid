import type { Overlay } from '../types';

export interface OverlayHandlesProps {
  overlay: Overlay;
  canvasScale: number;
  onUpdate: (updates: Partial<Overlay>) => void;
}

// Stub — full drag/resize/rotate implementation added in Task 2 of Plan 13-02.
export function OverlayHandles(_props: OverlayHandlesProps): null {
  return null;
}
