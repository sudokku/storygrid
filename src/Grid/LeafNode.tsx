import React, { useState, useCallback, useRef } from 'react';
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
  const borderColor = useEditorStore(s => s.borderColor);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);
  const split = useGridStore(s => s.split);
  const updateCell = useGridStore(s => s.updateCell);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  if (!node || node.type !== 'leaf') return null;

  const hasMedia = !!mediaUrl;
  const isPanMode = panModeNodeId === id;
  const isPanModeOtherCell = panModeNodeId !== null && panModeNodeId !== id;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // D-12: toggle selection — click already-selected deselects
    setSelectedNode(isSelected ? null : id);
  }, [id, isSelected, setSelectedNode]);

  // D-08: double-click on selected cell with media enters pan mode
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSelected && hasMedia) {
      setPanModeNodeId(id);
    }
  }, [isSelected, hasMedia, id, setPanModeNodeId]);

  const handleUploadClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // Reset input so the same file can be re-selected
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
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    await autoFillCells(files, {
      addMedia,
      setMedia,
      split,
      getRoot: () => useGridStore.getState().root,
    });
  }, [addMedia, setMedia, split]);

  // D-11: pan drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPanMode) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }
    const currentNode = useGridStore.getState().root;
    const n = findNode(currentNode, id) as LeafNode | null;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: n?.panX ?? 0, panY: n?.panY ?? 0 };
  }, [isPanMode, id]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanMode || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    // 1px mouse movement = ~0.15% pan offset
    const sensitivity = 0.15;
    const newPanX = Math.max(-100, Math.min(100, panStartRef.current.panX + dx * sensitivity));
    const newPanY = Math.max(-100, Math.min(100, panStartRef.current.panY + dy * sensitivity));
    updateCell(id, { panX: newPanX, panY: newPanY });
  }, [isPanMode, id, updateCell]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current) {
      const target = e.target as HTMLElement;
      if (target.releasePointerCapture) {
        target.releasePointerCapture(e.pointerId);
      }
      panStartRef.current = null;
    }
  }, []);

  // D-11: wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isPanMode) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const currentNode = useGridStore.getState().root;
    const n = findNode(currentNode, id) as LeafNode | null;
    const currentScale = n?.panScale ?? 1;
    const newScale = Math.max(1, Math.min(3, currentScale + delta));
    updateCell(id, { panScale: newScale });
  }, [isPanMode, id, updateCell]);

  // D-09: ring styling logic
  // isPanMode → amber ring
  // isSelected && !isPanMode → blue ring
  // else → dashed border for empty cells
  const ringClass = isPanMode
    ? 'ring-2 ring-[#f59e0b] ring-inset'
    : isSelected
      ? 'ring-2 ring-[#3b82f6] ring-inset'
      : !mediaUrl ? 'border border-dashed border-[#333333]' : '';

  return (
    <div
      className={`
        relative w-full h-full isolate overflow-hidden
        ${ringClass}
        bg-[#1c1c1c]
      `}
      style={{
        borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
        outline: `1px solid ${borderColor}`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
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
        <img
          src={mediaUrl}
          className={`w-full h-full ${node.fit === 'cover' ? 'object-cover' : 'object-contain'}`}
          style={{
            objectPosition: node.objectPosition ?? 'center center',
            transform: (node.panX !== 0 || node.panY !== 0 || node.panScale !== 1)
              ? `translate(${node.panX}%, ${node.panY}%) scale(${node.panScale})`
              : undefined,
            transformOrigin: 'center center',
          }}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2">
          <ImageIcon size={24} className="text-[#666666]" />
          <span className="text-sm text-[#666666]">Drop image or use Upload button</span>
        </div>
      )}
      {/* Dim overlay on hover when filled (normal mode) */}
      {mediaUrl && isHovered && !isPanMode && (
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      )}
      {/* D-09: Dim overlay on OTHER cells when some cell is in pan mode */}
      {isPanModeOtherCell && (
        <div className="absolute inset-0 bg-black/40 pointer-events-none z-10" data-testid={`dim-overlay-${id}`} />
      )}
      {/* ActionBar: visible on hover, hidden in pan mode (D-12) */}
      <div
        className={`
          absolute top-2 left-1/2 -translate-x-1/2 z-20
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
