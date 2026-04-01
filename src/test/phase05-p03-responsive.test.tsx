/**
 * phase05-p03-responsive.test.tsx
 * Tests for responsive sidebar behavior (POLH-12).
 * Coverage: D-25 — desktop notice below 1024px, narrow sidebar at 1024-1199px.
 */
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

describe('Responsive sidebar (POLH-12)', () => {
  it('shows desktop-notice when viewport is below 1024px', () => {
    // Both max-width queries match (below 1024px)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 1199px)': true,
        '(max-width: 1023px)': true,
      }),
    });
    render(<Sidebar />);
    expect(screen.getByTestId('desktop-notice')).toBeInTheDocument();
  });

  it('desktop-notice contains helpful message about desktop requirement', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 1199px)': true,
        '(max-width: 1023px)': true,
      }),
    });
    render(<Sidebar />);
    const notice = screen.getByTestId('desktop-notice');
    expect(notice.textContent).toContain('desktop');
  });

  it('does NOT show desktop-notice when viewport is at least 1024px', () => {
    // Neither query matches (full width)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 1199px)': false,
        '(max-width: 1023px)': false,
      }),
    });
    render(<Sidebar />);
    expect(screen.queryByTestId('desktop-notice')).not.toBeInTheDocument();
  });

  it('renders sidebar with data-testid="sidebar" at full width (1200px+)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 1199px)': false,
        '(max-width: 1023px)': false,
      }),
    });
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders sidebar (not notice) at 1024-1199px narrow mode', () => {
    // Only max-width: 1199px matches (narrow but not too small)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia({
        '(max-width: 1199px)': true,
        '(max-width: 1023px)': false,
      }),
    });
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-notice')).not.toBeInTheDocument();
  });
});
