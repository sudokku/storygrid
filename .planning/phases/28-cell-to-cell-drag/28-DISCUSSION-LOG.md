# Phase 28: Cell-to-Cell Drag - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-17
**Phase:** 28-cell-to-cell-drag
**Mode:** assumptions
**Areas analyzed:** DndContext+sensors, Ghost pipeline, Drop-zone rendering, Phase 25 teardown, data-dnd-ignore+interop, Testing strategy

## Assumptions Presented

### Area 1: DndContext mount + sensor configuration

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| DndContext mounts in CanvasWrapper.tsx (not EditorShell) | Likely | CanvasWrapper already owns useSensors (lines 61-69); EditorShell would scope activators to Toolbar/Sidebar unnecessarily |
| Two PointerSensor subclasses (one mouse gated, one touch gated) — NOT a single combined constraint | Likely | `PointerActivationConstraint` union in AbstractPointerSensor.d.ts:20 is single-value; `useCombineActivators` lets first matching sensor win; combined `{delay,distance}` collapses to delay-only per attach() logic at core.esm.js:1451-1460 |
| Mouse: `{distance: 8}` activation; Touch: `{delay: 250, tolerance: 5}` activation | Likely | DRAG-03/DRAG-04 explicit requirements |
| onDragStart/Over/End/Cancel callbacks write imperatively via useDragStore.getState() | Likely | dragStore is vanilla Zustand; avoid React re-subscription inside DndContext host |

### Area 2: Ghost rendering pipeline

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| `canvas.toDataURL()` captured synchronously in onDragStart | Likely | LeafNode canvas exists unconditionally (LeafNode.tsx:682-686); React useEffect capture would race React commit cycle (Pitfall 9) |
| `ghostDataUrl` + `sourceRect` added to dragStore | Likely | Keeps adapter/dndkit.ts as the single place sensor callbacks write state |
| DragOverlay portal rendered in document.body (outside scaled canvas) | Confident | GHOST-06 explicit; DragOverlay default behavior verified in types |
| Custom Modifier in adapter/dndkit.ts divides transform by canvasScale | Likely | @dnd-kit/modifiers does NOT ship scale compensation — only createSnapModifier/restrictTo*/snapCenterToCursor |
| DragOverlay.adjustScale stays false | Confident | adjustScale compensates drop-targets, not dragged element — would double-compensate |
| Empty-cell fallback: `<div>` with bg-[#1c1c1c] at source dims | Likely | LeafNode canvas is display:none when no mediaUrl (LeafNode.tsx:685) |
| Ghost opacity 0.8 (matches Phase 29's GHOST-03) | Likely | Avoids cosmetic change between phases |

### Area 3: Drop-zone overlay rendering

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| DropZoneIndicators mounted conditionally on `overId === id && status === 'dragging'` | Confident | Avoids always-rendered overhead; Phase 25 precedent at LeafNode.tsx:720-756 |
| Root div: absolute, inset:0, pointer-events:none, z-index:20; 5 tiling children | Confident | ARCHITECTURE.md §6 z-index map; existing Phase 25 pattern proven correct |
| Icons: lucide ArrowLeftRight (center), ArrowUp/Down/Left/Right (edges) | Confident | Consistent with existing iconography; lucide already used |
| Icon size `32 / canvasScale` for screen-constant visual | Likely | Standard pattern for canvas-transform-compensated UI |
| computeDropZone keeps reading LeafNode.getBoundingClientRect() | Confident | Locked Phase 27 contract; pointer-events:none on indicators guarantees passthrough |
| Active/inactive zone styling is OUT of Phase 28 scope (DROP-02/03 → Phase 29) | Confident | REQUIREMENTS.md + Traceability Table |

### Area 4: Phase 25 teardown

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| 5 source files touched: CanvasWrapper, LeafNode, EditorShell (add portal), Divider + OverlayLayer (data-dnd-ignore) | Likely | Exhaustive grep for current Phase 25 references returns these files |
| Delete from CanvasWrapper: MouseSensor/TouchSensor/KeyboardSensor imports + DragZoneRefContext | Likely | No other consumers of DragZoneRefContext outside LeafNode |
| Delete from LeafNode: useDraggable/useDroppable/useDndMonitor imports, DragZoneRefContext, ActiveZone state, pointerPosRef listener, isPendingDrag + hold-pulse, 5 inline zone JSX blocks | Likely | All lines cited against current file |
| Delete wholesale: `src/test/phase25-touch-dnd.test.tsx` | Likely | Mocks MouseSensor/TouchSensor/KeyboardSensor with 500ms — obsolete + trips SC-3 grep |
| Delete drag-handle tests in `phase05-p02-cell-swap.test.ts` | Likely | DRAG-07 removes the drag-handle button |
| Rewrite `phase09-p03-leafnode-zones.test.ts` + `LeafNode.test.tsx` — drop useDndMonitor refs | Likely | deferred-items.md:13-25 explicit guidance |
| @dnd-kit/core, /sortable, /utilities STAY in package.json | Confident | New engine imports DndContext/PointerSensor/useDraggable/useDroppable/DragOverlay from @dnd-kit/core |

### Area 5: data-dnd-ignore + overlay/file-drop interop

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Add data-dnd-ignore="true" on Divider hit-area (Divider.tsx:103) + OverlayLayer root (OverlayLayer.tsx:51) | Likely | Matches ROADMAP.md line 85 directive |
| Guard implemented in custom PointerSensor subclass activator (not useDraggable.disabled) | Likely | useDraggable exposes only static `disabled` boolean — no per-event canDrag |
| OverlayLayer selected overlay: pointerEvents 'none' when dragStore.status === 'dragging' | Likely | ARCHITECTURE.md §8 Option A; existing pattern at OverlayLayer.tsx:67 |
| Divider.tsx setPointerCapture preserved — naturally blocks dnd-kit takeover | Confident | Pointer capture routes all subsequent events to capture target (Web API contract) |
| File-drop paths preserved (LeafNode.tsx:656-658, CanvasArea.tsx:89-94) | Confident | PointerSensor uses pointermove/pointerup — never fires dragstart/dragover/drop; zero collision |

### Area 6: Testing strategy

| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Three new Vitest files under `src/dnd/__tests__/`: useCellDraggable, useCellDropTarget, integration | Likely | Covers the three behavior surfaces; jsdom supports fireEvent.pointerDown/Move |
| SC-1/SC-2 activation timing verified by config-value assertions, not fake-timer pointer sequences | Likely | PITFALLS.md §11: jsdom delay-constraint timing is unreliable |
| SC-4 (file drop) covered by existing phase08-p02-workspace-drop + rewritten phase09-p03 | Likely | Existing tests unchanged; rewrite drops only useDndMonitor mocks |
| SC-5 (visual) requires manual UAT | Confident | PITFALLS.md §11: jsdom cannot render drag preview visually |

## Corrections Made

No corrections — all assumptions confirmed by the user.

## External Research

Not performed in this session. Two topics flagged for `gsd-phase-researcher` during the research phase:
1. Canvas `toDataURL()` timing vs rAF draw loop for video cells during dnd-kit's synchronous `onDragStart`
2. Exact `Modifier` signature + property mutation for scale compensation under ancestor `transform: scale()` — dnd-kit issues #50, #205, #250, #393
