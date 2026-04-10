import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Overlay, TextOverlay, EmojiOverlay, StickerOverlay } from '../types';
// Static circular import is safe because Zustand stores are created via factory
// functions; each store's getState() is only called lazily inside action bodies.
import { useGridStore } from './gridStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverlayAddPartial =
  | Omit<TextOverlay, 'id' | 'zIndex'>
  | Omit<EmojiOverlay, 'id' | 'zIndex'>
  | Omit<StickerOverlay, 'id' | 'zIndex'>;

type OverlayStoreState = {
  overlays: Overlay[];
  stickerRegistry: Record<string, string>; // id -> base64/dataUri

  addOverlay: (partial: OverlayAddPartial) => string;
  deleteOverlay: (id: string) => void;
  updateOverlay: (id: string, updates: Partial<Overlay>) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  addSticker: (stickerId: string, dataUri: string) => void;
  removeSticker: (stickerId: string) => void;
  replaceAll: (overlays: Overlay[]) => void; // used by gridStore undo/redo
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOverlayStore = create<OverlayStoreState>()(
  immer((set) => ({
    overlays: [],
    stickerRegistry: {},

    addOverlay: (partial) => {
      const newId = nanoid();
      set(state => {
        const maxZ = state.overlays.reduce((m, o) => Math.max(m, o.zIndex), 0);
        state.overlays.push({ ...partial, id: newId, zIndex: maxZ + 1 } as Overlay);
      });
      // Integrate into shared undo/redo history (D-05: one Ctrl+Z undoes one add)
      useGridStore.getState().pushOverlaySnapshot();
      return newId;
    },

    deleteOverlay: (id) => {
      set(state => {
        state.overlays = state.overlays.filter(o => o.id !== id);
      });
      // Integrate into shared undo/redo history
      useGridStore.getState().pushOverlaySnapshot();
    },

    updateOverlay: (id, updates) => {
      set(state => {
        const idx = state.overlays.findIndex(o => o.id === id);
        if (idx === -1) return;
        Object.assign(state.overlays[idx], updates);
      });
      // D-04: move/resize/rotate NOT in undo history
    },

    bringForward: (id) => {
      set(state => {
        const overlay = state.overlays.find(o => o.id === id);
        if (overlay) overlay.zIndex += 1;
      });
      // D-04: z-order not in undo history
    },

    sendBackward: (id) => {
      set(state => {
        const overlay = state.overlays.find(o => o.id === id);
        if (overlay) overlay.zIndex = Math.max(0, overlay.zIndex - 1);
      });
      // D-04: z-order not in undo history
    },

    addSticker: (stickerId, dataUri) => {
      set(state => {
        state.stickerRegistry[stickerId] = dataUri;
      });
      // D-06: registry is side-channel, not in undo history
    },

    removeSticker: (stickerId) => {
      set(state => {
        delete state.stickerRegistry[stickerId];
      });
    },

    replaceAll: (overlays) => {
      set(state => {
        state.overlays = overlays as typeof state.overlays;
      });
      // NO pushSnapshot — this is called BY undo/redo itself
    },
  })),
);
