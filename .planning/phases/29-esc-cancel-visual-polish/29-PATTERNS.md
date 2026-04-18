# Phase 29: ESC-Cancel + Visual Polish - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 7 (6 modified + 1 test update)
**Analogs found:** 7 / 7 (all files are existing codebase files being modified — no new files)

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/dnd/dragStore.ts` | store | event-driven | self (extend existing store) | exact — add fields/actions to existing vanilla Zustand store |
| `src/dnd/DragPreviewPortal.tsx` | component | event-driven | self (modify existing portal) | exact — modify grabOffsetModifier + DragOverlay props |
| `src/dnd/useCellDraggable.ts` | hook | event-driven | self (extend existing hook) | exact — no structural change, upstream call site changes |
| `src/Grid/CanvasWrapper.tsx` | component | event-driven | self (modify existing DndContext host) | exact — extend sensors config + handleDragEnd ordering |
| `src/Grid/LeafNode.tsx` | component | event-driven | self (modify existing leaf) | exact — add pointer capture call + CSS animation classes |
| `src/index.css` | config | — | self (extend existing CSS) | exact — add CSS variable + @keyframes following existing drag-hold-pulse pattern |
| `src/dnd/dragStore.test.ts` | test | — | self (extend existing test suite) | exact — extend beforeEach + add new describe blocks following existing test structure |

---

## Pattern Assignments

### `src/dnd/dragStore.ts` — extend store with 3 new fields + 3 new actions

**Analog:** self. Existing store at `/Users/radu/Developer/storygrid/src/dnd/dragStore.ts`.

**Existing DragState type pattern** (lines 33–45) — extend with 6 new declarations:
```typescript
// Existing type shape to copy from:
export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  // ... 5 more fields
  beginCellDrag: (sourceId: string, ghostUrl: string | null, sourceW: number, sourceH: number) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
};

// NEW declarations to add after existing fields, before actions:
  pointerDownX: number;
  pointerDownY: number;
  lastDropId: string | null;

// NEW action declarations to add after existing actions:
  setPointerDown: (x: number, y: number) => void;
  setLastDrop: (id: string) => void;
  clearLastDrop: () => void;
```

**Existing INITIAL_STATE pattern** (lines 47–56) — extend with 3 new entries:
```typescript
// Existing INITIAL_STATE (copy pattern exactly):
const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null as DragKind,
  sourceId: null as string | null,
  overId: null as string | null,
  activeZone: null as DropZone | null,
  ghostUrl: null as string | null,
  sourceW: 0,
  sourceH: 0,
  // ADD these three lines:
  pointerDownX: 0,
  pointerDownY: 0,
  lastDropId: null as string | null,
};
```

**Existing action implementation pattern** (lines 58–64) — copy structure for new actions:
```typescript
// Existing actions (copy set({}) call pattern exactly):
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) =>
  set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null, ghostUrl, sourceW, sourceH }),
setOver: (overId, activeZone) => set({ overId, activeZone }),
end: () => set({ ...INITIAL_STATE }),

// NEW actions to add (same single-expression set() pattern):
setPointerDown: (x, y) => set({ pointerDownX: x, pointerDownY: y }),
setLastDrop: (id) => set({ lastDropId: id }),
clearLastDrop: () => set({ lastDropId: null }),
```

**Key constraint:** `end()` already uses `set({ ...INITIAL_STATE })` (line 63) — the three new fields are automatically reset if they are in `INITIAL_STATE`. No change to `end()` needed.

---

### `src/dnd/DragPreviewPortal.tsx` — grabOffsetModifier fix + DragOverlay config + ghost visual

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/dnd/DragPreviewPortal.tsx`.

**grabOffsetModifier: replace activatorEvent coords with dragStore.getState()** (lines 35–67):
```typescript
// BEFORE (reads activatorEvent — fires after sensor threshold delay):
export const grabOffsetModifier: Modifier = ({
  transform,
  activatorEvent,
  draggingNodeRect,
}) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  // ...complex event type dispatch to get clientX/Y...

// AFTER (reads pointerDownX/Y stored at onPointerDown — true grab point):
export const grabOffsetModifier: Modifier = ({
  transform,
  draggingNodeRect,
}) => {
  if (!draggingNodeRect) return transform;
  const { pointerDownX, pointerDownY } = useDragStore.getState();
  // Guard: keyboard-initiated drags fire no pointer event → coords are (0,0)
  if (pointerDownX === 0 && pointerDownY === 0) return transform;

  const offsetX = pointerDownX - draggingNodeRect.left;
  const offsetY = pointerDownY - draggingNodeRect.top;
  const centreDeltaX = offsetX - draggingNodeRect.width / 2;
  const centreDeltaY = offsetY - draggingNodeRect.height / 2;

  return {
    ...transform,
    x: transform.x + centreDeltaX,
    y: transform.y + centreDeltaY,
  };
};
```

**DragOverlay dropAnimation: replace null with custom config** (line 76):
```typescript
// BEFORE:
<DragOverlay dropAnimation={null} modifiers={[grabOffsetModifier]}>

// AFTER (D-07: 200ms ease-in snap-back; also add prefers-reduced-motion guard):
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// ...
<DragOverlay
  dropAnimation={prefersReducedMotion ? null : { duration: 200, easing: 'ease-in' }}
  modifiers={[grabOffsetModifier]}
>
```

**Ghost img: opacity + size cap** (lines 78–92):
```typescript
// BEFORE:
<img
  src={ghostUrl}
  width={sourceW}
  height={sourceH}
  style={{
    opacity: 1,
    display: 'block',
    pointerEvents: 'none',
    width: `${sourceW}px`,
    height: `${sourceH}px`,
  }}
  alt=""
  draggable={false}
/>

// AFTER (D-05: opacity 0.2; D-03/D-04: max-w/h via CSS variable):
<img
  src={ghostUrl}
  width={sourceW}
  height={sourceH}
  className="max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)]"
  style={{
    opacity: 0.2,
    display: 'block',
    pointerEvents: 'none',
    width: `${sourceW}px`,
    height: `${sourceH}px`,
  }}
  alt=""
  draggable={false}
/>
```

---

### `src/dnd/useCellDraggable.ts` — no structural change; pointer capture wired in LeafNode

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/dnd/useCellDraggable.ts`.

This file requires **no changes**. The `setPointerDown` call is wired directly into `LeafNode.tsx`'s `handlePointerDown` callback (see below). The RESEARCH.md confirms Option B: LeafNode calls `dragStore.setPointerDown` directly — no change to this hook's interface.

The existing hook (lines 32–43) is the template. Nothing to modify here.

---

### `src/Grid/CanvasWrapper.tsx` — add KeyboardSensor + fix handleDragEnd ordering

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/Grid/CanvasWrapper.tsx`.

**KeyboardSensor: extend import and useSensors** (lines 8, 55–61):
```typescript
// BEFORE import (line 8):
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

// AFTER (add KeyboardSensor):
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

// BEFORE sensors (lines 55–61):
const touchSensor = useSensor(PointerSensor, {
  activationConstraint: { delay: 250, tolerance: 5 },
});
const mouseSensor = useSensor(PointerSensor, {
  activationConstraint: { distance: 8 },
});
const sensors = useSensors(touchSensor, mouseSensor);

// AFTER (add keyboard sensor — no activationConstraint needed for ESC-cancel):
const touchSensor = useSensor(PointerSensor, {
  activationConstraint: { delay: 250, tolerance: 5 },
});
const mouseSensor = useSensor(PointerSensor, {
  activationConstraint: { distance: 8 },
});
const keyboardSensor = useSensor(KeyboardSensor);
const sensors = useSensors(touchSensor, mouseSensor, keyboardSensor);
```

**handleDragEnd: fix ordering to put setLastDrop before end()** (lines 98–107):
```typescript
// BEFORE (end() called first — flash would be cleared before render):
const handleDragEnd = useCallback(({ over }: DragEndEvent) => {
  const { sourceId, activeZone } = useDragStore.getState();
  useDragStore.getState().end();              // ← end() first is wrong for D-08
  document.body.style.cursor = '';
  if (!sourceId) return;
  if (!over) return;
  const toId = String(over.id);
  if (toId === sourceId) return;
  moveCell(sourceId, toId, activeZone ?? 'center');
}, [moveCell]);

// AFTER (correct order per RESEARCH.md Pitfall 3):
const handleDragEnd = useCallback(({ over }: DragEndEvent) => {
  const { sourceId, activeZone } = useDragStore.getState();
  if (!sourceId) {
    useDragStore.getState().end();
    document.body.style.cursor = '';
    return;
  }
  if (!over) {
    useDragStore.getState().end();
    document.body.style.cursor = '';
    return;
  }
  const toId = String(over.id);
  if (toId === sourceId) {
    useDragStore.getState().end();
    document.body.style.cursor = '';
    return;
  }
  moveCell(sourceId, toId, activeZone ?? 'center');
  useDragStore.getState().setLastDrop(toId);         // 1. set flash BEFORE end()
  useDragStore.getState().end();                     // 2. reset drag state
  document.body.style.cursor = '';                  // 3. cursor
  setTimeout(() => useDragStore.getState().clearLastDrop(), 700);  // 4. schedule clear
}, [moveCell]);
```

---

### `src/Grid/LeafNode.tsx` — pointer capture + flash class + wobble class

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/Grid/LeafNode.tsx`.

**handlePointerDown: add setPointerDown call before pan mode guard** (lines 494–501):
```typescript
// BEFORE (returns early when not in pan mode — loses pointer coords for ghost):
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (!isPanMode) return;
  e.preventDefault();
  e.stopPropagation();
  divRef.current?.setPointerCapture?.(e.pointerId);
  const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
  panStartRef.current = { x: e.clientX, y: e.clientY, panX: n?.panX ?? 0, panY: n?.panY ?? 0 };
}, [isPanMode, id]);

// AFTER (D-01/D-02: record coords at true pointerdown time, before pan guard):
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  // D-01/D-02: capture pointer coords at true pointerdown for ghost offset fix
  useDragStore.getState().setPointerDown(e.clientX, e.clientY);
  if (!isPanMode) return;
  e.preventDefault();
  e.stopPropagation();
  divRef.current?.setPointerCapture?.(e.pointerId);
  const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
  panStartRef.current = { x: e.clientX, y: e.clientY, panX: n?.panX ?? 0, panY: n?.panY ?? 0 };
}, [isPanMode, id]);
```

**New dragStore selectors — add near existing isDragging/isDropTarget subscriptions**:

The existing selector pattern from `DropZoneIndicators.tsx` (line 23) — `useDragStore((s) => s.overId === cellId ? s.activeZone : null)` — is the model to copy for both new selectors:
```typescript
// Add these two selectors in LeafNodeComponent alongside other dragStore selectors:
const isLastDrop = useDragStore((s) => s.lastDropId === id);
// isDragging already available from useCellDraggable return value (line 33 of useCellDraggable.ts)
```

**Root div className: add wobble + flash animation classes** (lines 572–579 of LeafNode.tsx):
```typescript
// BEFORE (existing className template):
className={`
  relative w-full h-full overflow-visible select-none
  ${isHovered && !isPanMode ? 'z-20' : ''}
  ${isDragging ? 'z-50' : ''}
  ${ringClass}
  ${hasMedia ? '' : 'bg-[#1c1c1c]'}
`}

// AFTER (add wobble on isDragging, flash on isLastDrop):
className={`
  relative w-full h-full overflow-visible select-none
  ${isHovered && !isPanMode ? 'z-20' : ''}
  ${isDragging ? 'z-50' : ''}
  ${isDragging ? 'animate-cell-wobble' : ''}
  ${isLastDrop ? 'animate-drop-flash' : ''}
  ${ringClass}
  ${hasMedia ? '' : 'bg-[#1c1c1c]'}
`}
```

**PITFALL (from RESEARCH.md line 458):** Do NOT add a second `onPointerDown` attribute to the JSX element. The `dragListeners` spread at the end of the element (line 597) also contains `onPointerDown` from dnd-kit. React silently uses only the last `onPointerDown`. The `setPointerDown` call MUST go inside the existing `handlePointerDown` callback, not as a separate JSX attribute.

---

### `src/index.css` — CSS variable + @keyframes

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/index.css`.

**Pattern to copy: existing CSS variable declarations** (lines 8–13):
```css
/* Existing :root block (lines 8-13) — copy the same structure: */
:root {
  --canvas-width: 1080px;
  --canvas-height: 1920px;
  --safe-zone-top: 250px;
  --safe-zone-bottom: 250px;
  /* ADD: */
  --ghost-cap: 200px;
}
```

**Pattern to copy: existing @keyframes** (lines 106–109):
```css
/* Existing animation (lines 106-109) — copy the @keyframes pattern: */
@keyframes drag-hold-pulse {
  0%, 100% { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.0); }
  50%       { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4); }
}

/* ADD these two new @keyframes after drag-hold-pulse: */
@keyframes cell-wobble {
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(1.5deg); }
  75%  { transform: rotate(-1.5deg); }
  100% { transform: rotate(0deg); }
}

@keyframes drop-flash {
  0%   { box-shadow: 0 0 0 3px var(--primary); }
  100% { box-shadow: none; }
}
```

**Pattern to copy: existing prefers-reduced-motion block** (lines 111–116):
```css
/* Existing reduced-motion block (lines 111-116) — extend it: */
@media (prefers-reduced-motion: reduce) {
  [data-hold-pending="true"] {
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35);
    animation: none !important;
  }
  /* ADD inside same media query: */
  .animate-cell-wobble,
  .animate-drop-flash {
    animation: none !important;
  }
}
```

**Note on CSS token choice:** `var(--ring)` is `oklch(0.708 0 0)` — a medium gray, low contrast on dark cells. Using `var(--primary)` (`oklch(0.205 0 0)` in light mode, `oklch(0.922 0 0)` in dark mode) gives higher contrast on the dark canvas background. This is Claude's discretion per CONTEXT.md.

---

### `tailwind.config.js` — add animation extensions

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/tailwind.config.js`.

**Existing theme.extend pattern** (lines 5–58) — insert `animation` and `keyframes` keys:
```javascript
// Existing theme.extend has: colors, borderRadius, fontFamily
// ADD inside theme.extend alongside existing keys:
animation: {
  'cell-wobble': 'cell-wobble 150ms ease-in-out',
  'drop-flash': 'drop-flash 700ms ease-out',
},
keyframes: {
  'cell-wobble': {
    '0%':   { transform: 'rotate(0deg)' },
    '25%':  { transform: 'rotate(1.5deg)' },
    '75%':  { transform: 'rotate(-1.5deg)' },
    '100%': { transform: 'rotate(0deg)' },
  },
  'drop-flash': {
    '0%':   { boxShadow: '0 0 0 3px var(--primary)' },
    '100%': { boxShadow: 'none' },
  },
},
```

This enables `animate-cell-wobble` and `animate-drop-flash` as Tailwind utility classes.

---

### `src/dnd/dragStore.test.ts` — extend beforeEach + add new test blocks

**Analog:** self. Existing file at `/Users/radu/Developer/storygrid/src/dnd/dragStore.test.ts`.

**beforeEach: add 3 new fields to reset object** (lines 14–25):
```typescript
// BEFORE (lines 14-25) — resets only original 8 fields:
beforeEach(() => {
  useDragStore.setState({
    status: 'idle',
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
    ghostUrl: null,
    sourceW: 0,
    sourceH: 0,
  });
});

// AFTER — add 3 new fields so they reset between tests:
beforeEach(() => {
  useDragStore.setState({
    status: 'idle',
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
    ghostUrl: null,
    sourceW: 0,
    sourceH: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    lastDropId: null,
  });
});
```

**New describe blocks: copy structure from existing section 9** (lines 293–342):
```typescript
// Copy describe() + it() structure exactly from existing ghost field tests:
describe('dragStore — pointer down fields (D-02)', () => {
  it('setPointerDown(x, y) sets pointerDownX and pointerDownY', () => {
    useDragStore.getState().setPointerDown(120, 340);
    expect(useDragStore.getState().pointerDownX).toBe(120);
    expect(useDragStore.getState().pointerDownY).toBe(340);
  });
  it('end() resets pointerDownX and pointerDownY to 0', () => {
    useDragStore.getState().setPointerDown(100, 200);
    useDragStore.getState().end();
    expect(useDragStore.getState().pointerDownX).toBe(0);
    expect(useDragStore.getState().pointerDownY).toBe(0);
  });
});

describe('dragStore — lastDropId / drop flash (D-08)', () => {
  it('setLastDrop(id) sets lastDropId', () => {
    useDragStore.getState().setLastDrop('leaf-42');
    expect(useDragStore.getState().lastDropId).toBe('leaf-42');
  });
  it('clearLastDrop() sets lastDropId to null', () => {
    useDragStore.getState().setLastDrop('leaf-42');
    useDragStore.getState().clearLastDrop();
    expect(useDragStore.getState().lastDropId).toBeNull();
  });
  it('end() resets lastDropId to null', () => {
    useDragStore.getState().setLastDrop('leaf-42');
    useDragStore.getState().end();
    expect(useDragStore.getState().lastDropId).toBeNull();
  });
});
```

---

## Shared Patterns

### Vanilla Zustand get/set pattern (no Immer)
**Source:** `src/dnd/dragStore.ts` lines 58–64
**Apply to:** All new actions in `dragStore.ts`
```typescript
// Pattern: single-expression set() call, no produce(), no draft
actionName: (arg) => set({ fieldName: arg }),
```
The store has no Immer middleware (confirmed by test at lines 249–255). All sets are plain object spreads.

### dragStore.getState() imperative reads in event handlers
**Source:** `src/Grid/CanvasWrapper.tsx` lines 99–106
**Apply to:** New `setLastDrop` / `end()` / `clearLastDrop` calls in `handleDragEnd`
```typescript
// Pattern: read and mutate store imperatively in useCallback handlers
// Never useStore() hook in event handlers (not a React render context)
const { sourceId, activeZone } = useDragStore.getState();
useDragStore.getState().end();
```

### useDragStore selector pattern for component subscriptions
**Source:** `src/dnd/DropZoneIndicators.tsx` line 23
**Apply to:** `isLastDrop` selector in `LeafNode.tsx`
```typescript
// Pattern: boolean selector derived from store field === componentId
const isLastDrop = useDragStore((s) => s.lastDropId === id);
// Same pattern used for: s.overId === cellId ? s.activeZone : null
```

### CSS animation class conditional on boolean state
**Source:** `src/Grid/LeafNode.tsx` lines 573–579 (existing className template)
**Apply to:** `animate-cell-wobble` (on `isDragging`) and `animate-drop-flash` (on `isLastDrop`)
```typescript
// Pattern: ternary in template literal class list
${isDragging ? 'z-50' : ''}
// New entries follow identical structure:
${isDragging ? 'animate-cell-wobble' : ''}
${isLastDrop ? 'animate-drop-flash' : ''}
```

### @keyframes in index.css + prefers-reduced-motion guard
**Source:** `src/index.css` lines 106–116
**Apply to:** `cell-wobble` and `drop-flash` keyframe definitions
```css
/* Pattern: declare @keyframe, then disable in prefers-reduced-motion block */
@keyframes drag-hold-pulse { ... }

@media (prefers-reduced-motion: reduce) {
  [data-hold-pending="true"] { animation: none !important; }
}
```

---

## No Analog Found

None — all 7 files are existing codebase files being modified. Every pattern has a direct codebase source.

---

## Metadata

**Analog search scope:** `src/dnd/`, `src/Grid/`, `src/index.css`, `tailwind.config.js`
**Files read:** 8 source files + 2 context files
**Pattern extraction date:** 2026-04-19
