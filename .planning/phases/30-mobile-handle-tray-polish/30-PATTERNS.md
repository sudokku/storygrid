# Phase 30: Mobile Handle + Tray Polish - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/dnd/dragStore.ts` | store | event-driven | `src/dnd/dragStore.ts` (self — field addition) | exact |
| `src/dnd/useCellDraggable.ts` | hook | request-response | `src/dnd/useCellDraggable.ts` (self — return shape addition) | exact |
| `src/Grid/CanvasWrapper.tsx` | component (DndContext host) | event-driven | `src/Grid/CanvasWrapper.tsx` (self — callback additions) | exact |
| `src/Editor/MobileCellTray.tsx` | component | request-response | `src/Editor/MobileCellTray.tsx` (self — selector addition) | exact |
| `src/dnd/dragStore.test.ts` | test | — | `src/dnd/dragStore.test.ts` (self — describe blocks added) | exact |
| `src/dnd/useCellDraggable.test.ts` (new) | test | — | `src/test/phase25-touch-dnd.test.tsx` + `src/test/phase24-mobile-cell-tray.test.tsx` | role-match |

---

## Pattern Assignments

### `src/dnd/dragStore.ts` (store, event-driven)

**Analog:** self — add `prevSheetSnapState` field and cross-store calls in `beginCellDrag`/`end()`

**Current type block** (`src/dnd/dragStore.ts` lines 39–57):
```typescript
export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  overId: string | null;
  activeZone: DropZone | null;
  ghostUrl: string | null;
  sourceW: number;
  sourceH: number;
  pointerDownX: number;
  pointerDownY: number;
  lastDropId: string | null;
  beginCellDrag: (sourceId: string, ghostUrl: string | null, sourceW: number, sourceH: number) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
  setPointerDown: (x: number, y: number) => void;
  setLastDrop: (id: string) => void;
  clearLastDrop: () => void;
};
```

**New field to add to `DragState` type** — add after `lastDropId`:
```typescript
prevSheetSnapState: 'collapsed' | 'full' | null;
```

**Current `INITIAL_STATE`** (`src/dnd/dragStore.ts` lines 59–71):
```typescript
const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null as DragKind,
  sourceId: null as string | null,
  overId: null as string | null,
  activeZone: null as DropZone | null,
  ghostUrl: null as string | null,
  sourceW: 0,
  sourceH: 0,
  pointerDownX: 0,
  pointerDownY: 0,
  lastDropId: null as string | null,
};
```

**Addition to `INITIAL_STATE`** — add after `lastDropId`:
```typescript
prevSheetSnapState: null as 'collapsed' | 'full' | null,
```

**Current `beginCellDrag` action** (`src/dnd/dragStore.ts` line 75–76):
```typescript
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) =>
  set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null, ghostUrl, sourceW, sourceH }),
```

**Replacement pattern — cross-store imperative access** (D-01):
```typescript
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) => {
  const prevSnap = useEditorStore.getState().sheetSnapState;
  useEditorStore.getState().setSheetSnapState('collapsed');
  set({
    status: 'dragging', kind: 'cell', sourceId,
    overId: null, activeZone: null, ghostUrl, sourceW, sourceH,
    prevSheetSnapState: prevSnap,
  });
},
```

**Current `end()` action** (`src/dnd/dragStore.ts` line 78):
```typescript
end: () => set({ ...INITIAL_STATE }),
```

**Replacement pattern — read-before-reset** (D-01, Pitfall 2):
```typescript
end: () => {
  const { prevSheetSnapState } = useDragStore.getState();
  if (prevSheetSnapState !== null) {
    useEditorStore.getState().setSheetSnapState(prevSheetSnapState);
  }
  set({ ...INITIAL_STATE });
},
```

**Import to add** — `useEditorStore` at top alongside existing `create` import:
```typescript
import { useEditorStore } from '../store/editorStore';
```

**Cross-store pattern precedent** — `MobileCellTray.tsx` line 59 shows `.getState()` inside an async callback (not a hook), confirming the project's existing pattern for imperative cross-store reads outside React render:
```typescript
// src/Editor/MobileCellTray.tsx line 59
const nodeId = useEditorStore.getState().selectedNodeId;
```

---

### `src/dnd/useCellDraggable.ts` (hook, request-response)

**Analog:** self — add `style` property to return type and value

**Current return type** (`src/dnd/useCellDraggable.ts` lines 26–31):
```typescript
export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};
```

**New return type** (D-02):
```typescript
export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;   // CROSS-02 + CROSS-03
};
```

**Current return statement** (`src/dnd/useCellDraggable.ts` lines 52–57):
```typescript
return {
  attributes: attributes as Record<string, unknown>,
  listeners: composedListeners as Record<string, unknown>,
  isDragging,
  setNodeRef,
};
```

**New return statement** (D-02):
```typescript
return {
  attributes: attributes as Record<string, unknown>,
  listeners: composedListeners as Record<string, unknown>,
  isDragging,
  setNodeRef,
  style: {
    touchAction: 'none',          // CROSS-02
    WebkitTouchCallout: 'none',   // CROSS-03
  } as React.CSSProperties,
};
```

**Import to add** — `React` import at top (only needed for the `React.CSSProperties` type reference):
```typescript
import type React from 'react';
```

**LeafNode.tsx integration** (`src/Grid/LeafNode.tsx` lines 294–299) — destructure `style` and update JSX (lines 587–593):
```typescript
// Destructure — add style: dragStyle
const {
  setNodeRef: setDragRef,
  listeners: dragListeners,
  attributes: dragAttributes,
  isDragging,
  style: dragStyle,   // NEW
} = useCellDraggable(id);

// JSX style merge — remove static touchAction from element, spread dragStyle first:
style={{
  ...dragStyle,                          // touchAction: none, WebkitTouchCallout: none
  backfaceVisibility: 'hidden',
  transition: 'opacity 150ms ease-out',
  cursor: isPanMode ? undefined : 'grab',
  opacity: isSource ? 0.4 : 1,
  // NOTE: touchAction: 'none' removed here; now sourced from dragStyle
}}
```

---

### `src/Grid/CanvasWrapper.tsx` (component, event-driven)

**Analog:** self — add CROSS-04/05/06/07 side-effects inside existing drag callbacks

**Module-level stable handler reference** (CROSS-05, Pitfall 1) — add above component definition (after imports):
```typescript
// Stable reference required — removeEventListener must receive the exact same fn reference.
// Module-scope is correct for this single-instance component (see RESEARCH.md Open Question 2).
const suppressContextMenu = (e: Event) => e.preventDefault();
```

**Current `handleDragStart`** (`src/Grid/CanvasWrapper.tsx` lines 75–95):
```typescript
const handleDragStart = useCallback(({ active }: DragStartEvent) => {
  const node = document.querySelector(`[data-testid="leaf-${String(active.id)}"]`) as HTMLElement | null;
  if (!node || node.closest('[data-dnd-ignore="true"]')) {
    return;
  }
  const sourceId = String(active.id);
  const canvas = node.querySelector('canvas') as HTMLCanvasElement | null;
  let ghostUrl: string | null = null;
  try {
    ghostUrl = canvas?.toDataURL('image/png') ?? null;
  } catch {
    ghostUrl = null;
  }
  const rect = node.getBoundingClientRect();
  useDragStore.getState().beginCellDrag(sourceId, ghostUrl, rect.width, rect.height);
  // DRAG-02: body cursor → grabbing.
  document.body.style.cursor = 'grabbing';
}, []);
```

**Additions to `handleDragStart`** after existing `document.body.style.cursor = 'grabbing'` line:
```typescript
document.body.style.userSelect = 'none';                                 // CROSS-04
document.addEventListener('contextmenu', suppressContextMenu, true);     // CROSS-05 (capture phase)
navigator.vibrate?.(10);                                                 // CROSS-06
```

**Current `handleDragEnd`** (`src/Grid/CanvasWrapper.tsx` lines 110–140) — existing cleanup pattern for `document.body.style.cursor = ''` appears in 4 early-return branches and after `setLastDrop`. All branches need the CROSS-04/05 cleanup added.

**Additions to every `document.body.style.cursor = ''` line in `handleDragEnd`**:
```typescript
document.body.style.userSelect = '';                                        // CROSS-04
document.removeEventListener('contextmenu', suppressContextMenu, true);    // CROSS-05
```

**CROSS-07 addition** — after `useDragStore.getState().setLastDrop(toId)` (successful drop only):
```typescript
// CROSS-07: haptic pulse on successful cell move
if (over && String(over.id) !== sourceId) {
  navigator.vibrate?.(15);
}
```

**Current `handleDragCancel`** (`src/Grid/CanvasWrapper.tsx` lines 142–145):
```typescript
const handleDragCancel = useCallback(() => {
  useDragStore.getState().end();
  document.body.style.cursor = '';
}, []);
```

**Additions to `handleDragCancel`** after `document.body.style.cursor = ''`:
```typescript
document.body.style.userSelect = '';                                        // CROSS-04
document.removeEventListener('contextmenu', suppressContextMenu, true);    // CROSS-05
// No vibrate on cancel
```

---

### `src/Editor/MobileCellTray.tsx` (component, request-response)

**Analog:** self — add `isDragging` selector and compose with existing `isVisible` style logic

**Current store subscriptions** (`src/Editor/MobileCellTray.tsx` lines 25–26):
```typescript
const selectedNodeId = useEditorStore(s => s.selectedNodeId);
const isVisible = selectedNodeId !== null;
```

**Addition** — add `useDragStore` import and selector (D-03):
```typescript
import { useDragStore } from '../dnd';

// Inside component, after existing selectedNodeId line:
const isDragging = useDragStore(s => s.status === 'dragging');
```

**Current style block** (`src/Editor/MobileCellTray.tsx` lines 102–109):
```typescript
style={{
  bottom: '60px',
  opacity: isVisible ? 1 : 0,
  transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
  pointerEvents: isVisible ? 'auto' : 'none',
  transition:
    'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
}}
```

**Replacement style block** (D-03):
```typescript
style={{
  bottom: '60px',
  opacity: isDragging ? 0 : (isVisible ? 1 : 0),
  transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
  pointerEvents: (isDragging || !isVisible) ? 'none' : 'auto',
  transition:
    'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
}}
```

The `transition` string is unchanged. The existing `motion-reduce:transition-none` class on the container already handles reduced-motion — no new CSS needed.

---

### `src/dnd/dragStore.test.ts` (test — extend existing)

**Analog:** self — add sections 12+ following the established `describe` block pattern

**Existing `beforeEach` reset** (`src/dnd/dragStore.test.ts` lines 14–28) — must add `prevSheetSnapState: null` once the field is added:
```typescript
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
    prevSheetSnapState: null,   // ADD THIS
  });
});
```

**New describe block pattern** (copy structure from section 10 at lines 350–372):
```typescript
// ---------------------------------------------------------------------------
// 12. prevSheetSnapState — sheet collapse lifecycle (D-01)
// ---------------------------------------------------------------------------
describe('dragStore — prevSheetSnapState (D-01)', () => {
  it('beginCellDrag saves current sheetSnapState to prevSheetSnapState', () => { ... });
  it('beginCellDrag calls setSheetSnapState("collapsed")', () => { ... });
  it('end() restores sheetSnapState via editorStore and resets prevSheetSnapState to null', () => { ... });
  it('end() when prevSheetSnapState is null does NOT call setSheetSnapState', () => { ... });
});
```

**Test mock pattern for `useEditorStore`** — adapt from `src/test/phase25-touch-dnd.test.tsx` lines 28–43 (vi.mock pattern):
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editorStore';

// In each test that checks editorStore side-effects, reset editorStore state:
beforeEach(() => {
  useEditorStore.setState({ sheetSnapState: 'full' });
});

it('beginCellDrag saves current sheetSnapState to prevSheetSnapState', () => {
  useEditorStore.setState({ sheetSnapState: 'full' });
  useDragStore.getState().beginCellDrag('leaf-1', null, 0, 0);
  expect(useDragStore.getState().prevSheetSnapState).toBe('full');
  expect(useEditorStore.getState().sheetSnapState).toBe('collapsed');
});
```

---

### `src/dnd/useCellDraggable.test.ts` (new test file)

**Analog:** `src/test/phase25-touch-dnd.test.tsx` (hook mock structure) + `src/test/phase24-mobile-cell-tray.test.tsx` (store state setup)

**File header pattern** (from `src/test/phase25-touch-dnd.test.tsx` lines 1–15 and `src/dnd/dragStore.test.ts` lines 1–10):
```typescript
/**
 * useCellDraggable — hook unit tests (Phase 30, D-02)
 *
 * Covers: style object shape (CROSS-02, CROSS-03),
 *         return type completeness.
 */
import { describe, it, expect } from 'vitest';
```

**Hook test pattern** — `useCellDraggable` uses `useDraggable` from `@dnd-kit/core` which requires `DndContext`. Mock `@dnd-kit/core` following the pattern from `src/test/phase25-touch-dnd.test.tsx` lines 50–78:
```typescript
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    useDraggable: () => ({
      attributes: { role: 'gridcell', tabIndex: 0 },
      listeners: {},
      isDragging: false,
      setNodeRef: vi.fn(),
    }),
  };
});
```

**Style assertion pattern** (D-04):
```typescript
import { renderHook } from '@testing-library/react';
import { useCellDraggable } from './useCellDraggable';

it('style contains touchAction: none (CROSS-02)', () => {
  const { result } = renderHook(() => useCellDraggable('leaf-1'));
  expect(result.current.style.touchAction).toBe('none');
});

it('style contains WebkitTouchCallout: none (CROSS-03)', () => {
  const { result } = renderHook(() => useCellDraggable('leaf-1'));
  expect(result.current.style.WebkitTouchCallout).toBe('none');
});
```

---

## Shared Patterns

### Cross-Store Imperative Access
**Source:** `src/Editor/MobileCellTray.tsx` line 59; `src/dnd/dragStore.ts` (existing `useDragStore.getState()` calls in actions)
**Apply to:** `dragStore.ts` `beginCellDrag` and `end()` — access `editorStore` via `.getState()`, not React hooks
```typescript
// Pattern: imperative cross-store read outside React render
const nodeId = useEditorStore.getState().selectedNodeId;
// Or within store actions:
const prevSnap = useEditorStore.getState().sheetSnapState;
useEditorStore.getState().setSheetSnapState('collapsed');
```

### Optional Chaining for Browser API Guards
**Source:** CONTEXT.md `## Specifics` — project convention confirmed
**Apply to:** All `navigator.vibrate` calls in `CanvasWrapper.tsx`
```typescript
navigator.vibrate?.(10);   // safe on iOS Safari and jsdom — no try/catch needed
navigator.vibrate?.(15);
```

### Drag Lifecycle Side-Effect Pattern
**Source:** `src/Grid/CanvasWrapper.tsx` lines 94, 115, 129, 137, 144 — `document.body.style.cursor` mutations
**Apply to:** CROSS-04 (`userSelect`), CROSS-05 (`contextmenu` listener), CROSS-06/07 (`vibrate`) — all follow the same pattern: set in `handleDragStart`, clear in every branch of `handleDragEnd` and in `handleDragCancel`
```typescript
// Pattern: side-effect set on drag-start, cleared in ALL drag-end paths
// handleDragStart:
document.body.style.cursor = 'grabbing';   // existing — mirrors new userSelect pattern

// handleDragEnd (4 branches) + handleDragCancel:
document.body.style.cursor = '';           // existing — mirrors new userSelect pattern
```

### Zustand Selector for Reactive Drag State
**Source:** `src/Grid/LeafNode.tsx` lines 309–311
**Apply to:** `MobileCellTray.tsx` `isDragging` selector
```typescript
// Pattern: fine-grained selector on dragStore status
const isSource = useDragStore((s) => s.sourceId === id && s.status === 'dragging');
const isDropTarget = useDragStore((s) => s.overId === id && s.status === 'dragging');
// New in Phase 30:
const isDragging = useDragStore(s => s.status === 'dragging');
```

### Vitest Store Reset in `beforeEach`
**Source:** `src/dnd/dragStore.test.ts` lines 14–28
**Apply to:** New test files for `useCellDraggable` and `CanvasWrapper` — reset all affected stores to known state before each test
```typescript
beforeEach(() => {
  useDragStore.setState({ ...INITIAL_STATE_OBJECT });
  useEditorStore.setState({ sheetSnapState: 'collapsed', ... });
});
```

---

## No Analog Found

All files in Phase 30 are modifications to existing files. No files lack a codebase analog.

---

## Metadata

**Analog search scope:** `src/dnd/`, `src/Grid/`, `src/Editor/`, `src/store/`, `src/test/`
**Files scanned:** 10 source files + 5 test files read directly
**Pattern extraction date:** 2026-04-19
