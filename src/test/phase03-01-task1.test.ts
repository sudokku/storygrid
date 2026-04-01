/**
 * Phase 03-01 Task 1 Tests
 * - LeafNode type has backgroundColor field
 * - createLeaf() returns nodes with backgroundColor: null
 * - clearGrid() action resets root, mediaRegistry, and history
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../store/gridStore';
import { createLeaf } from '../lib/tree';
import type { ContainerNode, LeafNode } from '../types';

function getInitialState() {
  return useGridStore.getInitialState();
}

beforeEach(() => {
  useGridStore.setState(getInitialState(), true);
});

describe('Phase 03-01 Task 1: type extension + clearGrid', () => {
  describe('LeafNode.backgroundColor', () => {
    it('createLeaf() returns a node with backgroundColor: null', () => {
      const leaf = createLeaf();
      expect(leaf).toHaveProperty('backgroundColor', null);
    });

    it('initial tree leaves all have backgroundColor: null', () => {
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      container.children.forEach(child => {
        const leaf = child as LeafNode;
        expect(leaf.backgroundColor).toBeNull();
      });
    });

    it('updateCell can set backgroundColor on a leaf', () => {
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      const leaf = container.children[0] as LeafNode;

      useGridStore.getState().updateCell(leaf.id, { backgroundColor: '#ff0000' });

      const { root: updatedRoot } = useGridStore.getState();
      const updatedContainer = updatedRoot as ContainerNode;
      const updatedLeaf = updatedContainer.children[0] as LeafNode;
      expect(updatedLeaf.backgroundColor).toBe('#ff0000');
    });
  });

  describe('clearGrid action', () => {
    it('clearGrid() resets root to a fresh vertical container with 2 leaves', () => {
      // First mutate the tree
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      const leafId = container.children[0].id;
      useGridStore.getState().split(leafId, 'horizontal');

      // Now clear
      useGridStore.getState().clearGrid();

      const { root: freshRoot } = useGridStore.getState();
      expect(freshRoot.type).toBe('container');
      const freshContainer = freshRoot as ContainerNode;
      expect(freshContainer.direction).toBe('vertical');
      expect(freshContainer.children).toHaveLength(2);
      freshContainer.children.forEach(child => {
        expect(child.type).toBe('leaf');
      });
    });

    it('clearGrid() clears all mediaRegistry entries', () => {
      useGridStore.getState().addMedia('m1', 'data:image/png;base64,abc');
      useGridStore.getState().addMedia('m2', 'data:image/png;base64,def');

      useGridStore.getState().clearGrid();

      const { mediaRegistry } = useGridStore.getState();
      expect(mediaRegistry).toEqual({});
    });

    it('clearGrid() resets history to 1 entry with historyIndex: 0', () => {
      // Perform several actions to grow history
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      const leafId = container.children[0].id;
      useGridStore.getState().split(leafId, 'horizontal');
      useGridStore.getState().split(leafId, 'vertical');

      useGridStore.getState().clearGrid();

      const { history, historyIndex } = useGridStore.getState();
      expect(history).toHaveLength(1);
      expect(historyIndex).toBe(0);
    });

    it('clearGrid() makes undo a no-op (undo stack is empty)', () => {
      // Split then clear
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      const leafId = container.children[0].id;
      useGridStore.getState().split(leafId, 'horizontal');
      useGridStore.getState().clearGrid();

      const { root: rootAfterClear } = useGridStore.getState();

      // Undo should be a no-op
      useGridStore.getState().undo();
      const { root: rootAfterUndo, historyIndex } = useGridStore.getState();

      expect(historyIndex).toBe(0);
      // Root should be unchanged (undo was no-op)
      expect(rootAfterUndo.type).toBe('container');
    });

    it('clearGrid() fresh leaves have backgroundColor: null', () => {
      useGridStore.getState().clearGrid();
      const { root } = useGridStore.getState();
      const container = root as ContainerNode;
      container.children.forEach(child => {
        const leaf = child as LeafNode;
        expect(leaf.backgroundColor).toBeNull();
      });
    });
  });
});
