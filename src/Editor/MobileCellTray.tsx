/**
 * MobileCellTray — Phase 24
 * Persistent mobile-only action tray above the bottom sheet when a cell is selected.
 * Requirements: CELL-01, CELL-02, CELL-03 (see REQUIREMENTS.md and 24-UI-SPEC.md).
 * Analog: src/Grid/ActionBar.tsx (desktop) + src/Editor/MobileSheet.tsx (fixed/animation).
 */
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useDragStore } from '../dnd';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import {
  Upload,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Maximize2,
  Minimize2,
  ImageOff,
} from 'lucide-react';

const BTN_CLASS =
  'min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

export const MobileCellTray = React.memo(function MobileCellTray() {
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const isVisible = selectedNodeId !== null;
  // CROSS-08a (D-03): hide tray completely during drag to prevent ghost tap-throughs
  const isDragging = useDragStore(s => s.status === 'dragging');

  const split = useGridStore(s => s.split);
  const updateCell = useGridStore(s => s.updateCell);
  const removeMedia = useGridStore(s => s.removeMedia);
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);

  const fit = useGridStore(s => {
    if (!selectedNodeId) return 'cover' as const;
    const node = findNode(s.root, selectedNodeId);
    if (node && node.type === 'leaf') return (node as LeafNode).fit ?? 'cover';
    return 'cover' as const;
  });

  const mediaId = useGridStore(s => {
    if (!selectedNodeId) return null;
    const node = findNode(s.root, selectedNodeId);
    if (node && node.type === 'leaf') return (node as LeafNode).mediaId ?? null;
    return null;
  });
  const hasMedia = mediaId !== null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      // Read selectedNodeId at call time to avoid stale closure
      const nodeId = useEditorStore.getState().selectedNodeId;
      if (!nodeId) return;

      const { nanoid } = await import('nanoid');
      const newId = nanoid();

      if (file.type.startsWith('video/')) {
        const blobUrl = URL.createObjectURL(file);
        addMedia(newId, blobUrl, 'video');
      } else {
        const { fileToBase64 } = await import('../lib/media');
        const dataUri = await fileToBase64(file);
        addMedia(newId, dataUri, 'image');
      }
      setMedia(nodeId, newId);
    },
    [addMedia, setMedia],
  );

  const handleSplitH = useCallback(() => {
    if (selectedNodeId) split(selectedNodeId, 'horizontal');
  }, [split, selectedNodeId]);

  const handleSplitV = useCallback(() => {
    if (selectedNodeId) split(selectedNodeId, 'vertical');
  }, [split, selectedNodeId]);

  const handleToggleFit = useCallback(() => {
    if (selectedNodeId) {
      updateCell(selectedNodeId, { fit: fit === 'cover' ? 'contain' : 'cover' });
    }
  }, [updateCell, selectedNodeId, fit]);

  const handleClearMedia = useCallback(() => {
    if (mediaId && selectedNodeId) {
      removeMedia(mediaId);
      updateCell(selectedNodeId, { mediaId: null });
    }
  }, [removeMedia, updateCell, selectedNodeId, mediaId]);

  return (
    <div
      className="fixed left-0 right-0 z-[45] md:hidden motion-reduce:transition-none"
      style={{
        bottom: '60px',
        opacity: isDragging ? 0 : (isVisible ? 1 : 0),
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        pointerEvents: (isDragging || !isVisible) ? 'none' : 'auto',
        transition:
          'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      data-testid="mobile-cell-tray"
    >
      <div className="mx-4 flex items-center justify-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md">
        <button
          type="button"
          className={BTN_CLASS}
          onClick={handleUploadClick}
          aria-label={hasMedia ? 'Replace media' : 'Upload media'}
        >
          <Upload size={20} className="text-white" />
        </button>
        <button
          type="button"
          className={BTN_CLASS}
          onClick={handleSplitH}
          aria-label="Split horizontal"
        >
          <SplitSquareHorizontal size={20} className="text-white" />
        </button>
        <button
          type="button"
          className={BTN_CLASS}
          onClick={handleSplitV}
          aria-label="Split vertical"
        >
          <SplitSquareVertical size={20} className="text-white" />
        </button>
        <button
          type="button"
          className={BTN_CLASS}
          onClick={handleToggleFit}
          aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
        >
          {fit === 'cover' ? (
            <Minimize2 size={20} className="text-white" />
          ) : (
            <Maximize2 size={20} className="text-white" />
          )}
        </button>
        {hasMedia && (
          <button
            type="button"
            className={`${BTN_CLASS} hover:bg-red-500/20`}
            onClick={handleClearMedia}
            aria-label="Clear media"
          >
            <ImageOff size={20} className="text-white" />
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
});
