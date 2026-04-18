/**
 * dragStore — state-transition tests (Plan 27-03, extended in Plan 28-01)
 *
 * Covers: initial state, beginCellDrag, setOver, end,
 *         cross-cycle isolation, middleware-absence assertions,
 *         action reference stability, and ghost field behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDragStore } from './dragStore';

// ---------------------------------------------------------------------------
// Reset to initial state before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  useDragStore.setState({
    status: 'idle',
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
    ghostUrl: null,
    sourceW: 0,
    sourceH: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    lastDropId: null,
  });
});

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------
describe('dragStore — initial state', () => {
  it('status is idle', () => {
    expect(useDragStore.getState().status).toBe('idle');
  });

  it('kind is null', () => {
    expect(useDragStore.getState().kind).toBeNull();
  });

  it('sourceId is null', () => {
    expect(useDragStore.getState().sourceId).toBeNull();
  });

  it('overId is null', () => {
    expect(useDragStore.getState().overId).toBeNull();
  });

  it('activeZone is null', () => {
    expect(useDragStore.getState().activeZone).toBeNull();
  });

  it('ghostUrl is null', () => {
    expect(useDragStore.getState().ghostUrl).toBeNull();
  });

  it('sourceW is 0', () => {
    expect(useDragStore.getState().sourceW).toBe(0);
  });

  it('sourceH is 0', () => {
    expect(useDragStore.getState().sourceH).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. beginCellDrag
// ---------------------------------------------------------------------------
describe('dragStore — beginCellDrag', () => {
  it('sets status to dragging, kind to cell, sourceId to provided id, overId/activeZone null', () => {
    useDragStore.getState().beginCellDrag('leaf-abc', 'data:image/png;base64,iVBORw0KG', 200, 300);
    const state = useDragStore.getState();
    expect(state.status).toBe('dragging');
    expect(state.kind).toBe('cell');
    expect(state.sourceId).toBe('leaf-abc');
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });

  it('resets overId and activeZone to null even if a previous setOver left them populated (defensive clean start)', () => {
    useDragStore.getState().beginCellDrag('leaf-first', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('leaf-prev', 'top');
    // Now begin a new drag without calling end() first
    useDragStore.getState().beginCellDrag('leaf-xyz', 'data:image/png;base64,iVBORw0KG', 200, 300);
    const state = useDragStore.getState();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
    expect(state.sourceId).toBe('leaf-xyz');
  });

  it('does not mutate gridStore (gridStore.getState().root before and after must be identical)', async () => {
    const { useGridStore } = await import('../store/gridStore');
    const rootBefore = useGridStore.getState().root;
    useDragStore.getState().beginCellDrag('leaf-abc', null, 0, 0);
    const rootAfter = useGridStore.getState().root;
    expect(rootAfter).toBe(rootBefore);
  });
});

// ---------------------------------------------------------------------------
// 3. setOver
// ---------------------------------------------------------------------------
describe('dragStore — setOver', () => {
  it('updates overId and activeZone, leaves status/kind/sourceId unchanged', () => {
    useDragStore.getState().beginCellDrag('src', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('tgt', 'top');
    const state = useDragStore.getState();
    expect(state.overId).toBe('tgt');
    expect(state.activeZone).toBe('top');
    expect(state.status).toBe('dragging');
    expect(state.kind).toBe('cell');
    expect(state.sourceId).toBe('src');
  });

  it('setOver(null, null) clears over fields without changing status/kind/sourceId', () => {
    useDragStore.getState().beginCellDrag('src', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('tgt', 'right');
    useDragStore.getState().setOver(null, null);
    const state = useDragStore.getState();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
    expect(state.status).toBe('dragging');
    expect(state.kind).toBe('cell');
    expect(state.sourceId).toBe('src');
  });

  it('calling setOver twice in a row leaves state identical to one call (idempotent)', () => {
    useDragStore.getState().beginCellDrag('src', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('tgt', 'right');
    const stateAfterFirst = { ...useDragStore.getState() };
    useDragStore.getState().setOver('tgt', 'right');
    const stateAfterSecond = useDragStore.getState();
    expect(stateAfterSecond.overId).toBe(stateAfterFirst.overId);
    expect(stateAfterSecond.activeZone).toBe(stateAfterFirst.activeZone);
    expect(stateAfterSecond.status).toBe(stateAfterFirst.status);
    expect(stateAfterSecond.kind).toBe(stateAfterFirst.kind);
    expect(stateAfterSecond.sourceId).toBe(stateAfterFirst.sourceId);
  });

  it('setOver BEFORE beginCellDrag (status=idle) still updates the over fields', () => {
    // No status guard — caller is responsible for ordering
    useDragStore.getState().setOver('tgt', 'bottom');
    const state = useDragStore.getState();
    expect(state.overId).toBe('tgt');
    expect(state.activeZone).toBe('bottom');
    // status/kind/sourceId remain at initial values
    expect(state.status).toBe('idle');
    expect(state.kind).toBeNull();
    expect(state.sourceId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. end
// ---------------------------------------------------------------------------
describe('dragStore — end', () => {
  it('after beginCellDrag + setOver, resets ALL five fields to initial values', () => {
    useDragStore.getState().beginCellDrag('leaf-a', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('leaf-b', 'left');
    useDragStore.getState().end();
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.kind).toBeNull();
    expect(state.sourceId).toBeNull();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });

  it('calling end() from idle is a no-op — state remains at initial', () => {
    useDragStore.getState().end();
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.kind).toBeNull();
    expect(state.sourceId).toBeNull();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });

  it('calling end() twice is idempotent', () => {
    useDragStore.getState().beginCellDrag('leaf-a', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().end();
    useDragStore.getState().end();
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.kind).toBeNull();
    expect(state.sourceId).toBeNull();
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-cycle isolation (no state leak)
// ---------------------------------------------------------------------------
describe('dragStore — cross-cycle isolation (no state leak)', () => {
  const INITIAL = {
    status: 'idle' as const,
    kind: null,
    sourceId: null,
    overId: null,
    activeZone: null,
  };

  it('3 full cycles each leave state at initial after end()', () => {
    for (let i = 0; i < 3; i++) {
      useDragStore.getState().beginCellDrag(`leaf-${i}`, 'data:image/png;base64,iVBORw0KG', 200, 300);
      useDragStore.getState().setOver(`target-${i}`, 'top');
      useDragStore.getState().end();
      const state = useDragStore.getState();
      expect(state.status).toBe(INITIAL.status);
      expect(state.kind).toBe(INITIAL.kind);
      expect(state.sourceId).toBe(INITIAL.sourceId);
      expect(state.overId).toBe(INITIAL.overId);
      expect(state.activeZone).toBe(INITIAL.activeZone);
    }
  });

  it('100 cycles programmatically — final state matches initial', () => {
    for (let i = 0; i < 100; i++) {
      useDragStore.getState().beginCellDrag(`leaf-${i}`, 'data:image/png;base64,iVBORw0KG', 200, 300);
      useDragStore.getState().setOver(`target-${i}`, 'center');
      useDragStore.getState().end();
    }
    const state = useDragStore.getState();
    expect(state.status).toBe(INITIAL.status);
    expect(state.kind).toBe(INITIAL.kind);
    expect(state.sourceId).toBe(INITIAL.sourceId);
    expect(state.overId).toBe(INITIAL.overId);
    expect(state.activeZone).toBe(INITIAL.activeZone);
  });

  it('partial cycle: second beginCellDrag (no end() between) reflects second drag cleanly', () => {
    useDragStore.getState().beginCellDrag('leaf-first', 'data:image/png;base64,iVBORw0KG', 200, 300);
    useDragStore.getState().setOver('leaf-over', 'right');
    // No end() — simulate interrupted drag
    useDragStore.getState().beginCellDrag('leaf-second', 'data:image/png;base64,iVBORw0KG', 400, 600);
    const state = useDragStore.getState();
    // Should reflect second drag, not a merge
    expect(state.sourceId).toBe('leaf-second');
    expect(state.kind).toBe('cell');
    expect(state.status).toBe('dragging');
    // overId and activeZone should be reset (defensive clean start)
    expect(state.overId).toBeNull();
    expect(state.activeZone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. No Immer middleware (DND-02 architecture assertion)
// ---------------------------------------------------------------------------
describe('dragStore — no Immer middleware (DND-02 architecture assertion)', () => {
  it('dragStore.ts source does not import or reference Immer', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/dnd/dragStore.ts', 'utf-8');
    expect(src).not.toMatch(/immer/i);
  });
});

// ---------------------------------------------------------------------------
// 7. No persist middleware (ephemeral guarantee)
// ---------------------------------------------------------------------------
describe('dragStore — no persist middleware (ephemeral guarantee)', () => {
  it('dragStore.ts source does not import or reference persist middleware', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/dnd/dragStore.ts', 'utf-8');
    expect(src).not.toMatch(/persist/i);
  });
});

// ---------------------------------------------------------------------------
// 8. Action reference stability
// ---------------------------------------------------------------------------
describe('dragStore — action references are stable across ticks (selector reference equality)', () => {
  it('end() function reference is stable — reading getState() twice returns the same reference', () => {
    const ref1 = useDragStore.getState().end;
    const ref2 = useDragStore.getState().end;
    expect(ref1).toBe(ref2);
  });

  it('beginCellDrag function reference is stable', () => {
    const ref1 = useDragStore.getState().beginCellDrag;
    const ref2 = useDragStore.getState().beginCellDrag;
    expect(ref1).toBe(ref2);
  });

  it('setOver function reference is stable', () => {
    const ref1 = useDragStore.getState().setOver;
    const ref2 = useDragStore.getState().setOver;
    expect(ref1).toBe(ref2);
  });
});

// ---------------------------------------------------------------------------
// 9. Ghost field behavior (Plan 28-01)
// ---------------------------------------------------------------------------
describe('dragStore — ghost field behavior', () => {
  it('beginCellDrag populates ghostUrl, sourceW, sourceH alongside other fields', () => {
    useDragStore
      .getState()
      .beginCellDrag('leaf-1', 'data:image/png;base64,XXX', 100, 200);
    const state = useDragStore.getState();
    expect(state.ghostUrl).toBe('data:image/png;base64,XXX');
    expect(state.sourceW).toBe(100);
    expect(state.sourceH).toBe(200);
    expect(state.sourceId).toBe('leaf-1');
    expect(state.status).toBe('dragging');
    expect(state.kind).toBe('cell');
  });

  it('beginCellDrag with null ghostUrl and zero dimensions is accepted (ghost capture may fail)', () => {
    useDragStore.getState().beginCellDrag('leaf-1', null, 0, 0);
    const state = useDragStore.getState();
    expect(state.ghostUrl).toBeNull();
    expect(state.sourceW).toBe(0);
    expect(state.sourceH).toBe(0);
    expect(state.status).toBe('dragging');
  });

  it('end() resets ghostUrl to null, sourceW to 0, sourceH to 0', () => {
    useDragStore
      .getState()
      .beginCellDrag('leaf-1', 'data:image/png;base64,XXX', 100, 200);
    useDragStore.getState().end();
    const state = useDragStore.getState();
    expect(state.ghostUrl).toBeNull();
    expect(state.sourceW).toBe(0);
    expect(state.sourceH).toBe(0);
  });

  it('setOver does NOT mutate ghostUrl/sourceW/sourceH (they retain values from beginCellDrag)', () => {
    useDragStore
      .getState()
      .beginCellDrag('leaf-1', 'data:image/png;base64,XXX', 100, 200);
    useDragStore.getState().setOver('leaf-2', 'top');
    const state = useDragStore.getState();
    // Ghost fields unchanged by setOver
    expect(state.ghostUrl).toBe('data:image/png;base64,XXX');
    expect(state.sourceW).toBe(100);
    expect(state.sourceH).toBe(200);
    // Over fields updated
    expect(state.overId).toBe('leaf-2');
    expect(state.activeZone).toBe('top');
  });
});

// ---------------------------------------------------------------------------
// 10. Pointer-down fields (D-02)
// ---------------------------------------------------------------------------
describe('dragStore — pointer down fields (D-02)', () => {
  it('setPointerDown(x, y) sets pointerDownX and pointerDownY', () => {
    useDragStore.getState().setPointerDown(120, 340);
    expect(useDragStore.getState().pointerDownX).toBe(120);
    expect(useDragStore.getState().pointerDownY).toBe(340);
  });

  it('setPointerDown updates independently from drag lifecycle fields', () => {
    useDragStore.getState().setPointerDown(50, 75);
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.sourceId).toBeNull();
    expect(state.pointerDownX).toBe(50);
    expect(state.pointerDownY).toBe(75);
  });

  it('end() resets pointerDownX and pointerDownY to 0', () => {
    useDragStore.getState().setPointerDown(100, 200);
    useDragStore.getState().end();
    expect(useDragStore.getState().pointerDownX).toBe(0);
    expect(useDragStore.getState().pointerDownY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. lastDropId / drop flash (D-08)
// ---------------------------------------------------------------------------
describe('dragStore — lastDropId / drop flash (D-08)', () => {
  it('setLastDrop(id) sets lastDropId', () => {
    useDragStore.getState().setLastDrop('leaf-42');
    expect(useDragStore.getState().lastDropId).toBe('leaf-42');
  });

  it('clearLastDrop() sets lastDropId to null', () => {
    useDragStore.getState().setLastDrop('leaf-42');
    useDragStore.getState().clearLastDrop();
    expect(useDragStore.getState().lastDropId).toBeNull();
  });

  it('end() resets lastDropId to null', () => {
    useDragStore.getState().setLastDrop('leaf-99');
    useDragStore.getState().end();
    expect(useDragStore.getState().lastDropId).toBeNull();
  });

  it('setLastDrop does not affect status, sourceId, or other lifecycle fields', () => {
    useDragStore.getState().setLastDrop('leaf-7');
    const state = useDragStore.getState();
    expect(state.status).toBe('idle');
    expect(state.sourceId).toBeNull();
    expect(state.lastDropId).toBe('leaf-7');
  });
});
