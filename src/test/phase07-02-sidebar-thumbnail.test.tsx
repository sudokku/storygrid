/**
 * Phase 07-02 Task 2 Tests — Sidebar SelectedCellPanel thumbnail rendering
 * Covers:
 *   Test 1: Image cell renders <img src={mediaUrl}>
 *   Test 2: Video cell with thumbnail renders <img src={thumbnailUrl}>
 *   Test 3: Video cell without thumbnail renders ImageIcon placeholder (not broken img)
 *   Test 4: No media cell renders ImageIcon placeholder
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SelectedCellPanel } from '../Editor/Sidebar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { GridNode } from '../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const leafNoMedia: GridNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

const leafWithImageMedia: GridNode = {
  type: 'leaf',
  id: 'leaf-2',
  mediaId: 'img-1',
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

const leafWithVideoMedia: GridNode = {
  type: 'leaf',
  id: 'leaf-3',
  mediaId: 'vid-1',
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  useEditorStore.setState({
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
    sheetSnapState: 'collapsed',
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 07-02 Sidebar SelectedCellPanel thumbnail rendering', () => {

  it('Test 1: image cell renders <img src={mediaUrl}>', () => {
    const imageUrl = 'data:image/png;base64,iVBORw0KGgo=';
    useGridStore.setState({
      root: leafWithImageMedia,
      mediaRegistry: { 'img-1': imageUrl },
      mediaTypeMap: { 'img-1': 'image' },
      thumbnailMap: {},
    });

    render(<SelectedCellPanel nodeId="leaf-2" />);

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe(imageUrl);
  });

  it('Test 2: video cell with thumbnail renders <img src={thumbnailUrl}>', () => {
    const blobUrl = 'blob:http://localhost/vid';
    const thumbUrl = 'data:image/jpeg;base64,/9j/MOCK';
    useGridStore.setState({
      root: leafWithVideoMedia,
      mediaRegistry: { 'vid-1': blobUrl },
      mediaTypeMap: { 'vid-1': 'video' },
      thumbnailMap: { 'vid-1': thumbUrl },
    });

    render(<SelectedCellPanel nodeId="leaf-3" />);

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    // Should show thumbnail, NOT the blob URL
    expect(img?.getAttribute('src')).toBe(thumbUrl);
    expect(img?.getAttribute('src')).not.toBe(blobUrl);
  });

  it('Test 3: video cell without thumbnail renders ImageIcon placeholder (not broken img)', () => {
    const blobUrl = 'blob:http://localhost/vid-no-thumb';
    useGridStore.setState({
      root: leafWithVideoMedia,
      mediaRegistry: { 'vid-1': blobUrl },
      mediaTypeMap: { 'vid-1': 'video' },
      thumbnailMap: {}, // no thumbnail yet
    });

    render(<SelectedCellPanel nodeId="leaf-3" />);

    // No <img> should be rendered (thumbnail not available)
    const img = document.querySelector('img');
    expect(img).toBeNull();

    // The thumbnail area should be present (aspect-video container)
    const thumbnailArea = document.querySelector('.aspect-video');
    expect(thumbnailArea).toBeTruthy();
  });

  it('Test 4: no media cell renders ImageIcon placeholder', () => {
    useGridStore.setState({
      root: leafNoMedia,
      mediaRegistry: {},
      mediaTypeMap: {},
      thumbnailMap: {},
    });

    render(<SelectedCellPanel nodeId="leaf-1" />);

    // No <img> rendered
    const img = document.querySelector('img');
    expect(img).toBeNull();

    // The thumbnail area (aspect-video container) should exist
    const thumbnailArea = document.querySelector('.aspect-video');
    expect(thumbnailArea).toBeTruthy();
  });

});
