---
phase: 28-cell-to-cell-drag
plan: 10a
type: execute
wave: 5
depends_on:
  - 28-01
  - 28-02
  - 28-03
  - 28-04
  - 28-05
  - 28-06
  - 28-07
  - 28-08
  - 28-09
files_modified:
  - src/test/phase25-touch-dnd.test.tsx
  - src/test/phase05-p02-cell-swap.test.ts
  - src/test/phase09-p03-leafnode-zones.test.ts
  - src/Grid/__tests__/LeafNode.test.tsx
  - src/dnd/__tests__/useCellDraggable.test.tsx
  - src/dnd/__tests__/useCellDropTarget.test.tsx
autonomous: true
requirements:
  - DND-04
  - DRAG-01
  - DRAG-03
  - DRAG-04
  - DRAG-07
  - DROP-01
  - DROP-04
  - DROP-05
  - CROSS-01
must_haves:
  truths:
    - "src/test/phase25-touch-dnd.test.tsx is DELETED (no longer references obsolete MouseSensor/TouchSensor/useDndMonitor engine)"
    - "src/test/phase05-p02-cell-swap.test.ts retains the 'swapCells store action (D-13)' describe block and DELETES the 'ActionBar drag handle' describe block (DRAG-07 removed the handle)"
    - "src/test/phase09-p03-leafnode-zones.test.ts is REWRITTEN to drop useDndMonitor-based zone assertions and assert the DropZoneIndicators contract via data-testid=\"drop-zones\""
    - "src/Grid/__tests__/LeafNode.test.tsx still passes — mounts LeafNode inside a DndContext so useCellDraggable/useCellDropTarget resolve without error; no useDndMonitor mocking"
    - "src/dnd/__tests__/useCellDraggable.test.tsx asserts the useCellDraggable hook contract AND the PointerSensorMouse / PointerSensorTouch class-level config (no fake-timer pointer simulation per Pitfall 11)"
    - "src/dnd/__tests__/useCellDropTarget.test.tsx asserts overId / activeZone propagation through useDragStore via the REAL setOver(overId, zone) action and the REAL end() action — NOT any fictional 'updateOver' or 'endDrag' or 'cancelDrag' actions"
    - "Unit test suite for Plan 10a passes: npm run test -- --run on each of the 6 files above exits 0"
  artifacts:
    - path: "src/test/phase05-p02-cell-swap.test.ts"
      provides: "swapCells store action regression coverage; drag-handle test block removed"
      contains: "describe('swapCells store action"
      contains_not: "drag-handle-leaf-1"
    - path: "src/test/phase09-p03-leafnode-zones.test.ts"
      provides: "DropZoneIndicators visual contract + file-drop coexistence regression"
      contains: "drop-zones"
      contains_not: "useDndMonitor"
    - path: "src/Grid/__tests__/LeafNode.test.tsx"
      provides: "CELL-01/CELL-03 regression tests; updated wrapper comment"
      contains_not: "useDndMonitor"
    - path: "src/dnd/__tests__/useCellDraggable.test.tsx"
      provides: "Unit coverage for useCellDraggable — hook contract + sensor class config"
      contains: "useCellDraggable"
    - path: "src/dnd/__tests__/useCellDropTarget.test.tsx"
      provides: "Unit coverage for useCellDropTarget — isOver + dragStore setOver/end transitions"
      contains: "useCellDropTarget"
      contains_also: "setOver"
  key_links:
    - from: "src/dnd/__tests__/useCellDropTarget.test.tsx"
      to: "src/dnd/dragStore.ts"
      via: "direct calls to useDragStore.getState().setOver(...) and .end() — NOT fictional updateOver/endDrag/cancelDrag"
      pattern: "setOver\\("
---

<objective>
Plan 10a (Wave 5, sibling of 10b in Wave 6): unit-level test reconciliation with the new engine.

1. DELETE `src/test/phase25-touch-dnd.test.tsx` wholesale (hard-codes Phase 25 engine).
2. TRIM `src/test/phase05-p02-cell-swap.test.ts` to keep only the `swapCells store action` describe block; drop the `ActionBar drag handle` block (DRAG-07 removed the handle button).
3. REWRITE `src/test/phase09-p03-leafnode-zones.test.ts` to assert the new `DropZoneIndicators` contract via `data-testid="drop-zones"`; drop `edge-line-*` / `swap-overlay-*` / `useDndMonitor` references.
4. UPDATE `src/Grid/__tests__/LeafNode.test.tsx` with surgical comment edits (Phase 25 → Phase 28); test logic unchanged.
5. CREATE `src/dnd/__tests__/useCellDraggable.test.tsx` — hook contract + sensor class-level config.
6. CREATE `src/dnd/__tests__/useCellDropTarget.test.tsx` — hook contract + dragStore setOver/end transitions.

Purpose:
- Make unit-level test coverage green after Phase 28's engine swap.
- Provide regression coverage for DND-04 (single engine), DRAG-01/DRAG-07 (any cell, no handle), DRAG-03/DRAG-04 (sensor config), DROP-01/DROP-04/DROP-05 (drop-zone rendering), CROSS-01 (mouse+touch parity).
- Phase 10b (Wave 6) adds CanvasWrapper integration + SC-3 grep gate + barrel export verification on top of this unit layer.

Output: 1 deletion, 3 rewrites, 2 new test files. All 6 files pass on individual `npm run test -- --run <file>` invocations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md
@.planning/phases/28-cell-to-cell-drag/28-PATTERNS.md
@.planning/phases/27-dnd-foundation/27-VERIFICATION.md
@.planning/phases/27-dnd-foundation/deferred-items.md

@src/dnd/index.ts
@src/dnd/dragStore.ts
@src/dnd/dragStore.test.ts
@src/dnd/computeDropZone.ts
@src/dnd/computeDropZone.test.ts
@src/test/phase05-p02-cell-swap.test.ts
@src/test/phase09-p03-leafnode-zones.test.ts
@src/Grid/__tests__/LeafNode.test.tsx
@src/test/setup.ts

<interfaces>
<!-- AUTHORITATIVE dragStore contract after Phase 28 Plans 01 applied. Read src/dnd/dragStore.ts BEFORE writing any test assertions. -->

```typescript
// src/dnd/index.ts (barrel) — after Phases 27 + 28
export { useDragStore } from './dragStore';
export type { DragKind, DropZone, DragStatus, DragState } from './dragStore';
export { computeDropZone } from './computeDropZone';
export { useCellDraggable } from './useCellDraggable';
export { useCellDropTarget } from './useCellDropTarget';
export { DragPreviewPortal } from './DragPreviewPortal';
export { DropZoneIndicators } from './DropZoneIndicators';
export { PointerSensorMouse, PointerSensorTouch, scaleCompensationModifier } from './adapter/dndkit';
```

```typescript
// src/dnd/dragStore.ts — AUTHORITATIVE contract (Phase 27 base + Phase 28 Plan 01 additions)
export type DragKind = 'cell' | null;
export type DropZone = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type DragStatus = 'idle' | 'dragging';

export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  overId: string | null;
  activeZone: DropZone | null;
  ghostDataUrl: string | null;                            // added by Plan 01
  sourceRect: { width: number; height: number; left: number; top: number } | null;  // added by Plan 01
  beginCellDrag: (sourceId: string) => void;              // status->'dragging', kind='cell', sourceId set, overId+activeZone reset to null
  setOver: (overId: string | null, zone: DropZone | null) => void;  // overId+activeZone updated; idempotent
  setGhost: (ghostDataUrl: string | null, sourceRect: DragState['sourceRect']) => void;  // added by Plan 01
  end: () => void;                                        // all fields reset to initial; safe from any status
};
```

**CRITICAL — actions that DO NOT EXIST in the real store (do not reference these in tests):**
- `updateOver` — does not exist. The real action is `setOver(overId, zone)`.
- `endDrag` — does not exist. The real action is `end()`.
- `cancelDrag` — does not exist. There is ONE reset action: `end()`. Both dnd-kit's `onDragEnd` AND `onDragCancel` handlers call `useDragStore.getState().end()` (see Plan 07 handlers). Cancel coverage is proven by asserting that both handlers invoke `end()` — not by looking for a separate `cancelDrag` action.

```typescript
// useCellDraggable signature (after Plan 03)
export function useCellDraggable(id: string): {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;     // never undefined — always a spreadable object
  isDragging: boolean;
  setNodeRef: (el: HTMLElement | null) => void;
};
```

```typescript
// useCellDropTarget signature (after Plan 04)
export function useCellDropTarget(id: string): {
  setNodeRef: (el: HTMLElement | null) => void;
  isOver: boolean;                         // true when dnd-kit collision detection marks this node
};
```

```typescript
// DropZoneIndicators contract (after Plan 06)
// Renders a <div data-testid="drop-zones"> with 5 absolute-positioned lucide icons.
// Only renders when zone !== null AND overId === this cell's id (rendered by LeafNode).
interface Props { zone: DropZone | null; scale: number; }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete phase25-touch-dnd.test.tsx wholesale (D-21)</name>
  <files>src/test/phase25-touch-dnd.test.tsx</files>

  <read_first>
    - `src/test/phase25-touch-dnd.test.tsx` (scan first 100 lines to confirm it mocks Phase 25 MouseSensor/TouchSensor/KeyboardSensor + useDndMonitor)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-21 (this file must be DELETED; its behaviors are covered by new Phase 28 tests)
    - `.planning/phases/27-dnd-foundation/deferred-items.md` (confirm this test is NOT in the "deferred but re-enable later" list — it is NOT; it is obsolete)
  </read_first>

  <action>
    DELETE the file entirely:
    ```bash
    rm src/test/phase25-touch-dnd.test.tsx
    ```

    Rationale per D-21:
    - The test file hard-codes Phase 25's `MouseSensor`, `TouchSensor`, `KeyboardSensor` imports and mocks `useDndMonitor`.
    - Phase 28 replaces all three sensors with custom `PointerSensorMouse`/`PointerSensorTouch` subclasses that do NOT share the same API surface.
    - Behaviors covered by this file (cell-to-cell swap via drag, zone selection, DRAG-04 touch delay) are re-covered in Tasks 5-6 of this plan and the CanvasWrapper integration test in Plan 10b.
    - Attempting to rewrite in place is a trap: the mocks reference deleted symbols and the harness doesn't translate.

    DO NOT:
    - Leave a stub file with `describe.skip(...)`. Deletion is clean.
    - Move to a `deferred/` folder — it's obsolete, not deferred.
    - Copy-paste individual tests into another file.
  </action>

  <verify>
    <automated>test ! -f src/test/phase25-touch-dnd.test.tsx && echo "File deleted"</automated>
    - `test ! -f src/test/phase25-touch-dnd.test.tsx` exits 0
    - `grep -rE 'phase25-touch-dnd' src/` returns no matches
  </verify>

  <acceptance_criteria>
    - `src/test/phase25-touch-dnd.test.tsx` no longer exists on disk
    - No other file imports from it (grep returns zero)
  </acceptance_criteria>

  <done>Phase 25 touch DnD test file is deleted. Coverage moves to Tasks 5-6 (this plan) and Plan 10b Task 1 (CanvasWrapper integration).</done>
</task>

<task type="auto">
  <name>Task 2: Trim phase05-p02-cell-swap.test.ts — delete ActionBar drag-handle describe block, keep swapCells store tests (D-21)</name>
  <files>src/test/phase05-p02-cell-swap.test.ts</files>

  <read_first>
    - `src/test/phase05-p02-cell-swap.test.ts` full file (~205 lines)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-21 (DRAG-07 removes the `drag-handle-leaf-{id}` button — tests asserting it must be deleted)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A3 DRAG-07 (entire cell is the draggable, no dedicated handle button)
    - `src/Grid/ActionBar.tsx` (after Plan 08 — GripVertical button removed; confirm by grep `data-testid="drag-handle-`)
  </read_first>

  <action>
    Edit `src/test/phase05-p02-cell-swap.test.ts`:

    1. **KEEP** lines 1-145 EXACTLY AS-IS — the header comment, all imports, helpers, `beforeEach`, and the `describe('swapCells store action (D-13)', () => {...})` block.
       - These tests exercise the gridStore.swapCells action which is still used by Plan 08 LeafNode + Plan 07 CanvasWrapper's onDragEnd for center-zone drops.
       - The `swap is undoable via undo()` test regression-covers undo history after moveCell('center', ...).

    2. **DELETE** lines ~147-204 — the full `describe('ActionBar drag handle (D-13, D-14)', () => {...})` block.
       - DRAG-07: Phase 28 removes the dedicated drag-handle button. The ENTIRE cell is the draggable via `useCellDraggable` listeners on LeafNode's outer div.
       - After Plan 08, `ActionBar.tsx` no longer renders a `data-testid="drag-handle-{id}"` button.

    3. **UPDATE** the top-of-file header comment (lines 1-12) to reflect the new scope:
       ```typescript
       /**
        * phase05-p02-cell-swap.test.ts
        * Tests for the gridStore.swapCells action (D-13).
        *
        * Coverage:
        * - swapCells store action swaps media content between two leaves
        * - swapCells pushes to undo history (historyIndex increments)
        * - swap is undoable via undo()
        *
        * Phase 28 note: ActionBar drag-handle tests DELETED — DRAG-07 removed the
        * GripVertical button; the entire cell is now the draggable via
        * useCellDraggable in LeafNode.
        */
       ```

    4. **REMOVE** the now-unused imports:
       - `import { render, screen } from '@testing-library/react';` — DELETE
       - `import React from 'react';` — DELETE
       - `import { ActionBar } from '../Grid/ActionBar';` — DELETE
       - Reduce vitest import to: `import { describe, it, expect, beforeEach } from 'vitest';` (drop `vi` if it is only used in the deleted block).

    Final file should be ~145 lines (~60 lines deleted).

    DO NOT:
    - Delete the `describe('swapCells store action (D-13)')` block.
    - Rename test IDs or modify helper functions.
    - Touch `src/Grid/ActionBar.tsx` (Plan 08's responsibility).
  </action>

  <verify>
    <automated>grep -c "drag-handle-leaf-1" src/test/phase05-p02-cell-swap.test.ts</automated>
    - `grep -c "drag-handle-leaf-1" src/test/phase05-p02-cell-swap.test.ts` returns 0
    - `grep -q "describe('swapCells store action" src/test/phase05-p02-cell-swap.test.ts` succeeds
    - `grep -q "describe('ActionBar drag handle" src/test/phase05-p02-cell-swap.test.ts` returns no match
    - `npm run test -- --run src/test/phase05-p02-cell-swap.test.ts` — swapCells block tests pass
    - `npx tsc --noEmit` — no unused import errors
  </verify>

  <acceptance_criteria>
    - File is ~145 lines; `describe('ActionBar drag handle')` block fully removed
    - `describe('swapCells store action (D-13)')` block remains intact and passes
    - No dead imports (`render`, `screen`, `React`, `ActionBar`) remain
    - `grep -c "drag-handle-leaf-1" src/test/phase05-p02-cell-swap.test.ts` returns 0
    - `npm run test -- --run src/test/phase05-p02-cell-swap.test.ts` passes
  </acceptance_criteria>

  <done>Cell-swap test file retains store-level regression coverage; Phase 25 handle-button tests are gone; imports clean.</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite phase09-p03-leafnode-zones.test.ts — drop useDndMonitor mocks, assert DropZoneIndicators contract (D-22)</name>
  <files>src/test/phase09-p03-leafnode-zones.test.ts</files>

  <read_first>
    - `src/test/phase09-p03-leafnode-zones.test.ts` full file (~242 lines — currently asserts `edge-line-top-{id}` / `edge-line-bottom-{id}` / `swap-overlay-{id}` testids which are DELETED in Plan 08)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-22 (test rewrites must assert new DropZoneIndicators `data-testid="drop-zones"` container; no useDndMonitor mocks)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A3 DROP-01 (5-zone indicators), DROP-05 (visual feedback contract)
    - `src/dnd/DropZoneIndicators.tsx` (after Plan 06 — confirm testid=`drop-zones` on root)
    - `src/Grid/LeafNode.tsx` (after Plan 08 — confirm file-drop triad `handleFileDragOver/Leave/Drop` still present)
    - `src/dnd/dragStore.ts` (AUTHORITATIVE — confirm the store has `setOver`, `end`, and that direct `useDragStore.setState({...})` is the clean testing pattern)
  </read_first>

  <action>
    REWRITE `src/test/phase09-p03-leafnode-zones.test.ts` with THREE describe blocks:

    **Block A: "LeafNode file drop coexistence (EC-12)"** — KEEP ZONE-10/10b/10c/12. These tests fire native `dragOver` with `dataTransfer.types=["Files"]` and assert `drop-target-{id}` ring appears / `drop-zones` does NOT appear. The file-drop triad is preserved in Plan 08 (D-28).

    **Block B: "LeafNode drop-zone indicators (DROP-01, DROP-05)"** — NEW (replaces the old "5-zone overlay JSX" block).
    - ZONE-01: initially, `data-testid="drop-zones"` is NOT in DOM (status='idle').
    - ZONE-02: when `useDragStore` is set into `status='dragging', overId=LEAF_ID, activeZone='center'`, the `<DropZoneIndicators>` inside LeafNode renders AND contains `data-testid="drop-zones"`.
    - ZONE-03: when `overId !== LEAF_ID`, `data-testid="drop-zones"` is NOT rendered inside this leaf.

    **Block C: "gridStore.moveCell routing (D-04, DROP-07)"** — KEEP ZONE-08, ZONE-09, ZONE-11.

    **Deletions from the old file:**
    - DELETE the "LeafNode 5-zone overlay JSX (D-01 visual contract)" block; MOVE ZONE-12 (ring class check) into Block A.
    - DELETE all `edge-line-top-{id}` / `edge-line-bottom-{id}` / `edge-line-left-{id}` / `edge-line-right-{id}` / `swap-overlay-{id}` references.
    - DELETE any reference to `useDndMonitor`.

    **IMPORTANT — use the REAL dragStore actions in tests:**
    - Use `useDragStore.setState({ status, sourceId, overId, activeZone, ghostDataUrl, sourceRect })` to seed state directly (vanilla zustand).
    - When asserting the `setOver` action, call `useDragStore.getState().setOver(overId, zone)` — NOT `updateOver` (which does not exist).
    - When asserting the end action, call `useDragStore.getState().end()` — NOT `endDrag` / `cancelDrag` (which do not exist).

    **Concrete new file content (full rewrite):**
    ```typescript
    /**
     * phase09-p03-leafnode-zones.test.ts
     *
     * Tests for LeafNode drop-zone overlay rendering and file-drop coexistence.
     * Covers DROP-01, DROP-05, DROP-07, EC-12 from phase 28 CONTEXT.
     *
     * Phase 28 migration note:
     *   5-zone overlays are now rendered by <DropZoneIndicators> (src/dnd/DropZoneIndicators.tsx),
     *   not by inline JSX in LeafNode.
     */
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
    import { render, screen, fireEvent, createEvent, cleanup } from '@testing-library/react';
    import React from 'react';
    import { DndContext } from '@dnd-kit/core';
    import { LeafNodeComponent } from '../Grid/LeafNode';
    import { useGridStore } from '../store/gridStore';
    import { useEditorStore } from '../store/editorStore';
    import { useDragStore } from '../dnd';
    import type { LeafNode, GridNode } from '../types';

    const LEAF_ID = 'leaf-target';

    function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
      return {
        type: 'leaf',
        id: LEAF_ID,
        mediaId: null,
        fit: 'cover',
        objectPosition: 'center center',
        backgroundColor: null,
        panX: 0, panY: 0, panScale: 1,
        audioEnabled: true,
        ...overrides,
      };
    }

    function setGridState(root: GridNode, registry: Record<string, string> = {}) {
      useGridStore.setState({ root, mediaRegistry: registry, history: [{ root }], historyIndex: 0 });
    }

    function makeDataTransfer(types: string[]) {
      return {
        types,
        getData: () => '',
        setData: () => {},
        files: [] as unknown as FileList,
        items: [] as unknown as DataTransferItemList,
        dropEffect: 'none',
        effectAllowed: 'all',
      };
    }

    function mockRect(width: number, height: number) {
      const rect = { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    }

    function fireDragEventWithCoords(
      kind: 'dragOver' | 'drop',
      el: Element,
      clientX: number,
      clientY: number,
      dt: ReturnType<typeof makeDataTransfer>,
    ) {
      const event = createEvent[kind](el, { dataTransfer: dt as unknown as DataTransfer });
      Object.defineProperty(event, 'clientX', { value: clientX });
      Object.defineProperty(event, 'clientY', { value: clientY });
      fireEvent(el, event);
    }

    beforeEach(() => {
      useGridStore.setState(useGridStore.getInitialState(), true);
      useEditorStore.setState({ selectedNodeId: null, panModeNodeId: null });
      // Reset dragStore to idle between tests using the REAL initial shape.
      useDragStore.setState({
        status: 'idle',
        kind: null,
        sourceId: null,
        overId: null,
        activeZone: null,
        ghostDataUrl: null,
        sourceRect: null,
      });
      mockRect(400, 400);
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    function renderTargetLeaf() {
      const leaf = makeLeaf({ id: LEAF_ID });
      setGridState(leaf);
      return render(
        React.createElement(DndContext, {}, React.createElement(LeafNodeComponent, { id: LEAF_ID }))
      );
    }

    describe('LeafNode file drop coexistence (EC-12)', () => {
      it('ZONE-10: file drag (dataTransfer.types=["Files"]) does NOT render drop-zones indicators', () => {
        renderTargetLeaf();
        const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
        fireDragEventWithCoords('dragOver', leafEl, 200, 10, makeDataTransfer(['Files']));
        expect(screen.queryByTestId('drop-zones')).toBeNull();
        expect(screen.getByTestId(`drop-target-${LEAF_ID}`)).toBeInTheDocument();
      });

      it('ZONE-10b: file drag-leave clears the drop-target ring', () => {
        renderTargetLeaf();
        const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
        fireDragEventWithCoords('dragOver', leafEl, 200, 10, makeDataTransfer(['Files']));
        expect(screen.getByTestId(`drop-target-${LEAF_ID}`)).toBeInTheDocument();
        fireEvent.dragLeave(leafEl);
        expect(screen.queryByTestId(`drop-target-${LEAF_ID}`)).toBeNull();
      });

      it('ZONE-10c: non-file dragOver (empty types) does NOT show drop-target ring', () => {
        renderTargetLeaf();
        const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
        fireDragEventWithCoords('dragOver', leafEl, 200, 200, makeDataTransfer([]));
        expect(screen.queryByTestId(`drop-target-${LEAF_ID}`)).toBeNull();
      });

      it('ZONE-12: file-drop ring uses ring-2 ring-[#3b82f6] ring-inset classes', () => {
        renderTargetLeaf();
        const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
        fireDragEventWithCoords('dragOver', leafEl, 200, 10, makeDataTransfer(['Files']));
        const ring = screen.getByTestId(`drop-target-${LEAF_ID}`);
        expect(ring.className).toContain('ring-2');
        expect(ring.className).toContain('ring-[#3b82f6]');
        expect(ring.className).toContain('ring-inset');
      });
    });

    describe('LeafNode drop-zone indicators (DROP-01, DROP-05)', () => {
      it('ZONE-01: idle state — drop-zones testid NOT in DOM', () => {
        renderTargetLeaf();
        expect(screen.queryByTestId('drop-zones')).toBeNull();
      });

      it('ZONE-02: when dragStore has overId=LEAF_ID and activeZone="center", drop-zones IS rendered', () => {
        const rerender = renderTargetLeaf();
        // Seed dragStore into the state that Plan 07's onDragOver would have produced:
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'other-leaf',
          overId: LEAF_ID,
          activeZone: 'center',
          ghostDataUrl: null,
          sourceRect: null,
        });
        rerender.rerender(
          React.createElement(DndContext, {}, React.createElement(LeafNodeComponent, { id: LEAF_ID }))
        );
        expect(screen.queryByTestId('drop-zones')).toBeInTheDocument();
      });

      it('ZONE-03: when overId !== LEAF_ID, drop-zones NOT rendered inside this leaf', () => {
        const rerender = renderTargetLeaf();
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'other-leaf',
          overId: 'different-leaf',
          activeZone: 'top',
          ghostDataUrl: null,
          sourceRect: null,
        });
        rerender.rerender(
          React.createElement(DndContext, {}, React.createElement(LeafNodeComponent, { id: LEAF_ID }))
        );
        expect(screen.queryByTestId('drop-zones')).toBeNull();
      });
    });

    describe('gridStore.moveCell routing (D-04, DROP-07)', () => {
      it('ZONE-08: moveCell store action exists', () => {
        expect(typeof useGridStore.getState().moveCell).toBe('function');
      });

      it('ZONE-09: moveCell with "center" swaps mediaIds', () => {
        const leaf1 = makeLeaf({ id: 'leaf-1', mediaId: 'mid-1' });
        const leaf2: LeafNode = { ...makeLeaf(), id: 'leaf-2', mediaId: 'mid-2' };
        const root: GridNode = { type: 'container', id: 'root', direction: 'horizontal', sizes: [0.5, 0.5], children: [leaf1, leaf2] };
        useGridStore.setState({
          root,
          mediaRegistry: { 'mid-1': 'url1', 'mid-2': 'url2' },
          history: [{ root }],
          historyIndex: 0,
        });
        useGridStore.getState().moveCell('leaf-1', 'leaf-2', 'center');
        const children = (useGridStore.getState().root as { children: LeafNode[] }).children;
        expect(children[0].mediaId).toBe('mid-2');
        expect(children[1].mediaId).toBe('mid-1');
      });

      it('ZONE-11: moveCell with same fromId/toId has no visible effect (guard lives upstream)', () => {
        const leaf = makeLeaf({ id: LEAF_ID });
        setGridState(leaf);
        const before = useGridStore.getState().root;
        const after = useGridStore.getState().root;
        expect(before).toBe(after);
      });
    });
    ```

    Notes on the rewrite:
    - `useDndMonitor` is GONE. After Plan 08, zone dispatch lives in CanvasWrapper's onDragOver, not in LeafNode via useDndMonitor.
    - Direct `useDragStore.setState({...})` is the clean testing pattern for vanilla zustand; the full shape (including `kind`, `ghostDataUrl`, `sourceRect`) is restored each time.
    - `rerender` forces React to re-pick-up the store subscription deterministically in jsdom.

    DO NOT:
    - Use `vi.mock('@dnd-kit/core')` — we want real dnd-kit.
    - Mock `useDragStore` — call `setState` directly.
    - Re-introduce `edge-line-top-{id}` assertions.
    - Reference `updateOver`, `endDrag`, or `cancelDrag` — they do not exist. The real actions are `setOver(overId, zone)` and `end()`.
  </action>

  <verify>
    <automated>npm run test -- --run src/test/phase09-p03-leafnode-zones.test.ts</automated>
    - `grep -c "useDndMonitor" src/test/phase09-p03-leafnode-zones.test.ts` returns 0
    - `grep -c "edge-line-top-" src/test/phase09-p03-leafnode-zones.test.ts` returns 0
    - `grep -c "swap-overlay-" src/test/phase09-p03-leafnode-zones.test.ts` returns 0
    - `grep -c "updateOver\|endDrag\|cancelDrag" src/test/phase09-p03-leafnode-zones.test.ts` returns 0 (only real actions referenced)
    - `grep -q "'drop-zones'" src/test/phase09-p03-leafnode-zones.test.ts` succeeds
    - `npm run test -- --run src/test/phase09-p03-leafnode-zones.test.ts` — all tests pass
    - `npx tsc --noEmit` — clean
  </verify>

  <acceptance_criteria>
    - File contains 3 describe blocks: file drop coexistence, drop-zone indicators, gridStore.moveCell routing
    - Zero references to `useDndMonitor`, `edge-line-*`, `swap-overlay-*`, `updateOver`, `endDrag`, `cancelDrag`
    - `useDragStore` imported from `'../dnd'`
    - All tests pass
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>phase09-p03 test file tests the new DropZoneIndicators contract + preserves file-drop coexistence regression coverage.</done>
</task>

<task type="auto">
  <name>Task 4: Update Grid/__tests__/LeafNode.test.tsx — remove Phase 25 useDndMonitor comment (D-22)</name>
  <files>src/Grid/__tests__/LeafNode.test.tsx</files>

  <read_first>
    - `src/Grid/__tests__/LeafNode.test.tsx` full file (~221 lines — CELL-01, CELL-03 tests)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-22 (keep core behavior tests intact; drop Phase 25 comments)
  </read_first>

  <action>
    SURGICAL comment updates only. Test logic is unchanged.

    **Edit A — Phase 25 comment above `withDnd` helper:**
    ```typescript
    // BEFORE
    // Phase 25: LeafNodeComponent uses useDndMonitor which requires DndContext ancestor.
    function withDnd(ui: React.ReactElement) {
      return <DndContext>{ui}</DndContext>;
    }

    // AFTER
    // Phase 28: LeafNodeComponent uses useCellDraggable + useCellDropTarget from
    // the new dnd engine. These hooks wrap useDraggable/useDroppable, which require
    // a DndContext ancestor. The DndContext here has no sensors configured, so no
    // pointer activation happens — only the hook registration side-effects are exercised.
    function withDnd(ui: React.ReactElement) {
      return <DndContext>{ui}</DndContext>;
    }
    ```

    **Edit B — Phase 25 comment inside `MockResizeObserver.disconnect`:**
    ```typescript
    // BEFORE
      disconnect() {
        // Phase 25: do NOT clear roCallback on disconnect — DndContext may cause
        // additional useLayoutEffect cleanup/re-run cycles. Keep roCallback pointing
        // to the latest registered callback so tests can still fire it after remounts.
      }

    // AFTER
      disconnect() {
        // Keep roCallback pointing to the latest registered callback. The DndContext
        // wrapper (used by the new Phase 28 dnd hooks) can trigger useLayoutEffect
        // cleanup/re-run cycles during test renders; clearing here would break
        // tests that fire the callback after a remount.
      }
    ```

    **Edit C — DO NOT modify anything else.**

    DO NOT:
    - Delete or add tests — CELL-01/CELL-03 behaviors are unrelated to drag.
    - Convert the `withDnd` wrapper — DndContext ancestor is mandatory now.
  </action>

  <verify>
    <automated>grep -c "useDndMonitor\|Phase 25" src/Grid/__tests__/LeafNode.test.tsx</automated>
    - Returns 0 after edits
    - `grep -q "Phase 28" src/Grid/__tests__/LeafNode.test.tsx` succeeds
    - `grep -q "withDnd" src/Grid/__tests__/LeafNode.test.tsx` succeeds
    - `npm run test -- --run src/Grid/__tests__/LeafNode.test.tsx` — all tests pass
    - `npx tsc --noEmit` — clean
  </verify>

  <acceptance_criteria>
    - Zero references to `useDndMonitor` or `Phase 25`
    - `Phase 28` appears at least once
    - `withDnd` helper unchanged
    - Tests pass
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>LeafNode.test.tsx comments reflect Phase 28 engine; behavior tests unchanged; green.</done>
</task>

<task type="auto">
  <name>Task 5: Create src/dnd/__tests__/useCellDraggable.test.tsx — hook contract + sensor class config (D-30, D-31)</name>
  <files>src/dnd/__tests__/useCellDraggable.test.tsx</files>

  <read_first>
    - `src/dnd/useCellDraggable.ts` (after Plan 03)
    - `src/dnd/adapter/dndkit.ts` (after Plan 02 — PointerSensorMouse + PointerSensorTouch classes with static `activators`)
    - `src/dnd/dragStore.ts` — AUTHORITATIVE contract (real actions: `beginCellDrag`, `setOver`, `setGhost`, `end`; NO `updateOver`/`endDrag`/`cancelDrag`)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A7 D-30 (new tests), D-31 (sensor config ASSERTIONS only — NO fake-timer pointer-sequence; jsdom timer lifecycle is unreliable)
    - `.planning/research/PITFALLS.md` Pitfall 11 (fake timers + DnD Kit = flaky; assert sensor config, not activation timing)
  </read_first>

  <action>
    Create `src/dnd/__tests__/useCellDraggable.test.tsx`.

    **Full file content:**
    ```typescript
    /**
     * src/dnd/__tests__/useCellDraggable.test.tsx
     *
     * Unit tests for the useCellDraggable hook (Phase 28 Plan 03).
     * Covers: DRAG-01 (any cell draggable), DRAG-07 (entire cell is handle),
     *         GHOST-01 (hook returns listeners for the leaf element to spread).
     *
     * Sensor config assertions (D-31) cover DRAG-03 (mouse distance:8),
     * DRAG-04 (touch delay:250, tolerance:5), CROSS-01 (mouse/touch parity).
     *
     * Note per Pitfall 11: we do NOT simulate pointermove sequences with fake timers.
     * The REAL contract is (a) the hook's return shape, (b) the sensor classes' existence
     * and distinctness. Activation timing is verified at the source-code level (grep on
     * CanvasWrapper.tsx asserts `activationConstraint: { distance: 8 }` etc. — see Plan 07).
     */
    import { describe, it, expect, beforeEach } from 'vitest';
    import { render, renderHook } from '@testing-library/react';
    import React from 'react';
    import { DndContext } from '@dnd-kit/core';
    import { useCellDraggable } from '../useCellDraggable';
    import { PointerSensorMouse, PointerSensorTouch } from '../adapter/dndkit';
    import { useDragStore } from '../dragStore';

    beforeEach(() => {
      // Reset dragStore to the REAL initial shape (all fields, including kind).
      useDragStore.setState({
        status: 'idle',
        kind: null,
        sourceId: null,
        overId: null,
        activeZone: null,
        ghostDataUrl: null,
        sourceRect: null,
      });
    });

    function wrapper({ children }: { children: React.ReactNode }) {
      return <DndContext>{children}</DndContext>;
    }

    describe('useCellDraggable hook contract (DRAG-01, DRAG-07)', () => {
      it('returns { attributes, listeners, isDragging, setNodeRef }', () => {
        const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
        expect(result.current).toHaveProperty('attributes');
        expect(result.current).toHaveProperty('listeners');
        expect(result.current).toHaveProperty('isDragging');
        expect(result.current).toHaveProperty('setNodeRef');
      });

      it('listeners is always a spreadable object (never undefined)', () => {
        const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
        expect(result.current.listeners).toBeTypeOf('object');
        expect(result.current.listeners).not.toBeNull();
      });

      it('isDragging is false on mount (no drag started)', () => {
        const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
        expect(result.current.isDragging).toBe(false);
      });

      it('setNodeRef is a callable ref setter', () => {
        const { result } = renderHook(() => useCellDraggable('leaf-1'), { wrapper });
        expect(typeof result.current.setNodeRef).toBe('function');
      });
    });

    describe('PointerSensorMouse config (DRAG-03)', () => {
      it('is a class (constructable sensor)', () => {
        expect(typeof PointerSensorMouse).toBe('function');
      });

      it('exposes activators array with at least one entry', () => {
        const activators = (PointerSensorMouse as unknown as { activators: unknown[] }).activators;
        expect(Array.isArray(activators)).toBe(true);
        expect(activators.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('PointerSensorTouch config (DRAG-04)', () => {
      it('is a class (constructable sensor)', () => {
        expect(typeof PointerSensorTouch).toBe('function');
      });

      it('exposes activators array with at least one entry', () => {
        const activators = (PointerSensorTouch as unknown as { activators: unknown[] }).activators;
        expect(Array.isArray(activators)).toBe(true);
        expect(activators.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Mouse + Touch sensor parity (CROSS-01)', () => {
      it('both sensors are distinct classes (two activation paths, same downstream store)', () => {
        expect(PointerSensorMouse).not.toBe(PointerSensorTouch);
      });
    });

    describe('hook integration with DndContext', () => {
      it('mounts without error inside DndContext', () => {
        function Harness() {
          const { setNodeRef, listeners, attributes } = useCellDraggable('leaf-1');
          return (
            <div ref={setNodeRef} {...attributes} {...listeners} data-testid="harness">
              drag me
            </div>
          );
        }
        const { container } = render(<DndContext><Harness /></DndContext>);
        expect(container.querySelector('[data-testid="harness"]')).toBeTruthy();
      });

      it('does not throw when id is empty string (dnd-kit treats any string as a valid id)', () => {
        function Harness() {
          const { setNodeRef } = useCellDraggable('');
          return <div ref={setNodeRef} data-testid="empty-id-harness">empty</div>;
        }
        const { container } = render(<DndContext><Harness /></DndContext>);
        expect(container.querySelector('[data-testid="empty-id-harness"]')).toBeTruthy();
      });
    });
    ```

    Directory setup (if not already present):
    ```bash
    mkdir -p src/dnd/__tests__
    ```

    DO NOT:
    - Use `vi.useFakeTimers()` (Pitfall 11).
    - Mock `@dnd-kit/core`.
    - Simulate full drag start via dispatchEvent pointer sequences.
    - Reference `updateOver` / `endDrag` / `cancelDrag` anywhere.
  </action>

  <verify>
    <automated>npm run test -- --run src/dnd/__tests__/useCellDraggable.test.tsx</automated>
    - `test -f src/dnd/__tests__/useCellDraggable.test.tsx` — file exists
    - All tests pass
    - `npx tsc --noEmit` — clean
    - `grep -c "useFakeTimers" src/dnd/__tests__/useCellDraggable.test.tsx` returns 0
    - `grep -c "updateOver\|endDrag\|cancelDrag" src/dnd/__tests__/useCellDraggable.test.tsx` returns 0
  </verify>

  <acceptance_criteria>
    - File exists at exact path
    - Contains ≥5 describe blocks covering hook contract + sensor config
    - Zero references to `useFakeTimers`, `updateOver`, `endDrag`, `cancelDrag`
    - All tests pass
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>useCellDraggable has dedicated unit tests; sensor config contract is asserted without flaky timer simulation.</done>
</task>

<task type="auto">
  <name>Task 6: Create src/dnd/__tests__/useCellDropTarget.test.tsx — hook contract + REAL dragStore setOver/end transitions (D-30)</name>
  <files>src/dnd/__tests__/useCellDropTarget.test.tsx</files>

  <read_first>
    - `src/dnd/useCellDropTarget.ts` (after Plan 04)
    - `src/dnd/dragStore.ts` — AUTHORITATIVE contract (actions: `beginCellDrag`, `setOver`, `setGhost`, `end`; NO `updateOver`/`endDrag`/`cancelDrag`)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A7 D-30
  </read_first>

  <action>
    Create `src/dnd/__tests__/useCellDropTarget.test.tsx`.

    **Full file content:**
    ```typescript
    /**
     * src/dnd/__tests__/useCellDropTarget.test.tsx
     *
     * Unit tests for the useCellDropTarget hook (Phase 28 Plan 04).
     * Covers: DROP-01 (cell can be a drop target), DROP-04 (isOver reflects active hover),
     *         DROP-07 (hook does NOT directly mutate dragStore — CanvasWrapper.onDragOver
     *         owns setOver; hook is a thin useDroppable wrapper).
     */
    import { describe, it, expect, beforeEach } from 'vitest';
    import { render, renderHook } from '@testing-library/react';
    import React from 'react';
    import { DndContext } from '@dnd-kit/core';
    import { useCellDropTarget } from '../useCellDropTarget';
    import { useDragStore } from '../dragStore';

    beforeEach(() => {
      // Reset dragStore to the REAL initial shape.
      useDragStore.setState({
        status: 'idle',
        kind: null,
        sourceId: null,
        overId: null,
        activeZone: null,
        ghostDataUrl: null,
        sourceRect: null,
      });
    });

    function wrapper({ children }: { children: React.ReactNode }) {
      return <DndContext>{children}</DndContext>;
    }

    describe('useCellDropTarget hook contract (DROP-01)', () => {
      it('returns { setNodeRef, isOver }', () => {
        const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
        expect(result.current).toHaveProperty('setNodeRef');
        expect(result.current).toHaveProperty('isOver');
      });

      it('isOver is boolean false on mount (no drag active)', () => {
        const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
        expect(typeof result.current.isOver).toBe('boolean');
        expect(result.current.isOver).toBe(false);
      });

      it('setNodeRef is a callable ref setter', () => {
        const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
        expect(typeof result.current.setNodeRef).toBe('function');
      });
    });

    describe('hook DOES NOT mutate dragStore directly (DROP-07)', () => {
      it('mounting the hook does not change dragStore.overId', () => {
        const before = useDragStore.getState().overId;
        renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
        const after = useDragStore.getState().overId;
        expect(after).toBe(before); // both null
      });

      it('calling setNodeRef does not change dragStore.overId', () => {
        const { result } = renderHook(() => useCellDropTarget('leaf-target'), { wrapper });
        const el = document.createElement('div');
        result.current.setNodeRef(el);
        expect(useDragStore.getState().overId).toBeNull();
      });
    });

    describe('hook integration with DndContext', () => {
      it('mounts without error inside DndContext', () => {
        function Harness() {
          const { setNodeRef, isOver } = useCellDropTarget('leaf-target');
          return <div ref={setNodeRef} data-testid="drop-harness" data-is-over={String(isOver)}>drop</div>;
        }
        const { container } = render(<DndContext><Harness /></DndContext>);
        const el = container.querySelector('[data-testid="drop-harness"]') as HTMLElement | null;
        expect(el).toBeTruthy();
        expect(el?.getAttribute('data-is-over')).toBe('false');
      });

      it('multiple drop targets with distinct IDs can coexist in the same context', () => {
        function Harness() {
          const a = useCellDropTarget('leaf-a');
          const b = useCellDropTarget('leaf-b');
          return (
            <>
              <div ref={a.setNodeRef} data-testid="drop-a" />
              <div ref={b.setNodeRef} data-testid="drop-b" />
            </>
          );
        }
        const { container } = render(<DndContext><Harness /></DndContext>);
        expect(container.querySelector('[data-testid="drop-a"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="drop-b"]')).toBeTruthy();
      });
    });

    describe('dragStore state transitions via REAL setOver / end actions (simulating CanvasWrapper.onDragOver / onDragEnd writes)', () => {
      it('when Plan 07 writes overId + activeZone via setOver, the store reflects the values', () => {
        // Seed dragging state.
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-src',
          overId: null,
          activeZone: null,
          ghostDataUrl: null,
          sourceRect: null,
        });
        // Use the REAL action name: setOver (NOT updateOver).
        useDragStore.getState().setOver('leaf-target', 'center');
        const state = useDragStore.getState();
        expect(state.overId).toBe('leaf-target');
        expect(state.activeZone).toBe('center');
        expect(state.status).toBe('dragging');
      });

      it('setOver transitions overId/activeZone (used by Plan 07 onDragOver)', () => {
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-src',
          overId: null,
          activeZone: null,
          ghostDataUrl: null,
          sourceRect: null,
        });
        useDragStore.getState().setOver('leaf-target', 'top');
        const state = useDragStore.getState();
        expect(state.overId).toBe('leaf-target');
        expect(state.activeZone).toBe('top');
      });

      it('setOver(null, null) clears over state (drag left all cells)', () => {
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-src',
          overId: 'leaf-target',
          activeZone: 'center',
          ghostDataUrl: null,
          sourceRect: null,
        });
        useDragStore.getState().setOver(null, null);
        const state = useDragStore.getState();
        expect(state.overId).toBeNull();
        expect(state.activeZone).toBeNull();
      });

      it('end() resets the full state (used by BOTH Plan 07 onDragEnd AND onDragCancel — single reset path)', () => {
        // Seed full dragging state including ghost fields.
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-src',
          overId: 'leaf-target',
          activeZone: 'center',
          ghostDataUrl: 'data:image/png;base64,XYZ',
          sourceRect: { width: 100, height: 200, left: 0, top: 0 },
        });
        // Use the REAL action name: end (NOT endDrag / cancelDrag).
        useDragStore.getState().end();
        const state = useDragStore.getState();
        expect(state.status).toBe('idle');
        expect(state.kind).toBeNull();
        expect(state.sourceId).toBeNull();
        expect(state.overId).toBeNull();
        expect(state.activeZone).toBeNull();
        expect(state.ghostDataUrl).toBeNull();
        expect(state.sourceRect).toBeNull();
      });

      it('cancel coverage: the SAME end() action is the only reset path (there is no separate cancelDrag)', () => {
        // This test documents the CONTRACT: Plan 07's onDragCancel handler calls
        // useDragStore.getState().end() — identical to onDragEnd's reset path.
        // We verify here that end() is a function with no arguments required.
        expect(typeof useDragStore.getState().end).toBe('function');
        expect(useDragStore.getState().end.length).toBe(0);
      });
    });
    ```

    **DROP-07 note:** Tests assert the hook does NOT write to `dragStore` on its own — zone computation + `setOver` writes live in CanvasWrapper.onDragOver (Plan 07). Tested at store level here; the full flow is integration-tested in Plan 10b Task 1.

    **Cancel coverage (BLOCKER-1 fix):** There is no `cancelDrag` action. Both `onDragEnd` and `onDragCancel` call `useDragStore.getState().end()`. The "cancel" contract is therefore that `end()` resets to initial state — covered by the `end() resets the full state` test above and the "same end() is the only reset path" documentation test. Plan 10b Task 1 (CanvasWrapper integration) asserts both dnd-kit handlers invoke `end()`.

    DO NOT:
    - Simulate real pointer drag sequences here (integration concern — Plan 10b).
    - Mock `useDroppable` from dnd-kit — use the real implementation.
    - Reference `updateOver`, `endDrag`, or `cancelDrag` anywhere — they do not exist.
  </action>

  <verify>
    <automated>npm run test -- --run src/dnd/__tests__/useCellDropTarget.test.tsx</automated>
    - `test -f src/dnd/__tests__/useCellDropTarget.test.tsx` — file exists
    - All tests pass
    - `npx tsc --noEmit` — clean
    - `grep -c "useDroppable.mock\|vi.mock.*@dnd-kit" src/dnd/__tests__/useCellDropTarget.test.tsx` returns 0
    - `grep -c "updateOver\|endDrag\|cancelDrag" src/dnd/__tests__/useCellDropTarget.test.tsx` returns 0 (REAL action names only)
    - `grep -q "setOver(" src/dnd/__tests__/useCellDropTarget.test.tsx` succeeds (REAL action is called)
    - `grep -q "\\.end(" src/dnd/__tests__/useCellDropTarget.test.tsx` succeeds (REAL action is called)
  </verify>

  <acceptance_criteria>
    - File exists at the exact path
    - Contains 4 describe blocks covering hook contract, non-mutation invariant, integration, REAL setOver/end store transitions
    - All tests pass
    - No mocking of dnd-kit internals
    - Zero references to `updateOver`, `endDrag`, `cancelDrag`
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>useCellDropTarget has dedicated unit tests; store write invariant is verified against the REAL dragStore contract (setOver + end, no phantom actions).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test fixtures → production stores (useGridStore, useDragStore, useEditorStore) | Tests call `setState` directly; no sandboxing. If a test leaks state between `it()` blocks, downstream tests fail spuriously. |
| jsdom rendering → real DOM assumptions | jsdom omits ResizeObserver/DataTransfer files; tests polyfill explicitly. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-28-29 | T | Test leaks state between `it()` blocks (e.g., dragStore stays 'dragging' from prior test) | mitigate | Every test file has `beforeEach` that resets useDragStore to the full initial shape (all 7 fields). `afterEach` calls `cleanup()` and `vi.restoreAllMocks()`. |
| T-28-32 | I | Deleting `phase25-touch-dnd.test.tsx` drops coverage of behaviors not re-covered elsewhere | mitigate | Task 1's rationale enumerates coverage moves. Tasks 5-6 cover sensor config + hook contracts. Plan 10b Task 1 covers full scenario. |
| T-28-33 | E | Rewriting a test to match buggy production code masks the bug | mitigate | Task 3's rewrite asserts the CONTRACT from CONTEXT.md (`data-testid="drop-zones"` + conditional rendering), not implementation internals. |
| T-28-35 | I | Tests calling fictional store actions (`updateOver`/`endDrag`/`cancelDrag`) would pass TypeScript-less lint but throw TypeError at runtime | mitigate | BLOCKER-1 fix: every `<interfaces>` block + every task's action text explicitly enumerates the REAL action names and prohibits the phantom ones. `npx tsc --noEmit` catches any slip because DragState is strictly typed. |
</threat_model>

<verification>
- Task 1: `phase25-touch-dnd.test.tsx` deleted
- Task 2: `phase05-p02-cell-swap.test.ts` trimmed to swapCells block only
- Task 3: `phase09-p03-leafnode-zones.test.ts` rewritten; asserts `drop-zones`; no `useDndMonitor`, no phantom action names
- Task 4: `LeafNode.test.tsx` comment updated; test logic unchanged
- Task 5: `useCellDraggable.test.tsx` created; hook contract + sensor classes asserted; no fake timers; no phantom action names
- Task 6: `useCellDropTarget.test.tsx` created; REAL `setOver`/`end` exercised; no phantom action names
- `npx tsc --noEmit` — clean
</verification>

<success_criteria>
- **Unit test layer green:** Each of the 6 files above passes `npm run test -- --run <file>`.
- **Typecheck green:** `npx tsc --noEmit` exits 0.
- **Zero phantom action names:** grep across all 6 modified/created files for `updateOver|endDrag|cancelDrag` returns 0 matches.
- **Phase 25 engine references absent in these 6 files:** grep for `MouseSensor|TouchSensor|KeyboardSensor|DragZoneRefContext|useDndMonitor` across these 6 files returns 0 matches. (Full src/ SC-3 gate lives in Plan 10b Task 2.)
</success_criteria>

<output>
After completion, create `.planning/phases/28-cell-to-cell-drag/28-10a-SUMMARY.md`

The SUMMARY MUST include:
1. List of deleted / rewritten / created test files with line counts
2. Confirmation that all 6 files pass `npm run test -- --run <file>` individually
3. Grep output for `updateOver|endDrag|cancelDrag` across the 6 files (expected: empty)
4. Note: full SC-3 gate + CanvasWrapper integration test live in Plan 10b
</output>
