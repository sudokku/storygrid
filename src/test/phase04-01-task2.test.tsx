/**
 * Phase 04 Plan 01 Task 2 — tests
 * export.ts logic, ExportSurface, EditorShell wiring
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import * as htmlToImage from 'html-to-image';
import { exportGrid, downloadDataUrl, hasVideoCell } from '../lib/export';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { LeafNode } from '../types';

// ---------------------------------------------------------------------------
// exportGrid
// ---------------------------------------------------------------------------

describe('exportGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls toPng twice when format is "png"; first result discarded, second returned', async () => {
    const toPngSpy = vi.spyOn(htmlToImage, 'toPng')
      .mockResolvedValueOnce('data:image/png;first')
      .mockResolvedValueOnce('data:image/png;second');

    const node = document.createElement('div');
    const onStage = vi.fn();
    const result = await exportGrid(node, 'png', 0.9, onStage);

    expect(toPngSpy).toHaveBeenCalledTimes(2);
    expect(result).toBe('data:image/png;second');
  });

  it('calls toJpeg twice when format is "jpeg"; passes quality option', async () => {
    const toJpegSpy = vi.spyOn(htmlToImage, 'toJpeg')
      .mockResolvedValueOnce('data:image/jpeg;first')
      .mockResolvedValueOnce('data:image/jpeg;second');

    const node = document.createElement('div');
    const onStage = vi.fn();
    const result = await exportGrid(node, 'jpeg', 0.75, onStage);

    expect(toJpegSpy).toHaveBeenCalledTimes(2);
    expect(toJpegSpy).toHaveBeenCalledWith(node, expect.objectContaining({ quality: 0.75 }));
    expect(result).toBe('data:image/jpeg;second');
  });

  it('calls onStage("preparing") before first call, onStage("exporting") before second', async () => {
    const callOrder: string[] = [];

    vi.spyOn(htmlToImage, 'toPng').mockImplementation(async () => {
      callOrder.push('toPng');
      return 'data:image/png;x';
    });

    const onStage = vi.fn((stage: string) => {
      callOrder.push(`stage:${stage}`);
    });

    const node = document.createElement('div');
    await exportGrid(node, 'png', 0.9, onStage);

    expect(callOrder).toEqual(['stage:preparing', 'toPng', 'stage:exporting', 'toPng']);
  });

  it('propagates errors from toPng', async () => {
    vi.spyOn(htmlToImage, 'toPng').mockRejectedValue(new Error('canvas error'));

    const node = document.createElement('div');
    await expect(exportGrid(node, 'png', 0.9, vi.fn())).rejects.toThrow('canvas error');
  });
});

// ---------------------------------------------------------------------------
// downloadDataUrl
// ---------------------------------------------------------------------------

describe('downloadDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor element with download attribute and correct filename', () => {
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      (el as HTMLAnchorElement).click = clickSpy;
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    downloadDataUrl('data:image/png;base64,abc', 'storygrid-2026-01-01.png');

    expect(appendSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('storygrid-2026-01-01.png');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('sets href to the provided dataUrl', () => {
    let capturedAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      capturedAnchor = el as HTMLAnchorElement;
      (capturedAnchor as HTMLAnchorElement).click = vi.fn();
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    downloadDataUrl('data:image/png;base64,xyz', 'test.png');

    expect(capturedAnchor).not.toBeNull();
    expect((capturedAnchor as unknown as HTMLAnchorElement).href).toContain('data:image/png');
  });
});

// ---------------------------------------------------------------------------
// hasVideoCell
// ---------------------------------------------------------------------------

describe('hasVideoCell', () => {
  it('returns false when all media entries are image data URIs', () => {
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: 'img1', fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    expect(hasVideoCell(leaf, { img1: 'data:image/png;base64,abc' })).toBe(false);
  });

  it('returns true when any media entry starts with "data:video/"', () => {
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: 'vid1', fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    expect(hasVideoCell(leaf, { vid1: 'data:video/mp4;base64,abc' })).toBe(true);
  });

  it('returns false when tree has no media at all', () => {
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    expect(hasVideoCell(leaf, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ExportSurface
// ---------------------------------------------------------------------------

import { ExportSurface } from '../Grid/ExportSurface';

describe('ExportSurface', () => {
  beforeEach(() => {
    const leaf: LeafNode = { type: 'leaf', id: 'root-leaf', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    useGridStore.setState({ root: leaf, mediaRegistry: {}, history: [{ root: leaf }], historyIndex: 0 });
    useEditorStore.setState({ selectedNodeId: null });
  });

  it('renders with position absolute and left -9999px', () => {
    const exportRef = React.createRef<HTMLDivElement>();
    const { container } = render(<ExportSurface exportRef={exportRef} />);
    const surface = container.querySelector('[data-testid="export-surface"]') as HTMLElement;
    expect(surface).not.toBeNull();
    expect(surface.style.position).toBe('absolute');
    expect(surface.style.left).toBe('-9999px');
  });

  it('renders at width 1080px and height 1920px', () => {
    const exportRef = React.createRef<HTMLDivElement>();
    const { container } = render(<ExportSurface exportRef={exportRef} />);
    const surface = container.querySelector('[data-testid="export-surface"]') as HTMLElement;
    expect(surface.style.width).toBe('1080px');
    expect(surface.style.height).toBe('1920px');
  });

  it('has aria-hidden="true"', () => {
    const exportRef = React.createRef<HTMLDivElement>();
    const { container } = render(<ExportSurface exportRef={exportRef} />);
    const surface = container.querySelector('[data-testid="export-surface"]') as HTMLElement;
    expect(surface.getAttribute('aria-hidden')).toBe('true');
  });

  it('has visibility:hidden', () => {
    const exportRef = React.createRef<HTMLDivElement>();
    const { container } = render(<ExportSurface exportRef={exportRef} />);
    const surface = container.querySelector('[data-testid="export-surface"]') as HTMLElement;
    expect(surface.style.visibility).toBe('hidden');
  });

  it('renders GridNodeComponent inside ExportModeContext.Provider with value true', () => {
    const exportRef = React.createRef<HTMLDivElement>();
    const { container } = render(<ExportSurface exportRef={exportRef} />);
    // Root leaf should be rendered inside the surface
    const surface = container.querySelector('[data-testid="export-surface"]') as HTMLElement;
    expect(surface.querySelector('[data-testid="leaf-root-leaf"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EditorShell includes ExportSurface
// ---------------------------------------------------------------------------

import { EditorShell } from '../Editor/EditorShell';

describe('EditorShell includes ExportSurface', () => {
  it('ExportSurface is present in EditorShell DOM (always mounted per EXPO-07)', () => {
    render(<EditorShell />);
    expect(screen.getByTestId('export-surface')).toBeTruthy();
  });
});
