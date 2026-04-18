# Phase 28: Cell-to-Cell Drag - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 8 (4 implement-from-stub, 2 wiring changes, 2 minor attribute additions)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/dnd/useCellDraggable.ts` | hook | event-driven | `src/Grid/LeafNode.tsx` lines 313-328 (Phase 25 `useDraggable`) | role-match |
| `src/dnd/useCellDropTarget.ts` | hook | event-driven | `src/Grid/LeafNode.tsx` lines 320-321 (Phase 25 `useDroppable`) | role-match |
| `src/dnd/DragPreviewPortal.tsx` | component | event-driven | `src/Grid/OverlayLayer.tsx` (portal-like rendering into canvas space) | partial-match |
| `src/dnd/DropZoneIndicators.tsx` | component | event-driven | `src/Grid/LeafNode.tsx` lines 719-756 (Phase 25 zone JSX to replace) | exact |
| `src/Grid/CanvasWrapper.tsx` | component/provider | request-response | `src/Grid/CanvasWrapper.tsx` itself (replace Phase 25 wiring in-place) | exact |
| `src/Grid/LeafNode.tsx` | component | event-driven | `src/Grid/LeafNode.tsx` itself (remove Phase 25, wire Phase 28 hooks) | exact |
| `src/Grid/Divider.tsx` | component | event-driven | `src/Grid/OverlayLayer.tsx` root div (pointer-events-none pattern) | role-match |
| `src/Grid/OverlayLayer.tsx` | component | event-driven | self — add attribute to existing root div | exact |

---

## Pattern Assignments

### `src/dnd/useCellDraggable.ts` (hook, event-driven)

**Analog:** `src/Grid/LeafNode.tsx` lines 313-328 — Phase 25 `useDraggable` call and Phase 25 merge-ref pattern

**Imports pattern to use** (replace stub imports):
```typescript
import { useDraggable } from '@dnd-kit/core';
import { useDragStore } from './dragStore';
```

**Core pattern — Phase 25 useDraggable call** (`src/Grid/LeafNode.tsx` lines 313-318):
```typescript
const {
  setNodeRef: setDragNodeRef,
  listeners: dragListeners,
  isDragging,
  attributes: dragAttributes,
} = useDraggable({ id, data: { nodeId: id } });
```

**New Phase 28 pattern — PointerSensor dual-constraint, beginCellDrag + ghost capture on drag-start:**
The stub's Phase 28 impl must:
1. Call `useDraggable({ id: leafId })` from `@dnd-kit/core`
2. Return `{ attributes, listeners, isDragging, setNodeRef }` shaped to `UseCellDraggableResult`
3. The actual `beginCellDrag(leafId)` and ghost `toDataURL()` capture happen in `CanvasWrapper.tsx`'s `onDragStart` callback (not inside this hook), because `onDragStart` receives the dragged element's rect via `active.rect.current.initial`

**Ghost capture approach** (Claude's Discretion from CONTEXT.md):
Use `canvasRef` from `LeafNode` — the leaf already maintains a `<canvas>` element at `canvasRef` (`src/Grid/LeafNode.tsx` lines 64, 681-687). Call `canvasRef.current.toDataURL('image/png')` directly. Pass `canvasRef` into `useCellDraggable` OR capture it in `CanvasWrapper.onDragStart` by reading `active.node.current.querySelector('canvas')`. The simplest approach: expose a `captureGhost(): string | null` function from `useCellDraggable` that reads `canvasRef.current?.toDataURL()`.

**PITFALL 1 guard** — spread listeners LAST at the call site (`src/Grid/LeafNode.tsx` line 663):
```tsx
// CORRECT — listeners spread AFTER all explicit handlers
{...(!isPanMode ? dragListeners : {})}
```

**isDragging → dragStore.beginCellDrag bridge:**
`isDragging` from `useDraggable` changes when @dnd-kit internally activates. The Phase 28 design stores drag state in `dragStore` — `beginCellDrag` is called from `CanvasWrapper.onDragStart`, not from this hook's local `isDragging` effect. This hook's `isDragging` is used only for the source-cell opacity (40% dim, GHOST-07).

**dragStore selector pattern** (from `src/dnd/dragStore.ts` and CONTEXT.md):
```typescript
// Per-cell opacity: read only this cell's source status
const isSourceBeingDragged = useDragStore(s => s.sourceId === leafId && s.status === 'dragging');
```

---

### `src/dnd/useCellDropTarget.ts` (hook, event-driven)

**Analog:** `src/Grid/LeafNode.tsx` lines 320-321 — Phase 25 `useDroppable`

**Imports pattern to use:**
```typescript
import { useDroppable } from '@dnd-kit/core';
import { useDragStore } from './dragStore';
import { computeDropZone } from './computeDropZone';
```

**Core pattern — Phase 25 useDroppable call** (`src/Grid/LeafNode.tsx` line 320-321):
```typescript
const { setNodeRef: setDropNodeRef } = useDroppable({ id, data: { nodeId: id } });
```

**New Phase 28 pattern:**
`useDroppable` from @dnd-kit fires `onDragMove` (via `DndContext.onDragMove`) when pointer is over the droppable. The zone computation must use pointer coords from dnd-kit's own callback argument (PITFALL 2 guard — no parallel document `pointermove` listener).

The `setOver(leafId, zone)` call goes in `CanvasWrapper.tsx`'s `onDragMove` callback:
```typescript
// CanvasWrapper onDragMove — single event source, PITFALL 2 prevention
const handleDragMove = useCallback(({ over, activatorEvent, delta }: DragMoveEvent) => {
  if (!over) { useDragStore.getState().setOver(null, null); return; }
  const el = over.rect; // DOMRect in viewport space (post-transform, correct)
  const pointer = { x: activatorEvent.clientX + delta.x, y: activatorEvent.clientY + delta.y };
  const zone = computeDropZone(el, pointer);
  useDragStore.getState().setOver(String(over.id), zone);
}, []);
```

**isOver derivation** — use `useDragStore` selector, not `useDroppable`'s own `isOver`:
```typescript
const isOver = useDragStore(s => s.overId === leafId);
```

---

### `src/dnd/DragPreviewPortal.tsx` (component, event-driven)

**Analog:** No direct analog (first DragOverlay usage in codebase). The comment block in the stub references @dnd-kit/core's `DragOverlay`. Pattern from @dnd-kit docs + `CanvasWrapper.tsx` structure.

**Imports pattern** (modeled on CanvasWrapper import style, `src/Grid/CanvasWrapper.tsx` lines 8-16):
```typescript
import { DragOverlay } from '@dnd-kit/core';
import { useDragStore } from './dragStore';
```

**Core pattern — DragOverlay with ghost img:**
```tsx
export function DragPreviewPortal() {
  const ghostUrl = useDragStore(s => s.ghostUrl);   // field to add to dragStore
  const sourceW = useDragStore(s => s.sourceW);
  const sourceH = useDragStore(s => s.sourceH);
  const isDragging = useDragStore(s => s.status === 'dragging');

  return (
    <DragOverlay>
      {isDragging && ghostUrl ? (
        <img
          src={ghostUrl}
          width={sourceW}
          height={sourceH}
          style={{ opacity: 0.8, display: 'block', pointerEvents: 'none' }}
          alt=""
          draggable={false}
        />
      ) : null}
    </DragOverlay>
  );
}
```

`DragOverlay` portals into `document.body` automatically — no manual `createPortal` needed. It must be placed INSIDE the `<DndContext>` tree in `CanvasWrapper.tsx` (same location as the Phase 25 wiring).

**Scale modifier** — `@dnd-kit/modifiers` is installed (Phase 27). The ghost renders in viewport space (outside the `transform: scale(finalScale)` canvas), so no scale modifier is needed on the ghost itself. The ghost's `width/height` should be the cell's CSS pixel dimensions (from `getBoundingClientRect().width / height`), not the canvas's 1080-unit dimensions.

---

### `src/dnd/DropZoneIndicators.tsx` (component, event-driven)

**Analog:** `src/Grid/LeafNode.tsx` lines 714-756 — Phase 25 five-zone JSX blocks (exact content to replace/improve)

**Phase 25 pattern to replace** (`src/Grid/LeafNode.tsx` lines 719-756):
```tsx
{activeZone === 'top' && (
  <div
    data-testid={`edge-line-top-${id}`}
    className="absolute pointer-events-none z-20"
    style={{ top: 0, left: 0, right: 0, height: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }}
  />
)}
// ... (4 more zones)
{activeZone === 'center' && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" ...>
    <ArrowLeftRight size={32 / canvasScale} className="text-white" />
  </div>
)}
```

**New Phase 28 pattern** — lucide-react icon imports (from `src/Grid/ActionBar.tsx` lines 6-21):
```tsx
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
```

**Icon size pattern** — scale-stable sizing (from Phase 25 `ArrowLeftRight` usage, `src/Grid/LeafNode.tsx` line 754):
```tsx
size={32 / canvasScale}
```

**Component signature** (props needed):
```tsx
interface DropZoneIndicatorsProps {
  cellId: string;
  canvasScale: number;
}

export function DropZoneIndicators({ cellId, canvasScale }: DropZoneIndicatorsProps) {
  const activeZone = useDragStore(s => s.overId === cellId ? s.activeZone : null);
  // render 5 zones
}
```

**5-zone layout** (from UI-SPEC.md table):
```tsx
{/* Top — insert above */}
<div className="absolute top-0 inset-x-0 h-[20%] flex items-center justify-center pointer-events-none z-20"
     aria-label="Insert above">
  <ArrowUp size={32 / canvasScale} className={activeZone === 'top' ? 'text-white' : 'text-white/30'} />
</div>
{/* Bottom — insert below */}
<div className="absolute bottom-0 inset-x-0 h-[20%] flex items-center justify-center pointer-events-none z-20"
     aria-label="Insert below">
  <ArrowDown size={32 / canvasScale} className={activeZone === 'bottom' ? 'text-white' : 'text-white/30'} />
</div>
{/* Left — insert left */}
<div className="absolute left-0 inset-y-0 w-[20%] flex items-center justify-center pointer-events-none z-20"
     aria-label="Insert to the left">
  <ArrowLeft size={32 / canvasScale} className={activeZone === 'left' ? 'text-white' : 'text-white/30'} />
</div>
{/* Right — insert right */}
<div className="absolute right-0 inset-y-0 w-[20%] flex items-center justify-center pointer-events-none z-20"
     aria-label="Insert to the right">
  <ArrowRight size={32 / canvasScale} className={activeZone === 'right' ? 'text-white' : 'text-white/30'} />
</div>
{/* Center — swap */}
<div className="absolute inset-[20%] flex items-center justify-center pointer-events-none z-20"
     aria-label="Swap with this cell">
  <Maximize2 size={32 / canvasScale} className={activeZone === 'center' ? 'text-white' : 'text-white/30'} />
</div>
```

**Drop target outline** — applied to `LeafNode`'s root div (not inside `DropZoneIndicators`) via `useDragStore` selector:
```tsx
// In LeafNode.tsx root div className:
const isDropTarget = useDragStore(s => s.overId === id);
// ring-2 ring-primary ring-inset applied when isDropTarget && !isSource
```

---

### `src/Grid/CanvasWrapper.tsx` (component/provider, request-response)

**Analog:** `src/Grid/CanvasWrapper.tsx` itself — replace Phase 25 sensor/context wiring in-place

**Phase 25 imports to DELETE** (`src/Grid/CanvasWrapper.tsx` lines 9-16):
```typescript
// DELETE ALL OF:
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
```

**Phase 25 context to DELETE** (`src/Grid/CanvasWrapper.tsx` line 20):
```typescript
// DELETE:
export const DragZoneRefContext = React.createContext<...>(null);
```

**Phase 25 sensor block to DELETE** (`src/Grid/CanvasWrapper.tsx` lines 61-69):
```typescript
// DELETE:
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(KeyboardSensor),
);
const activeZoneRef = useRef<...>('center');
```

**Phase 25 handleDragEnd to DELETE** (`src/Grid/CanvasWrapper.tsx` lines 75-79):
```typescript
// DELETE:
const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
  if (!over || active.id === over.id) return;
  moveCell(String(active.id), String(over.id), activeZoneRef.current);
  activeZoneRef.current = 'center';
}, [moveCell]);
```

**Phase 28 replacement imports:**
```typescript
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core';
import { useDragStore } from '../dnd';
import { computeDropZone } from '../dnd';
import { DragPreviewPortal } from '../dnd';
```

**Phase 28 PointerSensor dual-constraint** (from CONTEXT.md DND-01, DRAG-03, DRAG-04; adapter/dndkit.ts RULE 2):
```typescript
// Touch: 250ms delay + 5px tolerance; Mouse: 8px distance
// dnd-kit PointerSensor accepts a single activationConstraint — use distance for mouse-like
// and delay for touch-like via a custom constraint function or two useSensor calls.
// Cleanest approach: two useSensor(PointerSensor) calls with different constraints.
const touchSensor = useSensor(PointerSensor, {
  activationConstraint: { delay: 250, tolerance: 5 },
});
const mouseSensor = useSensor(PointerSensor, {
  activationConstraint: { distance: 8 },
});
const sensors = useSensors(touchSensor, mouseSensor);
```

Note: dnd-kit evaluates sensors in order; if both match the same event, the first wins. Check dnd-kit source for the exact multi-sensor disambiguation for PointerSensor to ensure touch holds 250ms while mouse fires at 8px. Alternative: single PointerSensor with a custom constraint resolver that reads `pointerType` — cleaner but requires a constraint factory function.

**Phase 28 onDragStart** (calls `beginCellDrag` + captures ghost):
```typescript
const handleDragStart = useCallback(({ active }: DragStartEvent) => {
  const sourceId = String(active.id);
  // Capture ghost from the cell's canvas element
  const el = active.node.current as HTMLElement | null;
  const canvas = el?.querySelector('canvas') as HTMLCanvasElement | null;
  const ghostUrl = canvas?.toDataURL('image/png') ?? null;
  const rect = active.rect.current.initial;
  useDragStore.getState().beginCellDrag(sourceId, ghostUrl, rect?.width ?? 0, rect?.height ?? 0);
  document.body.classList.add('cursor-grabbing');
}, []);
```

Note: `dragStore.beginCellDrag` signature must be extended to accept `(sourceId, ghostUrl, sourceW, sourceH)` — the stub only takes `sourceId`. The planner must add `ghostUrl: string | null`, `sourceW: number`, `sourceH: number` fields to `DragState` and update `beginCellDrag`.

**Phase 28 onDragMove** (PITFALL 2 — single event source for zone coords):
```typescript
const handleDragMove = useCallback(({ over, activatorEvent, delta }: DragMoveEvent) => {
  if (!over) { useDragStore.getState().setOver(null, null); return; }
  const rect = over.rect as DOMRect;
  // activatorEvent is the original pointerdown; delta tracks total movement
  const pointer = {
    x: (activatorEvent as PointerEvent).clientX + delta.x,
    y: (activatorEvent as PointerEvent).clientY + delta.y,
  };
  const zone = computeDropZone(rect, pointer);
  useDragStore.getState().setOver(String(over.id), zone);
}, []);
```

**Phase 28 onDragEnd** (commits move or cancels):
```typescript
const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
  const { sourceId, activeZone } = useDragStore.getState();
  useDragStore.getState().end();
  document.body.classList.remove('cursor-grabbing');
  if (!over || !sourceId) return;  // CANCEL-03: released outside GridCanvas
  const toId = String(over.id);
  if (toId === sourceId) return;   // CANCEL-04: dropped on origin cell
  moveCell(sourceId, toId, activeZone ?? 'center');
}, [moveCell]);
```

**Phase 28 onDragCancel** (resets store):
```typescript
const handleDragCancel = useCallback(() => {
  useDragStore.getState().end();
  document.body.classList.remove('cursor-grabbing');
}, []);
```

**Phase 28 JSX wrapper** — DragZoneRefContext.Provider removed; DragPreviewPortal added inside DndContext:
```tsx
return (
  <div ref={containerRef} className="flex flex-1 h-full items-start justify-center overflow-hidden" data-testid="canvas-container">
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="relative group mt-8 flex-shrink-0"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${finalScale})`, transformOrigin: 'top center', background: canvasBackground }}
        onClick={handleBgClick}
        data-testid="canvas-surface"
        id="grid-canvas"  // needed for CANCEL-03 "outside GridCanvas" check
      >
        <GridNodeComponent id={rootId} />
        <OverlayLayer />
        {showSafeZone && <SafeZoneOverlay />}
      </div>
      <DragPreviewPortal />
    </DndContext>
  </div>
);
```

CANCEL-03 check ("release outside GridCanvas"): `onDragEnd` receives `over: null` when pointer is not over any droppable — the existing `if (!over) return` guard satisfies this without needing an explicit element hit-test.

---

### `src/Grid/LeafNode.tsx` (component, event-driven)

**Analog:** `src/Grid/LeafNode.tsx` itself — remove Phase 25 blocks, wire Phase 28 hooks

**Phase 25 imports to DELETE** (`src/Grid/LeafNode.tsx` lines 11-12):
```typescript
// DELETE:
import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';
import { DragZoneRefContext } from './CanvasWrapper';
```

**Phase 25 state/refs to DELETE** (`src/Grid/LeafNode.tsx` lines 58-60):
```typescript
// DELETE:
const [activeZone, setActiveZone] = useState<ActiveZone>(null);
const [isPendingDrag, setIsPendingDrag] = useState(false);
const dragZoneRef = useContext(DragZoneRefContext);
```

**Phase 25 pointer-tracking listener to DELETE** (`src/Grid/LeafNode.tsx` lines 300-310):
```typescript
// DELETE — PITFALL 2 root cause:
const pointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
useEffect(() => {
  const handler = (e: PointerEvent) => { pointerPosRef.current = { x: e.clientX, y: e.clientY }; };
  document.addEventListener('pointermove', handler);
  return () => document.removeEventListener('pointermove', handler);
}, []);
```

**Phase 25 useDraggable/useDroppable/useDndMonitor block to DELETE** (`src/Grid/LeafNode.tsx` lines 313-357):
```typescript
// DELETE entire block: useDraggable call, useDroppable call, setRefs merge, useDndMonitor block
```

**Phase 25 isPendingDrag native listener to DELETE** (`src/Grid/LeafNode.tsx` lines 361-374).

**Phase 25 five-zone JSX to DELETE** (`src/Grid/LeafNode.tsx` lines 714-756).

**Phase 28 replacement imports:**
```typescript
import { useCellDraggable, useCellDropTarget, DropZoneIndicators, useDragStore } from '../dnd';
```

**Phase 28 hook wiring pattern** (merge ref pattern preserved from Phase 25 `setRefs`, line 323-328):
```typescript
const { setNodeRef: setDragRef, listeners: dragListeners, attributes: dragAttributes, isDragging } = useCellDraggable(id);
const { setNodeRef: setDropRef, isOver } = useCellDropTarget(id);

const setRefs = useCallback((el: HTMLDivElement | null) => {
  divRef.current = el;
  setDragRef(el);
  setDropRef(el);
}, [setDragRef, setDropRef]);
```

**Phase 28 dragStore selectors** (CONTEXT.md pattern):
```typescript
const isSource = useDragStore(s => s.sourceId === id && s.status === 'dragging');
const isDropTarget = useDragStore(s => s.overId === id && s.status === 'dragging');
```

**Phase 28 root div changes** — opacity for source cell (GHOST-07), drop outline (DROP-04), cursor (DRAG-01):
```tsx
<div
  ref={setRefs}
  {...dragAttributes}
  className={`
    relative w-full h-full overflow-visible select-none
    ${isHovered && !isPanMode ? 'z-20' : ''}
    ${isDragging ? 'z-50' : ''}
    ${ringClass}
    ${hasMedia ? '' : 'bg-[#1c1c1c]'}
    ${isDropTarget && !isSource ? 'ring-2 ring-primary ring-inset' : ''}
  `}
  style={{
    backfaceVisibility: 'hidden',
    touchAction: 'none',
    transition: 'opacity 150ms ease-out',
    cursor: isPanMode ? undefined : 'grab',   // DRAG-01: grab at all times
    opacity: isSource ? 0.4 : 1,             // GHOST-07: 40% dim on source
  }}
  onClick={handleClick}
  onDoubleClick={handleDoubleClick}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  onDragOver={handleFileDragOver}   // native file drop — preserved
  onDragLeave={handleFileDragLeave}
  onDrop={handleFileDrop}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  {...(!isPanMode ? dragListeners : {})}   // PITFALL 1: spread LAST
  data-testid={`leaf-${id}`}
  aria-label="Drag to move"
  aria-selected={isSelected}
  role="gridcell"
>
```

**Phase 28 DropZoneIndicators placement** — inside root div, after all other children, before ActionBar:
```tsx
{isDropTarget && !isSource && (
  <DropZoneIndicators cellId={id} canvasScale={canvasScale} />
)}
```

**canvasRef access for ghost capture** — `canvasRef` already exists at line 64 and is a `useRef<HTMLCanvasElement>(null)`. The ghost capture in `CanvasWrapper.onDragStart` reads `active.node.current.querySelector('canvas')` — no changes to `canvasRef` needed.

**File guard for native file drop** — `handleFileDragOver` already has the guard (`src/Grid/LeafNode.tsx` lines 545-552):
```typescript
const hasFiles = Array.from(e.dataTransfer.types).includes('Files');
if (!hasFiles) return;
```
This pattern is preserved unchanged. It prevents @dnd-kit pointer drags from triggering the file drop handler.

---

### `src/Grid/Divider.tsx` (minor, attribute addition)

**Analog:** `src/Grid/OverlayLayer.tsx` root div (already has `pointerEvents: 'none'` pattern for non-interception)

**Change:** Add `data-dnd-ignore="true"` to the Divider root div (`src/Grid/Divider.tsx` line 94):
```tsx
// BEFORE (line 94):
<div
  className={`relative flex-shrink-0 ${cursorClass} ...`}
  data-testid={`divider-${containerId}-${siblingIndex}`}
>

// AFTER:
<div
  className={`relative flex-shrink-0 ${cursorClass} ...`}
  data-testid={`divider-${containerId}-${siblingIndex}`}
  data-dnd-ignore="true"
>
```

`data-dnd-ignore="true"` is read by the PointerSensor configuration to prevent drag activation when pointerdown lands on a divider handle. The PointerSensor must be configured with `bypassActivationConstraint` or the `onActivation` guard in `CanvasWrapper` must check `event.target.closest('[data-dnd-ignore]')`.

---

### `src/Grid/OverlayLayer.tsx` (minor, attribute addition)

**Analog:** self — root div already has `pointerEvents: 'none'`

**Change:** Add `data-dnd-ignore="true"` to the OverlayLayer root div (`src/Grid/OverlayLayer.tsx` line 50):
```tsx
// BEFORE (line 50):
<div
  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}
>

// AFTER:
<div
  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}
  data-dnd-ignore="true"
>
```

---

## Shared Patterns

### dragStore Vanilla Zustand Selector Pattern
**Source:** `src/dnd/dragStore.ts` + CONTEXT.md "Established Patterns"
**Apply to:** `useCellDraggable.ts`, `useCellDropTarget.ts`, `DropZoneIndicators.tsx`, `LeafNode.tsx`

```typescript
// Direct selector — no useDragStore.subscribe needed for React components
const isSource = useDragStore(s => s.sourceId === id && s.status === 'dragging');
const isDropTarget = useDragStore(s => s.overId === id);
const activeZone = useDragStore(s => s.overId === id ? s.activeZone : null);

// Imperative read in event callbacks (no re-render needed)
useDragStore.getState().beginCellDrag(sourceId);
useDragStore.getState().setOver(null, null);
useDragStore.getState().end();
```

### dragStore Extension Needed
**Source:** `src/dnd/dragStore.ts` — current `beginCellDrag(sourceId)` signature
**Apply to:** `src/dnd/dragStore.ts` must be extended before `DragPreviewPortal.tsx` can be implemented

Add to `DragState`:
```typescript
ghostUrl: string | null;
sourceW: number;
sourceH: number;
```
Update `beginCellDrag` signature:
```typescript
beginCellDrag: (sourceId: string, ghostUrl: string | null, sourceW: number, sourceH: number) => void;
```
Update action:
```typescript
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) =>
  set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null, ghostUrl, sourceW, sourceH }),
```

### Lucide-React Icon Usage Pattern
**Source:** `src/Grid/ActionBar.tsx` lines 6-21, `src/Grid/LeafNode.tsx` line 9
**Apply to:** `src/dnd/DropZoneIndicators.tsx`

```typescript
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
// Usage: <ArrowUp size={32 / canvasScale} className="text-white/30" />
```

Icon size is always `32 / canvasScale` to maintain physical pixel stability at all canvas zoom levels. This is the established pattern from Phase 25 (`src/Grid/LeafNode.tsx` line 754: `<ArrowLeftRight size={32 / canvasScale} />`).

### Merge-Ref Pattern (divRef + drag ref + drop ref)
**Source:** `src/Grid/LeafNode.tsx` lines 323-328
**Apply to:** `src/Grid/LeafNode.tsx` (Phase 28 version)

```typescript
const setRefs = useCallback((el: HTMLDivElement | null) => {
  divRef.current = el;
  setDragRef(el);
  setDropRef(el);
}, [setDragRef, setDropRef]);
```

### Pointer Listeners Spread-Last Rule (PITFALL 1)
**Source:** `src/Grid/LeafNode.tsx` line 663 (Phase 25); PITFALLS.md Pitfall 1
**Apply to:** `src/Grid/LeafNode.tsx` root div

```tsx
// Pattern: all explicit handlers first, spread LAST
onPointerDown={handlePointerDown}
onPointerMove={handlePointerMove}
onPointerUp={handlePointerUp}
{...(!isPanMode ? dragListeners : {})}   // MUST be last prop
```

### canvasScale Read Pattern
**Source:** `src/Grid/LeafNode.tsx` line 50, `src/Grid/Divider.tsx` line 24, `src/Grid/OverlayLayer.tsx` line 14
**Apply to:** `src/dnd/DropZoneIndicators.tsx` (receives as prop from LeafNode)

```typescript
// In LeafNode.tsx — already reads canvasScale:
const canvasScale = useEditorStore(s => s.canvasScale);
// Pass down as prop:
<DropZoneIndicators cellId={id} canvasScale={canvasScale} />
```

### cursor-grabbing Body Class Pattern
**Source:** CONTEXT.md "Established Patterns" (line 101 of CONTEXT.md: "LeafNode.tsx line 647")
**Apply to:** `src/Grid/CanvasWrapper.tsx` onDragStart/onDragEnd/onDragCancel

```typescript
// Phase 25 LeafNode.tsx line 647 reference (cursor: isDragging ? 'grabbing' : 'grab')
// Phase 28 moves this to document.body class for global cursor:
document.body.classList.add('cursor-grabbing');     // in onDragStart
document.body.classList.remove('cursor-grabbing');  // in onDragEnd + onDragCancel
```

Requires Tailwind config to include `cursor-grabbing` as a custom class, or use inline CSS: `document.body.style.cursor = 'grabbing'` / `document.body.style.cursor = ''`.

---

## No Analog Found

No files in this phase are without analog. All patterns exist in the codebase (Phase 25 code is the analog for what must be replaced).

---

## Critical Decisions from CONTEXT.md (locked — not for re-litigation)

| Decision | Value | Source |
|---|---|---|
| Single sensor | `PointerSensor` only — no MouseSensor/TouchSensor | DND-01, D-03 |
| Touch activation | 250ms delay + 5px tolerance | DRAG-03, adapter/dndkit.ts RULE 2 |
| Mouse activation | 8px distance | DRAG-04, adapter/dndkit.ts RULE 2 |
| Ghost method | `canvas.toDataURL('image/png')` on drag-start | GHOST-01, Claude's Discretion |
| Ghost opacity | 0.8 (80%) | GHOST-03 |
| Source cell opacity | 0.4 (40%) during drag | GHOST-07 |
| Drop target outline | `ring-2 ring-primary ring-inset` | DROP-04 |
| Zone icons | ArrowUp/Down/Left/Right + Maximize2 | D-02 |
| Zone layout | 20% edge bands + inset-[20%] center | UI-SPEC.md |
| No dead space | Zones tile full cell | DROP-01 |
| Parallel engine removal | Phase 25 code deleted in same PR | D-03 |
| CANCEL-03 | `over === null` in onDragEnd → cancel | CANCEL-03 |
| CANCEL-04 | `over.id === active.id` → no-op | CANCEL-04 |
| Out of scope Phase 28 | ESC cancel, snap-back, wobble, haptics, touch-action CSS | domain block |

---

## Metadata

**Analog search scope:** `src/dnd/`, `src/Grid/`, `src/store/`, `src/Editor/`
**Files scanned:** 18 source files + 3 planning documents
**Pattern extraction date:** 2026-04-18
