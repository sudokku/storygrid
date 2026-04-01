/**
 * action-bar.test.tsx
 * Tests for ActionBar component (MEDI-01, MEDI-05).
 * Coverage: D-07 (button order), D-08 (Clear Media conditional visibility),
 * D-02 (Upload/Replace label based on hasMedia).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ActionBar } from '../Grid/ActionBar';
import { useGridStore } from '../store/gridStore';
import type { GridNode, LeafNode } from '../types';

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
// ActionBar tests (MEDI-01, MEDI-05, D-02, D-07, D-08)
// ---------------------------------------------------------------------------

describe('ActionBar', () => {
  it('renders with the correct data-testid', () => {
    const leaf = makeLeaf();
    setStoreRoot(leaf);
    render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
    expect(screen.getByTestId('action-bar-leaf-1')).toBeInTheDocument();
  });

  describe('Upload/Replace button (D-02)', () => {
    it('renders Upload button as the first button (D-07)', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Upload image');
    });

    it('shows "Upload image" aria-label when hasMedia=false', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
    });

    it('shows "Replace image" aria-label when hasMedia=true', () => {
      const leaf = makeLeaf({ mediaId: 'mid-1' });
      setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Replace image' })).toBeInTheDocument();
    });

    it('calls onUploadClick when Upload button is clicked', async () => {
      const user = userEvent.setup();
      const onUpload = vi.fn();
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={onUpload} />);
      await user.click(screen.getByRole('button', { name: 'Upload image' }));
      expect(onUpload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear Media conditional visibility (D-08)', () => {
    it('does NOT render Clear Media button when hasMedia=false', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /clear media/i })).toBeNull();
    });

    it('renders Clear Media button when hasMedia=true', () => {
      const leaf = makeLeaf({ mediaId: 'mid-1' });
      setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: /clear media/i })).toBeInTheDocument();
    });
  });

  describe('Button DOM order (D-07)', () => {
    it('renders buttons in order: Upload → Split H → Split V → Toggle Fit → Clear Media → Remove', () => {
      const leaf = makeLeaf({ id: 'leaf-1', mediaId: 'mid-1' });
      setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      const labels = buttons.map(b => b.getAttribute('aria-label') ?? '');
      const uploadIdx = labels.findIndex(l => /upload|replace/i.test(l));
      const splitHIdx = labels.findIndex(l => /horizontal/i.test(l));
      const splitVIdx = labels.findIndex(l => /vertical/i.test(l));
      const clearIdx = labels.findIndex(l => /clear media/i.test(l));
      const removeIdx = labels.findIndex(l => /remove cell/i.test(l));
      expect(uploadIdx).toBeGreaterThanOrEqual(0);
      expect(splitHIdx).toBeGreaterThanOrEqual(0);
      expect(splitVIdx).toBeGreaterThanOrEqual(0);
      expect(clearIdx).toBeGreaterThanOrEqual(0);
      expect(removeIdx).toBeGreaterThanOrEqual(0);
      expect(uploadIdx).toBeLessThan(splitHIdx);
      expect(splitHIdx).toBeLessThan(splitVIdx);
      expect(splitVIdx).toBeLessThan(clearIdx);
      expect(clearIdx).toBeLessThan(removeIdx);
    });
  });

  describe('Split buttons', () => {
    it('renders Split horizontal button', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: /split horizontal/i })).toBeInTheDocument();
    });

    it('renders Split vertical button', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: /split vertical/i })).toBeInTheDocument();
    });
  });

  describe('Remove cell button', () => {
    it('renders Remove cell button', () => {
      const leaf = makeLeaf();
      setStoreRoot(leaf);
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={false} onUploadClick={vi.fn()} />);
      expect(screen.getByRole('button', { name: /remove cell/i })).toBeInTheDocument();
    });
  });

  describe('Clear Media action', () => {
    it('clicking Clear Media calls removeMedia and updateCell with mediaId=null', async () => {
      const user = userEvent.setup();
      const removeMedia = vi.fn();
      const updateCell = vi.fn();
      const leaf = makeLeaf({ id: 'leaf-1', mediaId: 'mid-1' });
      setStoreRoot(leaf, { 'mid-1': 'data:image/png;base64,x' });
      useGridStore.setState({ removeMedia, updateCell });
      render(<ActionBar nodeId="leaf-1" fit="cover" hasMedia={true} onUploadClick={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: /clear media/i }));
      expect(removeMedia).toHaveBeenCalledWith('mid-1');
      expect(updateCell).toHaveBeenCalledWith('leaf-1', { mediaId: null });
    });
  });
});
