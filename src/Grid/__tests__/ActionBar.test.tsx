/**
 * ActionBar.test.tsx
 * Tests for ActionBar clamp-based sizing (CELL-02) per 07-01-PLAN.md.
 * Coverage: D-04, D-05, D-06.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ActionBar } from '../ActionBar';
import { useGridStore } from '../../store/gridStore';
import type { GridNode, LeafNode } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  return {
    type: 'leaf',
    id: 'leaf-1',
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    audioEnabled: true,
    hasAudioTrack: false,
    ...overrides,
  };
}

function setStoreRoot(root: GridNode, registry: Record<string, string> = {}) {
  useGridStore.setState({
    root,
    mediaRegistry: registry,
    history: [{ root }],
    historyIndex: 0,
  });
}

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// ActionBar clamp-based sizing tests (CELL-02, D-04, D-05, D-06)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 12-02: audio button tests (AUD-02, AUD-03)
// ---------------------------------------------------------------------------

describe('ActionBar audio button (12-02)', () => {
  it('Test 1: does NOT render audio button when cell has no media (empty cell)', () => {
    const leaf = makeLeaf({ mediaId: null });
    setStoreRoot(leaf);
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
    expect(screen.queryByTestId('audio-button')).not.toBeInTheDocument();
  });

  it('Test 2: does NOT render audio button when cell mediaType is image', () => {
    const leaf = makeLeaf({ mediaId: 'img-1' });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'img-1': 'data:image/png;base64,x' },
      mediaTypeMap: { 'img-1': 'image' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    expect(screen.queryByTestId('audio-button')).not.toBeInTheDocument();
  });

  it('Test 3: DOES render audio button when cell mediaType is video', () => {
    const leaf = makeLeaf({ mediaId: 'vid-1', hasAudioTrack: true });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'vid-1': 'blob:video' },
      mediaTypeMap: { 'vid-1': 'video' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    expect(screen.getByTestId('audio-button')).toBeInTheDocument();
  });

  it('Test 4: when audioEnabled=true shows Volume2 icon and aria-label "Mute cell audio"', () => {
    const leaf = makeLeaf({ mediaId: 'vid-1', audioEnabled: true, hasAudioTrack: true });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'vid-1': 'blob:video' },
      mediaTypeMap: { 'vid-1': 'video' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    const btn = screen.getByTestId('audio-button');
    expect(btn.getAttribute('aria-label')).toBe('Mute cell audio');
    // lucide Volume2 svg has class containing "lucide-volume-2"
    expect(btn.querySelector('svg')?.getAttribute('class') ?? '').toMatch(/volume-2/);
  });

  it('Test 5: when audioEnabled=false shows VolumeX icon with text-red-500 and aria-label "Unmute cell audio"', () => {
    const leaf = makeLeaf({ mediaId: 'vid-1', audioEnabled: false, hasAudioTrack: true });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'vid-1': 'blob:video' },
      mediaTypeMap: { 'vid-1': 'video' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    const btn = screen.getByTestId('audio-button');
    expect(btn.getAttribute('aria-label')).toBe('Unmute cell audio');
    const svg = btn.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('class') ?? '').toMatch(/volume-x|volume-off/);
    expect(svg!.getAttribute('class') ?? '').toContain('text-red-500');
  });

  it('Test 6: clicking the audio button calls toggleAudioEnabled with nodeId', () => {
    const leaf = makeLeaf({ mediaId: 'vid-1', hasAudioTrack: true });
    const toggleAudioEnabled = vi.fn();
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'vid-1': 'blob:video' },
      mediaTypeMap: { 'vid-1': 'video' },
      history: [{ root: leaf }],
      historyIndex: 0,
      toggleAudioEnabled,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    screen.getByTestId('audio-button').click();
    expect(toggleAudioEnabled).toHaveBeenCalledWith('leaf-1');
  });

  it('Test 7: audio button renders after fit toggle and before clear media button in DOM order', () => {
    const leaf = makeLeaf({ mediaId: 'vid-1', hasAudioTrack: true });
    useGridStore.setState({
      root: leaf,
      mediaRegistry: { 'vid-1': 'blob:video' },
      mediaTypeMap: { 'vid-1': 'video' },
      history: [{ root: leaf }],
      historyIndex: 0,
    });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map(b => b.getAttribute('aria-label'));
    const fitIdx = labels.findIndex(l => l && /switch to contain/i.test(l));
    const audioIdx = labels.findIndex(l => l === 'Mute cell audio');
    const clearIdx = labels.findIndex(l => l === 'Clear media');
    expect(fitIdx).toBeGreaterThanOrEqual(0);
    expect(audioIdx).toBeGreaterThan(fitIdx);
    expect(clearIdx).toBeGreaterThan(audioIdx);
  });
});

describe('ActionBar clamp-based sizing (07-01)', () => {
  it('Test 1: ActionBar root container renders with flex and gap classes preserved', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
    const bar = screen.getByTestId('action-bar-leaf-1');
    expect(bar).toBeInTheDocument();
    expect(bar.className).toContain('flex');
    expect(bar.className).toContain('gap-1');
  });

  it('Test 2: Buttons use fixed w-16 h-16 sizing (portal-aware, viewport-space)', () => {
    // ActionBar renders via createPortal to document.body in viewport space (per quick-260407-q2s).
    // It does not get scaled by the canvas transform, so it uses fixed 64px button sizing
    // with 32px lucide icons (doubled from prior 32px per user request — buttons need to be
    // large enough to be usable at typical viewports). Re-introducing clamp() (Phase 10-01)
    // made buttons unusably small and was reverted.
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.className).toContain('w-16');
      expect(btn.className).toContain('h-16');
    }
    // Also verify the bar itself still renders (structural integrity)
    expect(screen.getByTestId('action-bar-leaf-1')).toBeInTheDocument();
  });

  it('Test 3: Each lucide icon receives a numeric size prop (not undefined)', () => {
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    // lucide icons render as SVG elements; verify they are present in the DOM
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // Each SVG should have width and height attributes (set by lucide from size prop)
    for (const svg of Array.from(svgs)) {
      expect(svg.getAttribute('width')).not.toBeNull();
      expect(svg.getAttribute('height')).not.toBeNull();
    }
  });

  it('Test 4: All 6 buttons render with correct aria-labels (upload, split-h, split-v, fit-toggle, clear-media, remove) — Phase 28 DRAG-07 removed the drag handle', () => {
    const leaf = makeLeaf({ mediaId: 'mid-1' });
    setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Replace image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split horizontal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split vertical' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to contain/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear media' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove cell' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drag to move' })).toBeNull();
  });
});
