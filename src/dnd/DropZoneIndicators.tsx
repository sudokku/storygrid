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

export function DropZoneIndicators(): null {
  return null;
}
