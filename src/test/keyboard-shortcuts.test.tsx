/**
 * keyboard-shortcuts.test.tsx
 * Tests for global keyboard shortcut handler in EditorShell (MEDI-07).
 * Coverage: D-12 (input-focus guard), Ctrl+Z calls undo, Ctrl+Shift+Z calls redo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditorShell } from '../Editor/EditorShell';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
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
  // Restore real initial state after each test
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// Keyboard shortcut tests (MEDI-07, D-12)
// ---------------------------------------------------------------------------

describe('Keyboard shortcuts (EditorShell)', () => {
  it('Ctrl+Z calls gridStore.undo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: false });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z calls gridStore.redo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it('Z without Ctrl does NOT call undo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: false, shiftKey: false });
    expect(undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Z does NOT call undo when focus is on an INPUT element (D-12)', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    // Dispatch with the input as the event target (keydown bubbles to window)
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, shiftKey: false });
    expect(undo).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('Ctrl+Z does NOT call undo when focus is on a TEXTAREA element (D-12)', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    fireEvent.keyDown(ta, { key: 'z', ctrlKey: true, shiftKey: false });
    expect(undo).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });

  it('Ctrl+Shift+Z does NOT call redo when focus is on an INPUT element (D-12)', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useGridStore.setState({ undo, redo });
    render(<EditorShell />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(redo).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
