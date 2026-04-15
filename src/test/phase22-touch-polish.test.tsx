/**
 * phase22-touch-polish.test.tsx
 * Tests for SCROLL-01 and SCROLL-02 requirements.
 * Phase 22 Plan 01 — Mobile Header & Touch Polish
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';

// CanvasArea for overscrollBehavior test
import { CanvasArea } from '../Editor/CanvasArea';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';

// Read index.css as a string at test time via Node fs (Vite ?raw is not
// processed in jsdom test environment)
const CSS_PATH = resolve(__dirname, '../index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// Store setup for CanvasArea render
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
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    mediaTypeMap: {},
    history: [{ root: singleLeaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    sheetSnapState: 'collapsed',
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
    showOverlays: true,
    totalDuration: 0,
  });
});

// ---------------------------------------------------------------------------
// SCROLL-01: CSS body rule
// ---------------------------------------------------------------------------

describe('SCROLL-01: CSS overscroll containment', () => {
  it('index.css body rule contains overscroll-behavior: contain', () => {
    expect(css).toContain('overscroll-behavior: contain');
  });

  it('CanvasArea main element has overscrollBehavior: contain in inline style', () => {
    render(<CanvasArea />);
    const main = screen.getByTestId('workspace-main');
    expect(main.style.overscrollBehavior).toBe('contain');
  });
});

// ---------------------------------------------------------------------------
// SCROLL-02: touch-action manipulation
// ---------------------------------------------------------------------------

describe('SCROLL-02: CSS touch-action elimination of 300ms delay', () => {
  it('index.css contains touch-action: manipulation', () => {
    expect(css).toContain('touch-action: manipulation');
  });

  it('index.css touch-action rule targets button and [role="button"] selectors', () => {
    expect(css).toContain('button');
    expect(css).toContain('[role="button"]');
    expect(css).toContain('touch-action: manipulation');
  });
});
