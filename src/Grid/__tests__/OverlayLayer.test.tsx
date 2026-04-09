import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { OverlayLayer } from '../OverlayLayer';
import { useOverlayStore } from '../../store/overlayStore';
import { useEditorStore } from '../../store/editorStore';
import type { TextOverlay } from '../../types';

const makeText = (id: string, content = 'hello'): TextOverlay => ({
  id,
  type: 'text',
  x: 540,
  y: 960,
  width: 400,
  rotation: 0,
  zIndex: 1,
  content,
  fontFamily: 'Geist',
  fontSize: 72,
  color: '#ffffff',
  fontWeight: 'regular',
  textAlign: 'center',
});

beforeEach(() => {
  useOverlayStore.setState({ overlays: [], stickerRegistry: {} });
  useEditorStore.setState({
    selectedNodeId: null,
    selectedOverlayId: null,
    canvasScale: 1,
  } as Parameters<typeof useEditorStore.setState>[0]);
});

afterEach(() => cleanup());

describe('OverlayLayer', () => {
  it('Test 1: renders overlay elements for each overlay in store', () => {
    useOverlayStore.setState({ overlays: [makeText('o1', 'A'), makeText('o2', 'B')] });
    const { getByTestId } = render(<OverlayLayer />);
    expect(getByTestId('overlay-o1')).toBeDefined();
    expect(getByTestId('overlay-o2')).toBeDefined();
  });

  it('Test 2: clicking an overlay sets selectedOverlayId in editorStore', () => {
    useOverlayStore.setState({ overlays: [makeText('o1')] });
    const { getByTestId } = render(<OverlayLayer />);
    fireEvent.pointerDown(getByTestId('overlay-o1'));
    expect(useEditorStore.getState().selectedOverlayId).toBe('o1');
  });

  it('Test 3 (OVL-13): Delete key removes selected overlay and clears selectedOverlayId', () => {
    useOverlayStore.setState({ overlays: [makeText('o1')] });
    useEditorStore.setState({ selectedOverlayId: 'o1' } as Parameters<typeof useEditorStore.setState>[0]);
    render(<OverlayLayer />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useOverlayStore.getState().overlays.length).toBe(0);
    expect(useEditorStore.getState().selectedOverlayId).toBeNull();
  });

  it('Test 4 (OVL-13 INPUT guard): Delete inside INPUT does NOT remove overlay', () => {
    useOverlayStore.setState({ overlays: [makeText('o1')] });
    useEditorStore.setState({ selectedOverlayId: 'o1' } as Parameters<typeof useEditorStore.setState>[0]);
    const { getByTestId } = render(
      <>
        <OverlayLayer />
        <input data-testid="sidebar-input" />
      </>
    );
    const input = getByTestId('sidebar-input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(useOverlayStore.getState().overlays.length).toBe(1);
  });

  it('Test 5 (OVL-13 TEXTAREA + Backspace guard): Backspace inside TEXTAREA does NOT remove overlay', () => {
    useOverlayStore.setState({ overlays: [makeText('o1')] });
    useEditorStore.setState({ selectedOverlayId: 'o1' } as Parameters<typeof useEditorStore.setState>[0]);
    const { getByTestId } = render(
      <>
        <OverlayLayer />
        <textarea data-testid="sidebar-ta" />
      </>
    );
    const ta = getByTestId('sidebar-ta') as HTMLTextAreaElement;
    ta.focus();
    fireEvent.keyDown(ta, { key: 'Backspace' });
    expect(useOverlayStore.getState().overlays.length).toBe(1);
  });
});
