# Phase 29: ESC-Cancel + Visual Polish - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add ESC-to-cancel drag gesture and 6 visual polish items to the Phase 28 DnD system. The ghost rendering has three overrides from the original REQUIREMENTS spec (position fix, size cap, opacity change) that must be treated as locked decisions — do not revert to the spec values.

Out of scope for this phase: mobile haptics, MobileSheet auto-collapse, cross-device CSS (`touch-action`, `-webkit-touch-callout`, `user-select`, `contextmenu`) — those are Phase 30.

</domain>

<decisions>
## Implementation Decisions

### Ghost — Position Fix (overrides GHOST-02, GHOST-04)
- **D-01:** The ghost spawns in the wrong position because `grabOffsetModifier` uses `activatorEvent` coords — which are recorded after the 8px/250ms sensor threshold, not at `mousedown`. Fix: record pointer coords in `onPointerDown` on the cell (or in `useCellDraggable`), store as `pointerDownX/pointerDownY` in `dragStore`, and use those instead of `activatorEvent` inside `grabOffsetModifier`.
- **D-02:** The `dragStore` needs two new fields: `pointerDownX: number` and `pointerDownY: number`. These are set by a `setPointerDown(x, y)` action called from the cell's `onPointerDown` handler and reset to 0 by `end()`.

### Ghost — Size Cap (overrides GHOST-04)
- **D-03:** Ghost renders with `maxWidth` and `maxHeight` capped at a fixed pixel value (~200px or similar — exact value deferred to a future UI-spec pass). The actual dimensions still come from `sourceW/sourceH` in `dragStore`; the cap is applied via CSS `max-width`/`max-height` on the `<img>` in `DragPreviewPortal`.
- **D-04:** The exact cap value is deferred to the UI-spec phase (user unsure about 200px). For now, implement with a Tailwind class `max-w-[200px] max-h-[200px]` or CSS variable so it can be tuned in the UI-spec phase without code changes.

### Ghost — Opacity (overrides GHOST-03)
- **D-05:** Ghost opacity is **20%** (opacity: 0.2) — not the 80% specified in GHOST-03. Lower opacity makes the underlying drop target visible through the ghost, helping users see which zone they're hovering over.

### ESC-Cancel Wiring
- **D-06:** Add `KeyboardSensor` from `@dnd-kit/core` to `useSensors` in `CanvasWrapper.tsx`. dnd-kit handles ESC natively and fires `onDragCancel` automatically. This does not violate DND-01 — DND-01 prohibited separate `TouchSensor + MouseSensor` in favor of a unified `PointerSensor`; `KeyboardSensor` serves a different purpose (cancel gesture).

### Snap-Back Animation
- **D-07:** Re-enable `DragOverlay`'s `dropAnimation` (currently `null`). Set to a custom config: `duration: 200, easing: 'ease-in'`. Fires automatically on `onDragCancel` — the ghost animates back to the source cell position. On successful drop (`onDragEnd`), `dropAnimation` still runs briefly before `dragStore.end()` hides the ghost — this is acceptable behavior.

### Drop Flash
- **D-08:** Add `lastDropId: string | null` to `dragStore` alongside `setLastDrop(id)` and `clearLastDrop()` actions. `handleDragEnd` in `CanvasWrapper.tsx` calls `setLastDrop(toId)` after a successful `moveCell`, then `setTimeout(() => dragStore.clearLastDrop(), 700)`. Each `LeafNode` subscribes via `useDragStore(s => s.lastDropId === cellId)` and applies a flash CSS class when truthy.

### Drag-Start Wobble
- **D-09:** Subtle rotation wobble: `±1.5deg` over `150ms` CSS `@keyframes cell-wobble`. Applied to the source cell's wrapper div when `isDragging` is true. The class is removed when drag ends (via `isDragging` returning false). Defined in global CSS or as a Tailwind `animate-*` extension.

### Active Zone Bright/Dim (partially done in Phase 28)
- **D-10:** `DropZoneIndicators.tsx` already uses `text-white` (active) vs `text-white/30` (inactive). Verify this is correct and ship as-is — no changes needed unless visual testing reveals issues.

### Claude's Discretion
- Flash visual style: background color flash or ring/outline flash — Claude's choice. Accent color (`text-accent` or `ring-accent`) is appropriate.
- Wobble animation: whether to use `fill-mode: forwards` to hold the final position or let it return to 0 — standard behavior (return to 0) is fine.
- Whether to show the drop flash on `center` zone (swap) as well as edge zones — yes, flash on all successful drops.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DnD Foundation (Phase 27–28)
- `src/dnd/dragStore.ts` — current DragState shape; new fields (pointerDownX, pointerDownY, lastDropId) go here
- `src/dnd/DragPreviewPortal.tsx` — ghost rendering; grabOffsetModifier lives here; dropAnimation config goes here
- `src/dnd/DropZoneIndicators.tsx` — zone icon rendering; active/dim styling already implemented
- `src/dnd/useCellDraggable.ts` — hook that marks a cell as draggable; onPointerDown capture goes here
- `src/Grid/CanvasWrapper.tsx` — DndContext host; sensors config; all drag event handlers

### Phase 28 Context (locked decisions)
- `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` — locked DnD decisions; D-01 through D-03 carry forward

### Requirements
- `.planning/REQUIREMENTS.md` — DND-01 through CROSS-01 requirements; note overrides D-01/D-03/D-05 above supersede GHOST-02, GHOST-03, GHOST-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useDragStore` (`src/dnd/dragStore.ts`): vanilla Zustand store, no middleware — adding fields is straightforward
- `grabOffsetModifier` (`src/dnd/DragPreviewPortal.tsx`): modifier function for DragOverlay; needs to read `pointerDownX/Y` from dragStore instead of `activatorEvent`
- `DropZoneIndicators` (`src/dnd/DropZoneIndicators.tsx`): already has active/inactive classes; no changes needed
- `handleDragEnd` / `handleDragCancel` in `CanvasWrapper.tsx`: event handlers where flash and cancel logic attach

### Established Patterns
- dragStore uses `INITIAL_STATE` spread in `end()` — new fields (pointerDownX, pointerDownY, lastDropId) must be added to `INITIAL_STATE` and reset there
- CSS animations in this project use Tailwind `animate-*` utilities or global `@keyframes` in `index.css`
- `useDragStore(s => s.someField === cellId)` selector pattern used in `DropZoneIndicators` — same pattern for `lastDropId`

### Integration Points
- `onPointerDown` in `LeafNode.tsx` or `useCellDraggable.ts` → new `dragStore.setPointerDown(x, y)` call
- `DragOverlay dropAnimation={null}` in `DragPreviewPortal.tsx` → change to custom animation config
- `handleDragEnd` in `CanvasWrapper.tsx` → add `setLastDrop(toId)` + setTimeout
- `LeafNode` render → subscribe to `lastDropId === cellId` for flash class

</code_context>

<specifics>
## Specific Ideas

- Ghost position bug root cause confirmed: `activatorEvent` is the event at sensor threshold (after 8px/250ms delay), not at `mousedown`. The fix uses `pointerDownX/Y` stored at `onPointerDown` time.
- Ghost cap value: user mentioned ~200px but is unsure — implement as a CSS variable or Tailwind arbitrary value (`max-w-[200px]`) so a future UI-spec pass can tune it without code changes.
- The ghost position fix may also resolve the drop-zone edge access issue (some edges were unreachable because the ghost occluded them — smaller + more transparent ghost should unblock edge zones).
- The user noted they plan a UI-spec phase for DnD visual polish details — the ghost cap and possibly other visual values will be revisited then.

</specifics>

<deferred>
## Deferred Ideas

- Ghost size cap exact value (200px?) — deferred to UI-spec phase
- Other DnD visual polish details — deferred to UI-spec phase
- Mobile haptics, MobileSheet auto-collapse, cross-device CSS — Phase 30

</deferred>

---

*Phase: 29-esc-cancel-visual-polish*
*Context gathered: 2026-04-19*
