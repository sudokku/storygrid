import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../Editor/Toolbar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';

// Reset stores before each test
beforeEach(() => {
  useGridStore.setState({
    root: { type: 'leaf', id: 'root', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null },
    mediaRegistry: {},
    history: [{ root: { type: 'leaf', id: 'root', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null } }],
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

describe('Toolbar', () => {
  it('renders Undo button disabled when no history', () => {
    render(<Toolbar />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeDisabled();
  });

  it('renders Redo button disabled when at latest state', () => {
    render(<Toolbar />);
    const redoBtn = screen.getByRole('button', { name: /redo/i });
    expect(redoBtn).toBeDisabled();
  });

  it('shows zoom label at 100%', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('zoom-label')).toHaveTextContent('100%');
  });

  it('zoom out button is disabled at minimum zoom (50%)', () => {
    useEditorStore.setState({ zoom: 0.5 });
    render(<Toolbar />);
    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
    expect(zoomOutBtn).toBeDisabled();
  });

  it('zoom in button is disabled at maximum zoom (150%)', () => {
    useEditorStore.setState({ zoom: 1.5 });
    render(<Toolbar />);
    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
    expect(zoomInBtn).toBeDisabled();
  });

  it('clicking zoom in calls setZoom with zoom + 0.1', () => {
    const setZoom = vi.fn();
    useEditorStore.setState({ zoom: 1, setZoom });
    render(<Toolbar />);
    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
    fireEvent.click(zoomInBtn);
    expect(setZoom).toHaveBeenCalledWith(1.1);
  });

  it('clicking zoom out calls setZoom with zoom - 0.1', () => {
    const setZoom = vi.fn();
    useEditorStore.setState({ zoom: 1, setZoom });
    render(<Toolbar />);
    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
    fireEvent.click(zoomOutBtn);
    expect(setZoom).toHaveBeenCalledWith(0.9);
  });

  it('renders safe zone toggle button', () => {
    render(<Toolbar />);
    const safeZoneBtn = screen.getByRole('button', { name: /toggle safe zone/i });
    expect(safeZoneBtn).toBeInTheDocument();
  });

  it('safe zone button has aria-pressed reflecting showSafeZone state', () => {
    useEditorStore.setState({ showSafeZone: true });
    render(<Toolbar />);
    const safeZoneBtn = screen.getByRole('button', { name: /toggle safe zone/i });
    expect(safeZoneBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking safe zone toggle calls toggleSafeZone', () => {
    const toggleSafeZone = vi.fn();
    useEditorStore.setState({ toggleSafeZone });
    render(<Toolbar />);
    const safeZoneBtn = screen.getByRole('button', { name: /toggle safe zone/i });
    fireEvent.click(safeZoneBtn);
    expect(toggleSafeZone).toHaveBeenCalled();
  });

  it('renders Export button', () => {
    render(<Toolbar />);
    // ExportSplitButton replaces the placeholder; verify the left segment (export action) is present
    const exportBtn = screen.getByRole('button', { name: /export png/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('renders New/Clear button', () => {
    render(<Toolbar />);
    const clearBtn = screen.getByRole('button', { name: /new \/ clear canvas/i });
    expect(clearBtn).toBeInTheDocument();
  });

  it('clicking New/Clear calls clearGrid when confirmed', () => {
    const clearGrid = vi.fn();
    useGridStore.setState({ clearGrid });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Toolbar />);
    const clearBtn = screen.getByRole('button', { name: /new \/ clear canvas/i });
    fireEvent.click(clearBtn);
    expect(clearGrid).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does NOT call clearGrid when confirm is cancelled', () => {
    const clearGrid = vi.fn();
    useGridStore.setState({ clearGrid });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Toolbar />);
    const clearBtn = screen.getByRole('button', { name: /new \/ clear canvas/i });
    fireEvent.click(clearBtn);
    expect(clearGrid).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('Undo button is enabled when history has entries', () => {
    const leaf = { type: 'leaf' as const, id: 'root', mediaId: null, fit: 'cover' as const, objectPosition: 'center center', backgroundColor: null };
    useGridStore.setState({
      history: [{ root: leaf }, { root: leaf }],
      historyIndex: 1,
    });
    render(<Toolbar />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).not.toBeDisabled();
  });

  it('clicking Undo calls gridStore.undo', () => {
    const undo = vi.fn();
    const leaf = { type: 'leaf' as const, id: 'root', mediaId: null, fit: 'cover' as const, objectPosition: 'center center', backgroundColor: null };
    useGridStore.setState({
      history: [{ root: leaf }, { root: leaf }],
      historyIndex: 1,
      undo,
    });
    render(<Toolbar />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    fireEvent.click(undoBtn);
    expect(undo).toHaveBeenCalled();
  });
});
