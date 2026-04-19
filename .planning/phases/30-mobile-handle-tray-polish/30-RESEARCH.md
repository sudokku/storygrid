# Phase 30: Mobile Handle + Tray Polish - Research

**Researched:** 2026-04-19
**Domain:** Mobile touch UX — haptic feedback, iOS interference suppression, tray/sheet collapse on drag
**Confidence:** HIGH

---

## Summary

Phase 30 is a pure wiring phase — no new capabilities, no new components, no new npm packages. All
seven requirements (CROSS-02 through CROSS-08) are browser API calls and store mutations bolted onto
the existing dnd-kit engine from Phases 27–29.

The DndContext host lives in `CanvasWrapper.tsx` (not `EditorShell.tsx`). All body-level drag
side-effects (`cursor: grabbing`, drop flash) are already wired in `CanvasWrapper`'s
`handleDragStart`/`handleDragEnd`/`handleDragCancel` callbacks — this is the correct location for
CROSS-04, CROSS-05, CROSS-06, and CROSS-07 as well.

`touch-action: none` is **already present** as a static inline style on the `LeafNode` root `<div>`
(line 589). The D-02 instruction to add it to `useCellDraggable`'s returned style object would be a
no-op if applied to the same element, but the plan must reconcile this: the existing static style on
the element is equivalent to what D-02 specifies — the implementation just needs to verify the style
is already there rather than adding it.

The biggest structural change is `dragStore.beginCellDrag` gaining a side-effectful cross-store
call to `useEditorStore.getState().setSheetSnapState('collapsed')`. This is the first time
`dragStore` reaches into `editorStore` at call time — the implementation must use `.getState()`
directly (not a React hook) since `beginCellDrag` runs synchronously inside
`useCellDraggable`'s composed `onPointerDown` listener, outside React render.

**Primary recommendation:** Wire all CROSS-02–07 side-effects in `CanvasWrapper.tsx`'s existing
drag callbacks. Add `prevSheetSnapState` to `dragStore` and call `setSheetSnapState` from within
`beginCellDrag` / `end()` using `.getState()` imperative access. The `touchAction: 'none'` on
`LeafNode` is already present — verify, don't duplicate.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add `prevSheetSnapState: 'collapsed' | 'full' | null` field to `dragStore`. `beginCellDrag` saves the current `editorStore.sheetSnapState` before collapsing; `end()` reads `prevSheetSnapState` and restores it via `editorStore.setSheetSnapState`, then resets the field to null. Centralizes drag lifecycle in one store — no component refs needed.
- **D-02:** Return `{ touchAction: 'none' }` in the `style` object from `useCellDraggable`. This applies `touch-action: none` only to the draggable element, co-located with drag logic, zero risk of spreading to ancestor elements. `-webkit-touch-callout: none` (CROSS-03) goes in the same style object.
- **D-03:** `MobileCellTray` gets both `opacity: 0` AND `pointer-events: none` when `dragStore.status === 'dragging'`. Prevents ghost tap-throughs on invisible tray buttons while a drag is active. Both applied/removed together via a single `isDragging` selector.
- **D-04:** Vitest behavioral unit tests only — spy on `navigator.vibrate` and assert calls with correct pulse durations (10ms, 15ms), spy on `contextmenu` handler and assert `preventDefault()` called, assert `useCellDraggable` style object contains `touchAction: 'none'` and `WebkitTouchCallout: 'none'`. Real-device UAT checklist for actual browser behavior on iOS Safari and Android Chrome.

### Claude's Discretion
- Exact location of `contextmenu` suppression wiring (inside `DndContext` host's `onDragStart`/`onDragEnd` callbacks, or inside a `useEffect` in `useCellDraggable`) — Claude chooses the cleanest integration point with existing Phase 28/29 code.
- Whether `MobileSheet` collapse logic lives in `MobileSheet.tsx` (subscribing to `dragStore`) or in the `DndContext` host's `onDragStart` callback — Claude picks whichever keeps the component less coupled.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CROSS-02 | `touch-action: none` on draggable `LeafNode` element only (not ancestors) | Already present as static inline style in LeafNode.tsx line 589. D-02 adds it to `useCellDraggable` return — both approaches target the same element. |
| CROSS-03 | `-webkit-touch-callout: none` on draggable `LeafNode` element | Not yet applied anywhere. Goes in `useCellDraggable` style return per D-02. |
| CROSS-04 | `document.body.style.userSelect = 'none'` on drag-start; restore on drag-end | Not yet applied. Wire in `CanvasWrapper.handleDragStart` / `handleDragEnd` / `handleDragCancel` alongside existing `document.body.style.cursor` lines. |
| CROSS-05 | `contextmenu` suppression via `capture` listener during active drag | Not yet applied. Wire attach in `handleDragStart`, remove in `handleDragEnd` + `handleDragCancel`. |
| CROSS-06 | `navigator.vibrate?.(10)` on successful drag activation | Not yet applied. Wire in `CanvasWrapper.handleDragStart` after `beginCellDrag`. |
| CROSS-07 | `navigator.vibrate?.(15)` on successful drop commit | Not yet applied. Wire in `CanvasWrapper.handleDragEnd` after `moveCell` is invoked (guarded by truthy `over` and non-equal `sourceId`). |
| CROSS-08 | `MobileCellTray` opacity fade + `MobileSheet` auto-collapse on drag-start | Tray needs `isDragging` selector; dragStore needs `prevSheetSnapState` field; `beginCellDrag` / `end()` need cross-store calls. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Haptic feedback (CROSS-06, CROSS-07) | Browser/Client | — | `navigator.vibrate` is a browser API; called in DndContext host callbacks |
| iOS scroll/callout suppression (CROSS-02, CROSS-03) | Browser/Client | — | CSS properties on the draggable element; zero server involvement |
| Body user-select / contextmenu (CROSS-04, CROSS-05) | Browser/Client | — | `document.body` DOM mutations; scoped to drag lifecycle in DndContext host |
| Tray visibility (CROSS-08a) | Frontend (React component) | Zustand store | `MobileCellTray` reads `dragStore.status` as a reactive selector |
| Sheet collapse (CROSS-08b) | Zustand store | Frontend (React component) | `dragStore.beginCellDrag` / `end()` write `editorStore.sheetSnapState`; `MobileSheet` reacts via existing `sheetSnapState` subscription |

---

## Standard Stack

No new packages. All work uses existing dependencies.

| Library | Version (installed) | Purpose in Phase 30 |
|---------|---------------------|---------------------|
| Zustand | ^5.0.12 | `dragStore` field addition; `.getState()` imperative calls |
| @dnd-kit/core | ^6.3.1 | `DndContext` callbacks where vibrate/userSelect are wired |
| React 18 | ^18.3.x | `useCallback`, `useEffect` in components |

**Installation:** none required.

---

## Architecture Patterns

### System Architecture Diagram

```
onPointerDown (LeafNode)
  └─> composedListeners.onPointerDown (useCellDraggable)
        └─> dragStore.setPointerDown(x, y)
        └─> dnd-kit PointerSensor activationConstraint (250ms / 8px)
              └─> [activation fires]
                    └─> CanvasWrapper.handleDragStart
                          ├─> dragStore.beginCellDrag(...)
                          │     ├─> [NEW] read editorStore.sheetSnapState
                          │     ├─> [NEW] save to dragStore.prevSheetSnapState
                          │     └─> [NEW] editorStore.setSheetSnapState('collapsed')
                          ├─> document.body.style.cursor = 'grabbing'  [existing]
                          ├─> [NEW] document.body.style.userSelect = 'none'
                          ├─> [NEW] document.addEventListener('contextmenu', handler, true)
                          └─> [NEW] navigator.vibrate?.(10)

                    └─> MobileCellTray [reactive]
                          └─> dragStore.status === 'dragging' → opacity:0, pointerEvents:none

pointer moves
  └─> CanvasWrapper.handleDragMove → dragStore.setOver(...)

onDragEnd / onDragCancel
  └─> CanvasWrapper.handleDragEnd / handleDragCancel
        ├─> moveCell(...)  [if valid drop]
        ├─> dragStore.end()
        │     ├─> [NEW] read prevSheetSnapState
        │     ├─> [NEW] editorStore.setSheetSnapState(prevSheetSnapState)
        │     └─> [NEW] reset prevSheetSnapState to null
        ├─> document.body.style.cursor = ''  [existing]
        ├─> [NEW] document.body.style.userSelect = ''
        ├─> [NEW] document.removeEventListener('contextmenu', handler, true)
        └─> [NEW] navigator.vibrate?.(15)  [handleDragEnd only, after moveCell]
```

### Recommended Project Structure (unchanged)

```
src/
├── dnd/
│   ├── dragStore.ts          # add prevSheetSnapState field
│   ├── useCellDraggable.ts   # add style return with touchAction + WebkitTouchCallout
│   └── dragStore.test.ts     # extend with prevSheetSnapState tests
├── Editor/
│   └── MobileCellTray.tsx    # add isDragging selector → opacity/pointerEvents
├── Grid/
│   └── CanvasWrapper.tsx     # add CROSS-04/05/06/07 side-effects in callbacks
└── (MobileSheet.tsx — no changes needed)
```

### Pattern 1: Cross-Store Imperative Call in Vanilla Store Action

`dragStore` is a vanilla Zustand store (no React context). It can access `editorStore` directly
using `.getState()` — no hooks required. This is the existing project pattern for cross-store reads.

```typescript
// Source: [VERIFIED: current dragStore.ts + editorStore.ts codebase]
// Inside dragStore create() callback:
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) => {
  // Cross-store read — safe because vanilla store actions are not React hooks
  const prevSnap = useEditorStore.getState().sheetSnapState;
  useEditorStore.getState().setSheetSnapState('collapsed');
  set({
    status: 'dragging', kind: 'cell', sourceId,
    overId: null, activeZone: null, ghostUrl, sourceW, sourceH,
    prevSheetSnapState: prevSnap,
  });
},
end: () => {
  const { prevSheetSnapState } = useDragStore.getState();
  if (prevSheetSnapState !== null) {
    useEditorStore.getState().setSheetSnapState(prevSheetSnapState);
  }
  set({ ...INITIAL_STATE });
},
```

Note: `end()` accesses `useDragStore.getState()` to read `prevSheetSnapState` before calling `set()`.
This is safe because `set()` is synchronous.

### Pattern 2: Contextmenu Suppression via Capture Listener

```typescript
// Source: [CITED: MDN addEventListener — capture phase]
// Handler defined ONCE at module scope (stable reference for removeEventListener)
const suppressContextMenu = (e: Event) => e.preventDefault();

// In handleDragStart:
document.addEventListener('contextmenu', suppressContextMenu, true);

// In handleDragEnd AND handleDragCancel:
document.removeEventListener('contextmenu', suppressContextMenu, true);
```

The handler reference must be stable (module-level or `useRef`/`useCallback`) so that
`removeEventListener` can match it. A new function literal in each `addEventListener` call would
leak the listener on every drag.

### Pattern 3: useCellDraggable Style Return (D-02)

Currently `useCellDraggable` does NOT return a `style` object — the return type is
`{ attributes, listeners, isDragging, setNodeRef }`. D-02 adds a `style` property:

```typescript
// Current UseCellDraggableResult (verified in src/dnd/useCellDraggable.ts):
export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};

// Phase 30 addition:
export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;   // NEW — CROSS-02 + CROSS-03
};

// Returned value:
style: {
  touchAction: 'none',
  WebkitTouchCallout: 'none',
}
```

`LeafNode.tsx` already has `touchAction: 'none'` as a static inline style (line 589). When
`useCellDraggable` also returns it, the consumer in `LeafNode` must merge the style objects.
The correct pattern is to spread hook style first, then override with local styles
(or remove the duplicate static style entry and rely solely on the hook):

```typescript
// Option A — merge (safest, no LeafNode logic change):
style={{ ...dragStyle, backfaceVisibility: 'hidden', touchAction: 'none', ... }}

// Option B — remove static touchAction from LeafNode, rely on hook:
// LeafNode style omits touchAction; hook always provides it
style={{ ...dragStyle, backfaceVisibility: 'hidden', ... }}
```

Option B is cleaner (single source of truth for the touch-action policy) and aligns with the
D-02 "co-located with drag logic" rationale. The plan must pick one approach explicitly.

### Pattern 4: MobileCellTray isDragging Composition

```typescript
// Current style object (lines 103-109 of MobileCellTray.tsx):
style={{
  bottom: '60px',
  opacity: isVisible ? 1 : 0,
  transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
  pointerEvents: isVisible ? 'auto' : 'none',
  transition: 'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s ...',
}}

// Phase 30 addition — add isDragging selector:
const isDragging = useDragStore(s => s.status === 'dragging');

// Composed style:
style={{
  bottom: '60px',
  opacity: isDragging ? 0 : (isVisible ? 1 : 0),
  transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
  pointerEvents: (isDragging || !isVisible) ? 'none' : 'auto',
  transition: 'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s ...',
}}
```

The `transition` string is unchanged. The `motion-reduce:transition-none` class on the
container already handles reduced-motion — no new CSS needed.

### Anti-Patterns to Avoid

- **Spreading `touchAction: 'none'` onto ancestor elements:** `CanvasArea.tsx` already applies
  `touchAction: 'none'` conditionally on the `<main>` when the sheet is open (`sheetOpen ? { touchAction: 'none' } : {}`). Phase 30's CROSS-02 must NOT add a second unconditional `touchAction: 'none'` to the canvas container — only the draggable leaf element.
- **Creating a new function literal for contextmenu handler on every drag:** Use a module-level
  stable reference. Otherwise `removeEventListener` will not match and the listener leaks.
- **Calling `useEditorStore` (React hook) inside `dragStore.beginCellDrag`:** Use `.getState()`
  imperative access only. Hooks cannot be called outside React render.
- **Setting `prevSheetSnapState` to `null` before reading it in `end()`:** The `end()` action
  must read `prevSheetSnapState` from the CURRENT state before calling `set({ ...INITIAL_STATE })`,
  because `INITIAL_STATE` sets `prevSheetSnapState: null`. Read-then-reset, not reset-then-read.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Touch scroll cancellation | Custom touchstart/touchmove preventDefault | `touch-action: none` CSS | Already on the element; browser-handled, no JS needed |
| Drag lifecycle events | Custom pointer event tracking | `DndContext` `onDragStart`/`onDragEnd` callbacks | Already wired; this is the intended extension point |
| Cross-store communication | React context bridge | `.getState()` imperative Zustand access | Both stores are vanilla Zustand; getState() is the correct pattern |

---

## Common Pitfalls

### Pitfall 1: `removeEventListener` Reference Mismatch for Contextmenu Handler
**What goes wrong:** `document.removeEventListener('contextmenu', fn, true)` silently no-ops if `fn`
is not the exact same reference that was passed to `addEventListener`.
**Why it happens:** If the handler is an inline arrow function or defined inside `useCallback` with
mismatched deps, the reference is new every call.
**How to avoid:** Define the handler at module scope (outside the component) or in a `useRef` that
is initialized once and never reassigned.
**Warning signs:** Context menu appears after drag-end when it should be suppressed; or context menu
stays suppressed permanently after the first drag (listener was never removed).

### Pitfall 2: Reading `prevSheetSnapState` After `set({ ...INITIAL_STATE })`
**What goes wrong:** `end()` calls `set({ ...INITIAL_STATE })` which sets `prevSheetSnapState: null`,
then tries to read it — gets `null` and cannot restore the sheet state.
**Why it happens:** `set()` is synchronous; state is overwritten before the read.
**How to avoid:** Read `prevSheetSnapState` from `useDragStore.getState()` or capture it as a local
`const` before calling `set({ ...INITIAL_STATE })`.

### Pitfall 3: Double-Applying `touch-action: none` to the Wrong Scope
**What goes wrong:** Adding `touchAction: 'none'` at a parent level (CanvasArea, CanvasWrapper)
breaks bottom-sheet scrolling and pinch-to-zoom (already handled — `CanvasArea` only applies it
when `sheetOpen`, not during drag).
**Why it happens:** `touch-action: none` is inherited by children if set on a container.
**How to avoid:** Apply only to the leaf draggable element. `LeafNode` already has it statically.

### Pitfall 4: `navigator.vibrate` TypeScript Error on Safari Type Definition
**What goes wrong:** `navigator.vibrate` is typed as `VibrationAPI` in lib.dom.d.ts; on older
TypeScript configs it may be typed with a specific signature that rejects optional chaining.
**Why it happens:** TypeScript strict type-checking on browser API presence.
**How to avoid:** Use `navigator.vibrate?.(10)` — optional chaining handles both the "property
undefined" case (iOS Safari, jsdom) and the "property exists but is undefined" case. The project
already uses this pattern per CONTEXT.md `## Specifics`.
**Confirm:** No TypeScript issue in practice — TS 5.8 types `navigator.vibrate` correctly with
optional chaining.

### Pitfall 5: `MobileSheet` Auto-Expand Logic Fighting Drag Collapse
**What goes wrong:** When a drag ends and the sheet restores, the `MobileSheet` `useEffect` that
watches `selectedNodeId` may fire simultaneously and expand the sheet to `full`, fighting the
restore from `dragStore.end()`.
**Why it happens:** The `useEffect` fires if `selectedNodeId` goes from null → non-null, which can
happen if the drag drop selects a cell. But `end()` restores `prevSheetSnapState` which might have
been `collapsed`.
**How to avoid:** The effect only fires on `null → non-null` transition (prev === null, curr !== null).
After a drag the `selectedNodeId` does not change (selection is preserved), so this race does not
occur in normal use. Verify: `beginCellDrag` does not clear `selectedNodeId`.

### Pitfall 6: `beginCellDrag` Called Twice Without `end()` (Interrupted Drag)
**What goes wrong:** `prevSheetSnapState` is overwritten by the second `beginCellDrag`, losing the
original snap state.
**Why it happens:** Rapid drag re-initiation.
**How to avoid:** `beginCellDrag` should only overwrite `prevSheetSnapState` if it is currently
`null` (i.e., not already mid-drag). Or, always overwrite — dnd-kit's `PointerSensor` prevents
two simultaneous drags, so this cannot happen in practice. But the defensive check
(`if (prevSheetSnapState === null)`) is cheap insurance.

---

## Code Examples

### dragStore.ts — additions for D-01

```typescript
// Source: [VERIFIED: current src/dnd/dragStore.ts + src/store/editorStore.ts]

// Add to DragState type:
prevSheetSnapState: 'collapsed' | 'full' | null;

// Add to INITIAL_STATE:
prevSheetSnapState: null as 'collapsed' | 'full' | null,

// Modified beginCellDrag:
beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) => {
  const prevSnap = useEditorStore.getState().sheetSnapState; // 'collapsed' | 'full'
  useEditorStore.getState().setSheetSnapState('collapsed');
  set({
    status: 'dragging', kind: 'cell', sourceId,
    overId: null, activeZone: null, ghostUrl, sourceW, sourceH,
    prevSheetSnapState: prevSnap,
  });
},

// Modified end():
end: () => {
  const { prevSheetSnapState } = useDragStore.getState();
  if (prevSheetSnapState !== null) {
    useEditorStore.getState().setSheetSnapState(prevSheetSnapState);
  }
  set({ ...INITIAL_STATE });
},
```

### CanvasWrapper.tsx — CROSS-04, CROSS-05, CROSS-06, CROSS-07

```typescript
// Source: [VERIFIED: current src/Grid/CanvasWrapper.tsx handleDragStart/handleDragEnd]

// Module-level stable reference (CROSS-05):
const suppressContextMenu = (e: Event) => e.preventDefault();

// In handleDragStart (after existing beginCellDrag call):
document.body.style.userSelect = 'none';                                    // CROSS-04
document.addEventListener('contextmenu', suppressContextMenu, true);         // CROSS-05
navigator.vibrate?.(10);                                                     // CROSS-06

// In handleDragEnd (after existing end() call, guard already present for valid drop):
document.body.style.userSelect = '';                                         // CROSS-04
document.removeEventListener('contextmenu', suppressContextMenu, true);      // CROSS-05
// CROSS-07: only on successful move (over exists AND toId !== sourceId):
if (over && String(over.id) !== sourceId) {
  navigator.vibrate?.(15);
}

// In handleDragCancel (after existing end() call):
document.body.style.userSelect = '';                                         // CROSS-04
document.removeEventListener('contextmenu', suppressContextMenu, true);      // CROSS-05
// No vibrate on cancel
```

### useCellDraggable.ts — D-02 style return

```typescript
// Source: [VERIFIED: current src/dnd/useCellDraggable.ts]

export type UseCellDraggableResult = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;   // NEW
};

// In return statement:
return {
  attributes: attributes as Record<string, unknown>,
  listeners: composedListeners as Record<string, unknown>,
  isDragging,
  setNodeRef,
  style: {
    touchAction: 'none',               // CROSS-02
    WebkitTouchCallout: 'none',        // CROSS-03
  },
};
```

**LeafNode.tsx integration note:** `LeafNode` destructures `useCellDraggable` and spreads
`dragAttributes` onto the element. The `style` property must be destructured and merged:

```typescript
const {
  setNodeRef: setDragRef,
  listeners: dragListeners,
  attributes: dragAttributes,
  isDragging,
  style: dragStyle,   // NEW
} = useCellDraggable(id);

// In JSX — merge dragStyle and remove duplicate touchAction from static style:
style={{
  ...dragStyle,                     // touchAction: none, WebkitTouchCallout: none
  backfaceVisibility: 'hidden',
  transition: 'opacity 150ms ease-out',
  cursor: isPanMode ? undefined : 'grab',
  opacity: isSource ? 0.4 : 1,
  // NOTE: touchAction: 'none' removed from here (now comes from dragStyle)
}}
```

---

## Key Findings: Current State vs Phase 30 Changes

| Item | Current State | Phase 30 Change |
|------|--------------|-----------------|
| `touchAction: 'none'` on LeafNode | Static inline style at line 589 of LeafNode.tsx | Move to `useCellDraggable` style return; remove from LeafNode static style |
| `WebkitTouchCallout: 'none'` | Not applied anywhere | Add to `useCellDraggable` style return |
| `document.body.style.userSelect` | Not set during drag | Add `'none'` on drag-start, `''` on drag-end/cancel |
| `contextmenu` suppression | Not applied | Add capture listener on drag-start; remove on drag-end/cancel |
| `navigator.vibrate` | Not called anywhere | 10ms on drag-start; 15ms on successful drop |
| `dragStore.prevSheetSnapState` | Field does not exist | Add field; `beginCellDrag` saves+collapses; `end()` restores+resets |
| `MobileCellTray` during drag | No drag-aware style | Add `isDragging` selector; compose opacity+pointerEvents |
| DndContext host location | `CanvasWrapper.tsx` (NOT EditorShell) | All side-effects go in `CanvasWrapper.tsx` |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Calling `end()` then reading prevSheetSnapState | Read prevSheetSnapState first, then call `set({ ...INITIAL_STATE })` | Standard Zustand pattern; see Pitfall 2 |
| Separate `userSelect` useEffect | Inline in `handleDragStart`/`handleDragEnd` callbacks | Matches existing `cursor: grabbing` pattern in CanvasWrapper |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `navigator.vibrate?.()` with optional chaining compiles without TS error on TS 5.8 | Code Examples | Might need `(navigator as Navigator & { vibrate?: (pattern: number) => boolean }).vibrate?.(10)` — but optional chaining on defined-but-optional browser methods works in TS 5.8 [ASSUMED] |
| A2 | `MobileSheet.tsx` auto-expand `useEffect` fires only on `null → non-null` transition for `selectedNodeId`, so drag-start (which does not clear selection) does not trigger it | Common Pitfalls / Pitfall 5 | If drag-start clears selectedNodeId then restores it on end, the sheet would auto-expand and fight the restore — inspect `beginCellDrag` to confirm no selectedNodeId mutation [VERIFIED: `dragStore.beginCellDrag` does not touch `editorStore.selectedNodeId`] |
| A3 | The `suppressContextMenu` function defined at module scope in `CanvasWrapper.tsx` is the cleanest location; alternative is `useRef` | Code Examples | Both approaches work; module-scope avoids React lifecycle coupling [ASSUMED] |

**Empty for all HIGH-confidence items:** All store shapes, component line numbers, and existing
patterns were verified by reading the actual source files in this session.

---

## Open Questions

1. **Sensor activation delay is 500ms, not 250ms**
   - What we know: `CanvasWrapper.tsx` line 67 shows `{ delay: 500, tolerance: 8 }` — not the
     250ms specified in the Phase 28/v1.5 ROADMAP requirements (DRAG-03).
   - What's unclear: Was 500ms intentional post-Phase 28 (per UAT feedback on Android Chrome),
     or is this a Phase 28 regression that should be 250ms?
   - Recommendation: Flag for human review before Phase 30 execution. Phase 30 does NOT change
     sensor configuration; CROSS-06 (`vibrate(10)` on activation) works regardless of the delay.

2. **Module-scope vs `useRef` for `suppressContextMenu` handler reference**
   - What we know: Both approaches produce a stable reference for `removeEventListener`.
   - What's unclear: `CanvasWrapper` is a `React.memo` component — module-scope is fine, but if
     multiple canvas instances ever existed the listener would be shared.
   - Recommendation: Module-scope is correct for this single-instance component. Claude's
     discretion per CONTEXT.md.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies identified. Phase 30 is pure browser API and
existing store mutations. No new CLI tools, runtimes, or services required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via vite) |
| Config file | `vitest.config.ts` (or `vite.config.ts`) |
| Quick run command | `npx vitest run src/dnd/dragStore.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CROSS-02 | `useCellDraggable` style contains `touchAction: 'none'` | unit | `npx vitest run src/dnd/useCellDraggable.test.ts -t "style"` | ❌ Wave 0 |
| CROSS-03 | `useCellDraggable` style contains `WebkitTouchCallout: 'none'` | unit | same file | ❌ Wave 0 |
| CROSS-04 | `document.body.style.userSelect` set to `'none'` on drag-start | unit/spy | `npx vitest run src/Grid/CanvasWrapper.test.tsx -t "userSelect"` | ❌ Wave 0 |
| CROSS-05 | `contextmenu` handler attached with `{ capture: true }` on drag-start; removed on drag-end | unit/spy | same file | ❌ Wave 0 |
| CROSS-06 | `navigator.vibrate` called with `10` on drag-start | unit/spy | same file | ❌ Wave 0 |
| CROSS-07 | `navigator.vibrate` called with `15` on successful drop commit | unit/spy | same file | ❌ Wave 0 |
| CROSS-08a | `MobileCellTray` opacity is 0 when `dragStore.status === 'dragging'` | unit | `npx vitest run src/Editor/MobileCellTray.test.tsx` | ❌ Wave 0 |
| CROSS-08b | `dragStore.beginCellDrag` saves sheetSnapState to `prevSheetSnapState` and calls `setSheetSnapState('collapsed')` | unit | `npx vitest run src/dnd/dragStore.test.ts -t "prevSheetSnapState"` | ❌ new tests in existing file |
| CROSS-08b | `dragStore.end()` restores `sheetSnapState` from `prevSheetSnapState` | unit | same | ❌ new tests in existing file |

### Sampling Rate
- **Per task commit:** `npx vitest run src/dnd/dragStore.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/dnd/useCellDraggable.test.ts` — covers CROSS-02, CROSS-03 (style object assertions)
- [ ] `src/Grid/CanvasWrapper.test.tsx` — covers CROSS-04, CROSS-05, CROSS-06, CROSS-07 (spy-based)
- [ ] `src/Editor/MobileCellTray.test.tsx` — covers CROSS-08a (isDragging → opacity)
- [ ] New `describe` blocks in existing `src/dnd/dragStore.test.ts` — covers CROSS-08b prevSheetSnapState transitions

**Note on existing `dragStore.test.ts`:** The `beforeEach` reset block must include
`prevSheetSnapState: null` once the field is added. All 11 existing test suites (sections 1–11)
remain valid; sections 12+ are added for Phase 30.

---

## Security Domain

> Phase 30 introduces no authentication, session management, access control, cryptographic
> operations, or user data processing. All changes are CSS properties, browser API calls
> (`navigator.vibrate`, `document.addEventListener`), and synchronous Zustand store mutations.

ASVS does not apply to this phase.

---

## Sources

### Primary (HIGH confidence — verified by reading source files)
- `src/dnd/dragStore.ts` — current shape: 11 fields (`status`, `kind`, `sourceId`, `overId`, `activeZone`, `ghostUrl`, `sourceW`, `sourceH`, `pointerDownX`, `pointerDownY`, `lastDropId`), 6 actions. No `prevSheetSnapState` yet.
- `src/store/editorStore.ts` — `sheetSnapState: 'collapsed' | 'full'` (line 31); `setSheetSnapState` (line 58). Initial value: `'collapsed'`.
- `src/Grid/CanvasWrapper.tsx` — DndContext host with `handleDragStart`, `handleDragMove`, `handleDragEnd`, `handleDragCancel`. Existing `document.body.style.cursor` mutation confirms the pattern for CROSS-04.
- `src/dnd/useCellDraggable.ts` — returns `{ attributes, listeners, isDragging, setNodeRef }`. No `style` property yet.
- `src/Editor/MobileCellTray.tsx` — transition string at line 108: `'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'`. No `isDragging` subscription yet.
- `src/Editor/MobileSheet.tsx` — subscribes to `editorStore.sheetSnapState` (line 23). No `dragStore` subscription. Requires NO code changes (D-01 drives sheet collapse through editorStore).
- `src/Grid/LeafNode.tsx` — `touchAction: 'none'` already present as static inline style (line 589). `useCellDraggable` consumed at line 294–299.
- `src/Editor/CanvasArea.tsx` — `touchAction: 'none'` conditionally on `<main>` when `sheetOpen` (line 88). This is a separate conditional application at the container level and does NOT conflict with the leaf-level static style.
- `src/index.css` — `touch-action: manipulation` on `button`, `[role="button"]`, `input`, `select`, `textarea`, `a` (line 103). This does NOT affect `LeafNode` (a `div`).
- `src/dnd/dragStore.test.ts` — existing 11 test suites covering all current fields; `beforeEach` block must be updated when `prevSheetSnapState` field is added.

### Tertiary (LOW confidence — not verified this session)
- `navigator.vibrate` TypeScript support in TS 5.8 dom lib — optional chaining assumed to work; not explicitly verified against TS 5.8 type definitions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — DndContext host location verified in CanvasWrapper.tsx; all store shapes read from source
- Pitfalls: HIGH — Pitfall 1 (contextmenu listener leak) and Pitfall 2 (read-before-reset) are structural; derived directly from code inspection
- Touch-action scope: HIGH — verified LeafNode already has it; CanvasArea conditional is a different element; index.css only applies to interactive elements

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable codebase; no upstream library churn expected)
