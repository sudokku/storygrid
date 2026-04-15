# Phase 23 Context: Bottom Sheet Redesign

## Phase Summary

**Goal**: The mobile bottom sheet is reliably accessible and fully scrollable in every state, opened and closed via a toggle button.

**Requirements**: SHEET-01, SHEET-02, SHEET-03, SHEET-04

---

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 23 goal, success criteria, requirements
- `.planning/REQUIREMENTS.md` — SHEET-01, SHEET-02, SHEET-03, SHEET-04 definitions
- `src/Editor/MobileSheet.tsx` — Full component to be redesigned
- `src/store/editorStore.ts` — `sheetSnapState` type and `setSheetSnapState` action (lines 31, 58, 91, 122)
- `.planning/phases/22-mobile-header-touch-polish/22-CONTEXT.md` — Phase 22 decisions (header toolbar buttons already moved there)

---

## Decisions

### Snap States — Collapsed ↔ Full only; half state removed

The `half` snap state is removed entirely. The sheet has two states: `collapsed` (60px tab strip visible) and `full` (full-height panel).

- Remove `'half'` from `SheetSnapState` type in `editorStore.ts`
- Remove `half` from `SNAP_TRANSLATE` in `MobileSheet.tsx`
- Toggle cycles: `collapsed → full → collapsed`

**Rationale**: Half was only ever a transition stop when drag was possible. Without the drag-pill, there is no natural way to reach half — keeping it would create an unreachable state.

### Tab Strip Content — Left chevron + tab label

When collapsed, the 60px strip shows:
- **Left**: `ChevronUp` icon in a 44×44px tap target (the toggle button)
- **Center**: Tab label text — `"Canvas Settings"` when no cell selected, `"Cell Settings"` when a cell is selected
- The strip itself is not tappable as a whole — only the chevron button triggers the toggle

**Visual layout**:
```
[ ▲  Canvas Settings          ]   (collapsed, no cell)
[ ▲  Cell Settings            ]   (collapsed, cell selected)
[ ▽  Cell Settings            ]   (open, cell selected — chevron points down)
```

**Cleanup**: Remove the old visual drag-pill div (`h-1 w-8 rounded-full bg-[#555]`) and the sheet's header row containing Templates/Undo/Redo/Clear — those controls are now in the Phase 22 header toolbar. The 60px area is now the tab strip only.

### Toggle Button — Left-aligned, flips direction

- `ChevronUp` when sheet is collapsed (tap to open)
- `ChevronDown` when sheet is full (tap to close)
- Position: left edge of the strip, 44×44px minimum tap target
- Uses lucide-react `ChevronUp` / `ChevronDown` icons (already installed)
- Aria label: `"Open panel"` when collapsed, `"Close panel"` when full

### Auto-Expand — Full height, animated on cell select

When a cell is tapped/selected (`selectedNodeId` changes from null to a value), the sheet expands to `'full'`.

- Change the existing `useEffect` from `setSheetSnapState('half')` to `setSheetSnapState('full')`
- Transition: existing `0.3s cubic-bezier(0.32, 0.72, 0, 1)` — no change needed, already applied when `isDragging` is false (and `isDragging` state is being removed anyway)

### Drag Gesture Removal — Full cleanup

Remove all drag-related code from `MobileSheet.tsx`:
- `isDragging` state and setter
- `dragStartRef` ref
- `handlePointerDown` / `handlePointerUp` callbacks
- `DRAG_THRESHOLD` constant
- `touch-none cursor-grab select-none` classes from the drag area div
- `onPointerDown` / `onPointerUp` event handlers
- The `transition` style conditional (`isDragging ? 'none' : '...'`) → always use the animated transition

---

## Deferred Ideas

None captured during this discussion.

---

## Prior Decisions Applied

- [Phase 22] Undo, Redo, Templates, Export, Clear are now in the mobile header toolbar — do NOT recreate them in the sheet tab strip
- [Phase 5.1] Mobile-specific layout uses `isMobile` / `md:hidden` conditional — sheet stays `md:hidden`
- [Phase 22] `touch-action: manipulation` is global via CSS rule — no need to add it per-element inside the sheet
