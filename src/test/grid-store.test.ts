import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '../store/gridStore';
import type { ContainerNode, LeafNode } from '../types';

function getInitialState() {
  return useGridStore.getInitialState();
}

beforeEach(() => {
  useGridStore.setState(getInitialState(), true);
});

describe('gridStore', () => {
  describe('initial state', () => {
    it('root is a vertical container with 2 leaf children and sizes [1,1]', () => {
      const { root } = useGridStore.getState();
      expect(root.type).toBe('container');
      const container = root as ContainerNode;
      expect(container.direction).toBe('vertical');
      expect(container.sizes).toEqual([1, 1]);
      expect(container.children).toHaveLength(2);
      container.children.forEach(child => {
        expect(child.type).toBe('leaf');
      });
    });

    it('history has 1 entry (initial snapshot) and historyIndex is 0', () => {
      const { history, historyIndex } = useGridStore.getState();
      expect(history).toHaveLength(1);
      expect(historyIndex).toBe(0);
    });

    it('mediaRegistry is empty object', () => {
      const { mediaRegistry } = useGridStore.getState();
      expect(mediaRegistry).toEqual({});
    });
  });

  describe('split action', () => {
    it('split(leafId, "horizontal"): root changes and history grows by 1', () => {
      const { root: originalRoot, history: originalHistory } = useGridStore.getState();
      const container = originalRoot as ContainerNode;
      const leafId = container.children[0].id;

      useGridStore.getState().split(leafId, 'horizontal');

      const { root: newRoot, history } = useGridStore.getState();
      expect(newRoot).not.toBe(originalRoot);
      expect(history).toHaveLength(originalHistory.length + 1);
    });

    it('historyIndex increases by 1 after split', () => {
      const { historyIndex: originalIndex } = useGridStore.getState();
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;

      useGridStore.getState().split(leafId, 'horizontal');

      const { historyIndex } = useGridStore.getState();
      expect(historyIndex).toBe(originalIndex + 1);
    });

    it('split same-direction appends sibling: splitting a leaf in a vertical container with direction "vertical" appends sibling', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;

      useGridStore.getState().split(leafId, 'vertical');

      const { root } = useGridStore.getState();
      const updatedContainer = root as ContainerNode;
      expect(updatedContainer.children).toHaveLength(3);
      expect(updatedContainer.sizes).toHaveLength(3);
      expect(updatedContainer.sizes[2]).toBe(1);
    });
  });

  describe('merge action', () => {
    it('merge(containerId): collapses container to first child', () => {
      // First split to create a nested container
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;
      useGridStore.getState().split(leafId, 'horizontal');

      // The leaf at children[0] is now replaced by a new container
      const { root } = useGridStore.getState();
      const outerContainer = root as ContainerNode;
      const innerContainer = outerContainer.children[0] as ContainerNode;
      expect(innerContainer.type).toBe('container');

      useGridStore.getState().merge(innerContainer.id);

      const { root: mergedRoot } = useGridStore.getState();
      const mergedOuter = mergedRoot as ContainerNode;
      expect(mergedOuter.children[0].type).toBe('leaf');
    });
  });

  describe('remove action', () => {
    it('remove(leafId): removes leaf, collapses parent if 1 child remains', () => {
      // With initial state of 2 leaves, removing one should collapse to a single leaf
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;

      useGridStore.getState().remove(leafId);

      const { root } = useGridStore.getState();
      // The root should now be a leaf (parent collapsed since only 1 child remained)
      expect(root.type).toBe('leaf');
    });
  });

  describe('resize action', () => {
    it('resize(containerId, 0, 0.5): adjusts sizes[0] and sizes[1] by delta', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const originalSizes = [...container.sizes];

      useGridStore.getState().resize(container.id, 0, 0.5);

      const { root } = useGridStore.getState();
      const updatedContainer = root as ContainerNode;
      expect(updatedContainer.sizes[0]).toBeCloseTo(originalSizes[0] + 0.5);
      expect(updatedContainer.sizes[1]).toBeCloseTo(originalSizes[1] - 0.5);
    });
  });

  describe('setMedia action', () => {
    it('setMedia(leafId, "media-1"): sets leaf.mediaId to "media-1"', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leaf = container.children[0] as LeafNode;
      expect(leaf.mediaId).toBeNull();

      useGridStore.getState().setMedia(leaf.id, 'media-1');

      const { root } = useGridStore.getState();
      const updatedContainer = root as ContainerNode;
      const updatedLeaf = updatedContainer.children[0] as LeafNode;
      expect(updatedLeaf.mediaId).toBe('media-1');
    });
  });

  describe('addMedia / removeMedia actions', () => {
    it('addMedia("media-1", "data:image/png;base64,..."): adds entry to mediaRegistry', () => {
      useGridStore.getState().addMedia('media-1', 'data:image/png;base64,abc123');

      const { mediaRegistry } = useGridStore.getState();
      expect(mediaRegistry['media-1']).toBe('data:image/png;base64,abc123');
    });

    it('removeMedia("media-1"): removes entry from mediaRegistry', () => {
      useGridStore.getState().addMedia('media-1', 'data:image/png;base64,abc123');
      useGridStore.getState().removeMedia('media-1');

      const { mediaRegistry } = useGridStore.getState();
      expect(mediaRegistry['media-1']).toBeUndefined();
    });
  });

  describe('updateCell action', () => {
    it('updateCell(leafId, { fit: "contain" }): updates leaf fit property', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leaf = container.children[0] as LeafNode;
      expect(leaf.fit).toBe('cover');

      useGridStore.getState().updateCell(leaf.id, { fit: 'contain' });

      const { root } = useGridStore.getState();
      const updatedContainer = root as ContainerNode;
      const updatedLeaf = updatedContainer.children[0] as LeafNode;
      expect(updatedLeaf.fit).toBe('contain');
    });
  });

  describe('undo / redo', () => {
    it('undo: root reverts to previous snapshot and historyIndex decreases by 1', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;
      const originalRootId = container.id;

      useGridStore.getState().split(leafId, 'horizontal');
      const { historyIndex: indexAfterSplit } = useGridStore.getState();

      useGridStore.getState().undo();

      const { root, historyIndex } = useGridStore.getState();
      expect(historyIndex).toBe(indexAfterSplit - 1);
      // Root should be back to the original container
      expect(root.id).toBe(originalRootId);
    });

    it('redo: root restores to next snapshot and historyIndex increases by 1', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;

      useGridStore.getState().split(leafId, 'horizontal');
      const { root: rootAfterSplit } = useGridStore.getState();
      const { historyIndex: indexBeforeUndo } = useGridStore.getState();

      useGridStore.getState().undo();
      useGridStore.getState().redo();

      const { root, historyIndex } = useGridStore.getState();
      expect(historyIndex).toBe(indexBeforeUndo);
      // The root structure should match what it was after split
      expect(root.type).toBe(rootAfterSplit.type);
    });

    it('undo then new action: redo stack cleared', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;

      // Perform 2 splits
      useGridStore.getState().split(leafId, 'horizontal');
      const { root: afterFirstSplit } = useGridStore.getState();
      const newContainer = afterFirstSplit as ContainerNode;
      const nextLeafId = newContainer.children[0].id;
      useGridStore.getState().split(nextLeafId, 'vertical');

      const { history: historyAfterTwoSplits } = useGridStore.getState();

      // Undo once
      useGridStore.getState().undo();

      // Perform a new action — should clear redo stack
      const { root: rootAfterUndo } = useGridStore.getState();
      const containerAfterUndo = rootAfterUndo as ContainerNode;
      const aLeafId = containerAfterUndo.children[0].id;
      useGridStore.getState().split(aLeafId, 'vertical');

      const { history } = useGridStore.getState();
      // History should be truncated (redo stack cleared) then new entry pushed
      // After 2 splits: history.length = 3 (initial + split1 + split2)
      // After undo: historyIndex = 2 (points to 3rd entry, 0-indexed)
      // Wait — let me recalculate: initial=index 0, split1=index 1, split2=index 2
      // After undo: historyIndex=1, history still has 3 entries
      // New action: slice to historyIndex+1=2 (keeps [0,1]), push new = 3 entries
      expect(history).toHaveLength(historyAfterTwoSplits.length);
    });

    it('undo at historyIndex 0: no-op (root unchanged)', () => {
      const { root: originalRoot, historyIndex } = useGridStore.getState();
      expect(historyIndex).toBe(0);

      useGridStore.getState().undo();

      const { root: sameRoot, historyIndex: sameIndex } = useGridStore.getState();
      expect(sameIndex).toBe(0);
      expect(sameRoot).toBe(originalRoot);
    });

    it('redo at end of history: no-op (root unchanged)', () => {
      const { root: originalRoot } = useGridStore.getState();

      useGridStore.getState().redo();

      const { root: sameRoot } = useGridStore.getState();
      expect(sameRoot).toBe(originalRoot);
    });
  });

  describe('history cap', () => {
    it('after 51 mutations, history.length is capped at 50', () => {
      const getLeafId = () => {
        const { root } = useGridStore.getState();
        const container = root as ContainerNode;
        // Find the first leaf at any depth
        const findFirstLeaf = (node: ContainerNode): string => {
          for (const child of node.children) {
            if (child.type === 'leaf') return child.id;
            const found = findFirstLeaf(child as ContainerNode);
            if (found) return found;
          }
          return node.children[0].id;
        };
        if (container.type === 'container') {
          return findFirstLeaf(container);
        }
        return container.id;
      };

      // Perform 51 split operations
      for (let i = 0; i < 51; i++) {
        const leafId = getLeafId();
        useGridStore.getState().split(leafId, 'horizontal');
      }

      const { history } = useGridStore.getState();
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('mediaRegistry excluded from snapshots', () => {
    it('after addMedia + split + undo, mediaRegistry still contains the media entry', () => {
      // Add media to registry
      useGridStore.getState().addMedia('m1', 'data:image/png;base64,abc');

      // Perform a split (which creates a history snapshot)
      const container = useGridStore.getState().root as ContainerNode;
      const leafId = container.children[0].id;
      useGridStore.getState().split(leafId, 'horizontal');

      // Undo — restores tree to before split
      useGridStore.getState().undo();

      // mediaRegistry should still have the entry (not affected by undo)
      const { mediaRegistry } = useGridStore.getState();
      expect(mediaRegistry['m1']).toBe('data:image/png;base64,abc');
    });
  });

  describe('cleanupStaleBlobMedia', () => {
    it('removes blob: entries from mediaRegistry and mediaTypeMap, leaves base64 entries untouched', () => {
      // Seed: two leaves, one with base64 media and one with blob media
      const container = useGridStore.getState().root as ContainerNode;
      const leaf1 = container.children[0] as LeafNode;
      const leaf2 = container.children[1] as LeafNode;

      // Add base64 and blob media entries
      useGridStore.getState().addMedia('img-base64', 'data:image/png;base64,abc123', 'image');
      useGridStore.getState().addMedia('vid-blob', 'blob:http://localhost/fake-video-id', 'video');

      // Assign media to leaves
      useGridStore.getState().setMedia(leaf1.id, 'img-base64');
      useGridStore.getState().setMedia(leaf2.id, 'vid-blob');

      // Run cleanup
      useGridStore.getState().cleanupStaleBlobMedia();

      const { mediaRegistry, mediaTypeMap, root } = useGridStore.getState();

      // Blob entry removed
      expect(mediaRegistry['vid-blob']).toBeUndefined();
      expect(mediaTypeMap['vid-blob']).toBeUndefined();

      // Base64 entry untouched
      expect(mediaRegistry['img-base64']).toBe('data:image/png;base64,abc123');
      expect(mediaTypeMap['img-base64']).toBe('image');

      // Leaf referencing blob now has null mediaId
      const updatedContainer = root as ContainerNode;
      const updatedLeaf2 = updatedContainer.children[1] as LeafNode;
      expect(updatedLeaf2.mediaId).toBeNull();

      // Leaf referencing base64 is unchanged
      const updatedLeaf1 = updatedContainer.children[0] as LeafNode;
      expect(updatedLeaf1.mediaId).toBe('img-base64');
    });

    it('is a no-op when no blob entries exist (base64 images left alone)', () => {
      const container = useGridStore.getState().root as ContainerNode;
      const leaf1 = container.children[0] as LeafNode;

      useGridStore.getState().addMedia('img-only', 'data:image/png;base64,xyz789', 'image');
      useGridStore.getState().setMedia(leaf1.id, 'img-only');

      const stateBefore = useGridStore.getState();

      useGridStore.getState().cleanupStaleBlobMedia();

      const { mediaRegistry, mediaTypeMap, root } = useGridStore.getState();

      // Nothing changed
      expect(mediaRegistry['img-only']).toBe('data:image/png;base64,xyz789');
      expect(mediaTypeMap['img-only']).toBe('image');
      const updatedLeaf1 = (root as ContainerNode).children[0] as LeafNode;
      expect(updatedLeaf1.mediaId).toBe('img-only');

      // History length unchanged (cleanup is a no-op, no snapshot pushed)
      expect(useGridStore.getState().history.length).toBe(stateBefore.history.length);
    });
  });
});
