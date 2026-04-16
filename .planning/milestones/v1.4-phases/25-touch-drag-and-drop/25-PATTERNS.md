# Phase 25: Touch Drag-and-Drop - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 3 (2 modified, 1 new)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/Grid/LeafNode.tsx` | component | event-driven | `src/Grid/LeafNode.tsx` (self — migrate existing pattern) | exact |
| `src/Grid/CanvasWrapper.tsx` | component (context host) | event-driven | `src/Grid/CanvasWrapper.tsx` (self — add DndContext wrapper) | exact |
| `src/test/phase25-touch-dnd.test.tsx` | test | request-response | `src/Grid/__tests__/LeafNode.test.tsx` + `src/test/phase24-mobile-cell-tray.test.tsx` | role-match |

---

## Pattern Assignments

### `src/Grid/LeafNode.tsx` (component, event-driven — MODIFIED)

**Analog:** `src/Grid/LeafNode.tsx` (self) — migrate HTML5 native drag to @dnd-kit hooks

**Current imports to EXTEND** (lines 1–10):
```typescript
import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
// ... existing imports ...
```

ADD these imports (insert after existing imports):
```typescript
import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';
import type { DragOverEvent } from '@dnd-kit/core';
```

**State to ADD** (after existing `const [activeZone, setActiveZone]` on line 56):
```typescript
// Phase 25: hold-pulse state for 500ms pre-activation visual feedback (D-05)
const [isPendingDrag, setIsPendingDrag] = useState(false);
```

**Replace HTML5 drag handler block** (lines 422–511 — `handleDragOver`, `handleDragLeave`, `handleDrop`):

Remove these three handlers entirely. They are replaced by `useDraggable` + `useDroppable` + `useDndMonitor`.

**ADD after existing `useEffect` hooks, before the early-return guard** (`if (!node || node.type !== 'leaf') return null`):

```typescript
// Phase 25 D-01/D-04: @dnd-kit draggable — replaces HTML5 ondragstart on ActionBar button
const {
  setNodeRef: setDragNodeRef,
  listeners: dragListeners,
  isDragging,
} = useDraggable({ id, data: { nodeId: id } });

// Phase 25 D-01: @dnd-kit droppable — target for other cells being dragged
const { setNodeRef: setDropNodeRef } = useDroppable({ id, data: { nodeId: id } });

// Phase 25 D-03: track active drag state to show 5-zone overlays on non-dragged cells
useDndMonitor({
  onDragOver({ over, activatorEvent }: DragOverEvent) {
    if (over?.id !== id) { setActiveZone(null); return; }
    const rect = divRef.current?.getBoundingClientRect();
    if (!rect || !activatorEvent) return;
    // Re-use the exact same zone math from the removed handleDragOver (formerly lines 429–443)
    const clientX = (activatorEvent as PointerEvent).clientX;
    const clientY = (activatorEvent as PointerEvent).clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const threshold = Math.max(20, Math.min(w, h) * 0.2);
    let zone: ActiveZone;
    if (y < threshold) zone = 'top';
    else if (y > h - threshold) zone = 'bottom';
    else if (x < threshold) zone = 'left';
    else if (x > w - threshold) zone = 'right';
    else zone = 'center';
    setActiveZone(zone);
  },
  onDragEnd() { setActiveZone(null); setIsPendingDrag(false); },
  onDragCancel() { setActiveZone(null); setIsPendingDrag(false); },
});
```

**Merge refs on root div** (currently line 589 `ref={divRef}`):
```typescript
ref={(el) => { divRef.current = el; setDragNodeRef(el); setDropNodeRef(el); }}
```

**Add drag lift styles + spread dragListeners on root div** (after existing `style={{ backfaceVisibility: 'hidden' }}`):
```typescript
{...dragListeners}
style={{
  backfaceVisibility: 'hidden',
  // DRAG-02: lift state — scale up + dim when this cell is being dragged
  ...(isDragging ? { transform: 'scale(1.08)', opacity: 0.6, zIndex: 50 } : {}),
  // D-05: hold-pulse animation during the 500ms wait before drag activates
  animation: isPendingDrag && !isDragging ? 'drag-hold-pulse 500ms ease-in-out forwards' : undefined,
  // touch-action:none on the leaf cell so TouchSensor can intercept touchmove
  // (leaf divs are not scroll containers; pinch-to-zoom uses passive touchstart/touchmove)
  touchAction: 'none',
}}
```

**Remove from JSX** — delete these props from the root `<div>` (lines 603–606):
```typescript
onDragOver={handleDragOver}   // REMOVE
onDragLeave={handleDragLeave} // REMOVE
onDrop={handleDrop}           // REMOVE
```

**Retain intact** — the 5-zone overlay JSX (lines 660–702) is kept without changes. The `activeZone` state now gets set by `useDndMonitor.onDragOver` instead of `handleDragOver`.

**File drop** — extract file-drop portion from the removed `handleDrop` into a new standalone `handleFileDrop` handler, still attached to the root div via `onDrop`. File drops use `React.DragEvent` (HTML5 file drag from desktop) and do NOT conflict with @dnd-kit pointer events.

---

### `src/Grid/CanvasWrapper.tsx` (component context host, event-driven — MODIFIED)

**Analog:** `src/Grid/CanvasWrapper.tsx` (self) — add DndContext wrapping the canvas-surface div

**Current imports** (lines 1–7 — unchanged):
```typescript
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { useShallow } from 'zustand/react/shallow';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { GridNodeComponent } from './GridNode';
import { OverlayLayer } from './OverlayLayer';
```

ADD imports:
```typescript
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
```

**ADD inside `CanvasWrapper` component body** (after existing state declarations, before `useEffect`):
```typescript
// Phase 25 D-02/D-07: unified sensor config — MouseSensor for desktop, TouchSensor for mobile
const sensors = useSensors(
  useSensor(MouseSensor, {
    // 5px movement threshold prevents accidental drag on click (desktop)
    activationConstraint: { distance: 5 },
  }),
  useSensor(TouchSensor, {
    // DRAG-01: 500ms long-press to initiate drag; 5px tolerance allows finger wobble
    activationConstraint: { delay: 500, tolerance: 5 },
  }),
);

// Track active zone across DragOver events so onDragEnd can read it (RESEARCH Pattern 4)
const activeZoneRef = useRef<'center' | 'top' | 'bottom' | 'left' | 'right'>('center');

const moveCell = useGridStore(s => s.moveCell);

const handleDragOver = useCallback((_event: DragOverEvent) => {
  // Zone computation happens inside each LeafNode via useDndMonitor.
  // CanvasWrapper only needs to track the latest zone from a ref that LeafNodes write to,
  // OR zone is passed via over.data.current if useDroppable data is updated dynamically.
  // Simplest: expose a setter via React context or pass through DndContext.onDragOver.
  // Per RESEARCH Pattern 4: use activeZoneRef populated by LeafNode useDndMonitor callback.
}, []);

const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
  // D-10: drop outside any droppable = cancel = no-op
  if (!over || active.id === over.id) return;
  const zone = activeZoneRef.current ?? 'center';
  moveCell(String(active.id), String(over.id), zone);
}, [moveCell]);
```

**Wrap the canvas-surface div** (currently line 87–103):
```typescript
// BEFORE (line 87):
<div
  className="relative group mt-8 flex-shrink-0"
  style={{ ... }}
  onClick={handleBgClick}
  data-testid="canvas-surface"
>
  <GridNodeComponent id={rootId} />
  ...
</div>

// AFTER: wrap with DndContext (D-02)
<DndContext
  sensors={sensors}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <div
    className="relative group mt-8 flex-shrink-0"
    style={{ ... }}
    onClick={handleBgClick}
    data-testid="canvas-surface"
  >
    <GridNodeComponent id={rootId} />
    ...
  </div>
</DndContext>
```

**No changes to outer layout** — the `containerRef` div (line 82–103) and all existing `useEffect` hooks remain unchanged.

**ActionBar drag handle** (confirmed read-only — `src/Grid/ActionBar.tsx` lines 77–88):
The ActionBar drag handle uses native `draggable` + `onDragStart` with `dataTransfer.setData('text/cell-id', nodeId)`. This is desktop-only HTML5 drag. After Phase 25, this mechanism is REPLACED by `@dnd-kit` `dragListeners` spread on `LeafNode`'s root div — the drag handle button in ActionBar should have its `draggable` and `onDragStart` props removed and a visual-only `GripVertical` icon retained. The `@dnd-kit` drag listeners on the cell root enable drag from anywhere on the cell, including the handle area.

---

### `src/test/phase25-touch-dnd.test.tsx` (test, request-response — NEW)

**Analog 1:** `src/Grid/__tests__/LeafNode.test.tsx` — store setup helpers, `makeLeaf`, `setStoreRoot`, `beforeEach` reset pattern

**Analog 2:** `src/test/phase24-mobile-cell-tray.test.tsx` — full store state reset in `beforeEach`, `afterEach` with `vi.restoreAllMocks()`

**File header pattern** (from `LeafNode.test.tsx` lines 1–6):
```typescript
/**
 * phase25-touch-dnd.test.tsx
 * Tests for DRAG-01 through DRAG-04 requirements.
 * Phase 25 — Touch Drag-and-Drop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
```

**Store helper pattern** (from `LeafNode.test.tsx` lines 18–41):
```typescript
function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  return {
    type: 'leaf',
    id: 'leaf-1',
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    audioEnabled: true,
    ...overrides,
  };
}

function setStoreRoot(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({
    root,
    mediaRegistry: registry,
    history: [{ root }],
    historyIndex: 0,
  });
}
```

**beforeEach/afterEach pattern** (from `phase24-mobile-cell-tray.test.tsx` lines 47–82):
```typescript
beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({ selectedNodeId: null, zoom: 1, canvasScale: 1, ... });
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

**@dnd-kit mock pattern for tests** — mock `@dnd-kit/core` to isolate sensor behavior:
```typescript
// Mock useDraggable — returns isDragging flag controllable in tests
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    useDraggable: vi.fn(() => ({
      setNodeRef: vi.fn(),
      listeners: {},
      isDragging: false,
      attributes: {},
    })),
    useDroppable: vi.fn(() => ({
      setNodeRef: vi.fn(),
      isOver: false,
    })),
    useDndMonitor: vi.fn(),
  };
});
```

**Test structure** — one `describe` block per requirement:
```typescript
describe('DRAG-01: TouchSensor config', () => { ... });   // sensor delay=500, tolerance=5
describe('DRAG-02: Visual lift feedback', () => { ... }); // isDragging → scale+opacity style
describe('DRAG-03: 5-zone overlays render during drag', () => { ... }); // useDndMonitor → activeZone
describe('DRAG-04: Drop routing calls moveCell', () => { ... }); // onDragEnd dispatch
```

---

## Shared Patterns

### React.memo Wrapping
**Source:** `src/Grid/LeafNode.tsx` line 30, `src/Grid/CanvasWrapper.tsx` line 28
**Apply to:** All modified components — KEEP existing `React.memo` wrapping. Do not remove.
```typescript
export const LeafNodeComponent = React.memo(function LeafNodeComponent({ id }: LeafNodeProps) {
export const CanvasWrapper = React.memo(function CanvasWrapper() {
```

### Hold-Pulse Keyframe Animation
**Source:** New — add to `src/index.css`
**Apply to:** `LeafNode.tsx` `isPendingDrag` state
```css
/* src/index.css — add inside @layer utilities or at root level */
@keyframes drag-hold-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.03); }
  100% { transform: scale(1.03); }
}
```
The `src/index.css` currently defines `:root` CSS variables and a `@layer base` block (lines 8–104). Add the keyframe block after line 104.

### touch-action: none on leaf divs
**Source:** `src/index.css` line 97–103 shows the global rule applies `touch-action: manipulation` only to `button, [role="button"], input, select, textarea, a` — NOT to `[role="gridcell"]` divs.
**Apply to:** `LeafNode.tsx` root div inline style — set `touchAction: 'none'` permanently (not conditionally) since leaf cells are not scroll containers and pinch-to-zoom uses passive `touchstart`/`touchmove` listeners that fire regardless of touch-action.

### useCallback Wrapping
**Source:** `src/Grid/LeafNode.tsx` lines 392–511 — all event handlers use `useCallback` with explicit dependency arrays.
**Apply to:** `handleDragOver` and `handleDragEnd` in `CanvasWrapper.tsx`. `handleFileDrop` extracted from the removed `handleDrop` in `LeafNode.tsx` must retain `useCallback`.

### Store Access Pattern
**Source:** `src/Grid/LeafNode.tsx` line 52: `const moveCell = useGridStore(s => s.moveCell);`
**Apply to:** `CanvasWrapper.tsx` — subscribe to `moveCell` from `useGridStore` using the same selector pattern (not `useGridStore.getState().moveCell` — use the hook for reactive subscription).

---

## No Analog Found

No files in this phase lack a codebase analog. All three files either modify existing components with self-analog or follow the established test pattern.

---

## Metadata

**Analog search scope:** `src/Grid/`, `src/Editor/`, `src/store/`, `src/test/`, `src/Grid/__tests__/`, `src/Editor/__tests__/`
**Files scanned:** 8 source files read directly; ~35 test files globbed for pattern selection
**Key finding:** EditorShell.tsx confirmed to have NO DndContext — the RESEARCH.md note is accurate. ActionBar.tsx confirmed to use native HTML5 `draggable` + `dataTransfer` — this is the exact mechanism being replaced.
**Pattern extraction date:** 2026-04-16
