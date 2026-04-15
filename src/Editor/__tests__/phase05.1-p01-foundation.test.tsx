/**
 * phase05.1-p01-foundation.test.tsx
 * Foundation tests for Phase 05.1 Plan 01.
 * Updated in Phase 23 to reflect toggle/tab-strip contract (drag gesture removed).
 * Covers: MobileSheet snap states, toggle button, tab strip, auto-expand,
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
  audioEnabled: true,
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

  it('shows CanvasSettingsPanel when no cell selected', () => {
    render(<MobileSheet />);
    // Canvas settings panel renders "Canvas" heading
    expect(screen.getByText('Canvas')).toBeInTheDocument();
  });

  it('shows SelectedCellPanel when a cell is selected', () => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1', sheetSnapState: 'full' });
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
});

// ---------------------------------------------------------------------------
// Phase 23 — toggle + tab strip
// ---------------------------------------------------------------------------

describe('Phase 23 — toggle + tab strip', () => {
  it('toggle button renders ChevronUp icon (aria-label "Open panel") when collapsed', () => {
    render(<MobileSheet />);
    const btn = screen.getByRole('button', { name: 'Open panel' });
    expect(btn).toBeInTheDocument();
  });

  it('toggle button renders ChevronDown icon (aria-label "Close panel") when full', () => {
    useEditorStore.setState({ sheetSnapState: 'full' });
    render(<MobileSheet />);
    const btn = screen.getByRole('button', { name: 'Close panel' });
    expect(btn).toBeInTheDocument();
  });

  it('clicking toggle when collapsed sets sheetSnapState to "full"', () => {
    render(<MobileSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(useEditorStore.getState().sheetSnapState).toBe('full');
  });

  it('clicking toggle when full sets sheetSnapState to "collapsed"', () => {
    useEditorStore.setState({ sheetSnapState: 'full' });
    render(<MobileSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(useEditorStore.getState().sheetSnapState).toBe('collapsed');
  });

  it('tab strip shows "Canvas Settings" when no cell selected', () => {
    render(<MobileSheet />);
    expect(screen.getByText('Canvas Settings')).toBeInTheDocument();
  });

  it('tab strip shows "Cell Settings" when a cell is selected', () => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    render(<MobileSheet />);
    expect(screen.getByText('Cell Settings')).toBeInTheDocument();
  });

  it('auto-expand: selecting a node triggers setSheetSnapState("full")', () => {
    render(<MobileSheet />);
    expect(useEditorStore.getState().sheetSnapState).toBe('collapsed');
    act(() => {
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    });
    expect(useEditorStore.getState().sheetSnapState).toBe('full');
  });

  it('data-sheet-snap attribute reflects the current store state', () => {
    render(<MobileSheet />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet.getAttribute('data-sheet-snap')).toBe('collapsed');
    act(() => {
      useEditorStore.setState({ sheetSnapState: 'full' });
    });
    expect(sheet.getAttribute('data-sheet-snap')).toBe('full');
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
