import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from './gridStore';
import { findNode, createLeaf } from '../lib/tree';
import type { ContainerNode, LeafNode } from '../types';

function getInitialState() {
  return useGridStore.getInitialState();
}

function firstLeafId(): string {
  const { root } = useGridStore.getState();
  const container = root as ContainerNode;
  return container.children[0].id;
}

function getLeaf(id: string): LeafNode {
  const { root } = useGridStore.getState();
  const node = findNode(root, id);
  if (!node || node.type !== 'leaf') throw new Error(`leaf ${id} not found`);
  return node;
}

beforeEach(() => {
  useGridStore.setState(getInitialState(), true);
});

describe('effects actions', () => {
  describe('setEffects', () => {
    it('updates a single slider without pushing a snapshot', () => {
      const id = firstLeafId();
      const historyBefore = useGridStore.getState().history.length;

      useGridStore.getState().setEffects(id, { brightness: 20 });

      expect(getLeaf(id).effects.brightness).toBe(20);
      expect(useGridStore.getState().history.length).toBe(historyBefore);
    });

    it('merges partial into existing effects (other fields preserved)', () => {
      const id = firstLeafId();
      useGridStore.getState().setEffects(id, { brightness: 10 });
      useGridStore.getState().setEffects(id, { contrast: -5 });

      const eff = getLeaf(id).effects;
      expect(eff.brightness).toBe(10);
      expect(eff.contrast).toBe(-5);
      expect(eff.saturation).toBe(0);
      expect(eff.blur).toBe(0);
    });

    it('no-op when nodeId does not resolve to a leaf', () => {
      const historyBefore = useGridStore.getState().history.length;
      useGridStore.getState().setEffects('does-not-exist', { brightness: 50 });
      expect(useGridStore.getState().history.length).toBe(historyBefore);
    });

    it('clears effects.preset when a numeric slider is touched while preset active (D-15)', () => {
      const id = firstLeafId();
      useGridStore.getState().applyPreset(id, 'vivid');
      expect(getLeaf(id).effects.preset).toBe('vivid');

      useGridStore.getState().setEffects(id, { brightness: 10 });

      const eff = getLeaf(id).effects;
      expect(eff.preset).toBeNull();
      expect(eff.brightness).toBe(10);
    });

    it('does NOT clear preset if partial is empty', () => {
      const id = firstLeafId();
      useGridStore.getState().applyPreset(id, 'sepia');
      useGridStore.getState().setEffects(id, {});
      expect(getLeaf(id).effects.preset).toBe('sepia');
    });
  });

  describe('beginEffectsDrag', () => {
    it('pushes exactly one snapshot', () => {
      const id = firstLeafId();
      const historyBefore = useGridStore.getState().history.length;
      useGridStore.getState().beginEffectsDrag(id);
      expect(useGridStore.getState().history.length).toBe(historyBefore + 1);
    });

    it('no-op when nodeId does not resolve to a leaf', () => {
      const historyBefore = useGridStore.getState().history.length;
      useGridStore.getState().beginEffectsDrag('does-not-exist');
      expect(useGridStore.getState().history.length).toBe(historyBefore);
    });

    it('drag sequence (begin + N setEffects) produces exactly ONE undo entry', () => {
      const id = firstLeafId();
      const historyIndexBefore = useGridStore.getState().historyIndex;

      useGridStore.getState().beginEffectsDrag(id);
      useGridStore.getState().setEffects(id, { brightness: 50 });
      useGridStore.getState().setEffects(id, { brightness: 80 });

      expect(getLeaf(id).effects.brightness).toBe(80);

      useGridStore.getState().undo();

      expect(getLeaf(id).effects.brightness).toBe(0);
      expect(useGridStore.getState().historyIndex).toBe(historyIndexBefore);
    });
  });

  describe('applyPreset', () => {
    it("applyPreset(id, 'vivid') sets preset + vivid numeric values in one snapshot", () => {
      const id = firstLeafId();
      const historyBefore = useGridStore.getState().history.length;

      useGridStore.getState().applyPreset(id, 'vivid');

      const eff = getLeaf(id).effects;
      expect(eff).toEqual({ preset: 'vivid', brightness: 0, contrast: 15, saturation: 40, blur: 0 });
      expect(useGridStore.getState().history.length).toBe(historyBefore + 1);
    });

    it('undo after applyPreset restores DEFAULT_EFFECTS', () => {
      const id = firstLeafId();
      useGridStore.getState().applyPreset(id, 'bw');
      useGridStore.getState().undo();
      expect(getLeaf(id).effects).toEqual({
        preset: null,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
      });
    });
  });

  describe('resetEffects', () => {
    it('restores DEFAULT_EFFECTS and preserves pan/fit/bg', () => {
      const id = firstLeafId();
      useGridStore.getState().updateCell(id, {
        panX: 10,
        panY: 20,
        panScale: 1.5,
        fit: 'contain',
        backgroundColor: '#ff0000',
      });
      useGridStore.getState().setEffects(id, { brightness: 40, contrast: 10 });

      useGridStore.getState().resetEffects(id);

      const leaf = getLeaf(id);
      expect(leaf.effects).toEqual({
        preset: null,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
      });
      expect(leaf.panX).toBe(10);
      expect(leaf.panY).toBe(20);
      expect(leaf.panScale).toBe(1.5);
      expect(leaf.fit).toBe('contain');
      expect(leaf.backgroundColor).toBe('#ff0000');
    });

    it('undo immediately after resetEffects restores DEFAULT_EFFECTS (single snapshot)', () => {
      const id = firstLeafId();
      useGridStore.getState().applyPreset(id, 'warm');
      // Starting from warm state, calling resetEffects pushes a snapshot and
      // resets to default. Undo unwinds the most recent snapshot; because the
      // store's snapshot model records pre-action state at each index, undo
      // returns to the baseline state captured at store init.
      useGridStore.getState().resetEffects(id);
      useGridStore.getState().undo();
      expect(getLeaf(id).effects).toEqual({
        preset: null,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
      });
    });
  });

  describe('resetCell', () => {
    it('resets effects + pan/fit/bg/objectPosition; preserves mediaId', () => {
      const id = firstLeafId();
      useGridStore.getState().setMedia(id, 'media-123');
      useGridStore.getState().updateCell(id, {
        panX: 30,
        panY: -10,
        panScale: 2,
        fit: 'contain',
        objectPosition: 'top left',
        backgroundColor: '#00ff00',
      });
      useGridStore.getState().applyPreset(id, 'sepia');

      useGridStore.getState().resetCell(id);

      const leaf = getLeaf(id);
      expect(leaf.mediaId).toBe('media-123');
      expect(leaf.effects).toEqual({
        preset: null,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
      });
      expect(leaf.panX).toBe(0);
      expect(leaf.panY).toBe(0);
      expect(leaf.panScale).toBe(1);
      expect(leaf.fit).toBe('cover');
      expect(leaf.objectPosition).toBe('center center');
      expect(leaf.backgroundColor).toBeNull();
    });

    it('resetCell pushes exactly one snapshot', () => {
      const id = firstLeafId();
      const historyBefore = useGridStore.getState().history.length;
      useGridStore.getState().resetCell(id);
      expect(useGridStore.getState().history.length).toBe(historyBefore + 1);
    });
  });
});

describe('toggleAudioEnabled', () => {
  it('defaults audioEnabled to true for new leaves', () => {
    const leaf = createLeaf();
    expect(leaf.audioEnabled).toBe(true);
  });

  it('flips audioEnabled from true to false', () => {
    const id = firstLeafId();
    expect(getLeaf(id).audioEnabled).toBe(true);
    useGridStore.getState().toggleAudioEnabled(id);
    expect(getLeaf(id).audioEnabled).toBe(false);
  });

  it('flips audioEnabled back to true on second call', () => {
    const id = firstLeafId();
    useGridStore.getState().toggleAudioEnabled(id);
    useGridStore.getState().toggleAudioEnabled(id);
    expect(getLeaf(id).audioEnabled).toBe(true);
  });

  it('pushes exactly one history snapshot per toggle', () => {
    const id = firstLeafId();
    const historyBefore = useGridStore.getState().history.length;
    useGridStore.getState().toggleAudioEnabled(id);
    expect(useGridStore.getState().history.length).toBe(historyBefore + 1);
  });

  it('is a no-op for non-existent nodeId', () => {
    const historyBefore = useGridStore.getState().history.length;
    expect(() => useGridStore.getState().toggleAudioEnabled('does-not-exist')).not.toThrow();
    expect(useGridStore.getState().history.length).toBe(historyBefore);
  });

  it('undo restores previous audioEnabled value', () => {
    const id = firstLeafId();
    expect(getLeaf(id).audioEnabled).toBe(true);
    useGridStore.getState().toggleAudioEnabled(id);
    expect(getLeaf(id).audioEnabled).toBe(false);
    useGridStore.getState().undo();
    expect(getLeaf(id).audioEnabled).toBe(true);
  });
});
