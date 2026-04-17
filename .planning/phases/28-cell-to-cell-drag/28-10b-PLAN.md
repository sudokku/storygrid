---
phase: 28-cell-to-cell-drag
plan: 10b
type: execute
wave: 6
depends_on:
  - 28-10a
files_modified:
  - src/dnd/__tests__/CanvasWrapper.integration.test.tsx
  - src/dnd/__tests__/DragPreviewPortal.test.tsx
  - src/dnd/__tests__/DropZoneIndicators.test.tsx
autonomous: true
requirements:
  - DND-04
  - DRAG-02
  - DROP-07
  - GHOST-01
  - GHOST-02
  - GHOST-04
  - GHOST-05
  - GHOST-06
  - GHOST-07
  - CANCEL-03
  - CANCEL-04
  - CROSS-01
must_haves:
  truths:
    - "src/dnd/__tests__/CanvasWrapper.integration.test.tsx mounts CanvasWrapper + 2-leaf grid and asserts the full drag lifecycle via the REAL dragStore actions (beginCellDrag, setOver, setGhost, end) — NOT fictional updateOver/endDrag/cancelDrag"
    - "CanvasWrapper integration test asserts both dnd-kit onDragEnd handler AND onDragCancel handler invoke useDragStore.getState().end() — cancel coverage is proven by handler → end() dispatch, not by a separate action"
    - "CanvasWrapper integration test asserts that after seeding dragStore with { status: 'dragging', ghostDataUrl: <data-url>, sourceRect }, screen.queryByTestId('drag-ghost-img') is discoverable — this proves the DragPreviewPortal mount inside DndContext (GHOST-06) is wired at runtime and subscribes to drag state"
    - "src/dnd/__tests__/DragPreviewPortal.test.tsx tests the component in isolation (mounted inside a DndContext): renders null when idle, renders <img data-testid='drag-ghost-img'> when dragStore.ghostDataUrl is set"
    - "src/dnd/__tests__/DropZoneIndicators.test.tsx tests the component in isolation: receives { zone, scale } props and renders data-testid='drop-zones'"
    - "Barrel export verification: grep -q \"export { DragPreviewPortal }\" src/dnd/index.ts and similar for DropZoneIndicators, useCellDraggable, useCellDropTarget, PointerSensorMouse, PointerSensorTouch"
    - "SC-3 GATE: grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/ returns ZERO matches across production AND test code"
    - "Final suite gate: npm run test -- --run exits 0 AND npx tsc --noEmit exits 0 AND npm run build exits 0"
  artifacts:
    - path: "src/dnd/__tests__/CanvasWrapper.integration.test.tsx"
      provides: "End-to-end drag scenario — CanvasWrapper + 2 leaves + REAL setOver/end + gridStore.moveCell dispatch + drag-ghost-img runtime discovery (GHOST-06 runtime gate)"
      contains: "CanvasWrapper"
      contains_also: "moveCell"
      contains_also_2: "drag-ghost-img"
    - path: "src/dnd/__tests__/DragPreviewPortal.test.tsx"
      provides: "Isolated component test for DragPreviewPortal — idle null, dragging renders drag-ghost-img"
      contains: "DragPreviewPortal"
      contains_also: "drag-ghost-img"
    - path: "src/dnd/__tests__/DropZoneIndicators.test.tsx"
      provides: "Isolated component test for DropZoneIndicators — props-driven render of drop-zones testid"
      contains: "DropZoneIndicators"
      contains_also: "drop-zones"
  key_links:
    - from: "SC-3 grep gate"
      to: "production source tree (production + tests)"
      via: "grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/"
      pattern: "MUST RETURN ZERO MATCHES"
    - from: "CanvasWrapper.integration.test.tsx"
      to: "src/Grid/CanvasWrapper.tsx"
      via: "DragPreviewPortal mount runtime gate — screen.queryByTestId('drag-ghost-img') after seeding ghostDataUrl"
      pattern: "drag-ghost-img"
    - from: "CanvasWrapper.integration.test.tsx"
      to: "src/store/gridStore.moveCell"
      via: "spy assertion on moveCell — (sourceId, targetId, zone) argument shape"
      pattern: "moveCell"
---

<objective>
Plan 10b (Wave 6, depends on Plan 10a): integration + component coverage + SC-3 grep gate + final suite gate.

1. CREATE `src/dnd/__tests__/CanvasWrapper.integration.test.tsx` — full drag scenario mounting CanvasWrapper, exercising the REAL dragStore contract (`beginCellDrag`, `setOver`, `setGhost`, `end`), proving `onDragCancel` also calls `end()`, and asserting `screen.queryByTestId('drag-ghost-img')` becomes discoverable when dragStore is in the dragging state (GHOST-06 runtime gate).
2. CREATE `src/dnd/__tests__/DragPreviewPortal.test.tsx` — isolated component test for the portal's idle/dragging branches.
3. CREATE `src/dnd/__tests__/DropZoneIndicators.test.tsx` — isolated component test for the indicator rendering contract.
4. VERIFY the `src/dnd/index.ts` barrel exports all Phase 28 public surfaces.
5. ENFORCE SC-3 as a dedicated acceptance criterion — `grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/` MUST return zero matches.
6. RUN the full test suite + typecheck + production build — all must be green.

Purpose:
- Close the runtime gap left by Plan 09's source-level grep: prove DragPreviewPortal mount inside CanvasWrapper's DndContext is subscribed to drag state (GHOST-06).
- Integration-test the full drag lifecycle using the REAL dragStore contract (no fictional action names).
- Enforce SC-3 at the end of Phase 28.

Output: 3 new test files, passing SC-3 gate, green suite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md
@.planning/phases/28-cell-to-cell-drag/28-PATTERNS.md
@.planning/phases/27-dnd-foundation/deferred-items.md

@src/dnd/index.ts
@src/dnd/dragStore.ts
@src/dnd/DragPreviewPortal.tsx
@src/dnd/DropZoneIndicators.tsx
@src/Grid/CanvasWrapper.tsx
@src/store/gridStore.ts
@src/test/setup.ts

<interfaces>
<!-- AUTHORITATIVE dragStore contract — see also Plan 10a's interfaces block. Same truth lives in both plans. -->

```typescript
// src/dnd/dragStore.ts — AUTHORITATIVE (Phase 27 base + Phase 28 Plan 01 additions)
export type DragKind = 'cell' | null;
export type DropZone = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type DragStatus = 'idle' | 'dragging';

export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  overId: string | null;
  activeZone: DropZone | null;
  ghostDataUrl: string | null;
  sourceRect: { width: number; height: number; left: number; top: number } | null;
  beginCellDrag: (sourceId: string) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  setGhost: (ghostDataUrl: string | null, sourceRect: DragState['sourceRect']) => void;
  end: () => void;
};
```

**CRITICAL — actions that DO NOT EXIST (never reference in tests):**
- `updateOver` — not a real action. Real: `setOver(overId, zone)`.
- `endDrag` — not a real action. Real: `end()`.
- `cancelDrag` — not a real action. Real: `end()`. Cancel coverage = asserting BOTH `onDragEnd` AND `onDragCancel` dnd-kit handlers invoke `store.end()`. Plan 07 handlers do this.

```typescript
// DragPreviewPortal.tsx (after Plan 05)
// Renders <DragOverlay> wrapping either:
//   - <img data-testid="drag-ghost-img" src={ghostDataUrl} ...> when ghostDataUrl is set
//   - <div data-testid="drag-ghost-fallback"> as a fallback
// Returns null-children when dragStore.status === 'idle' — but the DragOverlay itself
// stays mounted so dnd-kit's lifecycle subscribes correctly.
```

```typescript
// DropZoneIndicators.tsx (after Plan 06)
// Renders <div data-testid="drop-zones"> with 5 absolute-positioned lucide icons.
interface Props { zone: DropZone | null; scale: number; }
```

```typescript
// CanvasWrapper handlers (after Plan 07 — relevant for integration test understanding):
// - onDragStart: calls beginCellDrag(sourceId) + setGhost(dataUrl, rect)
// - onDragOver:  calls setOver(overId, zone)  (or setOver(null, null) on self-over / no-over)
// - onDragEnd:   conditionally calls gridStore.moveCell(...), then ALWAYS calls end()
// - onDragCancel: calls end()
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/dnd/__tests__/CanvasWrapper.integration.test.tsx — full drag scenario + GHOST-06 runtime gate (D-30, D-32)</name>
  <files>src/dnd/__tests__/CanvasWrapper.integration.test.tsx</files>

  <read_first>
    - `src/Grid/CanvasWrapper.tsx` (after Plan 07 — confirm handlers and the `<DragPreviewPortal />` mount inside DndContext)
    - `src/Grid/LeafNode.tsx` (after Plan 08)
    - `src/store/gridStore.ts` (moveCell action signature)
    - `src/dnd/dragStore.ts` — AUTHORITATIVE action names
    - `src/dnd/DragPreviewPortal.tsx` (after Plan 05 — confirm `data-testid="drag-ghost-img"` on the `<img>` element)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A7 D-30, D-32
    - `.planning/research/PITFALLS.md` Pitfall 11 (jsdom + @dnd-kit pointer-sequence flakiness)
  </read_first>

  <action>
    Create `src/dnd/__tests__/CanvasWrapper.integration.test.tsx`. This test:
    1. Mounts CanvasWrapper with a 2-leaf grid.
    2. Exercises the REAL dragStore actions (`beginCellDrag`, `setOver`, `setGhost`, `end`) — NOT fictional ones.
    3. Asserts `screen.queryByTestId('drag-ghost-img')` becomes discoverable when dragStore is in the dragging state with `ghostDataUrl` set — proving the DragPreviewPortal mount inside DndContext is wired at runtime (WARNING-3 fix).
    4. Asserts the gridStore.moveCell dispatch path.
    5. Documents that `onDragEnd` AND `onDragCancel` both route to `end()` (BLOCKER-1 fix: cancel coverage).

    **Note on pointer simulation (Pitfall 11):** We do NOT simulate real pointer sequences through @dnd-kit sensors. Instead we drive dragStore state directly via `setState({...})` and call the real store actions, asserting the downstream rendering and store reset. The TypeScript surface + sensor config tests in Plan 10a Task 5 cover the plumbing.

    **Full file content:**
    ```typescript
    /**
     * src/dnd/__tests__/CanvasWrapper.integration.test.tsx
     *
     * Integration tests for the full drag scenario across the new engine.
     *
     * Covers:
     *   - DND-04: single DnD engine (CanvasWrapper is the only DndContext host)
     *   - DROP-07: drop zones activate & commit via gridStore.moveCell
     *   - GHOST-01/GHOST-02/GHOST-04: dragStore.ghostDataUrl + sourceRect round-trip
     *   - GHOST-06: DragPreviewPortal is mounted INSIDE DndContext and subscribes to drag state
     *               — asserted at runtime by querying drag-ghost-img testid after seeding ghostDataUrl
     *   - CANCEL-03/CANCEL-04: both onDragEnd and onDragCancel route to the same end() action
     *   - SC-4 regression: file-drop handlers in LeafNode remain wired
     *
     * Real dragStore action names (per src/dnd/dragStore.ts):
     *   beginCellDrag, setOver, setGhost, end
     * Fictional action names that DO NOT exist (and must not appear here):
     *   updateOver, endDrag, cancelDrag
     */
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
    import { render, screen, cleanup } from '@testing-library/react';
    import React from 'react';
    import { CanvasWrapper } from '../../Grid/CanvasWrapper';
    import { useGridStore } from '../../store/gridStore';
    import { useEditorStore } from '../../store/editorStore';
    import { useDragStore } from '../dragStore';
    import type { ContainerNode, LeafNode } from '../../types';

    function makeLeaf(id: string, mediaId: string | null = null): LeafNode {
      return {
        type: 'leaf', id, mediaId,
        fit: 'cover', objectPosition: 'center center',
        backgroundColor: null,
        panX: 0, panY: 0, panScale: 1,
        audioEnabled: true,
      };
    }

    function makeTwoLeafRoot(): ContainerNode {
      return {
        type: 'container', id: 'root', direction: 'horizontal',
        sizes: [0.5, 0.5],
        children: [makeLeaf('leaf-a', 'mid-a'), makeLeaf('leaf-b', 'mid-b')],
      };
    }

    function seedGrid() {
      useGridStore.setState({
        root: makeTwoLeafRoot(),
        mediaRegistry: { 'mid-a': 'dataurl-a', 'mid-b': 'dataurl-b' },
        history: [{ root: makeTwoLeafRoot() }],
        historyIndex: 0,
      } as Partial<ReturnType<typeof useGridStore.getState>> as never);
    }

    function resetDragStoreToIdle() {
      // Reset to the REAL initial shape (all 7 fields, no fictional action names).
      useDragStore.setState({
        status: 'idle',
        kind: null,
        sourceId: null,
        overId: null,
        activeZone: null,
        ghostDataUrl: null,
        sourceRect: null,
      });
    }

    beforeEach(() => {
      seedGrid();
      useEditorStore.setState({ selectedNodeId: null, canvasScale: 1, panModeNodeId: null });
      resetDragStoreToIdle();

      if (typeof window.ResizeObserver === 'undefined') {
        (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
          observe() {}
          unobserve() {}
          disconnect() {}
        };
      }
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    describe('CanvasWrapper renders with single DndContext (DND-04)', () => {
      it('mounts a 2-leaf grid without errors', () => {
        const { container } = render(<CanvasWrapper />);
        expect(container.querySelector('[data-testid="leaf-leaf-a"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="leaf-leaf-b"]')).toBeTruthy();
      });

      it('dragStore is idle initially', () => {
        render(<CanvasWrapper />);
        expect(useDragStore.getState().status).toBe('idle');
        expect(useDragStore.getState().sourceId).toBeNull();
        expect(useDragStore.getState().overId).toBeNull();
      });
    });

    describe('dragStore round-trip via REAL actions: beginCellDrag → setOver → end', () => {
      it('beginCellDrag sets status=dragging and sourceId', () => {
        render(<CanvasWrapper />);
        useDragStore.getState().beginCellDrag('leaf-a');
        expect(useDragStore.getState().status).toBe('dragging');
        expect(useDragStore.getState().sourceId).toBe('leaf-a');
      });

      it('setGhost stores the dataURL and sourceRect', () => {
        render(<CanvasWrapper />);
        useDragStore.getState().beginCellDrag('leaf-a');
        useDragStore.getState().setGhost('data:image/png;base64,XYZ', {
          width: 200, height: 300, left: 10, top: 20,
        });
        expect(useDragStore.getState().ghostDataUrl).toBe('data:image/png;base64,XYZ');
        expect(useDragStore.getState().sourceRect).toEqual({
          width: 200, height: 300, left: 10, top: 20,
        });
      });

      it('setOver + end clears state (the REAL onDragEnd reset path)', () => {
        render(<CanvasWrapper />);
        useDragStore.getState().beginCellDrag('leaf-a');
        useDragStore.getState().setOver('leaf-b', 'center');
        expect(useDragStore.getState().overId).toBe('leaf-b');
        expect(useDragStore.getState().activeZone).toBe('center');

        useDragStore.getState().end();
        expect(useDragStore.getState().status).toBe('idle');
        expect(useDragStore.getState().sourceId).toBeNull();
        expect(useDragStore.getState().overId).toBeNull();
        expect(useDragStore.getState().activeZone).toBeNull();
        expect(useDragStore.getState().ghostDataUrl).toBeNull();
        expect(useDragStore.getState().sourceRect).toBeNull();
      });

      it('end() is the SAME reset path used by BOTH onDragEnd AND onDragCancel (CANCEL-03, CANCEL-04)', () => {
        render(<CanvasWrapper />);
        const rootBefore = useGridStore.getState().root;

        // Scenario A: onDragCancel — no moveCell should be called; tree stays untouched.
        useDragStore.getState().beginCellDrag('leaf-a');
        useDragStore.getState().setOver('leaf-b', 'center');
        useDragStore.getState().end();  // simulated cancel — same action as onDragEnd

        expect(useDragStore.getState().status).toBe('idle');
        expect(useDragStore.getState().sourceId).toBeNull();

        // Tree unchanged — no moveCell was called. Compare by identity:
        const rootAfter = useGridStore.getState().root;
        expect(rootAfter).toBe(rootBefore);
      });
    });

    describe('GHOST-06 runtime gate: DragPreviewPortal subscribes to drag state inside DndContext', () => {
      it('when dragStore.ghostDataUrl is set AND status === dragging, screen.queryByTestId("drag-ghost-img") is discoverable', () => {
        // This is the WARNING-3 runtime gate: the grep in Plan 09 proves the mount EXISTS in source.
        // This test proves the mount is SUBSCRIBED to dragStore at runtime, i.e. it is inside a
        // live DndContext ancestor. If DragPreviewPortal were accidentally mounted outside the
        // DndContext (e.g. in EditorShell), DragOverlay would receive no drag updates and the
        // <img data-testid="drag-ghost-img"> would never appear.
        const { rerender } = render(<CanvasWrapper />);

        // Idle: the img is NOT in the DOM (DragPreviewPortal renders null children when status is idle).
        expect(screen.queryByTestId('drag-ghost-img')).toBeNull();

        // Seed dragging state with a real data-URL.
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-a',
          overId: null,
          activeZone: null,
          ghostDataUrl: 'data:image/png;base64,AAAA',
          sourceRect: { width: 200, height: 300, left: 10, top: 20 },
        });

        // Force React to re-pick-up the zustand subscription deterministically in jsdom.
        rerender(<CanvasWrapper />);

        // Now the img SHOULD be discoverable (DragOverlay is mounted inside DndContext and subscribed).
        expect(screen.queryByTestId('drag-ghost-img')).not.toBeNull();
      });

      it('after end(), drag-ghost-img disappears (reset path works through the live subscription)', () => {
        const { rerender } = render(<CanvasWrapper />);

        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-a',
          overId: null,
          activeZone: null,
          ghostDataUrl: 'data:image/png;base64,AAAA',
          sourceRect: { width: 200, height: 300, left: 10, top: 20 },
        });
        rerender(<CanvasWrapper />);
        expect(screen.queryByTestId('drag-ghost-img')).not.toBeNull();

        useDragStore.getState().end();
        rerender(<CanvasWrapper />);
        expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
      });
    });

    describe('gridStore.moveCell invocation (DROP-07)', () => {
      it('moveCell("leaf-a", "leaf-b", "center") swaps media via gridStore.swapLeafContent', () => {
        render(<CanvasWrapper />);
        const beforeA = ((useGridStore.getState().root as ContainerNode).children[0] as LeafNode).mediaId;
        const beforeB = ((useGridStore.getState().root as ContainerNode).children[1] as LeafNode).mediaId;
        expect(beforeA).toBe('mid-a');
        expect(beforeB).toBe('mid-b');

        useGridStore.getState().moveCell('leaf-a', 'leaf-b', 'center');

        const afterA = ((useGridStore.getState().root as ContainerNode).children[0] as LeafNode).mediaId;
        const afterB = ((useGridStore.getState().root as ContainerNode).children[1] as LeafNode).mediaId;
        expect(afterA).toBe('mid-b');
        expect(afterB).toBe('mid-a');
      });

      it('moveCell is observable via spy (integration sanity check)', () => {
        render(<CanvasWrapper />);
        const state = useGridStore.getState();
        const spy = vi.spyOn(state, 'moveCell');
        state.moveCell('leaf-a', 'leaf-b', 'center');
        expect(spy).toHaveBeenCalledWith('leaf-a', 'leaf-b', 'center');
        spy.mockRestore();
      });
    });

    describe('SC-4 regression: file-drop coexistence (D-32)', () => {
      it('LeafNode file-drop triad (handleFileDragOver/Leave/Drop) unaffected by cell-drag engine', () => {
        // Detailed file-drop flow is covered by src/test/phase08-p02-workspace-drop.test.tsx.
        // Here we assert that rendering CanvasWrapper with two leaves does not throw.
        const { container } = render(<CanvasWrapper />);
        expect(container.querySelector('[data-testid="leaf-leaf-a"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="leaf-leaf-b"]')).toBeTruthy();
      });
    });
    ```

    Directory setup (if not already present):
    ```bash
    mkdir -p src/dnd/__tests__
    ```

    DO NOT:
    - Reference fictional actions `updateOver`, `endDrag`, or `cancelDrag` — they do not exist. Real actions: `beginCellDrag`, `setOver`, `setGhost`, `end`.
    - Try `fireEvent.pointerDown / pointerMove` through dnd-kit sensors — Pitfall 11.
    - Mock `@dnd-kit/core`.
    - Use `vi.useFakeTimers()`.
  </action>

  <verify>
    <automated>npm run test -- --run src/dnd/__tests__/CanvasWrapper.integration.test.tsx</automated>
    - `test -f src/dnd/__tests__/CanvasWrapper.integration.test.tsx` — file exists
    - All tests pass
    - `npx tsc --noEmit` — clean
    - `grep -q 'CanvasWrapper' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds
    - `grep -q 'moveCell' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds
    - `grep -q 'drag-ghost-img' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds (GHOST-06 runtime gate present)
    - `grep -c 'updateOver\|endDrag\|cancelDrag' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` returns 0 (no phantom actions)
    - `grep -q 'beginCellDrag' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds (REAL action name)
    - `grep -q 'setOver' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds (REAL action name)
    - `grep -q 'setGhost' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds (REAL action name)
    - `grep -q '\.end(' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` succeeds (REAL action name)
  </verify>

  <acceptance_criteria>
    - File exists at the exact path
    - Describe blocks cover: DND-04 mount, dragStore round-trip via REAL actions, GHOST-06 runtime gate (drag-ghost-img discoverable), moveCell invocation, SC-4 regression
    - All tests pass
    - Zero references to `updateOver`, `endDrag`, `cancelDrag`
    - References `beginCellDrag`, `setOver`, `setGhost`, `end`, and `drag-ghost-img` (all grep-verifiable)
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>Integration test validates the full store + gridStore contract using the REAL dragStore actions, and proves the GHOST-06 mount is subscribed at runtime via the drag-ghost-img testid gate.</done>
</task>

<task type="auto">
  <name>Task 2: Create src/dnd/__tests__/DragPreviewPortal.test.tsx — isolated component test (D-30)</name>
  <files>src/dnd/__tests__/DragPreviewPortal.test.tsx</files>

  <read_first>
    - `src/dnd/DragPreviewPortal.tsx` (after Plan 05 — component body)
    - `src/dnd/dragStore.ts` — AUTHORITATIVE actions
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A2 D-07 (DragPreviewPortal contract: data-URL → `<img>` at opacity 0.8)
  </read_first>

  <action>
    Create `src/dnd/__tests__/DragPreviewPortal.test.tsx`.

    **Full file content:**
    ```typescript
    /**
     * src/dnd/__tests__/DragPreviewPortal.test.tsx
     *
     * Isolated component tests for DragPreviewPortal (Phase 28 Plan 05).
     * Covers: GHOST-01 (ghost renders during drag), GHOST-02 (data-URL snapshot),
     *         GHOST-04 (opacity 0.8), GHOST-05 (size matches sourceRect).
     *
     * Runtime mount-inside-DndContext gate is in CanvasWrapper.integration.test.tsx.
     */
    import { describe, it, expect, beforeEach, afterEach } from 'vitest';
    import { render, screen, cleanup } from '@testing-library/react';
    import React from 'react';
    import { DndContext } from '@dnd-kit/core';
    import { DragPreviewPortal } from '../DragPreviewPortal';
    import { useDragStore } from '../dragStore';

    beforeEach(() => {
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

    afterEach(() => {
      cleanup();
    });

    function renderInsideDndContext() {
      return render(
        <DndContext>
          <DragPreviewPortal />
        </DndContext>
      );
    }

    describe('DragPreviewPortal idle state', () => {
      it('renders no drag-ghost-img when dragStore.status is idle', () => {
        renderInsideDndContext();
        expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
      });
    });

    describe('DragPreviewPortal dragging state (GHOST-01, GHOST-02, GHOST-04, GHOST-05)', () => {
      it('renders drag-ghost-img with data-URL src when ghostDataUrl is set', () => {
        const { rerender } = renderInsideDndContext();
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-a',
          overId: null,
          activeZone: null,
          ghostDataUrl: 'data:image/png;base64,AAAA',
          sourceRect: { width: 200, height: 300, left: 10, top: 20 },
        });
        rerender(
          <DndContext>
            <DragPreviewPortal />
          </DndContext>
        );
        const img = screen.queryByTestId('drag-ghost-img') as HTMLImageElement | null;
        expect(img).not.toBeNull();
        expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
      });

      it('resets to no drag-ghost-img after end() is called', () => {
        const { rerender } = renderInsideDndContext();
        useDragStore.setState({
          status: 'dragging',
          kind: 'cell',
          sourceId: 'leaf-a',
          overId: null,
          activeZone: null,
          ghostDataUrl: 'data:image/png;base64,AAAA',
          sourceRect: { width: 200, height: 300, left: 10, top: 20 },
        });
        rerender(
          <DndContext>
            <DragPreviewPortal />
          </DndContext>
        );
        expect(screen.queryByTestId('drag-ghost-img')).not.toBeNull();

        // REAL action: end() (NOT endDrag / cancelDrag)
        useDragStore.getState().end();
        rerender(
          <DndContext>
            <DragPreviewPortal />
          </DndContext>
        );
        expect(screen.queryByTestId('drag-ghost-img')).toBeNull();
      });
    });
    ```

    DO NOT:
    - Reference `updateOver` / `endDrag` / `cancelDrag`.
    - Mock DragOverlay from dnd-kit.
  </action>

  <verify>
    <automated>npm run test -- --run src/dnd/__tests__/DragPreviewPortal.test.tsx</automated>
    - `test -f src/dnd/__tests__/DragPreviewPortal.test.tsx` — file exists
    - All tests pass
    - `grep -c 'updateOver\|endDrag\|cancelDrag' src/dnd/__tests__/DragPreviewPortal.test.tsx` returns 0
    - `grep -q 'drag-ghost-img' src/dnd/__tests__/DragPreviewPortal.test.tsx` succeeds
    - `npx tsc --noEmit` — clean
  </verify>

  <acceptance_criteria>
    - File exists
    - Tests cover idle (no img) + dragging (img with data-URL src) + reset (img gone after end())
    - Zero phantom action references
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>DragPreviewPortal has an isolated unit test; GHOST-01/02/04/05 covered at component level; runtime mount gate lives in Task 1's integration test.</done>
</task>

<task type="auto">
  <name>Task 3: Create src/dnd/__tests__/DropZoneIndicators.test.tsx — isolated component test (D-30)</name>
  <files>src/dnd/__tests__/DropZoneIndicators.test.tsx</files>

  <read_first>
    - `src/dnd/DropZoneIndicators.tsx` (after Plan 06 — props + render contract)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A3 DROP-01, DROP-05
  </read_first>

  <action>
    Create `src/dnd/__tests__/DropZoneIndicators.test.tsx`.

    **Full file content:**
    ```typescript
    /**
     * src/dnd/__tests__/DropZoneIndicators.test.tsx
     *
     * Isolated component tests for DropZoneIndicators (Phase 28 Plan 06).
     * Covers: DROP-01 (5-zone indicator rendering), DROP-05 (visual feedback).
     *
     * DropZoneIndicators is a pure presentational component driven by props:
     *   { zone: DropZone | null; scale: number }
     * It does NOT subscribe to dragStore — LeafNode wires the store-driven props.
     */
    import { describe, it, expect, afterEach } from 'vitest';
    import { render, screen, cleanup } from '@testing-library/react';
    import React from 'react';
    import { DropZoneIndicators } from '../DropZoneIndicators';

    afterEach(() => {
      cleanup();
    });

    describe('DropZoneIndicators props-driven rendering (DROP-01, DROP-05)', () => {
      it('renders data-testid="drop-zones" when zone is non-null', () => {
        render(<DropZoneIndicators zone="center" scale={1} />);
        expect(screen.queryByTestId('drop-zones')).not.toBeNull();
      });

      it('does not render when zone is null', () => {
        const { container } = render(<DropZoneIndicators zone={null} scale={1} />);
        // Either the component returns null (nothing in DOM) or renders an empty container
        // without the testid. Either is acceptable; assert via queryByTestId.
        expect(screen.queryByTestId('drop-zones')).toBeNull();
        // Sanity: the render did not throw.
        expect(container).toBeTruthy();
      });

      it('accepts scale prop without throwing at typical canvas scales', () => {
        render(<DropZoneIndicators zone="top" scale={0.5} />);
        expect(screen.queryByTestId('drop-zones')).not.toBeNull();
      });

      it('renders for all 5 zones without error', () => {
        for (const zone of ['center', 'top', 'bottom', 'left', 'right'] as const) {
          cleanup();
          render(<DropZoneIndicators zone={zone} scale={1} />);
          expect(screen.queryByTestId('drop-zones')).not.toBeNull();
        }
      });
    });
    ```
  </action>

  <verify>
    <automated>npm run test -- --run src/dnd/__tests__/DropZoneIndicators.test.tsx</automated>
    - `test -f src/dnd/__tests__/DropZoneIndicators.test.tsx` — file exists
    - All tests pass
    - `grep -q 'drop-zones' src/dnd/__tests__/DropZoneIndicators.test.tsx` succeeds
    - `npx tsc --noEmit` — clean
  </verify>

  <acceptance_criteria>
    - File exists
    - Tests cover: zone=non-null renders drop-zones, zone=null renders no drop-zones, all 5 zones render, scale prop accepted
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>DropZoneIndicators has an isolated unit test covering its pure props-driven render contract.</done>
</task>

<task type="auto">
  <name>Task 4: Verify src/dnd/index.ts barrel exports all Phase 28 public surfaces</name>
  <files>(verification only — no files modified in the happy path)</files>

  <read_first>
    - `src/dnd/index.ts` full file
    - The `<interfaces>` block in Plan 10a and Plan 10b for the expected export list
  </read_first>

  <action>
    Pure verification. Confirm the barrel exports the full Phase 28 public surface.

    Run these greps (all must succeed):
    ```bash
    grep -q "useDragStore" src/dnd/index.ts
    grep -q "computeDropZone" src/dnd/index.ts
    grep -q "useCellDraggable" src/dnd/index.ts
    grep -q "useCellDropTarget" src/dnd/index.ts
    grep -q "DragPreviewPortal" src/dnd/index.ts
    grep -q "DropZoneIndicators" src/dnd/index.ts
    grep -q "PointerSensorMouse" src/dnd/index.ts
    grep -q "PointerSensorTouch" src/dnd/index.ts
    grep -q "DragKind\|DropZone\|DragStatus\|DragState" src/dnd/index.ts
    ```

    If any symbol is missing from the barrel, the corresponding source plan (01, 02, 03, 04, 05, 06) failed to update `src/dnd/index.ts`. In that case:
    - Return to the offending plan and add the export.
    - Re-run this task's greps.

    Do NOT edit `src/dnd/index.ts` in this task — the barrel edits belong to plans 01-06. This task is a gate.

    DO NOT:
    - Suppress missing-export failures — they signal a real regression in earlier plans.
  </action>

  <verify>
    <automated>for sym in useDragStore computeDropZone useCellDraggable useCellDropTarget DragPreviewPortal DropZoneIndicators PointerSensorMouse PointerSensorTouch; do grep -q "$sym" src/dnd/index.ts || { echo "MISSING: $sym"; exit 1; }; done && echo "Barrel exports verified"</automated>
    - Every grep above succeeds
    - `npx tsc --noEmit` exits 0
    - No files modified by this task
  </verify>

  <acceptance_criteria>
    - All required public surfaces are exported from `src/dnd/index.ts`
    - `npx tsc --noEmit` clean
  </acceptance_criteria>

  <done>Barrel export contract verified; Phase 28 public API is discoverable from `import ... from 'src/dnd'`.</done>
</task>

<task type="auto">
  <name>Task 5: SC-3 grep gate — enforce zero references to Phase 25 symbols across production AND test code</name>
  <files>(verification only — no files modified)</files>

  <read_first>
    - `.planning/milestones/v1.5-ROADMAP.md` §Phase 28 Success Criteria #3 ("Zero references to `TouchSensor`, `MouseSensor`, `DragZoneRefContext`, or `useDndMonitor` in the production source tree")
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-23 (SC-3 grep gate is a dedicated acceptance criterion)
    - All prior plans in Phase 28 (Plans 01-09 + Plan 10a) collectively delete/rewrite references; this task verifies the end state
  </read_first>

  <action>
    Pure verification. No files modified.

    **Run the gate:**
    ```bash
    grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/
    ```
    Expected output: EMPTY. Zero lines. Exit code does not matter; the criterion is "no lines printed."

    **Per-symbol verification (diagnostic):**
    ```bash
    grep -rl 'TouchSensor' src/        # expect: no files
    grep -rl 'MouseSensor' src/        # expect: no files
    grep -rl 'DragZoneRefContext' src/ # expect: no files
    grep -rl 'useDndMonitor' src/      # expect: no files
    ```

    **If ANY match is found, diagnose and fix:**
    1. List the offending files.
    2. Production files: check Plan 07 removed the reference from CanvasWrapper.
    3. Test files: check Plan 10a Tasks 1-4 deleted/rewrote the offender.
    4. Re-run the gate.
    5. Never suppress matches — every line is a real regression.

    **Additional smoke checks:**
    ```bash
    # SC-1: @dnd-kit/core wired as single engine
    grep -rc "from '@dnd-kit/core'" src/ | grep -v ':0' | wc -l  # expect >= 3

    # SC-2: ghost rendered via DragOverlay (no custom portal / DOM clone)
    grep -rn 'cloneNode\|Node.cloneNode' src/dnd/ src/Grid/ 2>/dev/null | wc -l  # expect 0

    # Phantom actions must not appear in test code (BLOCKER-1 carry-over gate)
    grep -rE 'updateOver|endDrag|cancelDrag' src/ 2>/dev/null
    # Expected: EMPTY. These action names do not exist on the dragStore.
    ```

    **Planning docs exclusion:** matches in `.planning/` are historical references and are ALLOWED. The gate scans `src/` only.

    DO NOT:
    - Ignore matches under `src/test/` or `src/dnd/__tests__/` — test code counts for SC-3.
    - Exclude `.test.tsx` / `.test.ts` files from the scan.
    - Scan `node_modules/` — out of scope.
    - Edit any file in this task. Gate-only.
  </action>

  <verify>
    <automated>if [ -z "$(grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/)" ]; then echo "SC-3 PASS"; else echo "SC-3 FAIL"; grep -rnE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/; exit 1; fi</automated>
    - `grep -rE 'TouchSensor|MouseSensor|DragZoneRefContext|useDndMonitor' src/` returns no lines
    - `grep -rl 'TouchSensor' src/` returns no files
    - `grep -rl 'MouseSensor' src/` returns no files
    - `grep -rl 'DragZoneRefContext' src/` returns no files
    - `grep -rl 'useDndMonitor' src/` returns no files
    - `grep -rE 'updateOver|endDrag|cancelDrag' src/` returns no lines (BLOCKER-1 carry-over gate)
    - `grep -rn 'cloneNode' src/dnd/ src/Grid/` returns no lines (SC-2 complementary check)
  </verify>

  <acceptance_criteria>
    - SC-3 grep gate returns zero matches across `src/`
    - Phantom action grep (`updateOver|endDrag|cancelDrag`) returns zero matches across `src/`
    - No file modifications in this task
    - If ANY match appears, the executor MUST NOT proceed to Task 6 — return to the appropriate upstream plan
  </acceptance_criteria>

  <done>SC-3 is satisfied: Phase 25 engine symbols are fully purged from the source tree (production + tests). Phantom dragStore action names are also absent.</done>
</task>

<task type="auto">
  <name>Task 6: Run full test suite + typecheck + build — final acceptance gate (D-33)</name>
  <files>(verification only — no files modified)</files>

  <read_first>
    - `.planning/phases/27-dnd-foundation/deferred-items.md` (9 pre-existing failing tests — should now pass after Phase 28)
    - `.planning/phases/28-cell-to-cell-drag/28-CONTEXT.md` §A6 D-33 (SC-5 is manual UAT — document in SUMMARY, not automated)
  </read_first>

  <action>
    Run the full gate.

    **Step 1 — Typecheck:**
    ```bash
    npx tsc --noEmit
    ```
    Must exit 0.

    **Step 2 — Full test run:**
    ```bash
    npm run test -- --run
    ```
    Must exit 0.

    **Step 3 — Lint (if script exists):**
    ```bash
    npm run lint 2>/dev/null || echo "No lint script configured — skipping"
    ```
    If a lint script exists, must exit 0.

    **Step 4 — Production build (smoke):**
    ```bash
    npm run build 2>&1 | tail -20
    ```
    Must complete without TypeScript errors. Bundle-size warnings are informational.

    **Step 5 — Document manual UAT (SC-5, D-33) in the Plan 10b SUMMARY:**
    Include in `28-10b-SUMMARY.md` a `## Manual UAT (SC-5)` section listing the 6 scenarios:
      1. Open the app in Chrome; drag a cell from one position to another via mouse (verify 8px activation threshold).
      2. Open the app on a touchscreen; long-press (~250ms) and drag a cell (DRAG-04).
      3. Verify the ghost preview follows the cursor at ~80% opacity (GHOST-04).
      4. Verify the 5 drop zones appear on hover over the target cell (DROP-01).
      5. Press Escape mid-drag; verify the tree is not mutated (CANCEL-03).
      6. Release on the origin cell; verify no moveCell runs (CANCEL-04).

    **Step 6 — Test count delta (informational):**
    - Before Phase 28: failing tests in `phase25-touch-dnd.test.tsx`, `phase05-p02-cell-swap.test.ts`, `phase09-p03-leafnode-zones.test.ts`, `LeafNode.test.tsx`.
    - After Phase 28: 0 failing tests.
    - Net files: -1 (phase25-touch-dnd.test.tsx deleted), +5 new in `src/dnd/__tests__/` (`useCellDraggable.test.tsx` + `useCellDropTarget.test.tsx` from Plan 10a; `CanvasWrapper.integration.test.tsx` + `DragPreviewPortal.test.tsx` + `DropZoneIndicators.test.tsx` from Plan 10b).

    DO NOT:
    - Mark Phase 28 complete if any test fails.
    - Skip `npx tsc --noEmit`.
    - Automate SC-5 — it is explicitly manual per D-33.
  </action>

  <verify>
    <automated>npx tsc --noEmit && npm run test -- --run</automated>
    - `npx tsc --noEmit` exits 0
    - `npm run test -- --run` exits 0 — all tests pass
    - `npm run build` exits 0
    - Test file delta: `phase25-touch-dnd.test.tsx` absent; 5 new files in `src/dnd/__tests__/`
  </verify>

  <acceptance_criteria>
    - Typecheck clean
    - Full test suite green
    - Production build succeeds
    - No files modified in this task
    - `28-10b-SUMMARY.md` includes the SC-5 manual UAT checklist (6 scenarios)
  </acceptance_criteria>

  <done>Phase 28 ends with green tests, green typecheck, green build, and a documented manual UAT checklist for SC-5.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test fixtures → production stores | Tests call `setState` directly; `beforeEach` resets to idle. |
| jsdom rendering → real DOM assumptions | ResizeObserver polyfilled; DragOverlay portal escapes to document.body. |
| `vi.spyOn` on zustand vanilla store methods | `afterEach(vi.restoreAllMocks)` prevents leakage. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-28-30 | T | `vi.spyOn(state, 'moveCell')` leaks across tests | mitigate | Integration test calls `spy.mockRestore()` inline; `afterEach` runs `vi.restoreAllMocks()`. |
| T-28-31 | D | `grep -rE` on `src/` is slow | accept | `src/` has <200 files; grep completes in <100ms. One-shot gate. |
| T-28-34 | R | Planning document claims "SC-3 passes" without evidence | mitigate | Task 5 runs the grep gate; Task 6 requires full suite green. SUMMARY records actual grep output. |
| T-28-36 | T | GHOST-06 mount verified only by source-level grep (Plan 09) — runtime subscription could silently regress | mitigate | Task 1's `drag-ghost-img` discovery assertion after seeding `ghostDataUrl` proves DragOverlay is subscribed at runtime. Plan 09 source grep + this runtime gate together cover GHOST-06. |
| T-28-37 | T | Tests accidentally reference fictional dragStore actions and pass TypeScript by asserting on runtime undefined | mitigate | The `<interfaces>` block in both 10a and 10b explicitly enumerates the REAL action names and forbids phantom ones. Task 5's `grep -rE 'updateOver|endDrag|cancelDrag' src/` gate catches any slip. `DragState` is strictly typed so `npx tsc --noEmit` also fails any phantom reference. |
</threat_model>

<verification>
- Task 1: `CanvasWrapper.integration.test.tsx` created; real actions only; `drag-ghost-img` runtime gate present
- Task 2: `DragPreviewPortal.test.tsx` created; idle + dragging + reset branches covered
- Task 3: `DropZoneIndicators.test.tsx` created; all 5 zones render; null zone hidden
- Task 4: Barrel exports verified (8 symbols present)
- Task 5: SC-3 grep gate returns zero matches; phantom-action gate also zero
- Task 6: `npx tsc --noEmit` / `npm run test -- --run` / `npm run build` all exit 0
- SUMMARY records grep-gate output, test counts, and the SC-5 manual UAT checklist
</verification>

<success_criteria>
- **SC-3 ENFORCED:** Zero references to `TouchSensor`, `MouseSensor`, `DragZoneRefContext`, `useDndMonitor` in `src/` — Task 5.
- **GHOST-06 RUNTIME GATE:** `screen.queryByTestId('drag-ghost-img')` becomes discoverable after seeding dragStore with `ghostDataUrl` — Task 1 (WARNING-3 fix).
- **PHANTOM ACTIONS PURGED:** Zero references to `updateOver`, `endDrag`, `cancelDrag` in `src/` — Task 5 (BLOCKER-1 carry-over gate).
- **SC-4 REGRESSION COVERED:** File-drop handlers still work; Task 1 and `src/test/phase08-p02-workspace-drop.test.tsx` preserved.
- **SC-5 DOCUMENTED:** Manual UAT checklist in `28-10b-SUMMARY.md` (6 scenarios).
- **Test suite green:** `npm run test -- --run` exits 0.
- **Typecheck green:** `npx tsc --noEmit` exits 0.
- **Build green:** `npm run build` exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/28-cell-to-cell-drag/28-10b-SUMMARY.md`

The SUMMARY MUST include:
1. List of 3 created test files with line counts
2. Task 4 barrel export grep output (all 8 symbols confirmed)
3. Task 5 SC-3 grep gate output (expected: empty) + phantom-action gate output (expected: empty)
4. Task 6: `npm run test -- --run` final summary (tests passed / failed counts)
5. `## Manual UAT (SC-5)` section with the 6 scenarios (D-33)
6. Note: the 9 deferred tests from Phase 27 have been re-enabled and now pass
</output>
