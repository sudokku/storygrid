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
  swapLeafContent,
} from '../lib/tree';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GridStoreState = {
  root: GridNode;
  mediaRegistry: Record<string, string>;
  history: Array<{ root: GridNode }>;
  historyIndex: number;
  // actions
  split: (nodeId: string, direction: SplitDirection) => void;
  merge: (nodeId: string) => void;
  remove: (nodeId: string) => void;
  resize: (containerId: string, index: number, delta: number) => void;
  setMedia: (nodeId: string, mediaId: string) => void;
  updateCell: (nodeId: string, updates: Partial<Omit<LeafNode, 'type' | 'id'>>) => void;
  addMedia: (mediaId: string, dataUri: string) => void;
  removeMedia: (mediaId: string) => void;
  clearGrid: () => void;
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateRoot: GridNode) => void;
  swapCells: (idA: string, idB: string) => void;
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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialTree = buildInitialTree();

export const useGridStore = create<GridStoreState>()(
  immer((set) => ({
    root: initialTree,
    mediaRegistry: {},
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

    // clearGrid resets root, mediaRegistry, and history to initial state
    clearGrid: () =>
      set(state => {
        const freshTree = buildInitialTree();
        state.root = freshTree;
        state.mediaRegistry = {};
        state.history = [{ root: structuredClone(freshTree) }];
        state.historyIndex = 0;
      }),

    // addMedia and removeMedia do NOT push to history (mediaRegistry excluded from snapshots)
    addMedia: (mediaId, dataUri) =>
      set(state => {
        state.mediaRegistry[mediaId] = dataUri;
      }),

    removeMedia: (mediaId) =>
      set(state => {
        delete state.mediaRegistry[mediaId];
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
        pushSnapshot(state);
        state.root = templateRoot;
        state.mediaRegistry = {};
      }),

    swapCells: (idA: string, idB: string) =>
      set(state => {
        pushSnapshot(state);
        state.root = swapLeafContent(current(state.root), idA, idB);
      }),
  })),
);
