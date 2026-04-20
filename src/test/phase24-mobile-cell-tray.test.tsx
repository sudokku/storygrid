/**
 * phase24-mobile-cell-tray.test.tsx
 * Tests for CELL-01, CELL-02, CELL-03 requirements.
 * Phase 24 Plan 01 — Mobile Cell Action Tray
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileCellTray } from '../Editor/MobileCellTray';
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
// CELL-01: Tray visibility
// ---------------------------------------------------------------------------

describe('CELL-01: Tray visibility', () => {
  it('tray has pointerEvents none when no cell selected', () => {
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    expect(tray.style.pointerEvents).toBe('none');
    expect(tray.style.opacity).toBe('0');
  });

  it('tray has pointerEvents auto and opacity 1 when a cell is selected', () => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    expect(tray.style.pointerEvents).toBe('auto');
    expect(tray.style.opacity).toBe('1');
  });

  it('tray has md:hidden class for desktop suppression', () => {
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    expect(tray.className).toContain('md:hidden');
  });

  it('tray is positioned with bottom:48px above the tab strip', () => {
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    expect(tray.style.bottom).toBe('48px');
  });

  it('tray uses z-[45] to layer above sheet but below overlays', () => {
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    expect(tray.className).toContain('z-[45]');
  });
});

// ---------------------------------------------------------------------------
// CELL-02: Tray button set
// ---------------------------------------------------------------------------

describe('CELL-02: Tray button set', () => {
  beforeEach(() => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
  });

  it('renders Upload button with aria-label "Upload media" when no media', () => {
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Upload media')).toBeInTheDocument();
  });

  it('renders Upload button with aria-label "Replace media" when hasMedia', () => {
    useGridStore.setState({
      root: { ...singleLeaf, mediaId: 'media-1' },
      mediaRegistry: { 'media-1': 'data:image/png;base64,aaa' },
      mediaTypeMap: { 'media-1': 'image' },
      history: [{ root: { ...singleLeaf, mediaId: 'media-1' } }],
      historyIndex: 0,
    });
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Replace media')).toBeInTheDocument();
  });

  it('renders Split Horizontal button', () => {
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Split horizontal')).toBeInTheDocument();
  });

  it('renders Split Vertical button', () => {
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Split vertical')).toBeInTheDocument();
  });

  it('renders Fit toggle with "Switch to contain" aria-label when fit=cover', () => {
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Switch to contain')).toBeInTheDocument();
  });

  it('renders Fit toggle with "Switch to cover" aria-label when fit=contain', () => {
    useGridStore.setState({
      root: { ...singleLeaf, fit: 'contain' as const },
      mediaRegistry: {},
      mediaTypeMap: {},
      history: [{ root: { ...singleLeaf, fit: 'contain' as const } }],
      historyIndex: 0,
    });
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Switch to cover')).toBeInTheDocument();
  });

  it('hides Clear button when hasMedia is false', () => {
    render(<MobileCellTray />);
    expect(screen.queryByLabelText('Clear media')).not.toBeInTheDocument();
  });

  it('shows Clear button when hasMedia is true', () => {
    useGridStore.setState({
      root: { ...singleLeaf, mediaId: 'media-1' },
      mediaRegistry: { 'media-1': 'data:image/png;base64,aaa' },
      mediaTypeMap: { 'media-1': 'image' },
      history: [{ root: { ...singleLeaf, mediaId: 'media-1' } }],
      historyIndex: 0,
    });
    render(<MobileCellTray />);
    expect(screen.getByLabelText('Clear media')).toBeInTheDocument();
  });

  it('does NOT render a Remove cell button (per D-08)', () => {
    render(<MobileCellTray />);
    expect(screen.queryByLabelText(/remove cell/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CELL-03: Touch target sizing and gaps
// ---------------------------------------------------------------------------

describe('CELL-03: Touch target sizing and gaps', () => {
  beforeEach(() => {
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
  });

  it('Upload button has min-w-[44px] and min-h-[44px] classes', () => {
    render(<MobileCellTray />);
    const btn = screen.getByLabelText('Upload media');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('Split H button has min-w-[44px] and min-h-[44px] classes', () => {
    render(<MobileCellTray />);
    const btn = screen.getByLabelText('Split horizontal');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('Split V button has min-w-[44px] and min-h-[44px] classes', () => {
    render(<MobileCellTray />);
    const btn = screen.getByLabelText('Split vertical');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('Fit toggle button has min-w-[44px] and min-h-[44px] classes', () => {
    render(<MobileCellTray />);
    const btn = screen.getByLabelText('Switch to contain');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('inner tray container uses gap-2 (8px) between buttons', () => {
    render(<MobileCellTray />);
    const tray = screen.getByTestId('mobile-cell-tray');
    // Inner pill container is the first element child
    const inner = tray.firstElementChild as HTMLElement;
    expect(inner.className).toContain('gap-2');
  });
});
