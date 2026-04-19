/**
 * Tests for CanvasWrapper drag side-effects — Phase 30
 * Requirements: CROSS-04 (userSelect), CROSS-05 (contextmenu listener),
 *               CROSS-06 (vibrate on drag-start), CROSS-07 (vibrate on drop)
 *
 * Strategy: these are it.todo stubs (Wave 0). Once CanvasWrapper.tsx is updated
 * in Wave 1 (Plan 30-03), these stubs will be fleshed out into real tests in
 * Plan 30-04.
 *
 * Using it.todo means vitest shows these as "todo" (not failures), which is
 * the correct Wave 0 behavior.
 */

import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { useDragStore } from '../dnd/dragStore';
import { useEditorStore } from '../store/editorStore';

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
  useEditorStore.setState({ sheetSnapState: 'collapsed' });
  document.body.style.userSelect = '';
  vi.stubGlobal('navigator', { ...navigator, vibrate: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.userSelect = '';
});

describe('CanvasWrapper — CROSS-04: user-select on drag lifecycle', () => {
  it.todo('sets document.body.style.userSelect to "none" on drag-start');
  it.todo('restores document.body.style.userSelect to "" on drag-end');
  it.todo('restores document.body.style.userSelect to "" on drag-cancel');
});

describe('CanvasWrapper — CROSS-05: contextmenu suppression', () => {
  it.todo('attaches contextmenu capture listener on drag-start');
  it.todo('removes contextmenu capture listener on drag-end');
  it.todo('removes contextmenu capture listener on drag-cancel');
  it.todo('suppressContextMenu calls e.preventDefault()');
});

describe('CanvasWrapper — CROSS-06: vibrate(10) on drag activation', () => {
  it.todo('calls navigator.vibrate(10) on successful drag-start');
});

describe('CanvasWrapper — CROSS-07: vibrate(15) on successful drop', () => {
  it.todo('calls navigator.vibrate(15) on successful cell move drop');
  it.todo('does NOT call navigator.vibrate(15) on same-cell drop (cancel)');
});
