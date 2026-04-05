import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type { GridNode, SplitDirection, LeafNode } from '../types';
import {
  splitNode,
  mergeNode,
  removeNode,
  resizeSiblings,
  updateLeaf,
  buildInitialTree,
  getAllLeaves,
  swapLeafContent,
} from '../lib/tree';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GridStoreState = {
  root: GridNode;
  mediaRegistry: Record<string, string>;
  mediaTypeMap: Record<string, 'image' | 'video'>;
  history: Array<{ root: GridNode }>;
  historyIndex: number;
  // actions
  split: (nodeId: string, direction: SplitDirection) => void;
  merge: (nodeId: string) => void;
  remove: (nodeId: string) => void;
  resize: (containerId: string, index: number, delta: number) => void;
  setMedia: (nodeId: string, mediaId: string) => void;
  updateCell: (nodeId: string, updates: Partial<Omit<LeafNode, 'type' | 'id'>>) => void;
  addMedia: (mediaId: string, dataUri: string, type?: 'image' | 'video') => void;
  removeMedia: (mediaId: string) => void;
  clearGrid: () => void;
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateRoot: GridNode) => void;
  swapCells: (idA: string, idB: string) => void;
  cleanupStaleBlobMedia: () => void;
};

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

const HISTORY_CAP = 50;

/**
 * Takes a snapshot of the current root (before mutation), clears the redo
 * stack, pushes the snapshot, and caps history at HISTORY_CAP.
 * Mutates the Immer draft state in place.
 */
function pushSnapshot(state: {
  root: GridNode;
  history: Array<{ root: GridNode }>;
  historyIndex: number;
}): void {
  // 1. Snapshot BEFORE mutation — unwrap Draft with current() first
  const plainRoot = current(state.root);
  const snap = structuredClone({ root: plainRoot });
  // 2. Clear redo stack
  state.history = state.history.slice(0, state.historyIndex + 1);
  // 3. Push snapshot
  state.history.push(snap);
  // 4. Cap at HISTORY_CAP (remove oldest if overflow)
  if (state.history.length > HISTORY_CAP) {
    state.history.shift();
  }
  // 5. Update pointer
  state.historyIndex = state.history.length - 1;
}

const initialTree = buildInitialTree();

// ---------------------------------------------------------------------------
// Blob URL revocation helper
// ---------------------------------------------------------------------------

function revokeRegistryBlobUrls(mediaRegistry: Record<string, string>): void {
  for (const url of Object.values(mediaRegistry)) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGridStore = create<GridStoreState>()(
  immer((set) => ({
    root: initialTree,
    mediaRegistry: {},
    mediaTypeMap: {},
    // Initial tree state stored as history[0] so undo can return to starting state
    history: [{ root: structuredClone(initialTree) }],
    historyIndex: 0,

    split: (nodeId, direction) =>
      set(state => {
        pushSnapshot(state);
        state.root = splitNode(current(state.root), nodeId, direction);
      }),

    merge: (nodeId) =>
      set(state => {
        pushSnapshot(state);
        state.root = mergeNode(current(state.root), nodeId);
      }),

    remove: (nodeId) =>
      set(state => {
        pushSnapshot(state);
        state.root = removeNode(current(state.root), nodeId);
      }),

    resize: (containerId, index, delta) =>
      set(state => {
        pushSnapshot(state);
        state.root = resizeSiblings(current(state.root), containerId, index, delta);
      }),

    setMedia: (nodeId, mediaId) =>
      set(state => {
        pushSnapshot(state);
        state.root = updateLeaf(current(state.root), nodeId, { mediaId });
      }),

    updateCell: (nodeId, updates) =>
      set(state => {
        pushSnapshot(state);
        state.root = updateLeaf(current(state.root), nodeId, updates);
      }),

    // clearGrid resets root, mediaRegistry, mediaTypeMap, and history to initial state
    clearGrid: () =>
      set(state => {
        // Revoke any existing blob URLs before clearing
        revokeRegistryBlobUrls(current(state.mediaRegistry));
        const freshTree = buildInitialTree();
        state.root = freshTree;
        state.mediaRegistry = {};
        state.mediaTypeMap = {};
        state.history = [{ root: structuredClone(freshTree) }];
        state.historyIndex = 0;
      }),

    // addMedia and removeMedia do NOT push to history (mediaRegistry excluded from snapshots)
    addMedia: (mediaId, dataUri, type = 'image') =>
      set(state => {
        state.mediaRegistry[mediaId] = dataUri;
        state.mediaTypeMap[mediaId] = type;
      }),

    removeMedia: (mediaId) =>
      set(state => {
        // Revoke blob URL if present before deleting
        const url = state.mediaRegistry[mediaId];
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        delete state.mediaRegistry[mediaId];
        delete state.mediaTypeMap[mediaId];
      }),

    undo: () =>
      set(state => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        // Use current() to unwrap Immer Draft proxy before structuredClone
        const plainSnap = current(state.history[state.historyIndex]);
        state.root = structuredClone(plainSnap.root);
      }),

    redo: () =>
      set(state => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        // Use current() to unwrap Immer Draft proxy before structuredClone
        const plainSnap = current(state.history[state.historyIndex]);
        state.root = structuredClone(plainSnap.root);
      }),

    applyTemplate: (templateRoot: GridNode) =>
      set(state => {
        // Revoke any existing blob URLs before clearing
        revokeRegistryBlobUrls(current(state.mediaRegistry));
        pushSnapshot(state);
        state.root = templateRoot;
        state.mediaRegistry = {};
        state.mediaTypeMap = {};
      }),

    swapCells: (idA: string, idB: string) =>
      set(state => {
        pushSnapshot(state);
        state.root = swapLeafContent(current(state.root), idA, idB);
      }),

    // D-03: Cleanup stale blob media on app startup. Call from EditorShell on mount.
    // Blob URLs don't survive page reloads; clear any leaves that reference them.
    cleanupStaleBlobMedia: () =>
      set(state => {
        const plainRegistry = current(state.mediaRegistry);
        const staleIds: string[] = [];
        for (const [mediaId, url] of Object.entries(plainRegistry)) {
          if (typeof url === 'string' && url.startsWith('blob:')) {
            staleIds.push(mediaId);
          }
        }
        if (staleIds.length === 0) return;

        // Remove stale entries from registry and typeMap
        for (const mediaId of staleIds) {
          delete state.mediaRegistry[mediaId];
          delete state.mediaTypeMap[mediaId];
        }

        // Null out any leaf mediaIds that pointed to stale blob entries
        const plainRoot = current(state.root);
        const staleSet = new Set(staleIds);
        const leaves = getAllLeaves(plainRoot);
        for (const leaf of leaves) {
          if (leaf.mediaId && staleSet.has(leaf.mediaId)) {
            state.root = updateLeaf(current(state.root), leaf.id, { mediaId: null });
          }
        }
      }),
  })),
);
