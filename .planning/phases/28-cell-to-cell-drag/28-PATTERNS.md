# Phase 28: Cell-to-Cell Drag - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 14 (6 new bodies + 1 extended store + 5 replaced wirings + 3 test files)
**Analogs found:** 14 / 14 (every file has a locked skeleton, an existing in-tree analog, or both)

> **Primary analog strategy:** Phase 27 has already written *skeleton contracts* for every `src/dnd/*` file being filled in Phase 28. The skeleton files and their header blocks lock API shape, are the BEST ANALOG, and MUST be respected. Secondary analogs come from Phase 25 code being surgically removed in the same commits (see `Old Pattern (REMOVE)` callouts) and from unrelated in-tree conventions (Zustand vanilla store, lucide icon sizing, React.memo components).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/dnd/adapter/dndkit.ts` | adapter / library-glue | event-driven | Phase 27 skeleton `src/dnd/adapter/dndkit.ts` (locked header); secondary: `src/Grid/CanvasWrapper.tsx:61-79` (old sensor wiring — REMOVE) | skeleton-exact |
| `src/dnd/useCellDraggable.ts` | hook (drag source) | event-driven | Phase 27 skeleton `src/dnd/useCellDraggable.ts` (return-type + Pitfall 1 header); secondary: `src/Grid/LeafNode.tsx:313-318` `useDraggable` call (REMOVE) | skeleton-exact |
| `src/dnd/useCellDropTarget.ts` | hook (drop target) | event-driven | Phase 27 skeleton `src/dnd/useCellDropTarget.ts` (return-type + Pitfall 2 header); secondary: `src/Grid/LeafNode.tsx:321` `useDroppable` + `331-357` `useDndMonitor` (REMOVE) | skeleton-exact |
| `src/dnd/DragPreviewPortal.tsx` | component (portal UI) | request-response (store-subscribe → render) | Phase 27 skeleton `src/dnd/DragPreviewPortal.tsx`; secondary: `createPortal(document.body)` ActionBar pattern (quick-260407-q2s); DragOverlay type `node_modules/@dnd-kit/core/dist/components/DragOverlay/DragOverlay.d.ts` | skeleton + precedent |
| `src/dnd/DropZoneIndicators.tsx` | component (absolute overlay) | request-response (prop-driven render) | Phase 27 skeleton `src/dnd/DropZoneIndicators.tsx`; secondary: `src/Grid/LeafNode.tsx:720-756` inline zone JSX (REMOVE — but STRUCTURE template for scale-stable 32/canvasScale sizing) | skeleton + inline-precedent |
| `src/dnd/dragStore.ts` (extend) | store (vanilla Zustand) | pub-sub | Phase 27 `src/dnd/dragStore.ts` INITIAL_STATE + action pattern (lines 41-54) | exact |
| `src/Grid/CanvasWrapper.tsx` (replace block) | host component / DndContext mount | event-driven | Phase 25 block at `src/Grid/CanvasWrapper.tsx:60-79, 120-139` (PATTERN SCAFFOLD — the STRUCTURE of DndContext + sensors + useCallback(onDragEnd) is kept; imports, sensor classes, and body content change) | role-match (structure reuse) |
| `src/Grid/LeafNode.tsx` (modify) | recursive tree leaf | event-driven + CRUD (file-drop) | Itself — 15 edits are surgical deletes/rewires. No external analog applies; see "Surgical Edit Map" below | self |
| `src/Editor/EditorShell.tsx` (modify) | top-level shell | mount-once | `src/Editor/EditorShell.tsx:86-97` — add `<DragPreviewPortal />` above/below canvas tree (role: top-level component mount alongside `<MobileSheet />`/`<Onboarding />`) | exact |
| `src/Grid/Divider.tsx` (attribute add) | raw-pointer hit area | pointer-event | `src/Grid/Divider.tsx:103-115` — add `data-dnd-ignore="true"` attribute on the `group/hit` div | self-attribute |
| `src/Grid/OverlayLayer.tsx` (attribute + conditional PE) | overlay layer | event-driven | `src/Grid/OverlayLayer.tsx:49-51` (root — attribute add) and `:67` (selected overlay — conditional PE via new dragStore selector) | self-attribute + new-selector |
| `src/dnd/__tests__/useCellDraggable.test.tsx` | unit test | test | `src/dnd/dragStore.test.ts` (Vitest + beforeEach store reset pattern); secondary: `src/Grid/__tests__/LeafNode.test.tsx` (render harness inside DndContext) | role-match |
| `src/dnd/__tests__/useCellDropTarget.test.tsx` | unit test | test | Same as above + `src/dnd/computeDropZone.test.ts` (rect mock helper at lines 24-42) | role-match |
| `src/dnd/__tests__/integration.test.tsx` | integration test | test | `src/test/phase25-touch-dnd.test.tsx` DRAG-04 pattern (lines 367-478) — mock `@dnd-kit/core`, mount `CanvasWrapper`, assert `moveCell` invoked. Adapt — keep behavioral asserts, drop Phase 25 Mouse/TouchSensor mocks | role-match (test-harness reuse) |

---

## Pattern Assignments

### `src/dnd/adapter/dndkit.ts` (adapter, event-driven)

**PRIMARY analog:** `src/dnd/adapter/dndkit.ts` (Phase 27 skeleton — lines 1-31). Headers in the skeleton are the contract Phase 28 must honor. Replace the `export {}` body.

**Header to preserve verbatim** (lines 1-28):
```typescript
/**
 * @dnd-kit/core adapter for the v1.5 unified DnD engine.
 * ... BLOCKING RULES — reintroducing any of these reproduces Phase 25 failures.
 * RULE 1 — DND-01: Single PointerSensor only.
 * RULE 2 — Pitfall 4: Touch { delay: 250, tolerance: 5 }  (NEVER 500ms)
 *                     Mouse { distance: 8 }
 * RULE 3 — Pitfall 10: No parallel engines during migration.
 */
```

**Exports to add** (per CONTEXT.md D-02, D-08, D-09):

1. **Two `PointerSensor` subclasses** — `PointerSensorMouse` + `PointerSensorTouch` via class inheritance. Each overrides the static `activators` array to return `false` on non-matching `pointerType`. Then:
   ```typescript
   // Skeleton shape (D-02, D-26):
   export class PointerSensorMouse extends PointerSensor {
     static activators = [{
       eventName: 'onPointerDown' as const,
       handler: ({ nativeEvent: event }: React.PointerEvent, { onActivation }: PointerSensorOptions): boolean => {
         if (event.pointerType !== 'mouse') return false;
         // D-26: ignore-check BEFORE onActivation
         const target = event.target as Element | null;
         if (target?.closest('[data-dnd-ignore]')) return false;
         onActivation?.({ event });
         return true;
       },
     }];
   }
   // PointerSensorTouch symmetrical — pointerType check accepts 'touch' | 'pen'
   ```
   Type sources: `node_modules/@dnd-kit/core/dist/sensors/pointer/PointerSensor.d.ts` (activator shape); `AbstractPointerSensor.d.ts` (`PointerActivationConstraint` union). D-03: keep constraints SEPARATE — NEVER `{ delay, distance }` combined.

2. **Custom scale-compensation Modifier** (D-08):
   ```typescript
   // Type: Modifier from @dnd-kit/core (node_modules/@dnd-kit/core/dist/modifiers/types.d.ts)
   import type { Modifier } from '@dnd-kit/core';
   import { useEditorStore } from '../../store/editorStore';
   export const scaleCompensationModifier: Modifier = ({ transform }) => {
     const scale = useEditorStore.getState().canvasScale || 1;
     return { ...transform, x: transform.x / scale, y: transform.y / scale };
   };
   ```
   Reference: `@dnd-kit/modifiers`'s shipped modifiers (`node_modules/@dnd-kit/modifiers/dist/snapCenterToCursor.d.ts`) — signature is identical. Scale compensation is NOT a prebuilt modifier; `@dnd-kit/modifiers` exports only `createSnapModifier`, `restrict*`, `snapCenterToCursor` per `node_modules/@dnd-kit/modifiers/dist/index.d.ts`.

**Old Pattern (REMOVE from `CanvasWrapper.tsx:60-79`):**
```typescript
// DELETE — lines 11-16 imports
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

// DELETE — lines 60-69: dual-sensor hand-wired with 500ms delay
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(KeyboardSensor),
);
```

---

### `src/dnd/useCellDraggable.ts` (hook, event-driven)

**PRIMARY analog:** `src/dnd/useCellDraggable.ts` (Phase 27 skeleton — lines 1-33). Return-type shape `UseCellDraggableResult` is LOCKED.

**Locked return shape** (Phase 27 lines 23-29):
```typescript
export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};
```

**Body pattern** (Phase 28 to implement — based on Pitfall 1 header + D-06):
```typescript
import { useDraggable } from '@dnd-kit/core';
import { useDragStore } from './dragStore';

export function useCellDraggable(leafId: string): UseCellDraggableResult {
  const { attributes, listeners, isDragging, setNodeRef } = useDraggable({
    id: leafId,
    data: { nodeId: leafId },
  });
  return { attributes, listeners: listeners ?? {}, isDragging, setNodeRef };
}
```

**Header contract to preserve verbatim** (Phase 27 lines 1-21) — "SPREAD LISTENERS LAST ON THE JSX ELEMENT" (Pitfall 1) — this rule must be applied to the LeafNode JSX call site (see "LeafNode surgical edits").

**Old Pattern (REMOVE from `LeafNode.tsx:313-328`):**
```typescript
// DELETE — line 11: import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';
// DELETE — lines 313-318:
const { setNodeRef: setDragNodeRef, listeners: dragListeners, isDragging, attributes: dragAttributes } = useDraggable({ id, data: { nodeId: id } });
// DELETE — lines 321: useDroppable call (moves to useCellDropTarget)
// DELETE — lines 323-328: setRefs callback merging three refs
```

**Ghost-snapshot side effect** (D-06 — called at `onDragStart` from adapter, NOT inside this hook):
The `canvas.toDataURL()` snapshot happens in the adapter's `onDragStart` callback. `useCellDraggable` stays pure. The source-cell canvas reference is accessed via `document.querySelector(\`[data-testid="leaf-${sourceId}"] canvas\`)` or via a ref registry. Architecture note in ARCHITECTURE.md §5 discusses tradeoffs; CONTEXT.md D-06 LOCKS "toDataURL + write to dragStore.ghostDataUrl".

---

### `src/dnd/useCellDropTarget.ts` (hook, event-driven)

**PRIMARY analog:** `src/dnd/useCellDropTarget.ts` (Phase 27 skeleton — lines 1-24).

**Locked return shape** (Phase 27 lines 17-20):
```typescript
export type UseCellDropTargetResult = {
  isOver: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};
```

**Body pattern** (Phase 28 — based on Pitfall 2 header + D-12 + D-16):
```typescript
import { useDroppable } from '@dnd-kit/core';
import { useDragStore } from './dragStore';

export function useCellDropTarget(leafId: string): UseCellDropTargetResult {
  const { setNodeRef, isOver } = useDroppable({ id: leafId, data: { nodeId: leafId } });
  // Note: zone computation lives in adapter's onDragOver, NOT here.
  // Single pointer source rule (Pitfall 2): adapter calls computeDropZone(
  // element.getBoundingClientRect(), pointer) then dragStore.setOver(leafId, zone).
  return { setNodeRef, isOver };
}
```

**Old Pattern (REMOVE from `LeafNode.tsx:299-310, 321, 331-357`):**
```typescript
// DELETE — lines 299-310: document-level pointermove listener that wrote pointerPosRef
useEffect(() => {
  const handler = (e: PointerEvent) => {
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
  };
  document.addEventListener('pointermove', handler);
  return () => document.removeEventListener('pointermove', handler);
}, []);

// DELETE — lines 331-357: useDndMonitor with per-cell zone calculation + dragZoneRef write
useDndMonitor({
  onDragOver({ over, active }) {
    if (active.id === id) return;
    if (over?.id !== id) { setActiveZone(null); return; }
    const rect = divRef.current?.getBoundingClientRect();
    // ... 20% threshold math (moved into dnd/computeDropZone.ts — Phase 27)
    setActiveZone(zone);
    if (dragZoneRef) dragZoneRef.current = zone ?? 'center';
  },
  // ...
});
```
This is exactly the Pitfall 2 root-cause from PITFALLS.md — two independent pointer sources.

---

### `src/dnd/DragPreviewPortal.tsx` (component, request-response)

**PRIMARY analog:** `src/dnd/DragPreviewPortal.tsx` (Phase 27 skeleton — lines 1-15). Contract locks: uses `DragOverlay` (NOT custom portal), renders canvas.toDataURL() snapshot as `<img>`, mounts in `document.body`.

**DragOverlay API reference:** `node_modules/@dnd-kit/core/dist/components/DragOverlay/DragOverlay.d.ts` — `<DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]} style={...}><img ... /></DragOverlay>`. Per D-09: `adjustScale` stays `false`.

**Portal precedent** (ActionBar — referenced in `src/Grid/__tests__/ActionBar.test.tsx:169`):
> "ActionBar renders via createPortal to document.body in viewport space (per quick-260407-q2s). It does not get scaled by the canvas transform."

`DragOverlay` is @dnd-kit's built-in portal equivalent — no raw `createPortal` call needed. The analog is CONCEPTUAL (document.body-level portal outside scaled canvas).

**Body pattern** (Phase 28 — based on D-07, D-08, D-10, D-11):
```typescript
import { DragOverlay } from '@dnd-kit/core';
import { useDragStore } from './dragStore';
import { scaleCompensationModifier } from './adapter/dndkit';

export function DragPreviewPortal() {
  // Scoped selectors — single leaf re-render pattern (ARCHITECTURE.md §3)
  const ghostDataUrl = useDragStore(s => s.ghostDataUrl);
  const sourceRect = useDragStore(s => s.sourceRect);
  const status = useDragStore(s => s.status);

  return (
    <DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]}>
      {status === 'dragging' && sourceRect && (
        ghostDataUrl ? (
          <img
            src={ghostDataUrl}
            style={{ width: sourceRect.width, height: sourceRect.height, opacity: 0.8 }}  // D-11
            alt=""
            draggable={false}
          />
        ) : (
          // D-10: empty-cell fallback
          <div
            className="bg-[#1c1c1c]"
            style={{ width: sourceRect.width, height: sourceRect.height, opacity: 0.8 }}
          />
        )
      )}
    </DragOverlay>
  );
}
```

**Mount point** — `EditorShell.tsx` addition (see that file's section).

---

### `src/dnd/DropZoneIndicators.tsx` (component, request-response)

**PRIMARY analog:** `src/dnd/DropZoneIndicators.tsx` (Phase 27 skeleton — lines 1-16). Header locks: `pointer-events: none` on every overlay child.

**SECONDARY analog (STRUCTURE template — Phase 25 inline JSX in `LeafNode.tsx:720-756`):**
This code is being DELETED from LeafNode (D-20) but the SIZING/LAYOUT patterns are the blueprint:
```typescript
// LeafNode.tsx:748-755 — template for absolute-positioned scale-stable overlay
<div
  data-testid={`swap-overlay-${id}`}
  className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
  style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
>
  <ArrowLeftRight size={32 / canvasScale} className="text-white" />
</div>
```

**D-13/D-14/D-16 body pattern** (Phase 28):
```typescript
import { useEditorStore } from '../store/editorStore';
import { ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import type { DropZone } from './dragStore';

interface Props {
  zone: DropZone | null;  // D-12: only rendered when overId === id; zone may be null briefly
}

export function DropZoneIndicators({ zone: _zone }: Props) {
  const canvasScale = useEditorStore(s => s.canvasScale);
  const iconSize = 32 / canvasScale;  // D-14 — screen-constant visual

  // D-13: single absolute root with inset-0 + pointer-events:none + z-20
  // D-15: all 5 icons always visible in Phase 28 (bright/dim active state = Phase 29)
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      data-testid="drop-zones"
    >
      {/* center ~60% — swap icon */}
      <div className="absolute inset-[20%] flex items-center justify-center">
        <ArrowLeftRight size={iconSize} className="text-white" />
      </div>
      {/* top band — Math.max(20, min(w,h)*0.2) height — but since this is a CSS-only layout,
          use 20% which matches computeDropZone's proportional threshold */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-center" style={{ height: '20%' }}>
        <ArrowUp size={iconSize} className="text-white" />
      </div>
      {/* bottom band */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center" style={{ height: '20%' }}>
        <ArrowDown size={iconSize} className="text-white" />
      </div>
      {/* left band */}
      <div className="absolute top-0 bottom-0 left-0 flex items-center justify-center" style={{ width: '20%' }}>
        <ArrowLeft size={iconSize} className="text-white" />
      </div>
      {/* right band */}
      <div className="absolute top-0 bottom-0 right-0 flex items-center justify-center" style={{ width: '20%' }}>
        <ArrowRight size={iconSize} className="text-white" />
      </div>
    </div>
  );
}
```

**Scale-stable icon precedent** (same pattern in `src/Grid/Divider.tsx:136`):
```typescript
style={{ transform: `${isVerticalContainer ? 'translateX(-50%)' : 'translateY(-50%)'} scale(${1 / canvasScale})` }}
```
— identical `1 / canvasScale` approach for screen-constant sizing inside the scaled canvas.

---

### `src/dnd/dragStore.ts` (extend existing)

**PRIMARY analog:** `src/dnd/dragStore.ts` (Phase 27 complete — lines 1-55). EXTEND, do not rewrite. Preserve existing shape + all 3 actions; add 2 fields and optionally 1 action.

**Existing pattern to extend** (Phase 27 lines 30-55):
```typescript
export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  overId: string | null;
  activeZone: DropZone | null;
  beginCellDrag: (sourceId: string) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
};

const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null,
  sourceId: null,
  overId: null,
  activeZone: null,
};
```

**Phase 28 extension** (CONTEXT.md D-06):
```typescript
// ADD to DragState:
ghostDataUrl: string | null;
sourceRect: { width: number; height: number; left: number; top: number } | null;
setGhost: (ghostDataUrl: string | null, sourceRect: DragState['sourceRect']) => void;

// ADD to INITIAL_STATE:
ghostDataUrl: null,
sourceRect: null,

// ADD inside create() body:
setGhost: (ghostDataUrl, sourceRect) => set({ ghostDataUrl, sourceRect }),

// MUST UPDATE end() — the existing `end: () => set({ ...INITIAL_STATE })` line
// already resets all fields to INITIAL_STATE, so once the two fields are added
// to INITIAL_STATE the existing end() implementation covers them automatically.
```

**CRITICAL constraint** (Phase 27 dragStore.test.ts enforces via source-readback):
- NO Immer — do not import `zustand/middleware/immer`
- NO persist — do not import `zustand/middleware/persist`
- `create<DragState>` directly (line 49) — stays unchanged

The test `src/dnd/dragStore.test.ts` reads source file to enforce; will keep passing as long as the two forbidden imports stay absent. Phase 28 extension MUST keep this invariant.

**Barrel export** — `src/dnd/index.ts` already exports `useDragStore` + `DragKind`/`DropZone`/`DragStatus` types. Phase 28 may optionally add named exports for the new action if consumers need it; reading via `useDragStore.getState().setGhost` from within the adapter is also fine.

---

### `src/Grid/CanvasWrapper.tsx` (replace block)

**PRIMARY analog:** itself — the STRUCTURE of `DndContext` + `useSensors` + `useCallback(onDragEnd)` + JSX wrapping stays identical; only sensor classes + callback bodies change.

**Structure to preserve** (lines 114-142):
- Outer `<div ref={containerRef} className="flex flex-1 ...">` — KEEP unchanged
- `<DndContext sensors={sensors} onDragEnd={handleDragEnd}>` — KEEP the mount point; swap the wired handlers
- Inner `<div className="relative group mt-8 flex-shrink-0" style={{ transform: scale(finalScale), ... }}>` — KEEP unchanged
- `<GridNodeComponent id={rootId} />` + `<OverlayLayer />` + `<SafeZoneOverlay />` — KEEP unchanged

**Pattern to REPLACE** (lines 11-20, 60-79, 120-139):

```typescript
// BEFORE — lines 11-16
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';

// BEFORE — line 20
export const DragZoneRefContext = React.createContext<React.MutableRefObject<...> | null>(null);

// BEFORE — lines 60-69
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  useSensor(KeyboardSensor),
);

// BEFORE — lines 71-79
const activeZoneRef = useRef<'center' | 'top' | ...>('center');
const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
  if (!over || active.id === over.id) return;
  moveCell(String(active.id), String(over.id), activeZoneRef.current);
  activeZoneRef.current = 'center';
}, [moveCell]);

// BEFORE — lines 120-139
<DragZoneRefContext.Provider value={activeZoneRef}>
  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    ...
  </DndContext>
</DragZoneRefContext.Provider>
```

**Pattern to ADD:**
```typescript
// AFTER — imports
import { DndContext, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { PointerSensorMouse, PointerSensorTouch } from '../dnd/adapter/dndkit';
import { useDragStore } from '../dnd';
import { computeDropZone } from '../dnd';

// AFTER — sensors (D-02, D-03 — SEPARATE constraints)
const sensors = useSensors(
  useSensor(PointerSensorMouse, { activationConstraint: { distance: 8 } }),
  useSensor(PointerSensorTouch, { activationConstraint: { delay: 250, tolerance: 5 } }),
);

// AFTER — handlers (D-04 — imperative via getState, NOT useState)
const handleDragStart = useCallback((event: DragStartEvent) => {
  const sourceId = String(event.active.id);
  // D-06: capture canvas.toDataURL + sourceRect here
  const el = document.querySelector(`[data-testid="leaf-${sourceId}"]`) as HTMLElement | null;
  const canvas = el?.querySelector('canvas') as HTMLCanvasElement | null;
  const rect = el?.getBoundingClientRect();
  const ghost = canvas ? canvas.toDataURL() : null;
  const sourceRect = rect ? { width: rect.width, height: rect.height, left: rect.left, top: rect.top } : null;
  useDragStore.getState().beginCellDrag(sourceId);
  useDragStore.getState().setGhost(ghost, sourceRect);
}, []);

const handleDragOver = useCallback((event: DragOverEvent) => {
  const { over, active, activatorEvent } = event;
  if (!over || active.id === over.id) {
    useDragStore.getState().setOver(null, null);
    return;
  }
  // Single pointer source (Pitfall 2): use activatorEvent + current pointer
  // Zone computation moved to computeDropZone (Phase 27)
  const targetEl = document.querySelector(`[data-testid="leaf-${over.id}"]`) as HTMLElement | null;
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  // Pointer from the native event attached to onDragMove/onDragOver sensor callback
  // (dnd-kit exposes via `activatorEvent` on initial drag-start; for subsequent pointer
  //  position use event.delta + activator or read from a single dnd-kit source)
  const pointer = { x: (activatorEvent as PointerEvent).clientX + event.delta.x,
                    y: (activatorEvent as PointerEvent).clientY + event.delta.y };
  const zone = computeDropZone(rect, pointer);
  useDragStore.getState().setOver(String(over.id), zone);
}, []);

const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event;
  const zone = useDragStore.getState().activeZone;
  if (over && active.id !== over.id && zone) {
    moveCell(String(active.id), String(over.id), zone);
  }
  useDragStore.getState().end();
}, [moveCell]);

const handleDragCancel = useCallback(() => {
  useDragStore.getState().end();
}, []);

// AFTER — JSX (DragZoneRefContext.Provider REMOVED)
<DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
>
  {/* rest unchanged */}
</DndContext>
```

**`useCallback` + imperative `getState()` precedent** already in file at line 75 — Phase 28 keeps the same idiom.

---

### `src/Grid/LeafNode.tsx` (surgical edits)

**PRIMARY analog:** itself. This is a 15-point edit map, not a copy-from-analog.

**Surgical Edit Map** (per CONTEXT.md D-20):

| Line range | Change | Replacement |
|-----------|--------|-------------|
| 1 | Remove `useContext` from React import | `useContext` import not needed after DragZoneRefContext deletion |
| 11 | `import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';` | DELETE |
| 12 | `import { DragZoneRefContext } from './CanvasWrapper';` | DELETE |
| 9 | `import { ImageIcon, ArrowLeftRight } from 'lucide-react';` | Keep `ImageIcon`, remove `ArrowLeftRight` (moved to DropZoneIndicators) |
| 18 | `type ActiveZone = 'top' \| 'bottom' \| ...;` | DELETE (moved to dragStore.DropZone) |
| 58 | `const [activeZone, setActiveZone] = useState<ActiveZone>(null);` | DELETE |
| 59 | `const [isPendingDrag, setIsPendingDrag] = useState(false);` | DELETE |
| 60 | `const dragZoneRef = useContext(DragZoneRefContext);` | DELETE |
| 299-310 | `pointerPosRef` + document `pointermove` listener | DELETE (Pitfall 2 root cause) |
| 313-318 | `useDraggable({ id, data })` call | REPLACE with `const { attributes, listeners, isDragging, setNodeRef: setDragNodeRef } = useCellDraggable(id);` |
| 321 | `useDroppable` call | REPLACE with `const { setNodeRef: setDropNodeRef } = useCellDropTarget(id);` |
| 323-328 | `setRefs` merging divRef + drag + drop | KEEP STRUCTURE (still need to merge 3 refs — divRef, drag, drop) |
| 331-357 | `useDndMonitor` block | DELETE entirely |
| 361-374 | `isPendingDrag` pointerdown/up/cancel listeners | DELETE |
| 626-650 | `ringClass` + root div className/style | KEEP ring pattern; add `overId === id`-driven 2px accent outline (D-17); remove `isPendingDrag` animation (D-20); keep `isDragging` opacity/boxShadow (Phase 29 polish inherits this) |
| 662 | `{...(!isPanMode ? dragListeners : {})}` spread | KEEP pattern — listeners spread LAST after all explicit pointer handlers (Pitfall 1 — already correct in Phase 25 code) |
| 720-756 | 5 inline `activeZone === 'top'/'bottom'/...` JSX blocks | REPLACE with conditional render: `{isOverThisCell && <DropZoneIndicators zone={activeZone} />}` where `isOverThisCell = useDragStore(s => s.overId === id && s.status === 'dragging')` (D-12) |

**Selector scoping** (D-12 — critical for re-render containment):
```typescript
// D-12 pattern
const isOverThisCell = useDragStore(s => s.overId === id && s.status === 'dragging');
const activeZone = useDragStore(s => s.overId === id ? s.activeZone : null);
// Only the ONE leaf with overId===id re-renders on zone change (ARCHITECTURE.md §3)
```

**File-drop handlers — PRESERVED unchanged** (D-28):
- Lines 506-543 `handleFileDrop` — KEEP
- Lines 545-552 `handleFileDragOver` + `types.includes('Files')` guard — KEEP
- Lines 554-556 `handleFileDragLeave` — KEEP
- Lines 656-658 JSX `onDragOver={handleFileDragOver} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop}` — KEEP

---

### `src/Editor/EditorShell.tsx` (add one mount)

**PRIMARY analog:** itself (lines 86-97) — add `<DragPreviewPortal />` alongside `<MobileSheet />` + `<Onboarding />`.

**Existing pattern** (lines 86-97):
```typescript
return (
  <div className="flex flex-col h-screen w-screen bg-[#0a0a0a]">
    <Toolbar />
    <div className="flex flex-1 overflow-hidden pb-[60px] md:pb-0">
      <CanvasArea />
      <Sidebar />
    </div>
    <MobileSheet />
    <Onboarding />
  </div>
);
```

**Phase 28 edit** — add import + mount:
```typescript
import { DragPreviewPortal } from '../dnd';
// ...
<MobileSheet />
<Onboarding />
<DragPreviewPortal />  // NEW — renders null when status==='idle' so mount-always is fine
```
Placement: after `<Onboarding />`, top level (sibling of `<CanvasArea />`) so it escapes the scaled canvas. `DragOverlay` handles its own portal-to-document.body under the hood.

---

### `src/Grid/Divider.tsx` (attribute add)

**PRIMARY analog:** itself — line 103 is an existing JSX element whose attributes are being extended.

**Existing pattern** (lines 103-115):
```jsx
<div
  className={`
    group/hit absolute z-10
    ${isVerticalContainer ? '-top-[11px] left-0 right-0 h-[22px]' : '-left-[11px] top-0 bottom-0 w-[22px]'}
    ${cursorClass}
  `}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  data-testid={`divider-hit-${containerId}-${siblingIndex}`}
>
```

**Phase 28 edit** — add one attribute (D-25):
```jsx
<div
  ...
  data-testid={`divider-hit-${containerId}-${siblingIndex}`}
  data-dnd-ignore="true"     // NEW — read by PointerSensorMouse/Touch activator (D-26)
>
```

D-29 note: `setPointerCapture` (line 56) REMAINS; this attribute is belt-and-braces.

---

### `src/Grid/OverlayLayer.tsx` (attribute + conditional PE)

**PRIMARY analog:** itself — line 51 (root wrapper) and line 67 (per-overlay div).

**Line 51 edit (D-25):**
```jsx
// BEFORE
<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>

// AFTER
<div
  data-dnd-ignore="true"  // NEW
  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}
>
```

**Line 67 edit (D-27):**
```jsx
// BEFORE
<div
  key={overlay.id}
  style={{ ..., pointerEvents: 'auto', cursor: 'move' }}
  onPointerDown={...}
>

// AFTER — add new selector at top of component
const isDragging = useDragStore(s => s.status === 'dragging');

// Then line 67 becomes:
<div
  key={overlay.id}
  style={{
    ...,
    pointerEvents: isDragging ? 'none' : 'auto',   // D-27 — flip to none during cell drag
    cursor: 'move',
  }}
  onPointerDown={...}
>
```

Also add import at top:
```typescript
import { useDragStore } from '../dnd';
```

---

### Tests — new + rewritten + deleted

#### `src/dnd/__tests__/useCellDraggable.test.tsx` (NEW)

**PRIMARY analog:** `src/dnd/dragStore.test.ts:17-35` (test-setup + beforeEach reset pattern) + `src/Grid/__tests__/LeafNode.test.tsx:16-18` (`withDnd` helper wrapping render in `<DndContext>`).

**Test harness pattern** (compose from both):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { useCellDraggable, useDragStore } from '../../dnd';  // barrel
// ... harness:
function Harness({ id }: { id: string }) {
  const { setNodeRef, listeners, attributes } = useCellDraggable(id);
  // Spread listeners LAST — Pitfall 1
  return <div ref={setNodeRef} {...attributes} {...listeners} data-testid={`leaf-${id}`} />;
}

beforeEach(() => {
  useDragStore.setState({ status: 'idle', kind: null, sourceId: null, overId: null, activeZone: null });
});
```

D-31 note: SC-1/SC-2 activation TIMING is NOT tested via fake-timer simulation (jsdom timer unreliability). Instead, assert sensor CONFIG:
```typescript
// Verify sensor registration produces correct config-value assertions, NOT fake-timer dispatch.
// Example (D-31): import { PointerSensorTouch } from '../adapter/dndkit';
// Instantiate with activationConstraint: { delay: 250, tolerance: 5 } and assert on the instance props.
```

#### `src/dnd/__tests__/useCellDropTarget.test.tsx` (NEW)

**Additional analog:** `src/dnd/computeDropZone.test.ts:24-42` — rect mock helper:
```typescript
function makeRect(left, top, width, height): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height,
           x: left, y: top, toJSON() { return this; } } as DOMRect;
}
```

Reuse this verbatim for simulating target element bounds.

#### `src/dnd/__tests__/integration.test.tsx` (NEW)

**PRIMARY analog:** `src/test/phase25-touch-dnd.test.tsx:367-478` (DRAG-04 "Drop routing" describe block) — the OVERALL TEST SHAPE is correct: render `<CanvasWrapper />`, simulate drag, assert `moveCell` invoked. ADAPT:
- DELETE Phase 25 mocks for `MouseSensor`/`TouchSensor`/`KeyboardSensor` (lines 73-75) and `useDndMonitor` (line 65).
- REPLACE with mocks for `PointerSensorMouse`/`PointerSensorTouch` from the new adapter.
- KEEP the `setStoreRoot` helper (lines 99-106) and the 2-leaf tree fixture (lines 371-384).
- KEEP the self-drop + null-over guard assertions (lines 422-454) — Phase 28 guards in `handleDragEnd`.
- KEEP the `ZONE-09 moveCell('center')` swap assertion pattern (phase09-p03-leafnode-zones lines 209-227).

#### `src/test/phase09-p03-leafnode-zones.test.ts` (REWRITE)

**What to drop** (D-22):
- No more `useDndMonitor` mock refs (this file NEVER mocks it — so safe; just assert new `DropZoneIndicators` render).
- The `describe('LeafNode 5-zone overlay JSX (D-01 visual contract)')` block (lines 169-194) asserts `edge-line-top-*` test-ids which are DELETED. Rewrite to assert `data-testid="drop-zones"` inner icons from `DropZoneIndicators` when `useDragStore` is in `status='dragging' + overId===LEAF_ID`.
- File-drop coexistence tests (lines 118-158, 184-193) — KEEP unchanged (Phase 28 preserves file-drop per D-28).

#### `src/Grid/__tests__/LeafNode.test.tsx` (REWRITE)

**What to drop** (D-22):
- `withDnd` wrapper at line 16-18 currently uses `DndContext` from `@dnd-kit/core` directly. This STILL WORKS after Phase 28 (DndContext still used). The comment "Phase 25: LeafNodeComponent uses useDndMonitor which requires DndContext ancestor." (line 15) — update: `useDndMonitor` removed; `useDroppable`/`useDraggable` from hooks still need DndContext ancestor.
- Tests 1-7 (lines 87-221) are about overflow isolation + placeholder — orthogonal to DnD. No changes.

#### `src/test/phase25-touch-dnd.test.tsx` (DELETE)

D-21: Delete entire file. Phase 25 expectations (Mouse/Touch/Keyboard sensors, 500ms delay, draggable attribute on ActionBar button) are all invalidated.

#### `src/test/phase05-p02-cell-swap.test.ts` (PARTIAL DELETE)

D-21: Delete the 3 tests in `describe('ActionBar drag handle (D-13, D-14)')` at lines 151-204 (drag-handle button removed per DRAG-07). KEEP the `describe('swapCells store action (D-13)')` block (lines 63-145) — those test `gridStore.swapCells` directly and are orthogonal to DnD engine.

---

## Shared Patterns

### Scoped Zustand Selector (per-leaf re-render containment)
**Source:** ARCHITECTURE.md §3 (Zustand selector discipline); already used in Phase 27 `src/dnd/dragStore.ts` test patterns.
**Apply to:** `LeafNode.tsx` (DropZoneIndicators mount gate), `OverlayLayer.tsx` (PE flip), `DragPreviewPortal.tsx` (ghost/rect).
```typescript
// Primitive-return selectors (auto-shallow via Object.is)
const isOver = useDragStore(s => s.overId === id);
const activeZone = useDragStore(s => s.overId === id ? s.activeZone : null);
const isDragging = useDragStore(s => s.status === 'dragging');
```

### Imperative Store Writes from Non-React Callbacks
**Source:** `src/Grid/CanvasWrapper.tsx:75-79` (existing useCallback(handleDragEnd) pattern); `src/Grid/LeafNode.tsx:139, 391` (`useGridStore.getState()` pattern).
**Apply to:** adapter's `onDragStart`/`onDragOver`/`onDragEnd`/`onDragCancel` callbacks.
```typescript
// Pattern: read/write store via getState() — no React subscription inside callback
const zone = useDragStore.getState().activeZone;
useDragStore.getState().setOver(targetId, zone);
useGridStore.getState().moveCell(sourceId, targetId, zone);
```
Rationale: matches D-04 ("imperative… no React re-subscription inside the context") and PITFALLS.md Pitfall 11 (no re-render storm).

### Scale-Stable Visual Sizing Inside Scaled Canvas
**Source:** `src/Grid/Divider.tsx:136` (`scale(${1 / canvasScale})`) and the Phase 25 inline JSX being replaced (`LeafNode.tsx:754` — `size={32 / canvasScale}`).
**Apply to:** `DropZoneIndicators` (D-14 icon sizing).
```typescript
const canvasScale = useEditorStore(s => s.canvasScale);
const iconSize = 32 / canvasScale;
// <Icon size={iconSize} />
```

### `data-dnd-ignore` Defence-in-Depth Marker
**Source:** CONTEXT.md D-25/D-26 (NEW convention — no prior analog).
**Apply to:** `Divider.tsx:103` hit area, `OverlayLayer.tsx:51` root. Consumed by `PointerSensorMouse`/`PointerSensorTouch` activators via `event.target.closest('[data-dnd-ignore]')` BEFORE `onActivation`.
**Enforcement** (D-24): `grep -r 'TouchSensor\|MouseSensor\|DragZoneRefContext\|useDndMonitor' src/` returns zero after Phase 28 teardown.

### `createPortal`-Equivalent Viewport-Space UI
**Source:** ActionBar precedent (per `src/Grid/__tests__/ActionBar.test.tsx:169` comment — "ActionBar renders via createPortal to document.body").
**Apply to:** `DragPreviewPortal` (uses `DragOverlay` from `@dnd-kit/core` — no explicit `createPortal` needed; library handles it).
```typescript
// DragOverlay internally renders into document.body; its children escape the scaled canvas.
// Mount it at EditorShell (top-level), NOT inside CanvasWrapper or LeafNode.
```

### File-Drop / Cell-Drag Separation
**Source:** `src/Grid/LeafNode.tsx:545-552` + `src/Editor/CanvasArea.tsx:23-25` — `dataTransfer.types.includes('Files')` guard pattern.
**Apply to:** DO NOT touch these handlers (D-28). The new engine uses `pointermove`/`pointerup`, not `dragstart`/`dragover`/`drop`, so there is no collision. Preserve EXACTLY as-is.

### React.memo + Scoped Primitives (re-render minimization)
**Source:** `src/Grid/LeafNode.tsx:34` (`React.memo`), `src/Grid/CanvasWrapper.tsx:41`, `src/Grid/Divider.tsx:15`, `src/Grid/ActionBar.tsx:30`.
**Apply to:** `DragPreviewPortal` MAY use `React.memo`; `DropZoneIndicators` is rendered conditionally so memoization is less critical. Not a hard requirement in Phase 28 — but respects project convention.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every Phase 28 file has a Phase 27 skeleton analog OR an in-tree structural analog (CanvasWrapper DndContext block, LeafNode inline zones, Divider/Overlay attribute add, ActionBar portal precedent). The Phase 27 foundation deliberately pre-shaped every API surface Phase 28 fills. |

---

## Metadata

**Analog search scope:**
- `src/dnd/` (Phase 27 skeletons — primary contracts)
- `src/Grid/` (CanvasWrapper, LeafNode, Divider, OverlayLayer, ActionBar — structural analogs and surgical-edit targets)
- `src/Editor/` (EditorShell mount point, CanvasArea file-drop pattern)
- `src/store/` (editorStore.canvasScale, gridStore.moveCell — invariant, not modified)
- `src/test/` + `src/*/__tests__/` (Vitest patterns for new test files)
- `node_modules/@dnd-kit/core/dist/sensors/pointer/`, `components/DragOverlay/`, `modifiers/types.d.ts` (type signatures for sensor subclass + Modifier + DragOverlay props)
- `node_modules/@dnd-kit/modifiers/dist/` (prebuilt modifier shape — confirms scale-compensation must be custom)

**Files scanned:** 24 source files + 6 test files + 8 @dnd-kit typedef files = 38

**Pattern extraction date:** 2026-04-17

**Downstream note for planner:** The "LeafNode surgical edit map" (15 edit points) is the densest section. Planner should consider splitting Phase 28 into at minimum: (1) `dragStore` extension, (2) adapter + sensor subclasses + Modifier, (3) hook bodies, (4) DragPreviewPortal + DropZoneIndicators, (5) CanvasWrapper replace + EditorShell mount, (6) LeafNode surgical teardown + rewire, (7) Divider/OverlayLayer attribute adds, (8) test deletion/rewrite wave. TDD cycles per hook are cleanest per D-30's three new test files (useCellDraggable, useCellDropTarget, integration).
