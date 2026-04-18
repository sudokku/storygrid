# Phase 28: Cell-to-Cell Drag - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 28-cell-to-cell-drag
**Areas discussed:** DndContext host component, Drop zone icon set

---

## DndContext Host Component

| Option | Description | Selected |
|--------|-------------|----------|
| EditorShell.tsx | Higher in tree — DragPreviewPortal as sibling to CanvasWrapper and MobileSheet; makes Phase 30 auto-collapse trivial | |
| CanvasWrapper.tsx | Same location as Phase 25; keeps DnD logic co-located with grid; MobileSheet auto-collapse handled separately in Phase 30 | ✓ |

**User's choice:** CanvasWrapper.tsx
**Notes:** User preferred keeping DnD co-located with the grid rather than moving it higher. Phase 30 MobileSheet auto-collapse will read `dragStore.status` directly via selector (vanilla store is accessible anywhere — no need to be inside DndContext tree).

---

## Drop Zone Icons

| Option | Description | Selected |
|--------|-------------|----------|
| Directional arrows | ArrowUp/Down/Left/Right for edges; Maximize2 for center swap | ✓ |
| Chevrons + Plus | ChevronUp/Down/Left/Right for edges; Plus for center | |
| Claude's Discretion | Claude picks based on Atlassian pattern | |

**User's choice:** Directional arrows (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2)
**Notes:** Clear directional intent was preferred over lighter-weight chevrons.

---

## Claude's Discretion

- Ghost canvas capture approach (offscreen canvas for img/video frames)
- `data-dnd-ignore` placement details
- File drop guard implementation details
- PointerSensor dual-constraint implementation approach

## Deferred Ideas

None.
