/**
 * phase22-mobile-header.test.tsx
 * Tests for HEADER-01 and HEADER-02 requirements.
 * Phase 22 Plan 01 — Mobile Header & Touch Polish
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../Editor/Toolbar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';

// ---------------------------------------------------------------------------
// matchMedia mock — forces isMobile=true
// ---------------------------------------------------------------------------

let originalMatchMedia: typeof window.matchMedia;

function mockMatchMedia() {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 767px)',
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

const singleLeaf = {
  type: 'leaf' as const,
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover' as const,
  objectPosition: 'center center',
  backgroundColor: null,
  audioEnabled: true,
};

beforeEach(() => {
  mockMatchMedia();
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    mediaTypeMap: {},
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
    showOverlays: true,
    totalDuration: 0,
  });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// HEADER-01: Mobile header renders all 5 action controls
// ---------------------------------------------------------------------------

describe('HEADER-01: Mobile header layout', () => {
  it('renders mobile-undo button', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('mobile-undo')).toBeInTheDocument();
  });

  it('renders mobile-redo button', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('mobile-redo')).toBeInTheDocument();
  });

  it('renders mobile-clear button', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('mobile-clear')).toBeInTheDocument();
  });

  it('renders export button (from ExportSplitButton)', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('export-button')).toBeInTheDocument();
  });

  it('does NOT render "StoryGrid" wordmark text on mobile', () => {
    render(<Toolbar />);
    expect(screen.queryByText('StoryGrid')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HEADER-02: 44x44px touch targets and gap-2 spacing
// ---------------------------------------------------------------------------

describe('HEADER-02: Touch target sizing', () => {
  it('mobile-undo button has w-11 h-11 classes', () => {
    render(<Toolbar />);
    const btn = screen.getByTestId('mobile-undo');
    expect(btn.className).toContain('w-11');
    expect(btn.className).toContain('h-11');
  });

  it('mobile-redo button has w-11 h-11 classes', () => {
    render(<Toolbar />);
    const btn = screen.getByTestId('mobile-redo');
    expect(btn.className).toContain('w-11');
    expect(btn.className).toContain('h-11');
  });

  it('mobile-clear button has w-11 h-11 classes', () => {
    render(<Toolbar />);
    const btn = screen.getByTestId('mobile-clear');
    expect(btn.className).toContain('w-11');
    expect(btn.className).toContain('h-11');
  });

  it('mobile header container uses gap-2 spacing', () => {
    render(<Toolbar />);
    // Find the header element
    const header = screen.getByRole('banner');
    expect(header.className).toContain('gap-2');
  });
});

// ---------------------------------------------------------------------------
// Clear button: no window.confirm on mobile
// ---------------------------------------------------------------------------

describe('Mobile Clear button: no confirmation dialog', () => {
  it('calls clearGrid without calling window.confirm', () => {
    const clearGridMock = vi.fn();
    useGridStore.setState({ clearGrid: clearGridMock } as ReturnType<typeof useGridStore.setState>);

    const confirmSpy = vi.spyOn(window, 'confirm');

    render(<Toolbar />);
    const clearBtn = screen.getByTestId('mobile-clear');
    fireEvent.click(clearBtn);

    expect(clearGridMock).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
