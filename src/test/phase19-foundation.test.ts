/**
 * phase19-foundation.test.ts
 * Tests for Phase 19 foundation pieces:
 *   - getBFSLeavesWithDepth (src/lib/tree.ts)
 *   - detectAudioTrack (src/lib/media.ts)
 *   - setHasAudioTrack store action (src/store/gridStore.ts)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildInitialTree, splitNode, createLeaf, getAllLeaves } from '../lib/tree';
import { getBFSLeavesWithDepth } from '../lib/tree';
import { detectAudioTrack } from '../lib/media';
import type { GridNode, ContainerNode, LeafNode } from '../types';
import { useGridStore } from '../store/gridStore';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// getBFSLeavesWithDepth tests
// ---------------------------------------------------------------------------

describe('getBFSLeavesWithDepth', () => {
  it('returns single leaf at depth 0', () => {
    const leaf = createLeaf();
    const result = getBFSLeavesWithDepth(leaf);
    expect(result).toHaveLength(1);
    expect(result[0].leaf.id).toBe(leaf.id);
    expect(result[0].depth).toBe(0);
  });

  it('returns two leaves at depth 1 in left-to-right order', () => {
    // Container with two leaves
    const leaf1 = createLeaf();
    const leaf2 = createLeaf();
    const root: ContainerNode = {
      type: 'container',
      id: nanoid(),
      direction: 'vertical',
      sizes: [1, 1],
      children: [leaf1, leaf2],
    };

    const result = getBFSLeavesWithDepth(root);
    expect(result).toHaveLength(2);
    expect(result[0].leaf.id).toBe(leaf1.id);
    expect(result[0].depth).toBe(1);
    expect(result[1].leaf.id).toBe(leaf2.id);
    expect(result[1].depth).toBe(1);
  });

  it('returns leaves in BFS order for nested tree', () => {
    // root -> container[leafA, container[leafB, leafC]]
    // BFS order: leafA (depth 1), leafB (depth 2), leafC (depth 2)
    const leafA = createLeaf();
    const leafB = createLeaf();
    const leafC = createLeaf();

    const innerContainer: ContainerNode = {
      type: 'container',
      id: nanoid(),
      direction: 'vertical',
      sizes: [1, 1],
      children: [leafB, leafC],
    };

    const root: ContainerNode = {
      type: 'container',
      id: nanoid(),
      direction: 'horizontal',
      sizes: [1, 1],
      children: [leafA, innerContainer],
    };

    const result = getBFSLeavesWithDepth(root);
    expect(result).toHaveLength(3);
    expect(result[0].leaf.id).toBe(leafA.id);
    expect(result[0].depth).toBe(1);
    expect(result[1].leaf.id).toBe(leafB.id);
    expect(result[1].depth).toBe(2);
    expect(result[2].leaf.id).toBe(leafC.id);
    expect(result[2].depth).toBe(2);
  });

  it('never returns containers, only leaves', () => {
    const root = buildInitialTree(); // container with 2 leaves
    const result = getBFSLeavesWithDepth(root);
    for (const item of result) {
      expect(item.leaf.type).toBe('leaf');
    }
  });
});

// ---------------------------------------------------------------------------
// detectAudioTrack tests
// ---------------------------------------------------------------------------

describe('detectAudioTrack', () => {
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockDecode = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mockClose.mockResolvedValue(undefined);

    global.AudioContext = vi.fn().mockImplementation(() => ({
      decodeAudioData: mockDecode,
      close: mockClose,
    })) as unknown as typeof AudioContext;
  });

  it('returns true when audioBuffer has numberOfChannels > 0', async () => {
    mockDecode.mockResolvedValue({ numberOfChannels: 2 });
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    const result = await detectAudioTrack(file);
    expect(result).toBe(true);
  });

  it('returns false when audioBuffer has numberOfChannels === 0', async () => {
    mockDecode.mockResolvedValue({ numberOfChannels: 0 });
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    const result = await detectAudioTrack(file);
    expect(result).toBe(false);
  });

  it('returns true (fail-open) when decodeAudioData rejects', async () => {
    mockDecode.mockRejectedValue(new Error('Unsupported codec'));
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    const result = await detectAudioTrack(file);
    expect(result).toBe(true);
  });

  it('returns true when AudioContext constructor throws', async () => {
    global.AudioContext = vi.fn().mockImplementation(() => {
      throw new Error('AudioContext not available');
    }) as unknown as typeof AudioContext;

    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    const result = await detectAudioTrack(file);
    expect(result).toBe(true);
  });

  it('calls ctx.close() after successful decode', async () => {
    mockDecode.mockResolvedValue({ numberOfChannels: 1 });
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    await detectAudioTrack(file);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('calls ctx.close() even when decodeAudioData rejects', async () => {
    mockDecode.mockRejectedValue(new Error('decode failed'));
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    await detectAudioTrack(file);
    // close is called in finally, so even on rejection it should be called
    // (unless the AudioContext constructor itself throws)
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// setHasAudioTrack store action tests
// ---------------------------------------------------------------------------

describe('setHasAudioTrack store action', () => {
  beforeEach(() => {
    useGridStore.setState(useGridStore.getInitialState());
  });

  function getLeafId(): string {
    const root = useGridStore.getState().root;
    const leaves = getAllLeaves(root);
    return leaves[0].id;
  }

  it('sets hasAudioTrack to false on a leaf', () => {
    const leafId = getLeafId();
    useGridStore.getState().setHasAudioTrack(leafId, false);
    const root = useGridStore.getState().root;
    const leaves = getAllLeaves(root);
    const leaf = leaves.find(l => l.id === leafId);
    expect(leaf?.hasAudioTrack).toBe(false);
  });

  it('sets hasAudioTrack to true on a leaf', () => {
    const leafId = getLeafId();
    useGridStore.getState().setHasAudioTrack(leafId, true);
    const root = useGridStore.getState().root;
    const leaves = getAllLeaves(root);
    const leaf = leaves.find(l => l.id === leafId);
    expect(leaf?.hasAudioTrack).toBe(true);
  });

  it('does not push a snapshot (no undo entry)', () => {
    const leafId = getLeafId();
    const beforeIndex = useGridStore.getState().historyIndex;
    useGridStore.getState().setHasAudioTrack(leafId, true);
    const afterIndex = useGridStore.getState().historyIndex;
    expect(afterIndex).toBe(beforeIndex);
  });

  it('is a no-op for non-existent nodeId', () => {
    const before = useGridStore.getState().root;
    // Should not throw
    expect(() => {
      useGridStore.getState().setHasAudioTrack('nonexistent-id-xyz', true);
    }).not.toThrow();
    const after = useGridStore.getState().root;
    // Root unchanged
    expect(after).toStrictEqual(before);
  });
});
