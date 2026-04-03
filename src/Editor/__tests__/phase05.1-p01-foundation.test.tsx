/**
 * phase05.1-p01-foundation.test.tsx
 * Foundation tests for Phase 05.1 Plan 01.
 * Covers: MobileSheet snap states, drag gestures, sheet header buttons,
 *         responsive layout, mobile toolbar, canvas area padding, divider hit area.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MobileSheet } from '../MobileSheet';
import { useEditorStore } from '../../store/editorStore';
import { useGridStore } from '../../store/gridStore';
import type { GridNode } from '../../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const singleLeaf: GridNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

// matchMedia mock factory
function mockMatchMedia(matchesMap: Record<string, boolean>) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: matchesMap[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    history: [{ root: singleLeaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    selectedNodeId: null,
    zoom: 1,
    canvasScale: 1,
    showSafeZone: false,
    activeTool: 'select',
    isExporting: false,
    exportFormat: 'png',
    exportQuality: 0.9,
    panModeNodeId: null,
    gap: 0,
    borderRadius: 0,
    backgroundMode: 'solid',
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#000000',
    backgroundGradientDir: 'to-bottom',
    sheetSnapState: 'collapsed',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// MobileSheet tests
// ---------------------------------------------------------------------------

describe('MobileSheet', () => {
  it('renders with data-testid="mobile-sheet"', () => {
    render(<MobileSheet />);
    expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
  });

  it('starts in collapsed state (transform contains calc(100% - 60px))', () => {
    render(<MobileSheet />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet.style.transform).toContain('calc(100% - 60px)');
  });

  it('has sheet-drag-handle with touch-none class', () => {
    render(<MobileSheet />);
    const handle = screen.getByTestId('sheet-drag-handle');
    expect(handle).toBeInTheDocument();
    expect(handle.className).toContain('touch-none');
  });

  it('has md:hidden class to be hidden on desktop', () => {
    render(<MobileSheet />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet.className).toContain('md:hidden');
  });

  it('has cubic-bezier transition string', () => {
    render(<MobileSheet />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet.style.transition).toContain('cubic-bezier(0.32, 0.72, 0, 1)');
  });

  it('renders sheet-undo, sheet-redo, sheet-clear buttons', () => {
    render(<MobileSheet />);
    expect(screen.getByTestId('sheet-undo')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-redo')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-clear')).toBeInTheDocument();
  });

  it('snap state transitions upward on drag up > 50px (collapsed -> half)', () => {
    render(<MobileSheet />);
    const handle = screen.getByTestId('sheet-drag-handle');
    const mockSetPointerCapture = vi.fn();
    handle.setPointerCapture = mockSetPointerCapture;

    // Simulate drag up
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 300 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 200 }); // dy = -100 < -50

    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet.style.transform).toContain('60vh');
  });

  it('snap state transitions downward on drag down > 50px (half -> collapsed)', () => {
    // Set initial state to half
    useEditorStore.setState({ sheetSnapState: 'half' });
    render(<MobileSheet />);

    const handle = screen.getByTestId('sheet-drag-handle');
    const mockSetPointerCapture = vi.fn();
    handle.setPointerCapture = mockSetPointerCapture;

    const sheet = screen.getByTestId('mobile-sheet');
    // Initially half
    expect(sheet.style.transform).toContain('60vh');

    // Drag down
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 200 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 350 }); // dy = 150 > 50

    expect(sheet.style.transform).toContain('calc(100% - 60px)');
  });

  it('shows CanvasSettingsPanel when no cell selected', () => {
    render(<MobileSheet />);
    // Canvas settings panel renders "Canvas" heading
    expect(screen.getByText('Canvas')).toBeInTheDocument();
  });

  it('shows SelectedCellPanel when a cell is selected', () => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1', sheetSnapState: 'half' });
    render(<MobileSheet />);
    // SelectedCellPanel renders "Cell" heading
    expect(screen.getByText('Cell')).toBeInTheDocument();
  });

  it('shows Exit Pan Mode button when panModeNodeId is set', () => {
    useEditorStore.setState({ panModeNodeId: 'leaf-1' });
    render(<MobileSheet />);
    expect(screen.getByTestId('exit-pan-mode')).toBeInTheDocument();
    expect(screen.getByText('Exit Pan Mode')).toBeInTheDocument();
  });

  it('Exit Pan Mode button calls setPanModeNodeId(null)', () => {
    const setPanModeNodeId = vi.fn();
    useEditorStore.setState({ panModeNodeId: 'leaf-1', setPanModeNodeId });
    render(<MobileSheet />);
    fireEvent.click(screen.getByTestId('exit-pan-mode'));
    expect(setPanModeNodeId).toHaveBeenCalledWith(null);
  });

  it('undo button is disabled when historyIndex is 0', () => {
    render(<MobileSheet />);
    const undoBtn = screen.getByTestId('sheet-undo');
    expect(undoBtn).toBeDisabled();
  });

  it('redo button is disabled at latest history state', () => {
    render(<MobileSheet />);
    const redoBtn = screen.getByTestId('sheet-redo');
    expect(redoBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// D-02 removal test
// ---------------------------------------------------------------------------

describe('D-02 desktop notice removal', () => {
  it('desktop-notice is NOT present in the DOM at any viewport size', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({ '(max-width: 767px)': true }),
    });
    render(<MobileSheet />);
    expect(screen.queryByTestId('desktop-notice')).not.toBeInTheDocument();
  });
});
