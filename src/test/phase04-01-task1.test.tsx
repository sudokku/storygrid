/**
 * Phase 04 Plan 01 Task 1 — RED tests
 * ExportModeContext, editorStore export state, LeafNode/ContainerNode suppression
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import type { LeafNode, ContainerNode } from '../types';

// ---------------------------------------------------------------------------
// ExportModeContext
// ---------------------------------------------------------------------------

describe('ExportModeContext', () => {
  it('ExportModeContext default value is false', async () => {
    const { ExportModeContext } = await import('../Grid/ExportModeContext');
    expect(ExportModeContext._currentValue).toBe(false);
  });

  it('useExportMode() returns false outside a provider', async () => {
    const { useExportMode } = await import('../Grid/ExportModeContext');
    let value: boolean | undefined;
    function TestComp() {
      value = useExportMode();
      return null;
    }
    render(<TestComp />);
    expect(value).toBe(false);
  });

  it('useExportMode() returns true inside ExportModeContext.Provider value={true}', async () => {
    const { ExportModeContext, useExportMode } = await import('../Grid/ExportModeContext');
    let value: boolean | undefined;
    function TestComp() {
      value = useExportMode();
      return null;
    }
    render(
      <ExportModeContext.Provider value={true}>
        <TestComp />
      </ExportModeContext.Provider>,
    );
    expect(value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// editorStore export state
// ---------------------------------------------------------------------------

describe('editorStore export state', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true);
  });

  it('isExporting defaults to false', () => {
    expect(useEditorStore.getState().isExporting).toBe(false);
  });

  it('exportFormat defaults to "png"', () => {
    expect(useEditorStore.getState().exportFormat).toBe('png');
  });

  it('exportQuality defaults to 0.9', () => {
    expect(useEditorStore.getState().exportQuality).toBe(0.9);
  });

  it('setIsExporting(true) sets isExporting to true', () => {
    useEditorStore.getState().setIsExporting(true);
    expect(useEditorStore.getState().isExporting).toBe(true);
  });

  it('setExportFormat("jpeg") sets exportFormat to "jpeg"', () => {
    useEditorStore.getState().setExportFormat('jpeg');
    expect(useEditorStore.getState().exportFormat).toBe('jpeg');
  });

  it('setExportQuality(0.8) sets exportQuality to 0.8', () => {
    useEditorStore.getState().setExportQuality(0.8);
    expect(useEditorStore.getState().exportQuality).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// LeafNode export mode suppression
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

function setLeafRoot(leaf: LeafNode) {
  useGridStore.setState({
    root: leaf,
    mediaRegistry: {},
    history: [{ root: leaf }],
    historyIndex: 0,
  });
}

describe('LeafNode export mode suppression', () => {
  beforeEach(() => {
    useEditorStore.setState({ selectedNodeId: null });
  });

  it('does NOT render ActionBar when exportMode is true', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    const { ExportModeContext } = await import('../Grid/ExportModeContext');
    const leaf = makeLeaf();
    setLeafRoot(leaf);
    render(
      <ExportModeContext.Provider value={true}>
        <LeafNodeComponent id="leaf-1" />
      </ExportModeContext.Provider>,
    );
    // ActionBar contains split/remove/fit buttons
    expect(screen.queryByRole('button', { name: /split/i })).toBeNull();
  });

  it('does NOT render selection ring when exportMode is true and node is selected', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    const { ExportModeContext } = await import('../Grid/ExportModeContext');
    const leaf = makeLeaf();
    setLeafRoot(leaf);
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    render(
      <ExportModeContext.Provider value={true}>
        <LeafNodeComponent id="leaf-1" />
      </ExportModeContext.Provider>,
    );
    const leafEl = screen.getByTestId('leaf-leaf-1');
    expect(leafEl.className).not.toContain('ring-2');
  });

  it('renders selection ring in normal (non-export) mode when selected', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    const leaf = makeLeaf();
    setLeafRoot(leaf);
    useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    render(<LeafNodeComponent id="leaf-1" />);
    const leafEl = screen.getByTestId('leaf-leaf-1');
    expect(leafEl.className).toContain('ring-2');
  });
});

// ---------------------------------------------------------------------------
// ContainerNode export mode suppression
// ---------------------------------------------------------------------------

describe('ContainerNode export mode suppression', () => {
  it('does NOT render Divider when exportMode is true', async () => {
    const { ContainerNodeComponent } = await import('../Grid/ContainerNode');
    const { ExportModeContext } = await import('../Grid/ExportModeContext');
    const leftLeaf: LeafNode = { type: 'leaf', id: 'left', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    const rightLeaf: LeafNode = { type: 'leaf', id: 'right', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    const container: ContainerNode = {
      type: 'container',
      id: 'container-1',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leftLeaf, rightLeaf],
    };
    useGridStore.setState({ root: container, mediaRegistry: {}, history: [{ root: container }], historyIndex: 0 });
    render(
      <ExportModeContext.Provider value={true}>
        <ContainerNodeComponent id="container-1" />
      </ExportModeContext.Provider>,
    );
    // Dividers have testid like divider-container-1-0
    expect(screen.queryByTestId('divider-container-1-0')).toBeNull();
  });

  it('renders Divider in normal (non-export) mode', async () => {
    const { ContainerNodeComponent } = await import('../Grid/ContainerNode');
    const leftLeaf: LeafNode = { type: 'leaf', id: 'left', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    const rightLeaf: LeafNode = { type: 'leaf', id: 'right', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    const container: ContainerNode = {
      type: 'container',
      id: 'container-1',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leftLeaf, rightLeaf],
    };
    useGridStore.setState({ root: container, mediaRegistry: {}, history: [{ root: container }], historyIndex: 0 });
    render(<ContainerNodeComponent id="container-1" />);
    expect(screen.getByTestId('divider-container-1-0')).toBeTruthy();
  });
});
