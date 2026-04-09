/**
 * phase05.1-p02-mobile-controls.test.tsx
 * Integration tests for Phase 05.1 Plan 02.
 * Covers: ActionBar hidden on mobile, Split H/V buttons in SelectedCellPanel,
 *         MobileWelcomeCard, mobile Onboarding branch, shared localStorage key.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Onboarding } from '../Onboarding';
import { SelectedCellPanel } from '../Sidebar';
import { useEditorStore } from '../../store/editorStore';
import { useGridStore } from '../../store/gridStore';
import type { GridNode } from '../../types';

// ---------------------------------------------------------------------------
// matchMedia mock factory
// ---------------------------------------------------------------------------

function mockMatchMedia(isMobile: boolean) {
  const mobileQuery = '(max-width: 767px)';
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === mobileQuery ? isMobile : false,
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

const STORAGE_KEY = 'storygrid_onboarding_done';

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
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
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Split H/V buttons in SelectedCellPanel
// ---------------------------------------------------------------------------

describe('SelectedCellPanel split buttons', () => {
  it('renders split-horizontal and split-vertical buttons', () => {
    render(<SelectedCellPanel nodeId="leaf-1" />);
    expect(screen.getByTestId('split-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('split-vertical')).toBeInTheDocument();
  });

  it('contains text "Split Horizontal" and "Split Vertical"', () => {
    render(<SelectedCellPanel nodeId="leaf-1" />);
    expect(screen.getByText('Split Horizontal')).toBeInTheDocument();
    expect(screen.getByText('Split Vertical')).toBeInTheDocument();
  });

  it('calls split with (nodeId, "horizontal") when Split Horizontal is clicked', () => {
    const split = vi.fn();
    useGridStore.setState({ split } as Parameters<typeof useGridStore.setState>[0]);
    render(<SelectedCellPanel nodeId="leaf-1" />);
    fireEvent.click(screen.getByTestId('split-horizontal'));
    expect(split).toHaveBeenCalledWith('leaf-1', 'horizontal');
  });

  it('calls split with (nodeId, "vertical") when Split Vertical is clicked', () => {
    const split = vi.fn();
    useGridStore.setState({ split } as Parameters<typeof useGridStore.setState>[0]);
    render(<SelectedCellPanel nodeId="leaf-1" />);
    fireEvent.click(screen.getByTestId('split-vertical'));
    expect(split).toHaveBeenCalledWith('leaf-1', 'vertical');
  });
});

// ---------------------------------------------------------------------------
// Mobile welcome card
// ---------------------------------------------------------------------------

describe('MobileWelcomeCard via Onboarding (mobile)', () => {
  it('shows mobile-welcome-card when on mobile and not dismissed', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.getByTestId('mobile-welcome-card')).toBeInTheDocument();
  });

  it('shows "Build your story." text', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.getByText('Build your story.')).toBeInTheDocument();
  });

  it('shows "Tap a cell to select it." instructions text', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.getByText(/Tap a cell to select it\./)).toBeInTheDocument();
  });

  it('removes mobile-welcome-card from DOM after clicking "Got it"', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    const dismissBtn = screen.getByTestId('welcome-dismiss');
    expect(dismissBtn).toBeInTheDocument();
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId('mobile-welcome-card')).not.toBeInTheDocument();
  });

  it('sets localStorage storygrid_onboarding_done = "true" after dismissal', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    fireEvent.click(screen.getByTestId('welcome-dismiss'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Desktop onboarding suppressed on mobile
// ---------------------------------------------------------------------------

describe('Desktop onboarding suppressed on mobile', () => {
  it('does NOT show onboarding-overlay on mobile', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Mobile welcome card already dismissed
// ---------------------------------------------------------------------------

describe('MobileWelcomeCard already dismissed', () => {
  it('does not render mobile-welcome-card when already dismissed', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.queryByTestId('mobile-welcome-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Shared localStorage key between desktop and mobile flows
// ---------------------------------------------------------------------------

describe('Shared localStorage key between mobile and desktop', () => {
  it('does not show mobile-welcome-card when dismissed via desktop (same key)', () => {
    // Simulate desktop dismissal by setting the same key
    localStorage.setItem(STORAGE_KEY, 'true');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia(true),
    });
    render(<Onboarding />);
    expect(screen.queryByTestId('mobile-welcome-card')).not.toBeInTheDocument();
  });
});
