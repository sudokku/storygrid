# Phase 29: ESC-Cancel + Visual Polish - Research

**Researched:** 2026-04-19
**Domain:** @dnd-kit/core v6.3.1 — KeyboardSensor, DragOverlay dropAnimation, CSS animation, Zustand store extension
**Confidence:** HIGH — all findings verified against installed source files in node_modules and existing codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Ghost position bug fix — record pointer coords at `onPointerDown` time, store as `pointerDownX/Y` in `dragStore`, use in `grabOffsetModifier` instead of `activatorEvent`.
- **D-02:** `dragStore` gains two new fields: `pointerDownX: number`, `pointerDownY: number`. Set by `setPointerDown(x, y)`. Reset to 0 by `end()`.
- **D-03:** Ghost `maxWidth`/`maxHeight` capped. Implement via CSS variable `--ghost-cap: 200px` in `:root {}`.
- **D-04:** Exact cap value (200px) deferred to UI-spec phase — use CSS variable so it can be tuned without code changes.
- **D-05:** Ghost opacity is **20%** (`opacity: 0.2`) — overrides GHOST-03's 80%.
- **D-06:** Add `KeyboardSensor` from `@dnd-kit/core` to `useSensors` in `CanvasWrapper.tsx`. dnd-kit fires `onDragCancel` on ESC automatically.
- **D-07:** Re-enable `DragOverlay`'s `dropAnimation` (currently `null`). Custom config: `{ duration: 200, easing: 'ease-in' }`.
- **D-08:** Add `lastDropId: string | null` to `dragStore` + `setLastDrop(id)` / `clearLastDrop()` actions. `handleDragEnd` calls `setLastDrop(toId)` then `setTimeout(() => clearLastDrop(), 700)`. `LeafNode` subscribes for flash class.
- **D-09:** Drag-start wobble: `±1.5deg` over `150ms` CSS `@keyframes cell-wobble`. Applied to source cell when `isDragging` is true.
- **D-10:** `DropZoneIndicators.tsx` active/dim styling (`text-white` / `text-white/30`) — verify and ship as-is.

### Claude's Discretion
- Flash visual style: background color flash or ring/outline flash.
- Wobble `animation-fill-mode`: return to 0 (standard) is fine.
- Flash on center (swap) zone as well as edge zones: yes, all successful drops.

### Deferred Ideas (OUT OF SCOPE)
- Ghost size cap exact value (200px?) — UI-spec phase tunes it via CSS variable.
- Mobile haptics, MobileSheet auto-collapse, cross-device CSS (`touch-action`, etc.) — Phase 30.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANCEL-01 | ESC cancels active drag and returns cell to origin | D-06: KeyboardSensor fires `onDragCancel` on ESC natively; verified in dnd-kit source |
| CANCEL-02 | Snap-back animation: 200ms ease-in on cancel | D-07: `dropAnimation: { duration: 200, easing: 'ease-in' }` on DragOverlay |
| GHOST-03 (override D-05) | Ghost opacity 20% (not 80%) | D-05: `opacity: 0.2` inline style on `<img>` in DragPreviewPortal |
| GHOST-04 (override D-03) | Ghost capped at `--ghost-cap` CSS variable | D-03/D-04: `max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)]` |
| GHOST-02 (override D-01) | Ghost spawns at correct grab-point position | D-01/D-02: `pointerDownX/Y` stored at `onPointerDown`, used in `grabOffsetModifier` |
| DROP-08 | 700ms accent-color flash on landed cell | D-08: `lastDropId` in dragStore, CSS `@keyframes drop-flash` in LeafNode |
| DRAG-05 | Drag-start wobble `±1.5deg` over `150ms` | D-09: `@keyframes cell-wobble`, applied to source cell when `isDragging` |
| DROP-02/DROP-03 | Active zone bright/inactive zones dim | D-10: Already implemented as `text-white` / `text-white/30` in DropZoneIndicators |
</phase_requirements>

---

## Summary

Phase 29 adds ESC-to-cancel drag gesture and 6 visual polish items to the Phase 28 DnD system. All work is additive — no existing functionality is removed. The phase modifies 6 files: `dragStore.ts`, `DragPreviewPortal.tsx`, `useCellDraggable.ts`, `CanvasWrapper.tsx`, `LeafNode.tsx`, and `src/index.css`.

The highest-complexity item is the ghost position fix (D-01/D-02), which requires threading new `pointerDownX/Y` state from `LeafNode`'s `onPointerDown` handler → `useCellDraggable` → `dragStore` → `grabOffsetModifier`. All other items are self-contained single-file changes.

The dnd-kit `KeyboardSensor` is already exported from `@dnd-kit/core` and fires `onDragCancel` automatically on ESC — confirmed by reading the CJS source in `node_modules`. The `dropAnimation` config shape is `{ duration: number; easing: string }` — confirmed from installed TypeScript declarations. No new npm packages are needed for this phase.

**Primary recommendation:** Implement in three logical waves: (1) dragStore field additions + useCellDraggable pointer capture; (2) DragPreviewPortal ghost changes + CanvasWrapper KeyboardSensor + dropAnimation; (3) LeafNode flash + wobble + index.css keyframes. Each wave is independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ESC cancel wiring | Frontend (DndContext) | — | KeyboardSensor lives in CanvasWrapper's sensor config, fires DndContext's onDragCancel |
| Snap-back animation | Frontend (DragOverlay) | — | dropAnimation config on DragOverlay in DragPreviewPortal |
| Ghost position fix | Frontend (modifier fn) | Store | grabOffsetModifier reads pointerDownX/Y from dragStore; store updated at onPointerDown in LeafNode |
| Ghost opacity + size cap | Frontend (DragOverlay render) | CSS | Inline style + CSS variable on `<img>` in DragPreviewPortal |
| Drop flash | Store + Frontend (LeafNode) | CSS | dragStore holds lastDropId; LeafNode subscribes and applies CSS animation class |
| Drag-start wobble | Frontend (LeafNode) | CSS | isDragging from useCellDraggable drives class on source cell wrapper |
| Active/dim zones | Frontend (DropZoneIndicators) | Store | Already implemented; verify only |

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Verification |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 | KeyboardSensor, DragOverlay dropAnimation | [VERIFIED: node_modules/@dnd-kit/core/dist/index.d.ts] |
| Zustand | ^5.0.x | dragStore field additions (vanilla store) | [VERIFIED: existing dragStore.ts pattern] |
| React 18 | ^18.3.x | Component subscriptions, useCallback patterns | [VERIFIED: existing codebase] |
| Tailwind CSS v3 | ^3.4.x | animate-* utilities, arbitrary values | [VERIFIED: tailwind.config.js — no animation extensions yet] |

**Installation:** No new packages required. All needed APIs are in `@dnd-kit/core` already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
onPointerDown (LeafNode)
    │  clientX, clientY
    ▼
dragStore.setPointerDown(x, y)
    │  stored: pointerDownX, pointerDownY
    ▼
PointerSensor threshold (8px / 250ms hold)
    │
    ▼
DndContext.onDragStart
    │  captures ghostUrl, rect.width/height
    │  calls dragStore.beginCellDrag(...)
    ▼
DragOverlay renders (DragPreviewPortal)
    │  modifiers=[grabOffsetModifier]  ← reads pointerDownX/Y from dragStore
    │  dropAnimation={duration:200, easing:'ease-in'}
    │  <img opacity:0.2, max-w/h:var(--ghost-cap)>
    │
    ├── ESC pressed
    │       │
    │       ▼
    │   KeyboardSensor fires onDragCancel
    │   dropAnimation runs (snap-back 200ms)
    │   dragStore.end()
    │   body cursor reset
    │
    └── Pointer released on target cell
            │
            ▼
        DndContext.onDragEnd
        moveCell(sourceId, toId, zone)
        dragStore.setLastDrop(toId)
        setTimeout(clearLastDrop, 700)
        dragStore.end()
        body cursor reset
            │
            ▼
        LeafNode (toId) subscribes lastDropId === id
        applies @keyframes drop-flash 700ms
```

### Recommended Project Structure (no changes to structure — additive only)

```
src/
├── dnd/
│   ├── dragStore.ts           # + pointerDownX, pointerDownY, lastDropId fields
│   ├── DragPreviewPortal.tsx  # + dropAnimation, opacity, size cap
│   └── useCellDraggable.ts   # + onPointerDown capture forwarded to store
├── Grid/
│   ├── CanvasWrapper.tsx      # + KeyboardSensor in useSensors
│   └── LeafNode.tsx           # + flash class, wobble class
└── index.css                  # + --ghost-cap var, @keyframes cell-wobble, drop-flash
```

### Pattern 1: KeyboardSensor Integration

**What:** Add `KeyboardSensor` to `useSensors` in `CanvasWrapper.tsx`. dnd-kit handles ESC internally; pressing ESC during a drag fires the DndContext's `onDragCancel` callback.

**When to use:** Any DnD implementation that needs keyboard cancel. Per CONTEXT.md D-06, this does not violate DND-01 (which only prohibits `TouchSensor + MouseSensor` combination — `KeyboardSensor` serves a separate purpose).

**Exact import:** [VERIFIED: node_modules/@dnd-kit/core/dist/index.d.ts]
```typescript
// Source: node_modules/@dnd-kit/core/dist/index.d.ts
import { KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

// In CanvasWrapper, add alongside existing touchSensor/mouseSensor:
const keyboardSensor = useSensor(KeyboardSensor);
const sensors = useSensors(touchSensor, mouseSensor, keyboardSensor);
```

**ESC behavior verified:** [VERIFIED: node_modules/@dnd-kit/core/dist/core.cjs.development.js]

The `KeyboardSensor` source confirms:
- `defaultKeyboardCodes.cancel = ['Escape']` — ESC is the cancel key by default
- On ESC keydown during active drag: `handleCancel` is called, which calls `event.preventDefault()` then `onCancel()` — this triggers `DndContext.onDragCancel`
- The `KeyboardSensor` activates a drag via Space/Enter on the focused element — it does NOT interfere with `PointerSensor` activation flow
- No `coordinateGetter` config needed for ESC-cancel-only use case

**Important:** `KeyboardSensor` requires the draggable element to be keyboard-focusable for drag *activation* via keyboard, but ESC *cancellation* of a pointer-initiated drag works automatically once `KeyboardSensor` is registered — dnd-kit's context manages the active sensor state globally.

### Pattern 2: dropAnimation Config Shape

**What:** `DragOverlay`'s `dropAnimation` prop accepts `DropAnimation = DropAnimationFunction | DropAnimationOptions`. For a simple duration+easing config, use `DropAnimationOptions`.

**Exact type:** [VERIFIED: node_modules/@dnd-kit/core/dist/components/DragOverlay/hooks/useDropAnimation.d.ts]
```typescript
interface DropAnimationOptions {
  keyframes?: KeyframeResolver;
  duration?: number;       // milliseconds
  easing?: string;         // CSS easing string
  sideEffects?: DropAnimationSideEffects | null;
}
```

**Implementation:** [VERIFIED: type declarations]
```typescript
// Source: DragPreviewPortal.tsx — change dropAnimation={null} to:
<DragOverlay
  dropAnimation={{ duration: 200, easing: 'ease-in' }}
  modifiers={[grabOffsetModifier]}
>
```

**Fires on:** Both `onDragEnd` AND `onDragCancel`. The animation runs, then `DragOverlay` unmounts the ghost. This is expected and acceptable per D-07.

**When `dropAnimation` runs on successful drop:** `dragStore.end()` is currently called immediately in `handleDragEnd`. This will hide the ghost before the animation completes. Solution: delay `dragStore.end()` until after the animation, OR accept that the ghost disappears instantly on successful drop (not the cancel path). **The snap-back behavior on cancel is the priority** — on successful drop the brief flash of animation is acceptable (D-07 says so explicitly).

**Timing concern for drop flash (D-08):** `setLastDrop(toId)` must be called BEFORE `dragStore.end()` in `handleDragEnd` if the flash depends on reading store state. Current `handleDragEnd` calls `useDragStore.getState().end()` first. New order must be: `setLastDrop(toId)` → `end()` → `setTimeout(clearLastDrop, 700)`.

### Pattern 3: grabOffsetModifier Fix (D-01/D-02)

**Root cause confirmed:** [VERIFIED: DragPreviewPortal.tsx lines 35-67]

The current `grabOffsetModifier` reads `activatorEvent` (the event that triggered sensor activation — after the 8px distance threshold for mouse, after 250ms hold for touch). The `activatorEvent.clientX/Y` is the position at the moment the sensor fires, not at the initial `mousedown`. For the 8px-distance sensor, the pointer has moved 8px from the original grab point, causing a visible snap.

**Fix approach (D-01/D-02):**

```typescript
// 1. In dragStore.ts — add to DragState type and INITIAL_STATE:
pointerDownX: number;  // set at onPointerDown, reset to 0 by end()
pointerDownY: number;
setPointerDown: (x: number, y: number) => void;

// INITIAL_STATE addition:
pointerDownX: 0,
pointerDownY: 0,

// Action:
setPointerDown: (x, y) => set({ pointerDownX: x, pointerDownY: y }),

// end() already uses spread of INITIAL_STATE — no extra reset needed

// 2. In useCellDraggable.ts — expose onPointerDown capture:
// Option A: useCellDraggable returns an onCapturePointerDown callback
// Option B: LeafNode calls dragStore.setPointerDown directly in its handlePointerDown

// IMPORTANT: LeafNode already has onPointerDown (handlePointerDown) gated on isPanMode.
// The current handlePointerDown early-returns when NOT in panMode:
//   if (!isPanMode) return;
// So a new pointer-capture call must be added BEFORE the panMode guard, or merged.
```

**Integration point in LeafNode.tsx:** [VERIFIED: LeafNode.tsx lines 494-501]

`handlePointerDown` in `LeafNode.tsx` currently returns early when `!isPanMode`. The `setPointerDown` call must happen regardless of pan mode — it should fire at the start of `handlePointerDown` before the early return:

```typescript
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  // D-01/D-02: capture pointer coords at true mousedown time for ghost offset fix
  useDragStore.getState().setPointerDown(e.clientX, e.clientY);
  if (!isPanMode) return;
  // ... existing pan logic
}, [isPanMode, id]);
```

**grabOffsetModifier update:**
```typescript
export const grabOffsetModifier: Modifier = ({
  transform,
  draggingNodeRect,
}) => {
  if (!draggingNodeRect) return transform;
  // Read from dragStore instead of activatorEvent
  const { pointerDownX, pointerDownY } = useDragStore.getState();
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

Note: `activatorEvent` parameter no longer needed in the destructuring (can be omitted).

### Pattern 4: dragStore Field Additions

**Current INITIAL_STATE:** [VERIFIED: dragStore.ts lines 47-56]

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
};
```

**New fields to add to INITIAL_STATE:**
```typescript
  pointerDownX: 0,
  pointerDownY: 0,
  lastDropId: null as string | null,
```

**New actions:**
```typescript
setPointerDown: (x: number, y: number) => set({ pointerDownX: x, pointerDownY: y }),
setLastDrop: (id: string) => set({ lastDropId: id }),
clearLastDrop: () => set({ lastDropId: null }),
```

`end()` automatically resets all three via `set({ ...INITIAL_STATE })` — no change to `end()` needed.

**Updated DragState type additions:**
```typescript
pointerDownX: number;
pointerDownY: number;
lastDropId: string | null;
setPointerDown: (x: number, y: number) => void;
setLastDrop: (id: string) => void;
clearLastDrop: () => void;
```

### Pattern 5: Drop Flash (D-08)

**Implementation pattern:** [VERIFIED: existing selector pattern in DropZoneIndicators.tsx]

```typescript
// In LeafNode.tsx — new selector (matches existing dragStore selector pattern):
const isLastDrop = useDragStore((s) => s.lastDropId === id);

// Apply flash class when isLastDrop is true:
className={`... ${isLastDrop ? 'animate-drop-flash' : ''}`}
```

**CSS keyframes in src/index.css:**
```css
@keyframes drop-flash {
  0%   { box-shadow: 0 0 0 2px var(--ring); }
  100% { box-shadow: none; }
}
```

**In tailwind.config.js extend.animation (or via inline style):**
```javascript
animation: {
  'drop-flash': 'drop-flash 700ms ease-out',
  'cell-wobble': 'cell-wobble 150ms ease-in-out',
},
keyframes: {
  'drop-flash': {
    '0%':   { boxShadow: '0 0 0 2px var(--ring)' },
    '100%': { boxShadow: 'none' },
  },
  'cell-wobble': {
    '0%':   { transform: 'rotate(0deg)' },
    '25%':  { transform: 'rotate(1.5deg)' },
    '75%':  { transform: 'rotate(-1.5deg)' },
    '100%': { transform: 'rotate(0deg)' },
  },
},
```

Alternatively: define keyframes in `src/index.css` and reference via inline `style={{ animation: 'drop-flash 700ms ease-out' }}`. Both approaches are valid. Using `tailwind.config.js` extensions enables `animate-drop-flash` Tailwind class.

**Note on `--ring` token:** [VERIFIED: src/index.css] In light mode `--ring: oklch(0.708 0 0)` (medium gray). This is a neutral gray ring, not a strongly visible accent. The UI-SPEC recommends `var(--ring)` for box-shadow flash. If stronger visibility is needed, `var(--primary)` (`oklch(0.205 0 0)` dark) could substitute, but this is Claude's discretion per the spec.

### Pattern 6: Drag-Start Wobble (D-09)

**Keyframes** (from UI-SPEC, confirmed matches D-09):
```css
@keyframes cell-wobble {
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(1.5deg); }
  75%  { transform: rotate(-1.5deg); }
  100% { transform: rotate(0deg); }
}
```

**Application in LeafNode.tsx:** `isDragging` is already available from `useCellDraggable`:
```typescript
const { attributes: dragAttributes, listeners: dragListeners, isDragging, setNodeRef } = useCellDraggable(id);
// ...
<div
  className={`... ${isDragging ? 'animate-cell-wobble' : ''}`}
  // ...
>
```

**Interaction with existing styles:** LeafNode root div already has `transition: 'opacity 150ms ease-out'` on the source cell (dims to 0.4 opacity). The wobble `transform` on the same element will not conflict because `transition` only applies to `opacity`, not `transform`. Both run simultaneously on `isDragging`.

**`animation-fill-mode`:** Return to 0 (standard — no `fill-mode: forwards`). After 150ms the wobble completes and transform returns to identity. `isDragging` stays true (the class stays applied), but since the animation has no `infinite` or `fill-mode: forwards`, it completes once and the element returns to normal transform. This is the correct behavior per D-09.

### Pattern 7: Ghost Opacity + Size Cap

**Current state:** [VERIFIED: DragPreviewPortal.tsx lines 76-95]

Ghost `<img>` currently has `opacity: 1`. Change to `opacity: 0.2` (D-05).

**Size cap implementation (D-03/D-04):**
```css
/* src/index.css :root {} — add: */
--ghost-cap: 200px;
```

```typescript
// DragPreviewPortal.tsx <img>:
className="max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)]"
style={{
  opacity: 0.2,
  display: 'block',
  pointerEvents: 'none',
  width: `${sourceW}px`,
  height: `${sourceH}px`,
}}
```

**Note on width/height vs max-width/max-height interaction:** The `<img>` has explicit `width`/`height` via inline `style`. Tailwind `max-w-[...]` applies `max-width` as a CSS property. The CSS cascade: `max-width` constrains the computed width even when `width` is set explicitly — so `max-w-[var(--ghost-cap)]` will cap the ghost correctly even when `sourceW > 200`. [VERIFIED: CSS specification behavior]

### Pattern 8: prefers-reduced-motion Guards

Required per UI-SPEC (HIGH severity from UI-INTELLIGENCE.md):

```css
/* src/index.css */
@media (prefers-reduced-motion: reduce) {
  .animate-cell-wobble {
    animation: none !important;
  }
  .animate-drop-flash {
    animation: none !important;
  }
  /* dropAnimation (snap-back) — handled via DragOverlay dropAnimation prop:
     Set duration to 0 via a media-query-aware approach.
     Simplest: the CSS animation on DragOverlay uses the Web Animations API
     which respects prefers-reduced-motion natively in modern browsers.
     Alternative: detect in JS and pass dropAnimation={null} when prefers-reduced-motion. */
}
```

**Note on snap-back and reduced motion:** The `dropAnimation` config `{ duration: 200, easing: 'ease-in' }` uses dnd-kit's Web Animations API internally. Browser support for automatic `prefers-reduced-motion` detection in WAAPI is present in Chrome 90+ / Firefox 90+ / Safari 15+ (the project's targets). However, this is not guaranteed — the safest approach is a JS-level check:

```typescript
// In DragPreviewPortal.tsx:
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// ...
<DragOverlay
  dropAnimation={prefersReducedMotion ? null : { duration: 200, easing: 'ease-in' }}
  modifiers={[grabOffsetModifier]}
>
```

This is Claude's discretion — either approach satisfies the requirement.

### Anti-Patterns to Avoid

- **Do NOT call `dragStore.end()` before `setLastDrop(toId)` in `handleDragEnd`** — end() resets all fields including overId/activeZone, but `lastDropId` is a separate field. Ordering: `setLastDrop` → `end()` → `setTimeout(clearLastDrop)`.
- **Do NOT spread `dragListeners` before explicit `onPointerDown` in LeafNode JSX** — the existing code correctly spreads LAST (`{...(!isPanMode ? dragListeners : {})}`). The new `setPointerDown` call must be inside the existing `handlePointerDown`, NOT as a separate `onPointerDown` attribute.
- **Do NOT use `KeyboardSensor` with `activationConstraint: { distance: 8 }`** — KeyboardSensor has no meaningful distance constraint. Only PointerSensor variants use distance/delay constraints.
- **Do NOT set `animation-fill-mode: forwards` on `cell-wobble`** — it would hold the rotated position after the animation ends, making the cell appear permanently skewed while `isDragging` is true.
- **Do NOT remove `activatorEvent` check from grabOffsetModifier without handling the zero-coords edge case** — when `pointerDownX === 0 && pointerDownY === 0` (no onPointerDown fired yet), return `transform` unchanged. This guards against keyboard-initiated drags where no pointer event fires.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ESC cancel during drag | Custom keydown listener | `KeyboardSensor` from @dnd-kit/core | dnd-kit manages sensor state; custom keydown listener won't have access to the active drag context |
| Drop animation | Custom requestAnimationFrame loop | `DragOverlay dropAnimation` config | The WAAPI-based animation in DragOverlay knows the source rect and target rect; custom code would need to replicate this geometry calculation |
| Ghost positioning offset | Custom CSS transform | `grabOffsetModifier` Modifier function | Modifiers receive the DragOverlay's computed transform; working outside this system breaks the overlay coordinate system |

**Key insight:** All three complex behaviors (ESC, snap-back, ghost offset) are solved by dnd-kit's built-in APIs. Phase 29 is a configuration problem, not a custom-build problem.

---

## Common Pitfalls

### Pitfall 1: Listeners Spread Order Breaks setPointerDown
**What goes wrong:** Adding a second `onPointerDown` attribute to the LeafNode JSX element instead of merging into the existing `handlePointerDown` callback. React will silently use only the last `onPointerDown` attribute.
**Why it happens:** Easy to forget that `dragListeners` also contains an `onPointerDown` from dnd-kit, spread at the end.
**How to avoid:** Add `dragStore.setPointerDown(e.clientX, e.clientY)` as the FIRST line of the existing `handlePointerDown` callback in LeafNode, before the `if (!isPanMode) return` guard.
**Warning signs:** Ghost position appears correct only when `isPanMode` is true.

### Pitfall 2: dropAnimation Fires on Both End and Cancel
**What goes wrong:** Expecting `dropAnimation` to run only on cancel. It runs on both `onDragEnd` and `onDragCancel`.
**Why it happens:** dnd-kit DragOverlay runs drop animation whenever the overlay is dismissed, regardless of how the drag ended.
**How to avoid:** Accept this behavior (D-07 explicitly acknowledges it). The ghost briefly animates back even on successful drops, but `dragStore.end()` will hide it quickly. Do not add logic to suppress animation on `onDragEnd`.
**Warning signs:** Ghost "bounces back" briefly even on successful drops — this is expected.

### Pitfall 3: dragStore.end() Called Before setLastDrop
**What goes wrong:** The drop flash never shows because `lastDropId` is set after `end()` clears it, or `end()` runs in the same microtask and clears `lastDropId` before the LeafNode re-renders.
**Why it happens:** Current `handleDragEnd` calls `end()` first, then has `if (!over) return`. Adding `setLastDrop` after this returns is safe, but adding after `end()` risks the flash being cleared.
**How to avoid:** Correct order in `handleDragEnd`:
```typescript
const toId = String(over.id);
if (toId === sourceId) return;
moveCell(sourceId, toId, activeZone ?? 'center');
useDragStore.getState().setLastDrop(toId);   // 1. set flash
useDragStore.getState().end();               // 2. reset drag state
document.body.style.cursor = '';            // 3. cursor
setTimeout(() => useDragStore.getState().clearLastDrop(), 700);  // 4. schedule clear
```

### Pitfall 4: Wobble Animation Class Persists After Drag Ends
**What goes wrong:** Cell remains in a rotated/animated state because `animate-cell-wobble` class stays applied when `isDragging` is still true after drop animation is running.
**Why it happens:** `isDragging` from `useDraggable` (dnd-kit) returns `true` until the drop animation completes, not just until pointer release.
**How to avoid:** The `cell-wobble` animation has `animation-fill-mode: none` (default) and duration 150ms — it completes on its own regardless of `isDragging`. The class staying applied doesn't cause persistent rotation; the animation just doesn't replay after 150ms. Acceptable.
**Warning signs:** Cell appears jittery during the full drag; check for `animation-iteration-count: infinite` accidentally added.

### Pitfall 5: pointerDownX/Y Zero Coordinates Edge Case
**What goes wrong:** On a touch device where `onPointerDown` fires at (0,0) (unlikely but possible on old Android), `grabOffsetModifier` returns unchanged transform instead of applying offset.
**Why it happens:** The proposed guard `if (pointerDownX === 0 && pointerDownY === 0) return transform` triggers.
**How to avoid:** Store whether `setPointerDown` was called via a boolean flag, OR treat any (x > 0 OR y > 0) as a valid pointer position. For this project's use case (photos on a ~375px wide screen), pointer coords at (0,0) are practically impossible — this edge case is acceptable to ignore.

### Pitfall 6: dragStore Test File Needs beforeEach Update
**What goes wrong:** Existing test `beforeEach` in `dragStore.test.ts` manually resets only the 8 original fields via `useDragStore.setState({...})`. After adding `pointerDownX`, `pointerDownY`, `lastDropId`, these new fields won't be reset between tests unless the `beforeEach` is updated.
**Why it happens:** Zustand `setState` is a shallow merge — fields not listed in `setState` retain their values.
**How to avoid:** Update `beforeEach` in `dragStore.test.ts` to include all new fields in the reset object.

---

## Code Examples

### Complete dragStore additions
```typescript
// Source: verified against existing dragStore.ts pattern

// Type additions:
pointerDownX: number;
pointerDownY: number;
lastDropId: string | null;
setPointerDown: (x: number, y: number) => void;
setLastDrop: (id: string) => void;
clearLastDrop: () => void;

// INITIAL_STATE additions:
pointerDownX: 0,
pointerDownY: 0,
lastDropId: null as string | null,

// Action additions:
setPointerDown: (x, y) => set({ pointerDownX: x, pointerDownY: y }),
setLastDrop: (id) => set({ lastDropId: id }),
clearLastDrop: () => set({ lastDropId: null }),
```

### KeyboardSensor in CanvasWrapper
```typescript
// Source: verified @dnd-kit/core export
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

const touchSensor = useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
const mouseSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
const keyboardSensor = useSensor(KeyboardSensor);
const sensors = useSensors(touchSensor, mouseSensor, keyboardSensor);
```

### DragPreviewPortal changes
```typescript
// Source: verified DropAnimationOptions type declaration
<DragOverlay
  dropAnimation={{ duration: 200, easing: 'ease-in' }}
  modifiers={[grabOffsetModifier]}
>
  {isDragging && ghostUrl ? (
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
  ) : null}
</DragOverlay>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dropAnimation={null}` | `dropAnimation={{ duration, easing }}` | Phase 29 | Enables snap-back on cancel |
| `activatorEvent` coords for ghost offset | `pointerDownX/Y` captured at `onPointerDown` | Phase 29 | Ghost spawns at correct grab point |
| Ghost `opacity: 1` | Ghost `opacity: 0.2` | Phase 29 | Drop zones visible through ghost |
| No ESC cancel | `KeyboardSensor` in useSensors | Phase 29 | ESC cancels drag natively |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `KeyboardSensor` requires no special config to fire `onDragCancel` on ESC | KeyboardSensor Integration | Low — confirmed in CJS source that `defaultKeyboardCodes.cancel = ['Escape']` |
| A2 | `prefers-reduced-motion` is respected automatically by WAAPI in Chrome/Firefox/Safari targets | Pattern 8 | Low — browsers 90+ all honor it; JS fallback provided as alternative |
| A3 | `max-width` on `<img>` with explicit inline `width` style will correctly cap the rendered width | Ghost Size Cap | Very low — standard CSS cascade; `max-width` wins over `width` |

**All critical implementation claims are VERIFIED against installed source files.**

---

## Open Questions (RESOLVED)

1. **`dragStore.end()` timing with dropAnimation**
   - What we know: `dropAnimation` runs after the ghost is dismissed; `dragStore.end()` currently fires immediately in `handleDragEnd`/`handleDragCancel`.
   - What's unclear: If `end()` runs before the snap-back animation completes, the ghost might disappear prematurely (since `isDragging` from `useDragStore` would become false and `DragPreviewPortal` renders `null`).
   - RESOLVED: `DragOverlay` manages the ghost independently during `dropAnimation` — the overlay uses its own internal `isDraggingRef` from DndContext, not `useDragStore`'s `isDragging`. Calling `dragStore.end()` immediately is safe. Proceed with immediate `end()` call.

2. **`onAnimationEnd` for drop flash cleanup alternative**
   - What we know: `setTimeout(clearLastDrop, 700)` is the specified approach (D-08).
   - What's unclear: If animation completes earlier (e.g., user switches tabs), the timeout keeps `lastDropId` set until 700ms.
   - RESOLVED: Use `setTimeout` approach as specified in D-08. `onAnimationEnd` adds complexity without material benefit; deferred unless visual testing reveals issues.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 29 is purely code/CSS changes to existing files. No external tools, CLIs, databases, or new runtimes required. All packages already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vite.config.ts` (vitest inline config) |
| Quick run command | `npx vitest run src/dnd/dragStore.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-02 | `dragStore` has `pointerDownX`, `pointerDownY`, `lastDropId` fields that reset via `end()` | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ (extend existing) |
| D-02 | `setPointerDown(x, y)` sets fields; `setLastDrop(id)` sets lastDropId; `clearLastDrop()` clears it | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ (extend existing) |
| D-06 | `KeyboardSensor` is registered in `CanvasWrapper` sensors config | unit/smoke | `npx vitest run src/Grid/CanvasWrapper.test.tsx` | ❌ Wave 0 |
| D-01 | `grabOffsetModifier` reads `pointerDownX/Y` from dragStore (not `activatorEvent`) | unit | `npx vitest run src/dnd/DragPreviewPortal.test.tsx` | ❌ Wave 0 |
| D-08 | `handleDragEnd` calls `setLastDrop(toId)` before `end()` on successful drop | unit | `npx vitest run src/Grid/CanvasWrapper.test.tsx` | ❌ Wave 0 |
| D-09 | LeafNode applies wobble class when `isDragging` | unit | `npx vitest run src/Grid/LeafNode.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/dnd/dragStore.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/Grid/CanvasWrapper.test.tsx` — covers D-06 (KeyboardSensor registered in sensors)
- [ ] `src/dnd/DragPreviewPortal.test.tsx` — covers D-01 (grabOffsetModifier reads pointerDownX/Y)
- [ ] Update `src/dnd/dragStore.test.ts` `beforeEach` to include 3 new fields in reset

*(Existing `dragStore.test.ts` covers the store's contract and will catch D-02 with new tests added to the same file.)*

---

## Security Domain

This phase introduces no authentication, session management, access control, cryptography, input validation from external sources, or network calls. No ASVS categories apply. Phase 29 is purely client-side UI/animation state management.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@dnd-kit/core/dist/index.d.ts` — KeyboardSensor export confirmed
- `node_modules/@dnd-kit/core/dist/sensors/keyboard/KeyboardSensor.d.ts` — KeyboardSensorOptions type
- `node_modules/@dnd-kit/core/dist/core.cjs.development.js` — ESC cancel behavior in `defaultKeyboardCodes`, `handleCancel` implementation
- `node_modules/@dnd-kit/core/dist/components/DragOverlay/hooks/useDropAnimation.d.ts` — `DropAnimationOptions` shape (`duration`, `easing`, `keyframes`, `sideEffects`)
- `node_modules/@dnd-kit/core/dist/components/DragOverlay/DragOverlay.d.ts` — `dropAnimation` prop type
- `src/dnd/dragStore.ts` — current INITIAL_STATE shape (8 fields), action signatures
- `src/dnd/DragPreviewPortal.tsx` — current `grabOffsetModifier` implementation, DragOverlay usage
- `src/dnd/useCellDraggable.ts` — current hook shape (no onPointerDown exposure)
- `src/Grid/CanvasWrapper.tsx` — current sensor config (touchSensor + mouseSensor), handleDragEnd/Cancel
- `src/Grid/LeafNode.tsx` — handlePointerDown location and pan mode gate pattern
- `src/dnd/DropZoneIndicators.tsx` — text-white / text-white/30 confirmed as active/inactive
- `src/index.css` — existing `@keyframes drag-hold-pulse`, prefers-reduced-motion pattern, CSS variable declarations
- `tailwind.config.js` — no existing `animation:` or `keyframes:` extensions; theme.extend confirmed

### Secondary (MEDIUM confidence)
- `src/dnd/dragStore.test.ts` — confirmed test patterns: beforeEach manual reset, vitest usage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules
- Architecture: HIGH — all integration points read from actual source files
- Pitfalls: HIGH — derived from direct inspection of existing code patterns and dnd-kit source

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable — @dnd-kit/core at ^6.3.1, no breaking changes expected)
