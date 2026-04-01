import React, { useCallback, useRef } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import { autoFillCells } from '../lib/media';
import type { LeafNode, ContainerNode, GridNode } from '../types';
import { ImageIcon, Upload, ImageOff, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Cell dimension helper
// ---------------------------------------------------------------------------

/**
 * Computes the pixel dimensions of a leaf node at 1080×1920 resolution.
 * Walks from root to target via path-tracking, multiplying fractional sizes
 * at each container level.
 *
 * direction='vertical' → children stack top-to-bottom → splits height
 * direction='horizontal' → children placed side-by-side → splits width
 */
function computeCellDimensions(root: GridNode, nodeId: string): { w: number; h: number } | null {
  const typedPath: Array<{ node: ContainerNode; idx: number }> = [];

  function findPath(node: GridNode, targetId: string): boolean {
    if (node.id === targetId) return true;
    if (node.type !== 'container') return false;
    for (let i = 0; i < node.children.length; i++) {
      typedPath.push({ node: node as ContainerNode, idx: i });
      if (findPath(node.children[i], targetId)) return true;
      typedPath.pop();
    }
    return false;
  }

  if (!findPath(root, nodeId)) return null;

  let wFraction = 1;
  let hFraction = 1;
  for (const { node, idx } of typedPath) {
    const totalWeight = node.sizes.reduce((sum, s) => sum + s, 0);
    const fraction = node.sizes[idx] / totalWeight;
    if (node.direction === 'vertical') {
      // vertical container stacks children top-to-bottom → splits height
      hFraction *= fraction;
    } else {
      // horizontal container places children side-by-side → splits width
      wFraction *= fraction;
    }
  }

  return { w: Math.round(1080 * wFraction), h: Math.round(1920 * hFraction) };
}

// ---------------------------------------------------------------------------
// No-selection panel (D-09)
// ---------------------------------------------------------------------------

function NoSelectionPanel() {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Canvas</p>
      {/* Background color — Phase 5 stub */}
      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Background color</label>
        <input
          type="color"
          disabled
          defaultValue="#000000"
          className="w-full h-8 rounded border border-[#2a2a2a] bg-[#2a2a2a] cursor-not-allowed opacity-40"
          title="Available in Phase 5"
        />
      </div>
      {/* Gap slider — Phase 5 stub */}
      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Cell gap</label>
        <input
          type="range"
          disabled
          defaultValue={0}
          min={0}
          max={24}
          className="w-full cursor-not-allowed opacity-40"
          title="Available in Phase 5"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected cell panel (D-10)
// ---------------------------------------------------------------------------

interface SelectedCellPanelProps {
  nodeId: string;
}

const SelectedCellPanel = React.memo(function SelectedCellPanel({ nodeId }: SelectedCellPanelProps) {
  const node = useGridStore(s => findNode(s.root, nodeId) as LeafNode | null);
  const mediaUrl = useGridStore(s => {
    const n = findNode(s.root, nodeId) as LeafNode | null;
    return n?.mediaId ? s.mediaRegistry[n.mediaId] ?? null : null;
  });
  const root = useGridStore(s => s.root);
  const updateCell = useGridStore(s => s.updateCell);
  const remove = useGridStore(s => s.remove);
  const removeMedia = useGridStore(s => s.removeMedia);
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);
  const split = useGridStore(s => s.split);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => inputRef.current?.click(), []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;

      if (files.length === 1 && node?.mediaId) {
        // Single file when cell already has media: replace only this cell
        const mediaId = node.mediaId;
        const { fileToBase64 } = await import('../lib/media');
        const dataUri = await fileToBase64(files[0]);
        removeMedia(mediaId);
        const { nanoid } = await import('nanoid');
        const newId = nanoid();
        addMedia(newId, dataUri);
        setMedia(nodeId, newId);
      } else {
        // Multi-file or empty cell: use autoFillCells
        await autoFillCells(files, {
          addMedia,
          setMedia,
          split,
          getRoot: () => useGridStore.getState().root,
        });
      }
    },
    [node, nodeId, removeMedia, addMedia, setMedia, split],
  );

  const handleClearMedia = useCallback(() => {
    if (node?.mediaId) {
      removeMedia(node.mediaId);
      updateCell(nodeId, { mediaId: null });
    }
  }, [node, nodeId, removeMedia, updateCell]);

  const handleRemove = useCallback(() => {
    setSelectedNode(null);
    remove(nodeId);
  }, [nodeId, remove, setSelectedNode]);

  const handleFitToggle = useCallback(
    (fit: 'cover' | 'contain') => {
      updateCell(nodeId, { fit });
    },
    [nodeId, updateCell],
  );

  const handleBgColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateCell(nodeId, { backgroundColor: e.target.value });
    },
    [nodeId, updateCell],
  );

  const dims = computeCellDimensions(root, nodeId);

  if (!node || node.type !== 'leaf') return null;

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Cell</p>

      {/* 1. Thumbnail */}
      <div className="w-full aspect-video rounded overflow-hidden bg-[#111111] border border-[#2a2a2a] flex items-center justify-center">
        {mediaUrl ? (
          <img src={mediaUrl} className="w-full h-full object-contain" alt="Cell thumbnail" />
        ) : (
          <ImageIcon size={24} className="text-neutral-600" />
        )}
      </div>

      {/* 2. Fit toggle */}
      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Fit</label>
        <div className="flex rounded overflow-hidden border border-[#2a2a2a]">
          <button
            className={`flex-1 py-1.5 text-xs transition-colors ${node.fit === 'cover' ? 'bg-[#3b82f6] text-white' : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'}`}
            onClick={() => handleFitToggle('cover')}
          >
            Cover
          </button>
          <button
            className={`flex-1 py-1.5 text-xs transition-colors ${node.fit === 'contain' ? 'bg-[#3b82f6] text-white' : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'}`}
            onClick={() => handleFitToggle('contain')}
          >
            Contain
          </button>
        </div>
      </div>

      {/* 3. Background color — only in contain mode */}
      {node.fit === 'contain' && (
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Background color</label>
          <input
            type="color"
            value={node.backgroundColor ?? '#000000'}
            onChange={handleBgColor}
            className="w-full h-8 rounded border border-[#2a2a2a] cursor-pointer bg-transparent"
          />
        </div>
      )}

      {/* 4. Cell dimensions */}
      {dims && (
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Dimensions</label>
          <p className="text-xs text-neutral-300 font-mono" data-testid="cell-dimensions">
            {dims.w} × {dims.h} px
          </p>
        </div>
      )}

      {/* 5. Actions row */}
      <div className="space-y-2 pt-1">
        {/* Upload/Replace */}
        <button
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 transition-colors"
          onClick={handleUploadClick}
        >
          <Upload size={14} />
          {mediaUrl ? 'Replace image' : 'Upload image'}
        </button>

        {/* Clear Media — only when has media (D-08) */}
        {mediaUrl && (
          <button
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-red-500/20 text-red-400 transition-colors"
            onClick={handleClearMedia}
          >
            <ImageOff size={14} />
            Clear image
          </button>
        )}

        {/* Remove Cell */}
        <button
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-red-500/20 text-red-400 transition-colors"
          onClick={handleRemove}
        >
          <Trash2 size={14} />
          Remove cell
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);

  return (
    <aside
      className="w-[280px] shrink-0 bg-[#1c1c1c] border-l border-[#2a2a2a] overflow-y-auto"
      data-testid="sidebar"
    >
      {selectedNodeId ? (
        <SelectedCellPanel nodeId={selectedNodeId} key={selectedNodeId} />
      ) : (
        <NoSelectionPanel />
      )}
    </aside>
  );
}
