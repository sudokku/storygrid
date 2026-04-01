/**
 * phase05-p03-shortcuts.test.tsx
 * Tests for keyboard shortcuts added in Phase 5 Plan 02 (POLH-09).
 * Coverage: Delete, Backspace, H, V, F, Escape, Ctrl+E shortcuts in EditorShell.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditorShell } from '../Editor/EditorShell';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { GridNode } from '../types';

// A single leaf root for testing
const singleLeaf: GridNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

beforeEach(() => {
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    history: [{ root: singleLeaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    selectedNodeId: null,
    panModeNodeId: null,
    zoom: 1,
    canvasScale: 1,
    showSafeZone: false,
    activeTool: 'select',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useGridStore.setState(useGridStore.getInitialState(), true);
});

describe('Keyboard shortcuts — new in Phase 5 (POLH-09)', () => {
  describe('Delete / Backspace key', () => {
    it('pressing Delete when selectedNodeId is set calls remove(selectedNodeId)', () => {
      const remove = vi.fn();
      useGridStore.setState({ remove });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Delete' });
      expect(remove).toHaveBeenCalledWith('leaf-1');
    });

    it('pressing Delete when selectedNodeId is set also calls setSelectedNode(null)', () => {
      const setSelectedNode = vi.fn();
      useEditorStore.setState({ selectedNodeId: 'leaf-1', setSelectedNode });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Delete' });
      expect(setSelectedNode).toHaveBeenCalledWith(null);
    });

    it('pressing Backspace when selectedNodeId is set calls remove(selectedNodeId)', () => {
      const remove = vi.fn();
      useGridStore.setState({ remove });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Backspace' });
      expect(remove).toHaveBeenCalledWith('leaf-1');
    });

    it('pressing Delete when no selectedNodeId does nothing (no remove called)', () => {
      const remove = vi.fn();
      useGridStore.setState({ remove });
      useEditorStore.setState({ selectedNodeId: null });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Delete' });
      expect(remove).not.toHaveBeenCalled();
    });

    it('pressing Delete when target is INPUT does nothing (no remove called)', () => {
      const remove = vi.fn();
      useGridStore.setState({ remove });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: 'Delete' });
      expect(remove).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('H key — split horizontal', () => {
    it('pressing h when selectedNodeId is set calls split(selectedNodeId, horizontal)', () => {
      const split = vi.fn();
      useGridStore.setState({ split });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'h' });
      expect(split).toHaveBeenCalledWith('leaf-1', 'horizontal');
    });

    it('pressing H (uppercase) when selectedNodeId is set calls split(selectedNodeId, horizontal)', () => {
      const split = vi.fn();
      useGridStore.setState({ split });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'H' });
      expect(split).toHaveBeenCalledWith('leaf-1', 'horizontal');
    });

    it('pressing h when target is INPUT does nothing (no split called)', () => {
      const split = vi.fn();
      useGridStore.setState({ split });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: 'h' });
      expect(split).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('V key — split vertical', () => {
    it('pressing v when selectedNodeId is set calls split(selectedNodeId, vertical)', () => {
      const split = vi.fn();
      useGridStore.setState({ split });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'v' });
      expect(split).toHaveBeenCalledWith('leaf-1', 'vertical');
    });

    it('pressing V (uppercase) when selectedNodeId is set calls split(selectedNodeId, vertical)', () => {
      const split = vi.fn();
      useGridStore.setState({ split });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'V' });
      expect(split).toHaveBeenCalledWith('leaf-1', 'vertical');
    });
  });

  describe('F key — toggle fit', () => {
    it('pressing f when selectedNodeId is set and fit=cover calls updateCell with fit=contain', () => {
      const updateCell = vi.fn();
      useGridStore.setState({ root: { ...singleLeaf, fit: 'cover' }, updateCell });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'f' });
      expect(updateCell).toHaveBeenCalledWith('leaf-1', { fit: 'contain' });
    });

    it('pressing f when selectedNodeId is set and fit=contain calls updateCell with fit=cover', () => {
      const updateCell = vi.fn();
      useGridStore.setState({ root: { ...singleLeaf, fit: 'contain' }, updateCell });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'f' });
      expect(updateCell).toHaveBeenCalledWith('leaf-1', { fit: 'cover' });
    });
  });

  describe('Escape key', () => {
    it('pressing Escape when panModeNodeId is set calls setPanModeNodeId(null) but NOT setSelectedNode', () => {
      const setPanModeNodeId = vi.fn();
      const setSelectedNode = vi.fn();
      useEditorStore.setState({
        panModeNodeId: 'leaf-1',
        selectedNodeId: 'leaf-1',
        setPanModeNodeId,
        setSelectedNode,
      });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(setPanModeNodeId).toHaveBeenCalledWith(null);
      expect(setSelectedNode).not.toHaveBeenCalled();
    });

    it('pressing Escape when panModeNodeId is null calls setSelectedNode(null)', () => {
      const setPanModeNodeId = vi.fn();
      const setSelectedNode = vi.fn();
      useEditorStore.setState({
        panModeNodeId: null,
        selectedNodeId: 'leaf-1',
        setPanModeNodeId,
        setSelectedNode,
      });
      render(<EditorShell />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(setSelectedNode).toHaveBeenCalledWith(null);
      expect(setPanModeNodeId).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+E — export trigger', () => {
    it('pressing Ctrl+E clicks the export button if present in the DOM', () => {
      render(<EditorShell />);
      // Query the real rendered button (ExportSplitButton now has data-testid="export-button")
      const exportBtn = document.querySelector('[data-testid="export-button"]') as HTMLElement;
      expect(exportBtn).not.toBeNull();
      const clickSpy = vi.fn();
      exportBtn.addEventListener('click', clickSpy);
      fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('pressing Meta+E (macOS Cmd+E) triggers export', () => {
      render(<EditorShell />);
      // Query the real rendered button (ExportSplitButton now has data-testid="export-button")
      const exportBtn = document.querySelector('[data-testid="export-button"]') as HTMLElement;
      expect(exportBtn).not.toBeNull();
      const clickSpy = vi.fn();
      exportBtn.addEventListener('click', clickSpy);
      fireEvent.keyDown(window, { key: 'E', metaKey: true });
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
