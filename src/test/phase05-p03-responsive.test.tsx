/**
 * phase05-p03-responsive.test.tsx
 * Tests for responsive sidebar behavior.
 * Updated for Phase 05.1: D-25 desktop notice removed; sidebar is always hidden on mobile via CSS.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Editor/Sidebar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { GridNode } from '../types';

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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Responsive sidebar (Phase 05.1)', () => {
  it('does NOT show desktop-notice at any viewport width (D-02 removed)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 767px)': true,
      }),
    });
    render(<Sidebar />);
    expect(screen.queryByTestId('desktop-notice')).not.toBeInTheDocument();
  });

  it('does NOT show desktop-notice even at full width', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({}),
    });
    render(<Sidebar />);
    expect(screen.queryByTestId('desktop-notice')).not.toBeInTheDocument();
  });

  it('renders sidebar with data-testid="sidebar" always (visibility controlled by CSS md:flex)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 767px)': false,
      }),
    });
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('sidebar element has hidden class (CSS controls display, not JS)', () => {
    render(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.className).toContain('hidden');
  });

  it('sidebar element has md:flex class for responsive show on desktop', () => {
    render(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.className).toContain('md:flex');
  });
});
