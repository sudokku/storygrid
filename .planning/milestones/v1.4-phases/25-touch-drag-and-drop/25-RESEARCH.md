# Phase 25: Touch Drag-and-Drop - Research

**Researched:** 2026-04-16
**Domain:** @dnd-kit/core v6 — TouchSensor, useDraggable, useDroppable, nested DndContext, touch-action conflict
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace the native HTML5 drag swap mechanism in `LeafNode.tsx` (`ondragstart`/`onDrop`) with `useDraggable` and `useDroppable` from @dnd-kit.
- **D-02:** Add a new `DndContext` wrapping `GridNode` (not `EditorShell`) configured with both `MouseSensor` and `TouchSensor`. This is separate from the existing `DndContext` in `EditorShell` (used for ActionBar drag positioning).
- **D-03:** Nested DndContexts are trusted to work correctly — inner `GridNode` context handles grid drops; outer `EditorShell` context handles ActionBar drops. Verify non-interference during implementation (a quick test suffices).
- **D-04:** Both desktop (mouse) and mobile (touch) use the unified @dnd-kit `DndContext` — no parallel native drag system remaining after this phase.
- **D-05:** During the 500ms hold before drag activates: show a subtle scale pulse (~1.03×) on the cell to signal that a drag is about to initiate.
- **D-06:** On drag activation (500ms threshold crossed): `scale(1.08)` + `opacity: 60%` for the lifted cell. This is the "lift" state that persists for the full drag.
- **D-07:** `TouchSensor` activation delay is set to 500ms (matching DRAG-01 requirement exactly).
- **D-08:** Long-press drag suppresses single-tap cell selection. When the 500ms activation delay elapses, `TouchSensor` consumes the touch event — no tap-select fires simultaneously.
- **D-09:** Touch count gate: if a second finger is added during the 500ms wait, cancel the drag timer and allow pinch-to-zoom. @dnd-kit `TouchSensor` handles this automatically (monitors touch count).
- **D-10:** Release outside any droppable cell cancels the drag; cell snaps back. Standard @dnd-kit behavior on non-droppable release.
- **D-11:** Desktop mouse drag uses `MouseSensor` in the same new `DndContext` as touch. Native HTML5 drag event handlers (`ondragstart`, `ondragover`, `onDrop`) are removed from `LeafNode.tsx`.
- **D-12:** Desktop retains the same 5-zone visual overlay (existing zone overlay JSX in `LeafNode.tsx`). Zone rendering is reused by both desktop and mobile.

### Claude's Discretion

- Zone overlays appear on all non-dragged cells simultaneously during a drag (existing desktop behavior). The implementer may choose to show zones only on the hovered cell if performance warrants it — but default to showing all zones.

### Deferred Ideas (OUT OF SCOPE)

None captured during this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAG-01 | User can initiate a cell drag via long-press (≥500ms threshold) on any cell on mobile | TouchSensor `activationConstraint: { delay: 500, tolerance: 5 }` — verified in installed @dnd-kit/core v6 source |
| DRAG-02 | Dragged cell shows visual lift feedback (scale-up + reduced opacity) during the drag | `isDragging` flag from `useDraggable` + CSS transform `scale(1.08)` + `opacity: 0.6` |
| DRAG-03 | Valid drop zones appear on all other cells during drag (center = swap, 4 edges = insert) | `useDndMonitor` inside LeafNode reads active drag state; existing 5-zone overlay JSX is reusable |
| DRAG-04 | Dropping on center swaps cell content; dropping on an edge inserts the dragged cell at that position | `onDragEnd` calls `moveCell(active.id, over.id, over.data.current.zone)` — `moveCell` already routes center→swap, edge→moveLeafToEdge |
</phase_requirements>

---

## Summary

Phase 25 migrates cell-to-cell drag-and-drop from native HTML5 drag events to @dnd-kit's unified sensor model, adding touch support (long-press 500ms) while preserving all existing desktop drag behavior. The work is entirely contained within four files: `LeafNode.tsx` (replace drag handlers, add useDraggable/useDroppable), `GridNode.tsx` or its render site (add DndContext), and a new test file.

The project already has `@dnd-kit/core ^6.3.1` and `@dnd-kit/utilities ^3.2.2` installed. The store already has `moveCell(fromId, toId, edge)` which handles all five drop zones. No new packages and no store changes are required — this is purely a UI wiring phase.

The critical implementation detail is the `touch-action` handling. The existing `@dnd-kit/core` v6 `useDraggable` does **not** automatically set `touch-action: none` on the draggable node (that style only appears on the `DragOverlay` / `PositionedOverlay` component). For `TouchSensor` to intercept touch events before the browser's native scroll/pan behaviors, the draggable element must have `touch-action: none` applied **while a drag is pending or active**. The global Phase 22 rule sets `touch-action: manipulation` only on `button`, `[role="button"]`, and form elements — not on leaf cell divs (`role="gridcell"`). The solution is to apply `touch-action: none` conditionally on the leaf div during drag (using the `isDragging` flag from `useDraggable` or a drag-pending state).

**Primary recommendation:** Add DndContext wrapping CanvasWrapper's grid surface (inside CanvasArea or CanvasWrapper), wire TouchSensor with 500ms delay + 5px tolerance, wire MouseSensor with distance constraint. Inside LeafNode, replace `onDragStart`/`onDrop` with `useDraggable` + `useDroppable`. Use `useDndMonitor` to track drag state for overlay rendering.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag activation (long-press, mouse-down) | Client (sensor layer) | — | @dnd-kit TouchSensor/MouseSensor intercept pointer/touch events at the browser level |
| Drag state propagation | Client (DndContext) | — | DndContext broadcasts active/over to all useDroppable/useDraggable descendants |
| Visual lift feedback (scale + opacity) | Client (LeafNode CSS) | — | isDragging from useDraggable drives inline style on the cell div |
| 5-zone hit detection during drag | Client (LeafNode useDroppable) | — | useDroppable provides `isOver`; zone is computed from pointer position via `onDragOver` callback in DndContext or useDndMonitor |
| Drop routing (swap vs. edge insert) | Client → Store | — | onDragEnd in DndContext calls moveCell which owns all routing logic |
| Hold-pulse animation (pre-activation feedback) | Client (LeafNode CSS) | — | CSS keyframe animation triggered by a React state flag during the 500ms window |

---

## Standard Stack

### Core (already installed — no new installs)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @dnd-kit/core | ^6.3.1 | DndContext, useDraggable, useDroppable, TouchSensor, MouseSensor, useSensor, useSensors, useDndMonitor | Installed and in use for ActionBar drag |
| @dnd-kit/utilities | ^3.2.2 | CSS helpers (transform, CSS) | Installed |

[VERIFIED: /Users/radu/Developer/storygrid/package.json — `@dnd-kit/core ^6.3.1`, `@dnd-kit/utilities ^3.2.2`]

### No new packages required

The full implementation can be done with what is already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
[Touch/Mouse Input]
       |
       v (onTouchStart / onMouseDown)
[TouchSensor (500ms delay + 5px tolerance) | MouseSensor (5px distance)]
       |
       v activation
[DndContext — wraps CanvasWrapper's grid surface]
   onDragStart → set activeId state
   onDragOver  → (reads over.data.current.zone for zone overlay routing)
   onDragEnd   → moveCell(active.id, over.id, zone) | no-op if over=null
       |
       +----> [LeafNode as Draggable]
       |        useDraggable({ id, data: { nodeId } })
       |        isDragging → scale(1.08) + opacity:0.6 + touch-action:none
       |        [hold-pulse animation during 500ms window — CSS keyframe]
       |
       +----> [LeafNode as Droppable]
                useDroppable({ id, data: { nodeId } })
                useDndMonitor → isAnyDragActive → show 5-zone overlays
                zone computed from pointer position in DndContext.onDragOver
                activeZone state drives overlay JSX (existing code reused)
```

### Recommended File Structure (changes only)

```
src/
├── Grid/
│   ├── LeafNode.tsx         ← MODIFIED: replace HTML5 drag, add useDraggable + useDroppable
│   └── GridNode.tsx         ← READ-ONLY (no changes needed; DndContext goes in CanvasWrapper)
├── Grid/CanvasWrapper.tsx   ← MODIFIED: add DndContext with sensors + onDragEnd handler
└── test/
    └── phase25-touch-dnd.test.tsx  ← NEW: sensor config + zone routing + store dispatch tests
```

**DndContext placement:** Wrap the inner scaled canvas div in `CanvasWrapper.tsx` (the div with `data-testid="canvas-surface"` that directly renders `<GridNodeComponent>`). This places the context inside `CanvasArea` which is already inside `EditorShell`. The ActionBar has its own independent drag handle via native `draggable` attribute — it is NOT inside any DndContext, so there is no existing outer DndContext conflict. [VERIFIED: reading EditorShell.tsx, ActionBar.tsx — no DndContext found in either]

### Pattern 1: Sensor Configuration in DndContext

```typescript
// Source: @dnd-kit/core v6 installed source + docs.dndkit.com/sensors
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

const sensors = useSensors(
  useSensor(MouseSensor, {
    // Require 5px movement before activating on desktop — prevents accidental activation on click
    activationConstraint: { distance: 5 },
  }),
  useSensor(TouchSensor, {
    // DRAG-01: 500ms hold before drag activates
    // tolerance: 5px — finger can wobble 5px during the wait without cancelling
    activationConstraint: { delay: 500, tolerance: 5 },
  }),
);

// In JSX:
<DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  {/* canvas-surface div and GridNodeComponent */}
</DndContext>
```

### Pattern 2: useDraggable in LeafNode (replaces HTML5 drag)

```typescript
// Source: @dnd-kit/core v6 useDraggable return value (verified in installed source)
import { useDraggable } from '@dnd-kit/core';

const { setNodeRef: setDragNodeRef, listeners: dragListeners, isDragging } = useDraggable({
  id,
  data: { nodeId: id },
});

// Apply to the root div:
<div
  ref={(el) => { divRef.current = el; setDragNodeRef(el); }}
  {...dragListeners}
  style={{
    // DRAG-02: lift state when drag is active
    ...(isDragging ? { transform: 'scale(1.08)', opacity: 0.6, zIndex: 50 } : {}),
    // D-09 conflict resolution: touch-action:none only during drag to not break tap-select
    touchAction: isDragging ? 'none' : undefined,
  }}
>
```

**Critical note on touchAction:** For TouchSensor to capture `touchmove` before the browser scrolls, the draggable element needs `touch-action: none` applied **before** drag activation. The touch-action must be set at `onTouchStart` (when drag is pending), not only after activation. Solution: use a `data-pending-drag` attribute or a `isPendingDrag` state, set on `onDragStart` from `useDndMonitor` or DndContext's `onDragStart`. Alternatively, apply `touch-action: none` permanently to all leaf divs — this is safe because LeafNode handles scrolling at a higher container level (CanvasArea has `overscrollBehavior: contain`; the grid cells do not themselves scroll).

Simpler approach: apply `touch-action: none` to the leaf div permanently (not conditionally), since the cells are not scroll containers and pinch-to-zoom uses passive `touchstart`/`touchmove` listeners that will still fire regardless.

### Pattern 3: useDroppable in LeafNode + Zone Routing

```typescript
// Source: @dnd-kit/core v6 useDroppable (verified in installed source)
import { useDroppable } from '@dnd-kit/core';

// Each leaf is both draggable and droppable
const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
  id,
  data: { nodeId: id },
});

// Merge refs:
<div
  ref={(el) => { divRef.current = el; setDragNodeRef(el); setDropNodeRef(el); }}
>
```

Zone detection during drag: the existing `handleDragOver` logic (using `getBoundingClientRect` math) can be reused, but triggered by DndContext's `onDragOver` callback or via `useDndMonitor` inside LeafNode. The `onDragOver` in DndContext receives `{ active, over }` — use `over.id` to identify the target cell, then read pointer position to compute the zone, and store it in a Zustand slice or React context so the target LeafNode can render the overlay.

Simpler alternative: keep all zone logic inside `LeafNode.tsx` using `useDndMonitor`:

```typescript
// useDndMonitor inside LeafNode component
import { useDndMonitor } from '@dnd-kit/core';

useDndMonitor({
  onDragOver({ over, activatorEvent }) {
    if (over?.id !== id) { setActiveZone(null); return; }
    // Compute zone from activatorEvent or current pointer position
    const rect = divRef.current?.getBoundingClientRect();
    if (!rect || !activatorEvent) return;
    // ... zone math reused from existing handleDragOver ...
    setActiveZone(zone);
  },
  onDragEnd() { setActiveZone(null); },
  onDragCancel() { setActiveZone(null); },
});
```

**Note:** `useDndMonitor` requires the LeafNode to be a descendant of the DndContext. Since LeafNode is rendered inside CanvasWrapper's grid surface (which will be wrapped), this works correctly. [VERIFIED: component tree from CanvasWrapper.tsx and GridNode.tsx]

### Pattern 4: onDragEnd Handler (Drop Routing)

```typescript
// Source: @dnd-kit/core v6 docs — onDragEnd receives { active, over }
// over is null if dropped outside any droppable; over.id is the droppable's id

function handleDragEnd({ active, over }: DragEndEvent) {
  if (!over || active.id === over.id) return; // D-10: cancel = no-op

  const zone = currentZoneRef.current ?? 'center'; // track in ref during onDragOver
  moveCell(String(active.id), String(over.id), zone);
}
```

The zone must be captured during `onDragOver` (or via `useDndMonitor.onDragOver`) and stored in a ref that `onDragEnd` can read. The `over.data.current` field can hold zone data if `useDroppable` is called with `data: { zone }` — but zone changes dynamically based on pointer position, so a ref is more appropriate than static droppable data.

### Pattern 5: Hold-Pulse Animation (D-05)

```css
/* Add to index.css or as Tailwind arbitrary keyframe */
@keyframes drag-hold-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.03); }
  100% { transform: scale(1.03); }
}
```

```typescript
// Trigger: add isPendingDrag state in LeafNode
// Set to true on touchstart (from dragListeners or onPointerDown gate)
// Clear on touchend or drag activation

<div
  style={{
    animation: isPendingDrag ? 'drag-hold-pulse 500ms ease-in-out forwards' : undefined,
    // isDragging state overrides animation:
    ...(isDragging ? { transform: 'scale(1.08)', opacity: 0.6 } : {}),
  }}
>
```

The 500ms CSS animation duration matches the TouchSensor delay exactly — the animation completes just as the drag activates, providing seamless visual feedback.

### Anti-Patterns to Avoid

- **Keeping HTML5 drag handlers alongside @dnd-kit:** `onDragOver`, `onDrop`, `handleDragStart` in LeafNode MUST be fully removed after migrating. Mixing both systems causes event conflicts.
- **Applying `useDraggable` listeners to a child element instead of the cell root:** The sensor activators need to be on the element that encloses the cell content. Using `setActivatorNodeRef` on a child (for handle-only drag) is valid, but the drag zone detection uses `useDroppable`'s setNodeRef on the cell root.
- **Forgetting to pass zone data through `onDragEnd`:** The `over` object in `onDragEnd` does not include real-time pointer position — zone must be captured during `onDragOver` and stored in a ref or state.
- **Registering both DndContext and file-drop handlers on the same container:** CanvasArea's file drop handlers (`onDragEnter`, `onDragOver`, `onDrop`) use native `React.DragEvent` (for HTML5 file drag from desktop). @dnd-kit uses pointer/touch events internally and does NOT interfere with native HTML5 file drag events. These systems operate on different event types and coexist cleanly. [VERIFIED: @dnd-kit/core source uses `onTouchStart`/`onPointerDown` — not `onDragStart`]
- **Using DragOverlay:** The phase does not require a floating ghost image. The dragged cell stays in place (scale transform) while the zones render on target cells. Omit DragOverlay to keep implementation simple.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Touch long-press detection | Custom `setTimeout` + `touchstart`/`touchend` | `TouchSensor` with `activationConstraint: { delay: 500, tolerance: 5 }` | TouchSensor handles multi-touch cancellation (D-09), scroll conflict, and `touchcancel` |
| Mouse drag initiation threshold | Custom `mousemove` distance counter | `MouseSensor` with `activationConstraint: { distance: 5 }` | MouseSensor handles right-click guard, pointer capture, and selection prevention |
| Droppable rect measurement | Manual `getBoundingClientRect` subscriptions | `useDroppable` + collision detection | @dnd-kit measures and caches droppable rects efficiently |
| Multi-touch cancel | `if (touches.length > 1) cancelDrag()` | `TouchSensor` built-in | TouchSensor already returns `false` (no activation) when `touches.length > 1` (verified in installed source) |

---

## Runtime State Inventory

Not applicable. This is a UI wiring phase — no data migration, no stored strings, no OS-registered state involved.

---

## Common Pitfalls

### Pitfall 1: touch-action conflict blocks TouchSensor activation
**What goes wrong:** The browser interprets the 500ms touch as a scroll gesture and never fires the `touchmove` handlers that @dnd-kit registers, so `TouchSensor` never activates. Drag appears to do nothing on mobile.
**Why it happens:** `touch-action: manipulation` (set globally on buttons in Phase 22) prevents double-tap zoom but still allows scroll/pan. For `TouchSensor` to capture `touchmove` exclusively, the draggable element needs `touch-action: none`.
**How to avoid:** Apply `touch-action: none` to the LeafNode root div. The cells are not scroll containers themselves — scrolling happens at the CanvasArea level. The pinch-to-zoom touch handlers use passive native listeners and are not affected by `touch-action: none` on the cell div.
**Warning signs:** Long-press on a cell causes the canvas to pan/scroll instead of initiating a drag.

### Pitfall 2: Zone data is stale in onDragEnd
**What goes wrong:** `onDragEnd` calls `moveCell` with `zone = 'center'` for every drop, even when the user released on an edge zone.
**Why it happens:** Zone is computed from pointer position during `onDragOver`, but `onDragEnd` doesn't receive pointer position — only `active` and `over`. If zone is stored in local component state (async React re-render), it may not be current at `onDragEnd` time.
**How to avoid:** Store the active zone in a `useRef` that is synchronously updated in the `onDragOver` callback. Read the ref (not state) in `onDragEnd`.
**Warning signs:** Edge drops always behave like center swaps.

### Pitfall 3: Nested DndContext — event capture conflict
**What goes wrong:** The outer DndContext (if one existed) captures events intended for the inner one.
**How to avoid:** Verified via codebase inspection — there is NO DndContext in EditorShell, ActionBar, or anywhere in the current component tree. The ActionBar uses a native HTML5 `draggable` attribute (not @dnd-kit). The new GridNode DndContext will be the only one. The CONTEXT.md note about "nested DndContexts" referred to a concern that was pre-verified as a non-issue. [VERIFIED: reading EditorShell.tsx and ActionBar.tsx]
**Warning signs:** N/A — there is no outer DndContext to conflict with.

### Pitfall 4: Pinch-to-zoom passive listeners conflict with TouchSensor
**What goes wrong:** Drag activates when user attempts a two-finger pinch on a cell in pan mode.
**Why it happens:** TouchSensor and pinch-to-zoom both respond to touch events on the cell.
**How to avoid:** TouchSensor already returns `false` when `touches.length > 1` (verified in installed source: `if (touches.length > 1) { return false; }`). Additionally, pinch-to-zoom only activates when `isPanMode === true` — the two features are state-gated. When pinch mode is active, the drag long-press is not a valid user intent.
**Warning signs:** Two-finger zoom also triggers a drag overlay.

### Pitfall 5: File-drop stops working after migration
**What goes wrong:** Files dragged from the desktop no longer drop into cells after removing `onDrop` from LeafNode.
**Why it happens:** File-drop uses native HTML5 `dragover`/`drop` events (for `dataTransfer.files`). These are different from @dnd-kit's pointer/touch events. The existing `onDrop` handler in LeafNode handles BOTH cell swaps (now migrated to @dnd-kit) and file drops (must be preserved).
**How to avoid:** Keep the file-drop portion of `handleDrop` in LeafNode but remove only the `fromId = e.dataTransfer.getData('text/cell-id')` branch. The file-handling `if (files.length > 0)` block stays unchanged. Also keep `onDragOver` for file drops (the `isDragOver` visual indicator). [VERIFIED: reading LeafNode.tsx handleDrop — file and cell-swap paths are separate branches in the same function]
**Warning signs:** Dropping an image file onto a cell has no effect.

### Pitfall 6: isDragging causes visual jump when drag is cancelled
**What goes wrong:** When the user releases after a hold without crossing the 500ms threshold, or after a multi-touch cancel, a brief flash of `scale(1.08)` appears.
**Why it happens:** If the hold-pulse animation is driven by `isPendingDrag` state and the drag is cancelled after the animation has already scaled up, the cleanup resets transform abruptly.
**How to avoid:** Use a CSS transition on the `transform` property with a short `100ms` ease-out so cancellations animate smoothly back to scale(1).

---

## Code Examples

### DndContext wiring in CanvasWrapper.tsx

```typescript
// Pattern: add DndContext around the canvas-surface div
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useGridStore } from '../store/gridStore';

// Inside CanvasWrapper component:
const moveCell = useGridStore(s => s.moveCell);
const activeZoneRef = useRef<'center' | 'top' | 'bottom' | 'left' | 'right'>('center');

const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
);

const handleDragOver = useCallback(({ over }: DragOverEvent) => {
  // Zone is updated inside LeafNode via useDndMonitor — activeZoneRef is set there
  // OR: pass a callback via React context to set zone from the target LeafNode
}, []);

const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
  if (!over || active.id === over.id) return;
  moveCell(String(active.id), String(over.id), activeZoneRef.current);
  activeZoneRef.current = 'center'; // reset
}, [moveCell]);

// JSX: wrap canvas-surface div
<DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
  <div
    className="relative group mt-8 flex-shrink-0"
    style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${finalScale})`, ... }}
    onClick={handleBgClick}
    data-testid="canvas-surface"
  >
    <GridNodeComponent id={rootId} />
    <OverlayLayer />
    {showSafeZone && <SafeZoneOverlay />}
  </div>
</DndContext>
```

### LeafNode refactored drag handlers

```typescript
// Source: @dnd-kit/core v6 useDraggable + useDroppable + useDndMonitor
import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';

// Inside LeafNodeComponent:
const { setNodeRef: setDragRef, listeners: dragListeners, isDragging } = useDraggable({
  id,
  data: { nodeId: id },
});

const { setNodeRef: setDropRef } = useDroppable({
  id,
  data: { nodeId: id },
});

// Unified ref callback — both draggable and droppable use the cell root div
const setRefs = useCallback((el: HTMLDivElement | null) => {
  divRef.current = el;
  setDragRef(el);
  setDropRef(el);
}, [setDragRef, setDropRef]);

// Monitor active drag for zone overlays
useDndMonitor({
  onDragOver({ over, activatorEvent }) {
    if (over?.id !== id) { setActiveZone(null); return; }
    const rect = divRef.current?.getBoundingClientRect();
    const event = activatorEvent as PointerEvent | TouchEvent;
    // ... zone math from existing handleDragOver (getBoundingClientRect + threshold) ...
    setActiveZone(zone);
  },
  onDragEnd() { setActiveZone(null); },
  onDragCancel() { setActiveZone(null); },
});

// Cell root div:
<div
  ref={setRefs}
  {...dragListeners}
  style={{
    touchAction: 'none',           // required for TouchSensor to capture touchmove
    ...(isDragging ? {
      transform: `scale(1.08)`,
      opacity: 0.6,
      zIndex: 50,
      position: 'relative',
    } : {}),
  }}
  // ... existing props ...
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `element.draggable = true` + `ondragstart`/`onDrop` | `useDraggable`/`useDroppable` from @dnd-kit | Phase 25 | Touch support, unified sensor model, no native HTML5 drag limitations on iOS |
| Native `ondragstart` sets `dataTransfer.text/cell-id` | `useDraggable({ id })` — id travels through DndContext | Phase 25 | Works on both mouse and touch; no DataTransfer API needed |
| `handleDragOver` in each LeafNode updates activeZone | `useDndMonitor` in each LeafNode updates activeZone | Phase 25 | Same logic, different event source |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Passing `activationConstraint: { delay: 500, tolerance: 5 }` to `useSensor(TouchSensor)` produces the expected 500ms hold behavior | Standard Stack / Patterns | Drag activates too early or not at all — would need to adjust tolerance or consult `@dnd-kit/core` source more deeply |
| A2 | `useDndMonitor`'s `onDragOver` receives `activatorEvent` with current pointer coordinates that can be used for zone detection | Code Examples | Zone detection may require a different approach (e.g., tracking raw pointermove in a separate useEffect) |
| A3 | Setting `touch-action: none` on the leaf cell div permanently does not break pinch-to-zoom (which uses passive native `touchstart`/`touchmove` listeners) | Pitfall 1 | Pinch-to-zoom stops working — workaround: apply `touch-action: none` only when `isPendingDrag || isDragging` |

---

## Open Questions

1. **`activatorEvent` coordinates in `useDndMonitor.onDragOver`**
   - What we know: `onDragOver` in DndContext receives `{ active, over }`. `useDndMonitor` mirrors this.
   - What's unclear: Whether `activatorEvent` carries the *current* pointer position during the drag or just the initial touch position. If only initial position, zone detection needs to use a separate `pointermove` listener or `document.elementFromPoint`.
   - Recommendation: During implementation, log `activatorEvent` in `onDragOver` to check if coordinates update. Fallback: track pointer position in a `useEffect` with `pointermove` and compare against the droppable rect.

2. **DndContext placement — CanvasWrapper vs. CanvasArea**
   - What we know: GridNodeComponent renders inside CanvasWrapper's scaled div. Both CanvasWrapper and CanvasArea are valid wrapper sites.
   - What's unclear: Whether placing DndContext inside the scaled `transform: scale()` div affects coordinate measurements for useDroppable (droppable rects are measured from the DOM, which includes the transform).
   - Recommendation: Place DndContext outside the scaled div (in CanvasWrapper's parent-level), or test empirically. If rects are measured in viewport space post-transform, this works fine. If measured in pre-transform logical pixels, zone detection math needs a correction factor (`1 / canvasScale`).

---

## Environment Availability

Step 2.6: SKIPPED (no external tools or services required — all dependencies are already installed npm packages).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config file | `/Users/radu/Developer/storygrid/vitest.config.ts` |
| Quick run command | `npx vitest run src/test/phase25-touch-dnd.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAG-01 | TouchSensor configured with 500ms delay + 5px tolerance | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ Wave 0 |
| DRAG-01 | MouseSensor configured with 5px distance constraint | unit | same | ❌ Wave 0 |
| DRAG-02 | isDragging → cell div has scale(1.08) + opacity:0.6 | unit | same | ❌ Wave 0 |
| DRAG-02 | isDragging=false → no scale or opacity override | unit | same | ❌ Wave 0 |
| DRAG-03 | During active drag, non-dragged LeafNode shows zone overlay when active.id != id | integration | same | ❌ Wave 0 |
| DRAG-03 | Zone overlays cleared when drag ends or is cancelled | integration | same | ❌ Wave 0 |
| DRAG-04 | DragEnd with over=center calls moveCell(fromId, toId, 'center') | unit | same | ❌ Wave 0 |
| DRAG-04 | DragEnd with over=top calls moveCell(fromId, toId, 'top') | unit | same | ❌ Wave 0 |
| DRAG-04 | DragEnd with over=null is a no-op (D-10) | unit | same | ❌ Wave 0 |
| DRAG-04 | DragEnd with active.id === over.id is a no-op (self-drop) | unit | same | ❌ Wave 0 |

### Testing Strategy

**What can be unit-tested in jsdom:**
- Sensor configuration: assert `sensors` prop of DndContext contains objects with the right `activationConstraint` values
- `moveCell` dispatch: mock the store, simulate `onDragEnd` callback directly, assert call arguments
- Visual lift: render LeafNode with `useDraggable` mocked to return `isDragging: true`, assert transform + opacity styles
- Zone overlay presence: use `useDndMonitor` mock or fire custom events to trigger zone state changes

**What cannot be unit-tested (manual or e2e only):**
- Actual 500ms long-press activation on a real touch device — jsdom has no touch event propagation to sensors
- Pinch-to-zoom coexistence during drag — requires real browser environment
- Nested DndContext non-interference — verify by using the app on both desktop and mobile after implementation

### Existing Tests That Must Stay Green

The following tests exercise code that will be modified:
- `src/test/phase09-p03-leafnode-zones.test.ts` — tests native `ondragover`/`ondrop` zone detection. **These tests will need updating** after removing native drag handlers and replacing with @dnd-kit. The same zone logic is retained (useDndMonitor), but the test harness must be rewritten to trigger `useDndMonitor.onDragOver` instead of `fireEvent.dragOver`.
- `src/test/phase05-p02-cell-swap.test.ts` — tests ActionBar's drag handle button (`draggable` attribute, `onDragStart` sets `dataTransfer`). These tests do not touch LeafNode drag logic and will be unaffected.

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/phase25-touch-dnd.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/phase25-touch-dnd.test.tsx` — covers DRAG-01 through DRAG-04

---

## Security Domain

Phase 25 is a pure UI interaction refactor (CSS, event handling, @dnd-kit hooks). No authentication, session management, network requests, or data persistence are introduced.

Applicable ASVS categories:
- **V5 Input Validation:** All drag interactions read from `active.id` and `over.id` which are always equal to the cell's `id` prop (a nanoid string set at tree creation time). No external input is parsed. Risk: NONE.
- All other ASVS categories: NOT applicable.

---

## Sources

### Primary (HIGH confidence)
- `@dnd-kit/core v6.3.1` installed source (`node_modules/@dnd-kit/core/dist/core.esm.js`) — TouchSensor class, multi-touch cancel, useDraggable return value, useDndMonitor implementation
- `/Users/radu/Developer/storygrid/src/Grid/LeafNode.tsx` — existing zone detection math, file-drop handler, pinch-to-zoom listeners
- `/Users/radu/Developer/storygrid/src/Grid/CanvasWrapper.tsx` — confirmed placement site for new DndContext
- `/Users/radu/Developer/storygrid/src/Editor/EditorShell.tsx` — confirmed NO existing DndContext (CONTEXT.md note about nested contexts is a pre-emptive concern, not an existing conflict)
- `/Users/radu/Developer/storygrid/src/Grid/ActionBar.tsx` — confirmed uses native HTML5 `draggable` attribute (not @dnd-kit)
- `/Users/radu/Developer/storygrid/src/index.css` — confirmed `touch-action: manipulation` scope (button/[role="button"] only, not div[role="gridcell"])
- `/Users/radu/Developer/storygrid/package.json` — confirmed `@dnd-kit/core ^6.3.1` and `@dnd-kit/utilities ^3.2.2` installed

### Secondary (MEDIUM confidence)
- [dndkit.com/api-documentation/sensors/touch](https://dndkit.com/api-documentation/sensors/touch) — TouchSensor delay constraint docs, `touch-action: manipulation` recommendation
- [dndkit.com/api-documentation/context-provider/dnd-context](https://dndkit.com/api-documentation/context-provider/dnd-context) — nested DndContext behavior, onDragEnd active/over structure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages already installed and used in project; versions confirmed from package.json
- Architecture: HIGH — component tree fully read, DndContext placement confirmed, no surprises
- Pitfalls: HIGH — touch-action conflict identified from source inspection; zone-in-onDragEnd pitfall is a well-known @dnd-kit pattern
- Test strategy: MEDIUM — jsdom limitations on touch events require careful mocking; existing zone tests need rewriting

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable @dnd-kit/core v6 — no active releases expected)
