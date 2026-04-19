# Phase 30: Mobile Handle + Tray Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 30-mobile-handle-tray-polish
**Areas discussed:** Sheet collapse storage, touch-action scope, Tray pointer events during drag, Test strategy

---

## Sheet collapse storage

| Option | Description | Selected |
|--------|-------------|----------|
| dragStore field | Add prevSheetSnapState to dragStore; beginCellDrag saves it, end() restores it | ✓ |
| useRef in MobileSheet | Local ref in component, subscribes to dragStore.status | |
| editorStore prev field | Add drag-specific state to editorStore | |

**User's choice:** dragStore field
**Notes:** Centralizes drag lifecycle in one store, no component refs needed.

---

## touch-action scope

| Option | Description | Selected |
|--------|-------------|----------|
| useCellDraggable style | Return { touchAction: 'none' } in hook's style object | ✓ |
| Tailwind class touch-none on LeafNode | Add className directly in component JSX | |
| CSS via ref effect | Imperative useEffect in useCellDraggable | |

**User's choice:** useCellDraggable style
**Notes:** Co-located with drag logic, zero ancestor spread risk.

---

## Tray pointer events during drag

| Option | Description | Selected |
|--------|-------------|----------|
| opacity: 0 + pointer-events: none | Both applied when dragging | ✓ |
| opacity: 0 only (spec-literal) | Match spec exactly, no pointer-events change | |

**User's choice:** opacity: 0 + pointer-events: none
**Notes:** Prevents ghost tap-throughs on invisible tray buttons.

---

## Test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral unit tests + UAT checklist | Spy on navigator.vibrate, contextmenu, style assertions + real-device checklist | ✓ |
| Skip unit tests, UAT only | Manual verification only | |
| Playwright integration tests | Add Playwright infrastructure (doesn't exist in project) | |

**User's choice:** Behavioral unit tests + UAT checklist
**Notes:** Standard pattern for browser APIs in this project.

---

## Claude's Discretion

- Exact location of contextmenu suppression wiring (DndContext callbacks vs useCellDraggable useEffect)
- Whether MobileSheet collapse logic lives in the component or DndContext host

## Deferred Ideas

None.
