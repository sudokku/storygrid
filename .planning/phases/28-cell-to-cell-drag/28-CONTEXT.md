# Phase 28: Cell-to-Cell Drag - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Phase 27 `src/dnd/` foundation into a fully working cell-to-cell drag-and-drop system on both desktop and touch. Remove ALL Phase 25 `@dnd-kit` wiring in this same phase — no parallel engines mounted simultaneously. After this phase, any leaf cell can be dragged and dropped onto any other leaf cell using a single `PointerSensor` engine.

Out of scope for this phase: ESC-to-cancel, snap-back animation, drag-start wobble, ghost opacity (80%), active/inactive zone icon styling, drop flash — those are Phase 29. Mobile haptics, MobileSheet auto-collapse, cross-device CSS (`touch-action`, `-webkit-touch-callout`, `user-select`, `contextmenu`) — those are Phase 30.

</domain>

<decisions>
## Implementation Decisions

### DndContext Host Component
- **D-01:** `DndContext` mounts in `CanvasWrapper.tsx` — same location as Phase 25. `DragPreviewPortal` (using `DragOverlay` which portals to `document.body`) sits inside `CanvasWrapper` as well. `MobileSheet` remains outside the DnD context; Phase 30 will use `dragStore.status` via selector to trigger auto-collapse independently.

### Drop Zone Icons
- **D-02:** Five drop zones use lucide-react directional arrow icons:
  - Center (swap): `Maximize2`
  - Top edge (insert above): `ArrowUp`
  - Bottom edge (insert below): `ArrowDown`
  - Left edge (insert left): `ArrowLeft`
  - Right edge (insert right): `ArrowRight`

### Phase 25 Removal (locked by DND-04)
- **D-03:** The following must be deleted in this phase (same PR — no parallel engines):
  - `DndContext`, `MouseSensor`, `TouchSensor` imports and instantiation from `CanvasWrapper.tsx`
  - `DragZoneRefContext` inline context from `CanvasWrapper.tsx`
  - `useDraggable`, `useDroppable`, `useDndMonitor` imports and all usage from `LeafNode.tsx`
  - All five inline zone JSX blocks from `LeafNode.tsx`
  - Verification: `grep -r 'TouchSensor\|MouseSensor\|DragZoneRefContext\|useDndMonitor' src/` must return zero matches

### Locked Requirements (from REQUIREMENTS.md)
All of the following are pre-decided and must not be re-litigated in planning:
- **DND-01**: Single `PointerSensor` only — no TouchSensor + MouseSensor
- **DND-02**: Ephemeral drag state in separate vanilla Zustand `dragStore` (built in Phase 27)
- **DND-03**: All DnD code under `src/dnd/` (scaffolded in Phase 27)
- **DND-05**: `gridStore.moveCell` and tree primitives unchanged
- **DRAG-01**: `cursor: grab` on all leaf cells at all times (no gating)
- **DRAG-02**: `document.body` gains `cursor: grabbing` class while drag active
- **DRAG-03**: Touch activation: 250ms press-and-hold + 5px tolerance
- **DRAG-04**: Mouse activation: 8px pointer distance after mousedown
- **DRAG-07**: Entire cell body is drag-activation region — no dedicated handle
- **GHOST-01**: Ghost image via `canvas.toDataURL()` on drag-start, rendered as `<img>` (NOT `cloneNode`)
- **GHOST-02**: Ghost follows pointer with grab-point offset preserved (via `@dnd-kit/modifiers`)
- **GHOST-04**: Ghost renders at source-cell dimensions (no fixed cap)
- **GHOST-05**: Ghost contains artwork only — no ActionBar, handles, selection outline
- **GHOST-06**: Ghost renders via `DragOverlay` portal into viewport space (outside scaled canvas)
- **GHOST-07**: Source cell dims to 40% opacity during drag
- **DROP-01**: 5 zones tile the full cell with no dead space (computeDropZone from Phase 27)
- **DROP-04**: Hovered target cell gains 2px accent-color outline
- **DROP-05**: No insertion line on edge drops — icons alone convey intent
- **DROP-07**: Ghost stays under pointer — no magnetism
- **CANCEL-03**: Release outside `GridCanvas` element → cancel (no moveCell call)
- **CANCEL-04**: Release on origin cell → no-op, no undo entry (handled by moveCell early-return guard)
- **CROSS-01**: Single pointer-event stream drives desktop and touch

### Claude's Discretion
- Ghost canvas capture approach: the cell doesn't have a `<canvas>` element; Claude should use an offscreen canvas (draw img/video frame to `OffscreenCanvas` or a hidden `<canvas>`) and call `.toDataURL()` on it. Pick the approach that works reliably for both image and video cells.
- `data-dnd-ignore="true"` placement on `Divider.tsx` and `OverlayLayer.tsx` root — implementation detail.
- `canDrag` guard implementation in `useCellDraggable` to prevent PointerSensor from consuming native HTML5 file-drop events (`dataTransfer.types.includes('Files')` check approach).
- PointerSensor dual-constraint implementation (touch 250ms/5px + mouse 8px) — use two separate `PointerSensor` useSensor calls or a custom constraint resolver, whichever dnd-kit supports cleanly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.5 Milestone Requirements
- `.planning/REQUIREMENTS.md` — Full DND-*, DRAG-*, GHOST-*, DROP-*, CANCEL-*, CROSS-* requirement definitions for v1.5
- `.planning/milestones/v1.5-ROADMAP.md` — Phase 28 details section: complete implementation spec including all file changes, guard conditions, and success criteria

### Phase 27 Foundation
- `.planning/phases/27-dnd-foundation/27-VERIFICATION.md` — What Phase 27 delivered (computeDropZone, dragStore, hook stubs, file structure)
- `src/dnd/index.ts` — Public API barrel; all Phase 28 wiring imports from here
- `src/dnd/computeDropZone.ts` — Pure 5-zone function already tested and ready
- `src/dnd/dragStore.ts` — Vanilla Zustand store with beginCellDrag / setOver / end
- `src/dnd/useCellDraggable.ts` — Stub with Pitfall 1 warning doc (spread listeners LAST)
- `src/dnd/useCellDropTarget.ts` — Stub with Pitfall 2 warning doc (single event source)
- `src/dnd/DragPreviewPortal.tsx` — Stub to be implemented
- `src/dnd/DropZoneIndicators.tsx` — Stub to be implemented

### Phase 25 Code to Remove
- `src/Grid/CanvasWrapper.tsx` — Contains Phase 25 DndContext, MouseSensor, TouchSensor, DragZoneRefContext (all must be deleted)
- `src/Grid/LeafNode.tsx` — Contains Phase 25 useDraggable, useDroppable, useDndMonitor, zone JSX blocks (all must be deleted)

### Anti-Pattern Guards
- `.planning/research/PITFALLS.md` — Critical pitfalls including Pitfall 1 (JSX prop-order collision) and Pitfall 2 (parallel pointer event sources); both cause Phase 25-style failures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/dnd/computeDropZone.ts`: Pure function ready — `computeDropZone(rect, pointer)` → zone. No changes needed.
- `src/dnd/dragStore.ts`: Vanilla Zustand store ready — `beginCellDrag`, `setOver`, `end` actions exist.
- `src/store/gridStore.ts` lines 473-494: `moveCell` no-op guards are untouched from Phase 27; safe to call on drop commit.
- `lucide-react`: Already installed. `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Maximize2` are the chosen icons.
- `@dnd-kit/modifiers`: Installed in Phase 27 for scale-compensation modifier.

### Established Patterns
- `src/Grid/CanvasWrapper.tsx`: Currently hosts DndContext — new engine replaces Phase 25 wiring in-place.
- `src/Grid/LeafNode.tsx`: Handles native HTML5 file drop via `onDragOver` + `onDrop` — must be preserved, guarded with `dataTransfer.types.includes('Files')`.
- Zustand selectors: `useDragStore(s => s.sourceId === id && s.status === 'dragging')` pattern for per-cell opacity.
- `src/Grid/OverlayLayer.tsx` + `src/Grid/Divider.tsx`: Need `data-dnd-ignore="true"` attribute to prevent drag activation on divider handles and overlay text.

### Integration Points
- `CanvasWrapper.tsx` → new `DndContext` with single `PointerSensor` + `onDragEnd` handler
- `LeafNode.tsx` → wired to `useCellDraggable` + `useCellDropTarget` from `src/dnd/`; `DropZoneIndicators` rendered conditionally when `dragStore.overId === id`
- `EditorShell.tsx` → no changes (DndContext stays in CanvasWrapper)
- `MobileSheet.tsx` → no changes in Phase 28 (auto-collapse deferred to Phase 30)

</code_context>

<specifics>
## Specific Ideas

- Icon layout confirmed: `ArrowUp / ArrowDown / ArrowLeft / ArrowRight` for edges, `Maximize2` for center swap.
- DndContext in `CanvasWrapper.tsx` (not EditorShell) — user explicitly chose this layout.
- Phase 30 will use `dragStore.status` selector directly from `MobileSheet.tsx` without needing to be inside the DndContext tree (vanilla store, accessible anywhere).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-cell-to-cell-drag*
*Context gathered: 2026-04-18*
