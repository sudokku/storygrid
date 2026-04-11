/**
 * Phase 17 — Data Model Foundation
 * Tests for `hasAudioTrack: boolean` field on LeafNode (MUTE-04)
 *
 * SC1: createLeaf() returns hasAudioTrack === true by default
 * SC2: After splitNode + undo(), every leaf in the restored tree has hasAudioTrack === true (not undefined)
 * SC4: A leaf with deleted hasAudioTrack field: `leaf.hasAudioTrack ?? true` yields true (legacy defensive read)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createLeaf, getAllLeaves } from '../lib/tree';
import { useGridStore } from '../store/gridStore';
import type { LeafNode } from '../types';

describe('Phase 17 — hasAudioTrack on LeafNode', () => {
  // -------------------------------------------------------------------------
  // SC1: createLeaf() returns hasAudioTrack: true by default
  // -------------------------------------------------------------------------
  it('SC1: createLeaf() returns hasAudioTrack: true', () => {
    const leaf = createLeaf();
    // Use `as any` cast so the test file compiles before the field exists on the type.
    // When the field is missing, (leaf as any).hasAudioTrack is undefined — assertion fails (RED).
    // When the field is added in Task 2, this assertion passes (GREEN).
    expect((leaf as any).hasAudioTrack).toBe(true);
    expect(typeof (leaf as any).hasAudioTrack).toBe('boolean');
  });

  // -------------------------------------------------------------------------
  // SC2: split + undo round-trip preserves hasAudioTrack on all leaves
  // -------------------------------------------------------------------------
  describe('SC2: undo round-trip restores hasAudioTrack on all leaves', () => {
    beforeEach(() => {
      useGridStore.setState(useGridStore.getInitialState(), true);
    });

    it('each leaf in restored tree has hasAudioTrack === true after split + undo', () => {
      const { split, undo } = useGridStore.getState();
      const initialRoot = useGridStore.getState().root;

      // Get the first leaf id to split
      const firstLeaf = getAllLeaves(initialRoot)[0];
      expect(firstLeaf).toBeDefined();

      // Perform a snapshot-pushing action: split
      split(firstLeaf.id, 'horizontal');

      // Undo — should restore the pre-split tree with hasAudioTrack on all leaves
      undo();

      const restoredRoot = useGridStore.getState().root;
      const leaves = getAllLeaves(restoredRoot);
      expect(leaves.length).toBeGreaterThan(0);

      for (const leaf of leaves) {
        // Use `as any` cast before the field exists on the type.
        expect((leaf as any).hasAudioTrack).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // SC4: legacy snapshot defensive read — `?? true` guard
  // -------------------------------------------------------------------------
  it('SC4: leaf.hasAudioTrack ?? true returns true when field is missing (legacy defensive read)', () => {
    const leaf = createLeaf();
    const legacy = leaf as any;

    // Simulate a legacy snapshot that pre-dates Phase 17 (field absent)
    delete legacy.hasAudioTrack;

    // Direct access returns undefined (field missing)
    expect(legacy.hasAudioTrack).toBeUndefined();

    // Defensive read pattern used by consumers after Phase 17
    expect(legacy.hasAudioTrack ?? true).toBe(true);
  });
});
