import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type { GridNode, SplitDirection, LeafNode } from '../types';
import type { EffectSettings, PresetName } from '../lib/effects';
import { DEFAULT_EFFECTS, PRESET_VALUES } from '../lib/effects';
import {
  splitNode,
  mergeNode,
  removeNode,
  resizeSiblings,
  updateLeaf,
  buildInitialTree,
  getAllLeaves,
  swapLeafContent,
  moveLeafToEdge,
  findNode,
} from '../lib/tree';
import { useEditorStore } from './editorStore';

// ---------------------------------------------------------------------------
// Video thumbnail capture helper (MEDIA-01 backend, D-09/D-10)
// ---------------------------------------------------------------------------

export async function captureVideoThumbnail(blobUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
      if (timeoutId) clearTimeout(timeoutId);
    };
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onMeta = () => {
      try {
        video.currentTime = 0;
      } catch {
        finish(null);
      }
    };
    const onSeeked = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, w, h);
        finish(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        finish(null);
      }
    };
    const onError = () => finish(null);
    timeoutId = setTimeout(() => finish(null), 2000);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.src = blobUrl;
  });
}

// Indirection object so tests can override captureVideoThumbnail without
// ES module namespace tricks. addMedia calls _capture.fn instead of the
// function directly, allowing vi.fn() replacement in tests.
export const _capture = {
  fn: captureVideoThumbnail,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GridStoreState = {
  root: GridNode;
  mediaRegistry: Record<string, string>;
  mediaTypeMap: Record<string, 'image' | 'video'>;
  thumbnailMap: Record<string, string>;
  history: Array<{ root: GridNode }>;
  historyIndex: number;
  // actions
  split: (nodeId: string, direction: SplitDirection) => void;
  merge: (nodeId: string) => void;
  remove: (nodeId: string) => void;
  resize: (containerId: string, index: number, delta: number) => void;
  setMedia: (nodeId: string, mediaId: string) => void;
  updateCell: (nodeId: string, updates: Partial<Omit<LeafNode, 'type' | 'id'>>) => void;
  toggleAudioEnabled: (nodeId: string) => void;
  setEffects: (nodeId: string, partial: Partial<EffectSettings>) => void;
  beginEffectsDrag: (nodeId: string) => void;
  applyPreset: (nodeId: string, presetName: PresetName) => void;
  resetEffects: (nodeId: string) => void;
  resetCell: (nodeId: string) => void;
  addMedia: (mediaId: string, dataUri: string, type?: 'image' | 'video') => void;
  removeMedia: (mediaId: string) => void;
  clearGrid: () => void;
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateRoot: GridNode) => void;
  swapCells: (idA: string, idB: string) => void;
  moveCell: (
    fromId: string,
    toId: string,
    edge: 'center' | 'top' | 'bottom' | 'left' | 'right',
  ) => void;
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
  immer((set, get) => ({
    root: initialTree,
    mediaRegistry: {},
    mediaTypeMap: {},
    thumbnailMap: {},
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

    toggleAudioEnabled: (nodeId) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        pushSnapshot(state);
        state.root = updateLeaf(current(state.root), nodeId, {
          audioEnabled: !leaf.audioEnabled,
        });
      }),

    // ---------------------------------------------------------------------
    // Effects actions (Phase 11 — D-14, D-15, D-19, D-20, D-21)
    // ---------------------------------------------------------------------

    // setEffects: NO snapshot — caller pairs with beginEffectsDrag on drag
    // start so a full drag produces one undo entry. Per D-15, touching any
    // numeric slider while a preset is active clears the preset flag.
    setEffects: (nodeId, partial) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        const nextEffects: EffectSettings = { ...leaf.effects, ...partial };
        const touchesNumeric =
          'brightness' in partial ||
          'contrast' in partial ||
          'saturation' in partial ||
          'blur' in partial;
        if (touchesNumeric && leaf.effects.preset !== null) {
          nextEffects.preset = null;
        }
        state.root = updateLeaf(current(state.root), nodeId, { effects: nextEffects });
      }),

    // beginEffectsDrag: pushes the pre-drag snapshot only. No tree write.
    // No-op if nodeId doesn't resolve to a leaf (avoids polluting history).
    beginEffectsDrag: (nodeId) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        pushSnapshot(state);
      }),

    // applyPreset: one snapshot + write. Sets preset flag + numeric values.
    applyPreset: (nodeId, presetName) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        pushSnapshot(state);
        const nextEffects: EffectSettings = {
          preset: presetName,
          ...PRESET_VALUES[presetName],
        };
        state.root = updateLeaf(current(state.root), nodeId, { effects: nextEffects });
      }),

    // resetEffects: one snapshot + write. Only touches effects (preserves
    // pan/fit/backgroundColor/objectPosition/mediaId).
    resetEffects: (nodeId) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        pushSnapshot(state);
        state.root = updateLeaf(current(state.root), nodeId, {
          effects: { ...DEFAULT_EFFECTS },
        });
      }),

    // resetCell: one snapshot + write. Clears effects + pan/zoom/fit/bg/
    // objectPosition. Preserves mediaId (the media stays; presentation resets).
    resetCell: (nodeId) =>
      set(state => {
        const leaf = findNode(current(state.root), nodeId);
        if (!leaf || leaf.type !== 'leaf') return;
        pushSnapshot(state);
        state.root = updateLeaf(current(state.root), nodeId, {
          effects: { ...DEFAULT_EFFECTS },
          panX: 0,
          panY: 0,
          panScale: 1,
          fit: 'cover',
          objectPosition: 'center center',
          backgroundColor: null,
        });
      }),

    // clearGrid resets root, mediaRegistry, mediaTypeMap, thumbnailMap, and history to initial state
    clearGrid: () =>
      set(state => {
        // Revoke any existing blob URLs before clearing
        revokeRegistryBlobUrls(current(state.mediaRegistry));
        const freshTree = buildInitialTree();
        state.root = freshTree;
        state.mediaRegistry = {};
        state.mediaTypeMap = {};
        state.thumbnailMap = {};
        state.history = [{ root: structuredClone(freshTree) }];
        state.historyIndex = 0;
      }),

    // addMedia and removeMedia do NOT push to history (mediaRegistry excluded from snapshots)
    addMedia: (mediaId, dataUri, type = 'image') => {
      set(state => {
        state.mediaRegistry[mediaId] = dataUri;
        state.mediaTypeMap[mediaId] = type;
      });
      if (type === 'video') {
        _capture.fn(dataUri).then((thumb) => {
          if (!thumb) return;
          // Verify mediaId still exists (not removed during capture)
          const snapshot = get();
          if (snapshot.mediaRegistry[mediaId]) {
            set(state => {
              state.thumbnailMap[mediaId] = thumb;
            });
          }
        });
      }
    },

    removeMedia: (mediaId) =>
      set(state => {
        // Revoke blob URL if present before deleting
        const url = state.mediaRegistry[mediaId];
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        delete state.mediaRegistry[mediaId];
        delete state.mediaTypeMap[mediaId];
        delete state.thumbnailMap[mediaId];
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
        // Snapshot FIRST so undo restores the previous tree + media binding.
        pushSnapshot(state);

        // DFS walk of old leaves — collect mediaIds in visual order.
        const oldLeaves = getAllLeaves(current(state.root));
        const carriedMediaIds = oldLeaves
          .map(l => l.mediaId)
          .filter((id): id is string => id !== null);

        // DFS walk of new template leaves.
        const newLeaves = getAllLeaves(templateRoot);

        // Migrate min(N, M) media references onto the new leaves via updateLeaf.
        // Only the raw mediaId is copied — fit/objectPosition/backgroundColor/pan
        // stay at the createLeaf() defaults.
        let nextRoot: GridNode = templateRoot;
        const migrateCount = Math.min(carriedMediaIds.length, newLeaves.length);
        for (let i = 0; i < migrateCount; i++) {
          nextRoot = updateLeaf(nextRoot, newLeaves[i].id, {
            mediaId: carriedMediaIds[i],
          });
        }

        // Determine surplus media to drop (slice — NOT set diff, to handle dups).
        const keptIds = new Set(carriedMediaIds.slice(0, newLeaves.length));
        const droppedIds = carriedMediaIds.filter(id => !keptIds.has(id));

        // Prune dropped media from registry, typeMap, thumbnailMap.
        // Per-id blob revocation — do NOT use revokeRegistryBlobUrls (that
        // would revoke kept blobs too).
        for (const id of droppedIds) {
          const url = state.mediaRegistry[id];
          if (typeof url === 'string' && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
          delete state.mediaRegistry[id];
          delete state.mediaTypeMap[id];
          delete state.thumbnailMap[id];
        }

        state.root = nextRoot;
      }),

    swapCells: (idA: string, idB: string) =>
      set(state => {
        pushSnapshot(state);
        state.root = swapLeafContent(current(state.root), idA, idB);
      }),

    // Phase 9 D-04/D-05: atomic move of a leaf to a target cell's edge.
    // edge === 'center' delegates to swapLeafContent (existing swap semantics).
    // Other edges trigger a structural move via moveLeafToEdge (Plan 01 primitive).
    // Single pushSnapshot per successful call = one undo entry.
    moveCell: (fromId, toId, edge) =>
      set(state => {
        // No-op guards (D-04 / EC-05). These do NOT push a snapshot.
        if (fromId === toId) return;
        const src = findNode(current(state.root), fromId);
        if (!src || src.type !== 'leaf') return;
        const tgt = findNode(current(state.root), toId);
        if (!tgt || tgt.type !== 'leaf') return;

        pushSnapshot(state);
        if (edge === 'center') {
          // D-04: center delegates to existing swap semantics.
          state.root = swapLeafContent(current(state.root), fromId, toId);
        } else {
          // D-04/D-05: edge triggers structural move via pure tree primitive.
          state.root = moveLeafToEdge(current(state.root), fromId, toId, edge);
          // D-06/EC-18: the source leaf's id is discarded; any selection
          // pointing at fromId is now stale. Clear it so UI doesn't reference
          // a non-existent node.
          useEditorStore.getState().setSelectedNode(null);
        }
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

        // Remove stale entries from registry, typeMap, and thumbnailMap
        for (const mediaId of staleIds) {
          delete state.mediaRegistry[mediaId];
          delete state.mediaTypeMap[mediaId];
          delete state.thumbnailMap[mediaId];
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
