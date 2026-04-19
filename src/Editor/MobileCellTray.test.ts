/**
 * Tests for MobileCellTray — Phase 30
 * Requirements: D-03 (drag visibility), CROSS-08a (tray opacity on drag)
 *
 * The first concrete test (opacity 1 when not dragging) is GREEN immediately.
 * The remaining it.todo stubs turn into real tests in Plan 30-04 once
 * Wave 2 (Plan 30-05) adds useDragStore integration to MobileCellTray.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { MobileCellTray } from './MobileCellTray';
import { useDragStore } from '../dnd/dragStore';
import { useEditorStore } from '../store/editorStore';

// Mock lucide-react icons to avoid SVG rendering noise
vi.mock('lucide-react', () => ({
  Upload: () => React.createElement('span', { 'data-testid': 'icon-upload' }),
  SplitSquareHorizontal: () => React.createElement('span'),
  SplitSquareVertical: () => React.createElement('span'),
  Maximize2: () => React.createElement('span'),
  Minimize2: () => React.createElement('span'),
  ImageOff: () => React.createElement('span'),
}));

// Mock useGridStore — MobileCellTray reads split, updateCell, removeMedia, addMedia, setMedia, fit, mediaId
vi.mock('../store/gridStore', () => ({
  useGridStore: vi.fn((selector: (s: unknown) => unknown) => {
    const mockState = {
      split: vi.fn(),
      updateCell: vi.fn(),
      removeMedia: vi.fn(),
      addMedia: vi.fn(),
      setMedia: vi.fn(),
      root: { id: 'root', type: 'container', children: [], direction: 'horizontal', weights: [] },
    };
    return selector(mockState);
  }),
}));

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
    prevSheetSnapState: null,
  });
  useEditorStore.setState({ selectedNodeId: 'cell-1', sheetSnapState: 'collapsed' });
});

describe('MobileCellTray — CROSS-08a: drag visibility (D-03)', () => {
  it('is visible (opacity 1) when not dragging and selectedNodeId is set', () => {
    useDragStore.setState({ status: 'idle' });
    const { getByTestId } = render(React.createElement(MobileCellTray));
    const el = getByTestId('mobile-cell-tray');
    expect(el.style.opacity).toBe('1');
    expect(el.style.pointerEvents).toBe('auto');
  });

  it('opacity is "0" when dragStore.status is "dragging" (D-03, CROSS-08a)', () => {
    useDragStore.setState({ status: 'dragging' });
    const { getByTestId } = render(React.createElement(MobileCellTray));
    const el = getByTestId('mobile-cell-tray');
    expect(el.style.opacity).toBe('0');
  });

  it('pointerEvents is "none" when dragStore.status is "dragging" (D-03)', () => {
    useDragStore.setState({ status: 'dragging' });
    const { getByTestId } = render(React.createElement(MobileCellTray));
    const el = getByTestId('mobile-cell-tray');
    expect(el.style.pointerEvents).toBe('none');
  });

  it('opacity restores to "1" after drag ends with selectedNodeId still set', () => {
    useDragStore.setState({ status: 'dragging' });
    const { getByTestId, rerender } = render(React.createElement(MobileCellTray));
    // End drag — wrap in act to flush React state updates
    act(() => {
      useDragStore.setState({ status: 'idle' });
    });
    rerender(React.createElement(MobileCellTray));
    const el = getByTestId('mobile-cell-tray');
    expect(el.style.opacity).toBe('1');
  });
});
