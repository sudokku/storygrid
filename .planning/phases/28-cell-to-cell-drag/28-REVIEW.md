---
phase: 28-cell-to-cell-drag
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/dnd/__tests__/CanvasWrapper.integration.test.tsx
  - src/dnd/__tests__/DragPreviewPortal.test.tsx
  - src/dnd/__tests__/DropZoneIndicators.test.tsx
  - src/dnd/__tests__/useCellDraggable.test.tsx
  - src/dnd/__tests__/useCellDropTarget.test.tsx
  - src/dnd/adapter/__tests__/dndkit.test.ts
  - src/dnd/adapter/dndkit.ts
  - src/dnd/DragPreviewPortal.tsx
  - src/dnd/dragStore.test.ts
  - src/dnd/dragStore.ts
  - src/dnd/DropZoneIndicators.test.tsx
  - src/dnd/DropZoneIndicators.tsx
  - src/dnd/index.ts
  - src/dnd/useCellDraggable.ts
  - src/dnd/useCellDropTarget.ts
  - src/Grid/__tests__/ActionBar.test.tsx
  - src/Grid/__tests__/LeafNode.test.tsx
  - src/Grid/CanvasWrapper.tsx
  - src/Grid/Divider.tsx
  - src/Grid/LeafNode.tsx
  - src/Grid/OverlayLayer.tsx
  - src/test/action-bar.test.tsx
  - src/test/grid-rendering.test.tsx
  - src/test/phase05-p02-cell-swap.test.ts
  - src/test/phase05-p02-pan-zoom.test.tsx
  - src/test/phase09-p03-leafnode-zones.test.ts
  - src/test/phase22-mobile-header.test.tsx
  - src/test/phase25-touch-dnd.test.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 29 (28 present; 1 intentionally deleted)
**Status:** issues_found

## Summary

Phase 28 wires the unified @dnd-kit DnD engine through `src/dnd/*` and replaces the Phase 25 in-LeafNode implementation with a single `DndContext` host in `CanvasWrapper`. The architecture is sound: the ephemeral `dragStore` is isolated from `gridStore`'s undo history, sensor discrimination correctly splits mouse vs touch/pen, and the `[data-dnd-ignore]` escape hatch is honored by both sensors. Extensive unit/integration coverage accompanies the changes.

No Critical issues were found. The findings below cluster around three themes: (1) a small numeric mismatch between the visual drop-zone bands and the hit-test thresholds on small cells; (2) a few defensive-coding gaps around canvas/scale edge cases; and (3) one file in `files_reviewed_list` — `src/test/phase25-touch-dnd.test.tsx` — that was intentionally deleted in commit `4b6d7ca` (D-21) and so was not reviewable. The delete is a legitimate Phase 28 action; the file simply cannot be reviewed.

## Warnings

### WR-01: Visual drop-zone bands (20%) and hit-zone thresholds (max(20px, 20%)) diverge on small cells

**File:** `src/dnd/DropZoneIndicators.tsx:50,58,67,75` vs. `src/dnd/computeDropZone.ts:34`
**Issue:** `DropZoneIndicators` renders top/bottom/left/right bands at a flat `20%` of the cell dimension, while `computeDropZone` resolves zones using `Math.max(20, Math.min(w, h) * 0.2)`. For cells smaller than roughly 100×100 viewport pixels (common at `canvasScale ~ 0.3` or less), the 20px floor in `computeDropZone` makes the real hit-zone wider than the visual band. The ArrowUp/Down/Left/Right icons will sit in a band that no longer matches the zone the user is actually activating, producing a visual-vs-behavior desync (the icon indicates `top` but the pointer is in `center`, or vice versa).
**Fix:** Mirror the `max(20, 20%)` formula in the visual bands — use inline style with a computed pixel value:
```tsx
// In DropZoneIndicators.tsx — thread w/h through via ResizeObserver on the root,
// or via a new prop. Then:
const threshold = Math.max(20, Math.min(w, h) * 0.2);
const bandStyle = { height: `${threshold}px` }; // horizontal bands
const sideStyle = { width: `${threshold}px` };  // vertical bands
```
Alternatively, drop the 20px floor in `computeDropZone` and rely purely on `Math.min(w, h) * 0.2` so both sides use the same proportional formula. Either direction restores agreement — but they must agree.

### WR-02: `DropZoneIndicators` icon sizing does not guard against `canvasScale === 0`

**File:** `src/dnd/DropZoneIndicators.tsx:30`
**Issue:** `const iconSize = 32 / canvasScale;` — if `canvasScale` is `0` (the bootstrap window before `ResizeObserver` fires, per the comment in `adapter/dndkit.ts:117`), `iconSize` becomes `Infinity`, which lucide-react then stamps into the SVG `width`/`height` attributes. `scaleCompensationModifier` explicitly guards this case with `|| 1`; `DropZoneIndicators` does not. The practical impact is small because `DropZoneIndicators` only renders mid-drag (i.e., after the bootstrap window), but the code diverges from the file-level invariant already established in the same module.
**Fix:**
```tsx
const canvasScale = useEditorStore((s) => s.canvasScale);
const iconSize = 32 / (canvasScale || 1);
```

### WR-03: `canvas.toDataURL()` in `handleDragStart` is unguarded against tainted-canvas SecurityError

**File:** `src/Grid/CanvasWrapper.tsx:77`
**Issue:** `const ghostDataUrl = canvas ? canvas.toDataURL() : null;` — if the cell's canvas has ever been painted with a cross-origin image whose server did not emit permissive CORS headers, `toDataURL()` throws `DOMException: SecurityError`. The handler runs synchronously inside dnd-kit's `onDragStart` callback; an uncaught throw here abandons the drag without ever calling `beginCellDrag` or `setGhost`, leaving dnd-kit's internal `active` state and our `dragStore` desynchronized (dnd-kit believes a drag is in flight; our store is still idle). StoryGrid's MVP media path uses blob URLs / data URIs (same-origin) so the risk is low today, but v1 plans for URL-loaded assets would hit this.
**Fix:**
```ts
let ghostDataUrl: string | null = null;
if (canvas) {
  try {
    ghostDataUrl = canvas.toDataURL();
  } catch {
    // Tainted canvas (cross-origin without CORS) — fall back to the
    // D-10 empty-cell ghost branch in DragPreviewPortal.
    ghostDataUrl = null;
  }
}
```

### WR-04: `handleDragOver` / `handleDragStart` use `document.querySelector` keyed on test IDs

**File:** `src/Grid/CanvasWrapper.tsx:74, 101`
**Issue:** Production code resolves the source and target cell elements with `document.querySelector('[data-testid="leaf-${id}"]')`. Test IDs are a testing affordance — they are conventionally treated as free to rename or remove. Coupling runtime drag-zone resolution to them means a future refactor of the test-id naming scheme silently breaks the drag-over pipeline. The component already has direct access to the source/target DOM via the ref callbacks `setDragNodeRef` / `setDropNodeRef` and dnd-kit's internal node registry; dnd-kit exposes `event.over.rect` in `DragOverEvent` and `event.active.rect.current.initial` for the source rect, neither of which requires a DOM query.
**Fix:** Prefer dnd-kit's event payload data:
```ts
const handleDragOver = useCallback((event: DragOverEvent) => {
  const { over, active, activatorEvent, delta } = event;
  if (!over || active.id === over.id) {
    useDragStore.getState().setOver(null, null);
    return;
  }
  // over.rect is a ClientRect captured by dnd-kit — no DOM query needed.
  const rect = over.rect as DOMRect;
  const startX = (activatorEvent as PointerEvent).clientX;
  const startY = (activatorEvent as PointerEvent).clientY;
  const pointer = { x: startX + delta.x, y: startY + delta.y };
  const zone = computeDropZone(rect, pointer);
  useDragStore.getState().setOver(String(over.id), zone);
}, []);
```
For `handleDragStart`, store the source element/canvas in a module-scoped WeakMap keyed by id, or register a Map in the draggable hook (`useCellDraggable` already has `setNodeRef`), and look up the canvas child without a document query.

## Info

### IN-01: `activatorEvent` cast to `PointerEvent` is unsafe in principle

**File:** `src/Grid/CanvasWrapper.tsx:97-98`
**Issue:** `(activatorEvent as PointerEvent).clientX` assumes the activator was a pointer event. With the current sensor configuration (two `PointerSensor` subclasses only), this always holds, but `activatorEvent` is typed `Event | null` in dnd-kit. If a future phase adds a `KeyboardSensor`, this cast becomes a runtime error (`undefined.clientX` on a `KeyboardEvent`). DND-01 currently forbids this, but the cast still deserves a defensive narrow.
**Fix:**
```ts
if (!(activatorEvent instanceof PointerEvent)) {
  useDragStore.getState().setOver(null, null);
  return;
}
const startX = activatorEvent.clientX;
const startY = activatorEvent.clientY;
```

### IN-02: `ResizeObserverEntry` array access without length check

**File:** `src/Grid/CanvasWrapper.tsx:147`
**Issue:** `const { height, width } = entries[0].contentRect;` assumes at least one entry. The ResizeObserver spec guarantees entries are non-empty for an observed element, so this is essentially fine; still, the adjacent entry in LeafNode.tsx (line 97) uses the defensive `entries[0]?.contentRect.height ?? h` form. Consistency is cheap here.
**Fix:** `const entry = entries[0]; if (!entry) return; const { height, width } = entry.contentRect;` or use the optional-chaining form.

### IN-03: `src/test/phase25-touch-dnd.test.tsx` listed for review but was intentionally deleted

**File:** `src/test/phase25-touch-dnd.test.tsx` (not present on disk)
**Issue:** The phase-28 review file list includes `phase25-touch-dnd.test.tsx`, but it was removed in commit `4b6d7ca` (D-21) as part of the Phase 25 → Phase 28 wiring replacement. No review could be performed. This is documentary only — the deletion itself is expected per Phase 28 plan 10a.
**Fix:** None required. Flagging so future re-reviews do not attempt to diff a file that no longer exists.

### IN-04: Divide-by-zero guard duplication — `canvasScale || 1` appears in 3 places with minor variations

**File:** `src/dnd/adapter/dndkit.ts:117`, `src/dnd/DropZoneIndicators.tsx:30` (missing), `src/Grid/Divider.tsx:75`
**Issue:** Three modules consume `canvasScale` and each handles the `0` case inconsistently: `scaleCompensationModifier` uses `|| 1`, `Divider` divides directly (line 75 — `pixelDelta / canvasScale / containerPixels`) with no guard, and `DropZoneIndicators` also lacks a guard (WR-02). A small helper in `editorStore` (e.g., `useCanvasScaleSafe()`) or a shared constant avoids the drift.
**Fix:** Consider exposing a selector like `useEditorStore((s) => s.canvasScale || 1)` wrapped into a named hook, and using it in all three sites.

### IN-05: `DragPreviewPortal.test.tsx` uses `vi.mock` to replace `DragOverlay` — divergence from production render path

**File:** `src/dnd/__tests__/DragPreviewPortal.test.tsx:40-48`
**Issue:** The test mocks `@dnd-kit/core.DragOverlay` with a pass-through div so it can assert `drag-ghost-img` rendering without simulating a real dnd-kit drag lifecycle. The rationale is documented in-file (Rule 1 bug fix). This correctly isolates `DragPreviewPortal`'s own branching, but it means the tests do not exercise the actual `DragOverlay` portal mounting or animation manager. The companion `CanvasWrapper.integration.test.tsx` documents this gap and covers structural mount evidence via `DndLiveRegion`. This is acceptable given the constraints but worth flagging so future maintainers know the isolation tests alone do not prove end-to-end ghost rendering under the real portal.
**Fix:** None required. If e2e coverage via Playwright becomes feasible, a real-drag ghost render assertion would close the coverage gap.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
