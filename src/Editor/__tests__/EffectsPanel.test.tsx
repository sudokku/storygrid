import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EffectsPanel } from '../EffectsPanel';
import { useGridStore } from '../../store/gridStore';
import { findNode, getAllLeaves } from '../../lib/tree';
import type { LeafNode } from '../../types';

function getLeaf(id: string): LeafNode {
  const node = findNode(useGridStore.getState().root, id);
  if (!node || node.type !== 'leaf') throw new Error(`leaf ${id} not found`);
  return node;
}

let leafId: string;

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  // Seed: pick the first leaf in the initial tree and attach a media id so
  // the EffectsPanel renders enabled.
  const firstLeaf = getAllLeaves(useGridStore.getState().root)[0];
  leafId = firstLeaf.id;
  useGridStore.getState().addMedia('m-test', 'data:image/png;base64,AAA', 'image');
  useGridStore.getState().setMedia(leafId, 'm-test');
});

describe('EffectsPanel', () => {
  it('renders all 6 preset chips with correct display names', () => {
    render(<EffectsPanel nodeId={leafId} />);
    for (const name of ['Clarendon', 'Lark', 'Juno', 'Reyes', 'Moon', 'Inkwell']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('renders 4 sliders with correct labels', () => {
    render(<EffectsPanel nodeId={leafId} />);
    for (const label of ['Brightness', 'Contrast', 'Saturation', 'Blur']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("clicking the Clarendon chip applies the clarendon preset", () => {
    render(<EffectsPanel nodeId={leafId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clarendon' }));
    const leaf = getLeaf(leafId);
    expect(leaf.effects.preset).toBe('clarendon');
    expect(leaf.effects.brightness).toBe(25);
  });

  it('clicking Reset effects restores DEFAULT_EFFECTS', () => {
    render(<EffectsPanel nodeId={leafId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Juno' }));
    expect(getLeaf(leafId).effects.preset).toBe('juno');
    fireEvent.click(screen.getByRole('button', { name: 'Reset effects' }));
    const leaf = getLeaf(leafId);
    expect(leaf.effects).toEqual({
      preset: null,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      sepia: 0,
      hueRotate: 0,
      grayscale: 0,
    });
  });

  it('clicking Reset cell restores effects + pan/scale', () => {
    useGridStore.getState().updateCell(leafId, { panX: 30, panScale: 1.5 });
    useGridStore.getState().applyPreset(leafId, 'lark');
    render(<EffectsPanel nodeId={leafId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset cell' }));
    const leaf = getLeaf(leafId);
    expect(leaf.effects.preset).toBeNull();
    expect(leaf.panX).toBe(0);
    expect(leaf.panScale).toBe(1);
  });

  it('slider drag (pointerDown + change) commits exactly one history entry', () => {
    render(<EffectsPanel nodeId={leafId} />);
    const slider = screen.getByLabelText('Brightness') as HTMLInputElement;

    const historyBefore = useGridStore.getState().history.length;

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.change(slider, { target: { value: '80' } });
    fireEvent.pointerUp(slider);

    expect(getLeaf(leafId).effects.brightness).toBe(80);
    expect(useGridStore.getState().history.length).toBe(historyBefore + 1);

    useGridStore.getState().undo();
    expect(getLeaf(leafId).effects.brightness).toBe(0);
  });

  it('changing a slider after applying a preset clears the preset (D-15)', () => {
    render(<EffectsPanel nodeId={leafId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clarendon' }));
    expect(getLeaf(leafId).effects.preset).toBe('clarendon');

    const slider = screen.getByLabelText('Brightness') as HTMLInputElement;
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '10' } });
    fireEvent.pointerUp(slider);

    const leaf = getLeaf(leafId);
    expect(leaf.effects.preset).toBeNull();
    expect(leaf.effects.brightness).toBe(10);
    expect(leaf.effects.sepia).toBe(0);
    expect(leaf.effects.hueRotate).toBe(0);
    expect(leaf.effects.grayscale).toBe(0);
  });

  it('clicking an already-active preset chip toggles it off (D-11)', () => {
    render(<EffectsPanel nodeId={leafId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Moon' }));
    expect(getLeaf(leafId).effects.preset).toBe('moon');
    expect(getLeaf(leafId).effects.grayscale).toBe(100);

    // Click the same chip again to toggle off
    fireEvent.click(screen.getByRole('button', { name: 'Moon' }));
    const leaf = getLeaf(leafId);
    expect(leaf.effects.preset).toBeNull();
    expect(leaf.effects.sepia).toBe(0);
    expect(leaf.effects.hueRotate).toBe(0);
    expect(leaf.effects.grayscale).toBe(0);
    // Toggle-off resets all slider values to neutral defaults (D-11)
    // Scale is -100..+100 where 0 = neutral (brightness(1.0) = no change)
    expect(leaf.effects.brightness).toBe(0);
    expect(leaf.effects.contrast).toBe(0);
    expect(leaf.effects.saturation).toBe(0);
    expect(leaf.effects.blur).toBe(0);
  });

  it('renders disabled state when leaf has no media', () => {
    // Detach media from the leaf
    useGridStore.getState().updateCell(leafId, { mediaId: null });
    render(<EffectsPanel nodeId={leafId} />);
    expect(screen.getByText('Add media to apply effects')).toBeTruthy();
  });
});
