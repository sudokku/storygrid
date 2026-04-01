/**
 * Phase 04 Plan 01 Task 2 — updated tests
 * downloadDataUrl, hasVideoCell (unchanged functions)
 * ExportSurface removed — EditorShell test updated to confirm absence
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { downloadDataUrl, hasVideoCell } from '../lib/export';
import type { LeafNode } from '../types';

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
// EditorShell — ExportSurface is NOT present (infrastructure removed)
// ---------------------------------------------------------------------------

import { EditorShell } from '../Editor/EditorShell';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';

describe('EditorShell — ExportSurface removed', () => {
  it('ExportSurface is NOT present in EditorShell DOM (Canvas API replaces DOM capture)', () => {
    const leaf: LeafNode = { type: 'leaf', id: 'root-leaf', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null };
    useGridStore.setState({ root: leaf, mediaRegistry: {}, history: [{ root: leaf }], historyIndex: 0 });
    useEditorStore.setState({ selectedNodeId: null });
    render(<EditorShell />);
    expect(screen.queryByTestId('export-surface')).toBeNull();
  });
});
