import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock autoFillCells BEFORE importing CanvasArea
vi.mock('../lib/media', () => ({
  autoFillCells: vi.fn().mockResolvedValue(undefined),
}));

// Mock CanvasWrapper to keep test focused on CanvasArea
vi.mock('../Grid/CanvasWrapper', () => ({
  CanvasWrapper: () => <div data-testid="canvas-wrapper-stub" />,
}));

import { CanvasArea } from '../Editor/CanvasArea';
import { autoFillCells } from '../lib/media';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fakeFile = (name: string, type: string) =>
  new File(['x'], name, { type });

describe('CanvasArea workspace drop (Phase 8 / DROP-01, DROP-02)', () => {
  it('renders the workspace main element with testid', () => {
    render(<CanvasArea />);
    expect(screen.getByTestId('workspace-main')).toBeTruthy();
  });

  it('shows ring class on dragenter with Files', () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    fireEvent.dragEnter(main, {
      dataTransfer: { types: ['Files'], files: [], dropEffect: 'copy' },
    });
    expect(main.className).toContain('ring-4');
    expect(main.className).toContain('ring-[#3b82f6]');
    expect(main.className).toContain('ring-inset');
  });

  it('shows the "Drop image or video" pill on dragenter with Files', () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    fireEvent.dragEnter(main, {
      dataTransfer: { types: ['Files'], files: [], dropEffect: 'copy' },
    });
    const pill = screen.getByTestId('workspace-drop-pill');
    expect(pill.textContent).toBe('Drop image or video');
  });

  it('does NOT show the pill for cell-swap drags (text/cell-id, no Files)', () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    fireEvent.dragEnter(main, {
      dataTransfer: { types: ['text/cell-id'], files: [], dropEffect: 'move' },
    });
    expect(screen.queryByTestId('workspace-drop-pill')).toBeNull();
    expect(main.className).not.toContain('ring-4');
  });

  it('clears the pill after dragleave (counter returns to 0)', () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    fireEvent.dragEnter(main, {
      dataTransfer: { types: ['Files'], files: [], dropEffect: 'copy' },
    });
    expect(screen.getByTestId('workspace-drop-pill')).toBeTruthy();
    fireEvent.dragLeave(main, {
      dataTransfer: { types: ['Files'], files: [], dropEffect: 'copy' },
    });
    expect(screen.queryByTestId('workspace-drop-pill')).toBeNull();
  });

  it('routes file drops through autoFillCells', async () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    const file = fakeFile('a.png', 'image/png');
    await fireEvent.drop(main, {
      dataTransfer: { types: ['Files'], files: [file], dropEffect: 'copy' },
    });
    expect(autoFillCells).toHaveBeenCalledTimes(1);
    const calledWith = (autoFillCells as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0]).toBe(file);
  });

  it('does NOT call autoFillCells for cell-swap-only drops (no Files)', async () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    await fireEvent.drop(main, {
      dataTransfer: { types: ['text/cell-id'], files: [], dropEffect: 'move' },
    });
    expect(autoFillCells).not.toHaveBeenCalled();
  });
});
