# Phase 30: Mobile Handle + Tray Polish - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver native-feeling mobile touch interactions for the drag-and-drop system: haptic feedback on drag-start and drop commit, iOS-specific interference suppression (scroll hijack, image-action menu, context menu, text selection), and automatic tray/sheet collapse on drag-start. No new capabilities — this phase wires mobile UX polish onto the existing dnd-kit engine built in Phases 27–29.

</domain>

<decisions>
## Implementation Decisions

### Sheet Collapse Storage (CROSS-08)
- **D-01:** Add `prevSheetSnapState: 'collapsed' | 'full' | null` field to `dragStore`. `beginCellDrag` saves the current `editorStore.sheetSnapState` before collapsing; `end()` reads `prevSheetSnapState` and restores it via `editorStore.setSheetSnapState`, then resets the field to null. Centralizes drag lifecycle in one store — no component refs needed.

### touch-action Scope (CROSS-02)
- **D-02:** Return `{ touchAction: 'none' }` in the `style` object from `useCellDraggable`. This applies `touch-action: none` only to the draggable element, co-located with drag logic, zero risk of spreading to ancestor elements. `-webkit-touch-callout: none` (CROSS-03) goes in the same style object.

### Tray Visibility During Drag (CROSS-08)
- **D-03:** `MobileCellTray` gets both `opacity: 0` AND `pointer-events: none` when `dragStore.status === 'dragging'`. Prevents ghost tap-throughs on invisible tray buttons while a drag is active. Both applied/removed together via a single `isDragging` selector.

### Test Strategy (CROSS-02–07)
- **D-04:** Vitest behavioral unit tests only — spy on `navigator.vibrate` and assert calls with correct pulse durations (10ms, 15ms), spy on `contextmenu` handler and assert `preventDefault()` called, assert `useCellDraggable` style object contains `touchAction: 'none'` and `WebkitTouchCallout: 'none'`. Real-device UAT checklist for actual browser behavior on iOS Safari and Android Chrome.

### Claude's Discretion
- Exact location of `contextmenu` suppression wiring (inside `DndContext` host's `onDragStart`/`onDragEnd` callbacks, or inside a `useEffect` in `useCellDraggable`) — Claude chooses the cleanest integration point with existing Phase 28/29 code.
- Whether `MobileSheet` collapse logic lives in `MobileSheet.tsx` (subscribing to `dragStore`) or in the `DndContext` host's `onDragStart` callback — Claude picks whichever keeps the component less coupled.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v1.5-ROADMAP.md` §Phase 30 — Full Phase 30 details with CROSS-02 through CROSS-08 requirement specs, implementation notes, and success criteria. PRIMARY reference.

### Store Architecture
- `src/dnd/dragStore.ts` — Current dragStore shape (11 fields + 6 actions); D-01 adds `prevSheetSnapState` field. Read before modifying.
- `src/store/editorStore.ts` — `sheetSnapState` and `setSheetSnapState` live here; used by D-01 to save/restore sheet state.

### Mobile Components
- `src/Editor/MobileSheet.tsx` — Sheet snap state component; uses `editorStore.sheetSnapState`. CROSS-08 sheet collapse wired here or in DndContext host.
- `src/Editor/MobileCellTray.tsx` — Tray component; D-03 adds opacity+pointer-events when dragging.

### DnD Hooks
- `src/dnd/useCellDraggable.ts` — D-02 adds `touchAction: 'none'` and `WebkitTouchCallout: 'none'` to returned style object here.
- `src/Editor/EditorShell.tsx` — DndContext host; CROSS-04 (`user-select: none`), CROSS-05 (`contextmenu` suppression), CROSS-06 (`vibrate(10)`), CROSS-07 (`vibrate(15)`) wired in `onDragStart`/`onDragEnd` callbacks.

### Anti-Patterns
- `.planning/milestones/v1.5-ROADMAP.md` §Blocking anti-patterns — Pitfall 6 (touch-action: none must NOT spread to ancestors; bottom-sheet scrolling and pinch-to-zoom must be preserved).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dragStore.ts` `beginCellDrag` / `end()`: already called on every drag lifecycle event — add `prevSheetSnapState` save/restore here without touching callers
- `useCellDraggable.ts` returns `style` object: D-02's `touchAction` and `WebkitTouchCallout` go in the existing style return, no API surface change
- `MobileCellTray.tsx`: already has opacity transition (line 104, `opacity 0.3s` transition string) — extend selector to include `pointer-events: none` when dragging
- `EditorShell.tsx`: existing `onDragStart`/`onDragEnd` on `DndContext` — all body-level side effects (cursor class, user-select, contextmenu, vibrate) wire here

### Established Patterns
- Side-effects during drag (e.g., `cursor: grabbing` on body) already use `onDragStart`/`onDragEnd` + `useEffect` in the DndContext host
- Optional chaining for browser API fallbacks: existing code uses `?.` for APIs not available in jsdom
- `navigator.vibrate?.()` — correct pattern; no-throw on Safari/jsdom

### Integration Points
- `dragStore.beginCellDrag` is called in `useCellDraggable.ts` on drag activation — this is where `prevSheetSnapState` should be captured and sheet collapsed
- `dragStore.end()` is called in DndContext `onDragEnd`/`onDragCancel` — restore `sheetSnapState` from `prevSheetSnapState` here

</code_context>

<specifics>
## Specific Ideas

- CROSS-08 bottom-sheet collapse is two-step: (1) read current `editorStore.sheetSnapState` → save to `dragStore.prevSheetSnapState`, (2) call `editorStore.setSheetSnapState('collapsed')`. Restore is symmetric in `end()`.
- `navigator.vibrate` is not available on iOS Safari — guard with optional chaining only; no try/catch needed.
- UAT checklist items required by spec: 250ms long-press clean on iOS Safari, image-action menu suppressed, address-bar collapse during drag does not cancel, text selection / loupe absent during drag.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-mobile-handle-tray-polish*
*Context gathered: 2026-04-19*
