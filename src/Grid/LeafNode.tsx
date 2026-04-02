import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import { autoFillCells } from '../lib/media';
import type { LeafNode } from '../types';
import { ImageIcon } from 'lucide-react';
import { ActionBar } from './ActionBar';

interface LeafNodeProps {
  id: string;
}

export const LeafNodeComponent = React.memo(function LeafNodeComponent({ id }: LeafNodeProps) {
  const node = useGridStore(state => findNode(state.root, id) as LeafNode | null);
  const mediaUrl = useGridStore(state => {
    const n = findNode(state.root, id) as LeafNode | null;
    return n?.mediaId ? state.mediaRegistry[n.mediaId] ?? null : null;
  });
  const isSelected = useEditorStore(s => s.selectedNodeId === id);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);
  const canvasScale = useEditorStore(s => s.canvasScale);
  const borderRadius = useEditorStore(s => s.borderRadius);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);
  const split = useGridStore(s => s.split);
  const updateCell = useGridStore(s => s.updateCell);
  const swapCells = useGridStore(s => s.swapCells);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  if (!node || node.type !== 'leaf') return null;

  const hasMedia = !!mediaUrl;
  const isPanMode = panModeNodeId === id;
  const isPanModeOtherCell = panModeNodeId !== null && panModeNodeId !== id;

  // Native wheel listener — React's onWheel is passive in React 17+ and cannot preventDefault
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!isPanMode) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
      const newScale = Math.max(1, Math.min(3, (n?.panScale ?? 1) + delta));
      updateCell(id, { panScale: newScale });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isPanMode, id, updateCell]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(isSelected ? null : id);
  }, [id, isSelected, setSelectedNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (hasMedia) {
      setPanModeNodeId(isPanMode ? null : id);
    }
  }, [hasMedia, isPanMode, id, setPanModeNodeId]);

  const handleUploadClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    await autoFillCells(files, {
      addMedia,
      setMedia,
      split,
      getRoot: () => useGridStore.getState().root,
    });
  }, [addMedia, setMedia, split]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const isCellDrag = Array.from(e.dataTransfer.types).includes('text/cell-id');
    e.dataTransfer.dropEffect = isCellDrag ? 'move' : 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Cell swap comes first — drag handle sets text/cell-id
    const fromId = e.dataTransfer.getData('text/cell-id');
    if (fromId && fromId !== id) {
      swapCells(fromId, id);
      return;
    }

    // File drop fallback
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await autoFillCells(files, {
        addMedia,
        setMedia,
        split,
        getRoot: () => useGridStore.getState().root,
      });
    }
  }, [id, swapCells, addMedia, setMedia, split]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPanMode) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: n?.panX ?? 0, panY: n?.panY ?? 0 };
  }, [isPanMode, id]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanMode || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    // Sensitivity: 1px mouse = 1% of cell pan — enough to traverse the full image
    const newPanX = Math.max(-100, Math.min(100, panStartRef.current.panX + dx));
    const newPanY = Math.max(-100, Math.min(100, panStartRef.current.panY + dy));
    updateCell(id, { panX: newPanX, panY: newPanY });
  }, [isPanMode, id, updateCell]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      panStartRef.current = null;
    }
  }, []);

  const ringClass = isPanMode
    ? 'ring-2 ring-[#f59e0b] ring-inset'
    : isSelected
      ? 'ring-2 ring-[#3b82f6] ring-inset'
      : !mediaUrl ? 'border border-dashed border-[#333333]' : '';

  return (
    <div
      ref={divRef}
      className={`
        relative w-full h-full isolate overflow-hidden
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
      style={{
        borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-testid={`leaf-${id}`}
      aria-selected={isSelected}
      role="gridcell"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {mediaUrl ? (
        node.fit === 'cover' ? (
          // Pan/zoom: size a wrapper to panScale * 100% of the cell and position it so
          // the cell's overflow-hidden clips to show the correct image region.
          // Formula matches canvas drawPannedCoverImage: left = (1-panScale)*50 + panX
          <div
            className="absolute"
            style={{
              width: `${(node.panScale ?? 1) * 100}%`,
              height: `${(node.panScale ?? 1) * 100}%`,
              left: `${(1 - (node.panScale ?? 1)) * 50 + (node.panX ?? 0)}%`,
              top: `${(1 - (node.panScale ?? 1)) * 50 + (node.panY ?? 0)}%`,
            }}
          >
            <img src={mediaUrl} className="w-full h-full object-cover" alt="" draggable={false} />
          </div>
        ) : (
          <img
            src={mediaUrl}
            className="w-full h-full object-contain"
            style={{ objectPosition: node.objectPosition ?? 'center center' }}
            alt=""
            draggable={false}
          />
        )
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2">
          <ImageIcon size={24} className="text-[#666666]" />
          <span className="text-sm text-[#666666]">Drop image or use Upload button</span>
        </div>
      )}

      {/* Hover overlay */}
      {mediaUrl && isHovered && !isPanMode && (
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      )}
      {/* Dim other cells while any cell is in pan mode */}
      {isPanModeOtherCell && (
        <div className="absolute inset-0 bg-black/65 pointer-events-none z-10" data-testid={`dim-overlay-${id}`} />
      )}
      {/* Drop target highlight (cell swap or file drag) */}
      {isDragOver && (
        <div className="absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10" data-testid={`drop-target-${id}`} />
      )}

      {/* ActionBar: visible on hover, hidden in pan mode */}
      <div
        className={`
          absolute top-2 left-1/2 z-20
          transition-opacity duration-150
          ${isHovered && !isPanMode ? 'opacity-100 delay-150' : 'opacity-0 pointer-events-none'}
        `}
        style={{ transform: `translateX(-50%) scale(${1 / canvasScale})`, transformOrigin: 'top center' }}
      >
        <ActionBar nodeId={id} fit={node.fit} hasMedia={hasMedia} onUploadClick={handleUploadClick} />
      </div>
    </div>
  );
});
