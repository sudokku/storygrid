# Phase 25: Touch Drag-and-Drop - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Mobile users can restructure the grid by long-pressing a cell (≥500ms) and dragging it to a new position or slot. Dropping on a cell's center zone swaps content; dropping on an edge zone inserts the dragged cell at that edge position in the grid tree. This phase also migrates desktop cell drag from native HTML5 events to @dnd-kit, unifying both into one system.

</domain>

<decisions>
## Implementation Decisions

### Implementation Strategy
- **D-01:** Replace the native HTML5 drag swap mechanism in `LeafNode.tsx` (`ondragstart`/`onDrop`) with `useDraggable` and `useDroppable` from @dnd-kit.
- **D-02:** Add a new `DndContext` wrapping `GridNode` (not `EditorShell`) configured with both `MouseSensor` and `TouchSensor`. This is separate from the existing `DndContext` in `EditorShell` (used for ActionBar drag positioning).
- **D-03:** Nested DndContexts are trusted to work correctly — inner `GridNode` context handles grid drops; outer `EditorShell` context handles ActionBar drops. Verify non-interference during implementation (a quick test suffices).
- **D-04:** Both desktop (mouse) and mobile (touch) use the unified @dnd-kit `DndContext` — no parallel native drag system remaining after this phase.

### Long-Press Feedback
- **D-05:** During the 500ms hold before drag activates: show a subtle scale pulse (~1.03×) on the cell to signal that a drag is about to initiate.
- **D-06:** On drag activation (500ms threshold crossed): `scale(1.08)` + `opacity: 60%` for the lifted cell. This is the "lift" state that persists for the full drag.
- **D-07:** `TouchSensor` activation delay is set to 500ms (matching DRAG-01 requirement exactly).

### Touch Conflict Handling
- **D-08:** Long-press drag suppresses single-tap cell selection. When the 500ms activation delay elapses, `TouchSensor` consumes the touch event — no tap-select fires simultaneously.
- **D-09:** Touch count gate: if a second finger is added during the 500ms wait, cancel the drag timer and allow pinch-to-zoom to take over. @dnd-kit `TouchSensor` handles this automatically (monitors touch count).
- **D-10:** If the user releases the drag outside any droppable cell (empty canvas area or off-screen), the drag is cancelled and the cell snaps back to its original position. No state change — standard @dnd-kit behavior on non-droppable release.

### Desktop Behavior
- **D-11:** Desktop mouse drag uses `MouseSensor` in the same new `DndContext` as touch. Native HTML5 drag event handlers (`ondragstart`, `ondragover`, `onDrop`) are removed from `LeafNode.tsx`.
- **D-12:** Desktop retains the same 5-zone visual overlay (existing zone overlay JSX in `LeafNode.tsx`). Zone rendering is reused by both desktop and mobile — no duplication.

### Drop Zone Rendering (Claude's Discretion)
- Zone overlays appear on all non-dragged cells simultaneously during a drag (existing desktop behavior). The implementer may choose to show zones only on the hovered cell if performance warrants it — but default to showing all zones.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 25 goal, success criteria, requirements (DRAG-01, DRAG-02, DRAG-03, DRAG-04)
- `.planning/REQUIREMENTS.md` — DRAG-01 through DRAG-04 definitions

### Prior Decision to Follow
- `.planning/decisions/adr-cell-swap-touch.md` — Original ADR deferring this feature. The implementation path outlined there is now being executed. Read for the two-DndContext rationale and the specific components to modify.

### Existing Code to Understand
- `src/Grid/LeafNode.tsx` — Current native HTML5 drag implementation to be replaced; existing 5-zone overlay JSX to be retained; pinch-to-zoom touch listeners (passive) that must not conflict
- `src/Grid/GridNode.tsx` — Wrap this component (or its render site) with the new DndContext
- `src/store/gridStore.ts` — `swapCells` and `moveCell` actions (already implemented; these are the drop handlers)
- `src/Editor/EditorShell.tsx` — Contains the existing outer DndContext (ActionBar) — do not modify this; new context nests inside it

### Prior Phase Context
- `.planning/phases/22-mobile-header-touch-polish/22-CONTEXT.md` — Touch polish decisions: 44px targets, touch-action: manipulation global
- `.planning/phases/24-mobile-cell-action-tray/24-CONTEXT.md` — MobileCellTray layout and z-index reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Grid/LeafNode.tsx` — 5-zone hit detection logic (lines ~428–443) and zone overlay JSX (line ~661+) already implemented for desktop. Port/adapt these to @dnd-kit's `onDragOver`/`useDndMonitor` pattern instead of native `ondragover`.
- `src/store/gridStore.ts` — `moveCell(fromId, toId, edge)` handles all 5 drop zones (center = swap, 4 edges = insert). No store changes needed.
- `@dnd-kit/core` already installed — `useDraggable`, `useDroppable`, `DndContext`, `MouseSensor`, `TouchSensor`, `useSensor`, `useSensors` all available.

### Established Patterns
- `React.memo` wrapping on all Grid components — maintain on `LeafNode` and `GridNode`.
- Pinch-to-zoom in `LeafNode.tsx` uses passive `touchstart`/`touchmove` listeners on the element. @dnd-kit `TouchSensor` uses `pointerdown` — these operate on different event types and should coexist without conflict.
- `touch-action: manipulation` is set globally (Phase 22) — verify @dnd-kit does not set `touch-action: none` on draggable elements (it does by default; this will need to be configured or overridden to not block scrolling on non-drag touches).

### Integration Points
- New `DndContext` should wrap `GridNode` at whatever site renders it (likely `CanvasWrapper.tsx` or `EditorShell.tsx` — confirm during implementation).
- `onDragEnd` callback in the new `DndContext` reads `active.id` (dragged cell) and `over.id` + `over.data.current.zone` (target cell + which zone) to call `moveCell`.

</code_context>

<specifics>
## Specific Ideas

- The ADR implementation path is the canonical spec: replace `ondragstart`/`onDrop` in `LeafNode.tsx`, add a `DndContext` wrapping `GridNode` with `[MouseSensor, TouchSensor]`.
- Long-press hold pulse (D-05) should be implemented as a CSS `@keyframes` or Tailwind animation triggered by a `data-holding` attribute or a React state flag — whichever is simpler.

</specifics>

<deferred>
## Deferred Ideas

None captured during this discussion.

</deferred>
