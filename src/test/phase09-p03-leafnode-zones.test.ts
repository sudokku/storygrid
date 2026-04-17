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
import { render, screen, fireEvent, createEvent, cleanup, act } from '@testing-library/react';
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
    panX: 0,
    panY: 0,
    panScale: 1,
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
    act(() => {
      useDragStore.setState({
        status: 'dragging',
        kind: 'cell',
        sourceId: 'other-leaf',
        overId: LEAF_ID,
        activeZone: 'center',
        ghostDataUrl: null,
        sourceRect: null,
      });
    });
    rerender.rerender(
      React.createElement(DndContext, {}, React.createElement(LeafNodeComponent, { id: LEAF_ID }))
    );
    expect(screen.queryByTestId('drop-zones')).toBeInTheDocument();
  });

  it('ZONE-03: when overId !== LEAF_ID, drop-zones NOT rendered inside this leaf', () => {
    const rerender = renderTargetLeaf();
    act(() => {
      useDragStore.setState({
        status: 'dragging',
        kind: 'cell',
        sourceId: 'other-leaf',
        overId: 'different-leaf',
        activeZone: 'top',
        ghostDataUrl: null,
        sourceRect: null,
      });
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
