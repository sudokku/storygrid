/**
 * phase09-p03-leafnode-zones.test.ts
 *
 * Integration tests for LeafNode 5-zone hit detection + overlay rendering +
 * moveCell dispatch during cell-to-cell drag. Covers D-01, D-02, D-04, EC-11,
 * EC-12 from .planning/phases/09-improve-cell-movement-and-swapping/09-CONTEXT.md.
 *
 * These tests render <LeafNodeComponent> directly, mock getBoundingClientRect
 * to a deterministic 400x400 rect so zone math is reproducible, and use
 * fireEvent.dragOver/drop with a synthetic dataTransfer including
 * 'text/cell-id' to simulate a cell-drag from another leaf.
 *
 * Testid contract (satisfied by Task 2 in LeafNode.tsx):
 *   edge-line-top-{id}
 *   edge-line-bottom-{id}
 *   edge-line-left-{id}
 *   edge-line-right-{id}
 *   swap-overlay-{id}
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, createEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { LeafNodeComponent } from '../Grid/LeafNode';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { LeafNode, GridNode } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAF_ID = 'leaf-target';
const SOURCE_ID = 'source-leaf-id';

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
    ...overrides,
  };
}

function setGridState(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({ root, mediaRegistry: registry, history: [{ root }], historyIndex: 0 });
}

/** Build a minimal DataTransfer-ish object with the given types + getData map. */
function makeDataTransfer(types: string[], data: Record<string, string> = {}) {
  return {
    types,
    getData: (k: string) => data[k] ?? '',
    setData: () => {},
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    dropEffect: 'none',
    effectAllowed: 'all',
  };
}

// 400x400 deterministic rect mock
let rectMock: ReturnType<typeof vi.fn>;
function mockRect(width: number, height: number) {
  const rect = {
    x: 0, y: 0,
    left: 0, top: 0,
    right: width, bottom: height,
    width, height,
    toJSON: () => ({}),
  };
  rectMock = vi.fn(() => rect);
  Element.prototype.getBoundingClientRect = rectMock as unknown as typeof Element.prototype.getBoundingClientRect;
}

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({
    selectedNodeId: null,
    panModeNodeId: null,
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
  return render(React.createElement(LeafNodeComponent, { id: LEAF_ID }));
}

/**
 * jsdom's DragEvent does not honor MouseEventInit fields (clientX/Y end up as 0).
 * Workaround: build the event normally, then defineProperty the coordinates before
 * dispatching. DataTransfer is also patched directly because jsdom lacks DataTransfer.
 */
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
  // createEvent already sets dataTransfer; ensure it is our mock (not wrapped into jsdom's).
  Object.defineProperty(event, 'dataTransfer', { value: dt });
  fireEvent(el, event);
}

function fireCellDragOver(el: Element, clientX: number, clientY: number) {
  fireDragEventWithCoords(
    'dragOver',
    el,
    clientX,
    clientY,
    makeDataTransfer(['text/cell-id'], { 'text/cell-id': SOURCE_ID }),
  );
}

function fireCellDrop(el: Element, clientX: number, clientY: number, fromId = SOURCE_ID) {
  fireDragEventWithCoords(
    'drop',
    el,
    clientX,
    clientY,
    makeDataTransfer(['text/cell-id'], { 'text/cell-id': fromId }),
  );
}

// ---------------------------------------------------------------------------
// Zone detection
// ---------------------------------------------------------------------------

describe('LeafNode 5-zone detection (D-01)', () => {
  it('ZONE-01: top zone detected at y < threshold shows edge-line-top', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 200, 10);
    expect(screen.getByTestId(`edge-line-top-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-02: bottom zone detected at y > h - threshold shows edge-line-bottom', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 200, 390);
    expect(screen.getByTestId(`edge-line-bottom-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-03: left zone detected at x < threshold shows edge-line-left', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 10, 200);
    expect(screen.getByTestId(`edge-line-left-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-04: right zone detected at x > w - threshold shows edge-line-right', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 390, 200);
    expect(screen.getByTestId(`edge-line-right-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-05: center zone detected in middle region shows swap-overlay', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 200, 200);
    expect(screen.getByTestId(`swap-overlay-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-06: only one zone is active at a time (moving from top to center)', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 200, 10);
    expect(screen.getByTestId(`edge-line-top-${LEAF_ID}`)).toBeInTheDocument();
    // Move to center
    fireCellDragOver(leafEl, 200, 200);
    expect(screen.queryByTestId(`edge-line-top-${LEAF_ID}`)).toBeNull();
    expect(screen.getByTestId(`swap-overlay-${LEAF_ID}`)).toBeInTheDocument();
  });

  it('ZONE-07: dragLeave clears all overlays', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);
    fireCellDragOver(leafEl, 200, 10);
    expect(screen.getByTestId(`edge-line-top-${LEAF_ID}`)).toBeInTheDocument();
    fireEvent.dragLeave(leafEl);
    expect(screen.queryByTestId(`edge-line-top-${LEAF_ID}`)).toBeNull();
    expect(screen.queryByTestId(`swap-overlay-${LEAF_ID}`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Drop dispatch
// ---------------------------------------------------------------------------

describe('LeafNode drop dispatch via moveCell (D-04)', () => {
  it('ZONE-08: dropping on top edge dispatches moveCell with edge="top"', () => {
    const moveCellMock = vi.fn();
    useGridStore.setState({ moveCell: moveCellMock });

    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);

    fireCellDragOver(leafEl, 200, 10);
    fireCellDrop(leafEl, 200, 10);

    expect(moveCellMock).toHaveBeenCalledTimes(1);
    expect(moveCellMock).toHaveBeenCalledWith(SOURCE_ID, LEAF_ID, 'top');
  });

  it('ZONE-09: dropping on center dispatches moveCell with edge="center" (NOT swapCells directly)', () => {
    const moveCellMock = vi.fn();
    const swapCellsMock = vi.fn();
    useGridStore.setState({ moveCell: moveCellMock, swapCells: swapCellsMock });

    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);

    fireCellDragOver(leafEl, 200, 200);
    fireCellDrop(leafEl, 200, 200);

    expect(moveCellMock).toHaveBeenCalledTimes(1);
    expect(moveCellMock).toHaveBeenCalledWith(SOURCE_ID, LEAF_ID, 'center');
    expect(swapCellsMock).not.toHaveBeenCalled();
  });

  it('ZONE-11: dropping cell onto itself is a no-op (moveCell NOT called)', () => {
    const moveCellMock = vi.fn();
    useGridStore.setState({ moveCell: moveCellMock });

    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);

    fireCellDragOver(leafEl, 200, 200);
    fireCellDrop(leafEl, 200, 200, LEAF_ID);

    expect(moveCellMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// File-drop coexistence (EC-12 regression guard)
// ---------------------------------------------------------------------------

describe('LeafNode file drop coexistence (EC-12)', () => {
  it('ZONE-10: file drag (dataTransfer.types=["Files"]) does NOT render 5-zone overlays', () => {
    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);

    fireDragEventWithCoords('dragOver', leafEl, 200, 10, makeDataTransfer(['Files']));

    // None of the 5-zone overlays should appear.
    expect(screen.queryByTestId(`edge-line-top-${LEAF_ID}`)).toBeNull();
    expect(screen.queryByTestId(`edge-line-bottom-${LEAF_ID}`)).toBeNull();
    expect(screen.queryByTestId(`edge-line-left-${LEAF_ID}`)).toBeNull();
    expect(screen.queryByTestId(`edge-line-right-${LEAF_ID}`)).toBeNull();
    expect(screen.queryByTestId(`swap-overlay-${LEAF_ID}`)).toBeNull();
    // Existing file-drop indicator path still fires (isDragOver).
    expect(screen.getByTestId(`drop-target-${LEAF_ID}`)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Small-cell minimum pixel band (D-01: "must be tuned so small cells remain usable")
// ---------------------------------------------------------------------------

describe('LeafNode small-cell minimum band (D-01)', () => {
  it('ZONE-12: on a 60x60 cell, 20px minimum band still catches top edge at y=15, center at y=30/x=30', () => {
    mockRect(60, 60);

    renderTargetLeaf();
    const leafEl = screen.getByTestId(`leaf-${LEAF_ID}`);

    fireCellDragOver(leafEl, 30, 15);
    expect(screen.getByTestId(`edge-line-top-${LEAF_ID}`)).toBeInTheDocument();

    fireCellDragOver(leafEl, 30, 30);
    expect(screen.getByTestId(`swap-overlay-${LEAF_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`edge-line-top-${LEAF_ID}`)).toBeNull();
  });
});
