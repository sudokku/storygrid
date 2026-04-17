/**
 * dragStore tests (REQ: DND-02).
 *
 * Covers every state transition of the ephemeral drag store:
 *   - initial state
 *   - beginCellDrag
 *   - setOver
 *   - end
 *   - cross-cycle isolation (no state leak across repeated drags)
 *   - middleware-absence assertions (NO Immer, NO persist)
 *   - action-reference stability
 *
 * Also spot-verifies that gridStore.root is NOT mutated when drag-store
 * actions fire — the whole point of DND-02 is that drag state lives OUTSIDE
 * gridStore's undo history.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useDragStore } from './dragStore';
import { useGridStore } from '../store/gridStore';

const INITIAL = {
  status: 'idle' as const,
  kind: null,
  sourceId: null,
  overId: null,
  activeZone: null,
};

beforeEach(() => {
  // Reset store to initial shape before every test — guarantees isolation.
  useDragStore.setState({ ...INITIAL });
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
});

// ---------------------------------------------------------------------------
// 2. beginCellDrag
// ---------------------------------------------------------------------------

describe('dragStore — beginCellDrag', () => {
  it('transitions status idle → dragging and sets kind+sourceId', () => {
    useDragStore.getState().beginCellDrag('leaf-abc');
    const s = useDragStore.getState();
    expect(s.status).toBe('dragging');
    expect(s.kind).toBe('cell');
    expect(s.sourceId).toBe('leaf-abc');
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });

  it('resets overId and activeZone to null even if previously set (defensive clean start)', () => {
    // Seed overId/activeZone from a prior cycle — beginCellDrag must wipe them.
    useDragStore.getState().setOver('leaf-prev', 'top');
    expect(useDragStore.getState().overId).toBe('leaf-prev');
    expect(useDragStore.getState().activeZone).toBe('top');

    useDragStore.getState().beginCellDrag('leaf-xyz');
    const s = useDragStore.getState();
    expect(s.sourceId).toBe('leaf-xyz');
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });

  it('does NOT mutate gridStore.root (DND-02 architectural isolation)', () => {
    const rootBefore = useGridStore.getState().root;
    useDragStore.getState().beginCellDrag('leaf-abc');
    useDragStore.getState().setOver('leaf-tgt', 'center');
    useDragStore.getState().end();
    const rootAfter = useGridStore.getState().root;
    // Reference equality: gridStore's root must be literally untouched.
    expect(rootAfter).toBe(rootBefore);
  });
});

// ---------------------------------------------------------------------------
// 3. setOver
// ---------------------------------------------------------------------------

describe('dragStore — setOver', () => {
  it('updates overId and activeZone, leaves status/kind/sourceId untouched', () => {
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'top');
    const s = useDragStore.getState();
    expect(s.overId).toBe('tgt');
    expect(s.activeZone).toBe('top');
    expect(s.status).toBe('dragging');
    expect(s.kind).toBe('cell');
    expect(s.sourceId).toBe('src');
  });

  it('can clear over fields with (null, null) without touching status/kind/sourceId', () => {
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'right');
    useDragStore.getState().setOver(null, null);
    const s = useDragStore.getState();
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
    expect(s.status).toBe('dragging');
    expect(s.kind).toBe('cell');
    expect(s.sourceId).toBe('src');
  });

  it('is idempotent — calling twice with same args equals one call', () => {
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'right');
    const afterOne = { ...useDragStore.getState() };
    useDragStore.getState().setOver('tgt', 'right');
    const afterTwo = { ...useDragStore.getState() };
    expect(afterTwo.overId).toBe(afterOne.overId);
    expect(afterTwo.activeZone).toBe(afterOne.activeZone);
    expect(afterTwo.status).toBe(afterOne.status);
    expect(afterTwo.kind).toBe(afterOne.kind);
    expect(afterTwo.sourceId).toBe(afterOne.sourceId);
  });

  it('works BEFORE beginCellDrag (no status guard — caller controls ordering)', () => {
    // status still 'idle' — setOver must still mutate overId/activeZone
    useDragStore.getState().setOver('tgt', 'bottom');
    const s = useDragStore.getState();
    expect(s.overId).toBe('tgt');
    expect(s.activeZone).toBe('bottom');
    expect(s.status).toBe('idle'); // unchanged
    expect(s.kind).toBeNull();
    expect(s.sourceId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. end
// ---------------------------------------------------------------------------

describe('dragStore — end', () => {
  it('resets all five fields to initial after begin+setOver', () => {
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'left');
    useDragStore.getState().end();
    const s = useDragStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kind).toBeNull();
    expect(s.sourceId).toBeNull();
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });

  it('is a no-op when called from idle', () => {
    useDragStore.getState().end();
    const s = useDragStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kind).toBeNull();
    expect(s.sourceId).toBeNull();
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });

  it('is idempotent — calling twice leaves state at initial', () => {
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'center');
    useDragStore.getState().end();
    useDragStore.getState().end();
    const s = useDragStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kind).toBeNull();
    expect(s.sourceId).toBeNull();
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-cycle isolation (no state leak)
// ---------------------------------------------------------------------------

describe('dragStore — cross-cycle isolation (no state leak)', () => {
  it('runs 3 full cycles and returns to initial after each end()', () => {
    for (let i = 0; i < 3; i++) {
      useDragStore.getState().beginCellDrag(`leaf-${i}`);
      useDragStore.getState().setOver(`tgt-${i}`, 'top');
      useDragStore.getState().end();
      const s = useDragStore.getState();
      expect(s.status).toBe('idle');
      expect(s.kind).toBeNull();
      expect(s.sourceId).toBeNull();
      expect(s.overId).toBeNull();
      expect(s.activeZone).toBeNull();
    }
  });

  it('runs 100 programmatic cycles with final state matching initial', () => {
    for (let i = 0; i < 100; i++) {
      useDragStore.getState().beginCellDrag(`leaf-${i}`);
      useDragStore.getState().setOver(`tgt-${i}`, 'right');
      useDragStore.getState().end();
    }
    const s = useDragStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kind).toBeNull();
    expect(s.sourceId).toBeNull();
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });

  it('beginCellDrag without a prior end() reflects the second drag cleanly (no merge)', () => {
    useDragStore.getState().beginCellDrag('first');
    useDragStore.getState().setOver('tgt-first', 'top');
    // No end() — immediately begin a second drag.
    useDragStore.getState().beginCellDrag('second');
    const s = useDragStore.getState();
    expect(s.status).toBe('dragging');
    expect(s.kind).toBe('cell');
    expect(s.sourceId).toBe('second');
    expect(s.overId).toBeNull();
    expect(s.activeZone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. No Immer middleware (DND-02 architecture assertion)
// ---------------------------------------------------------------------------

describe('dragStore — no Immer middleware (DND-02 architecture assertion)', () => {
  it('source file does NOT import or reference Immer', () => {
    const src = readFileSync(resolve(__dirname, 'dragStore.ts'), 'utf-8');
    expect(src).not.toMatch(/immer/i);
  });
});

// ---------------------------------------------------------------------------
// 7. No persist middleware (ephemeral guarantee)
// ---------------------------------------------------------------------------

describe('dragStore — no persist middleware (ephemeral guarantee)', () => {
  it('source file does NOT import or reference persist middleware', () => {
    const src = readFileSync(resolve(__dirname, 'dragStore.ts'), 'utf-8');
    expect(src).not.toMatch(/persist/i);
  });
});

// ---------------------------------------------------------------------------
// 8. Action-reference stability (selector consumer protection)
// ---------------------------------------------------------------------------

describe('dragStore — action references are stable across ticks', () => {
  it('end function reference is identical across reads', () => {
    const a = useDragStore.getState().end;
    const b = useDragStore.getState().end;
    expect(a).toBe(b);
  });

  it('beginCellDrag function reference is identical across reads', () => {
    const a = useDragStore.getState().beginCellDrag;
    const b = useDragStore.getState().beginCellDrag;
    expect(a).toBe(b);
  });

  it('setOver function reference is identical across reads', () => {
    const a = useDragStore.getState().setOver;
    const b = useDragStore.getState().setOver;
    expect(a).toBe(b);
  });

  it('action references survive a full drag cycle', () => {
    const endBefore = useDragStore.getState().end;
    const beginBefore = useDragStore.getState().beginCellDrag;
    const setOverBefore = useDragStore.getState().setOver;
    useDragStore.getState().beginCellDrag('src');
    useDragStore.getState().setOver('tgt', 'center');
    useDragStore.getState().end();
    expect(useDragStore.getState().end).toBe(endBefore);
    expect(useDragStore.getState().beginCellDrag).toBe(beginBefore);
    expect(useDragStore.getState().setOver).toBe(setOverBefore);
  });
});
