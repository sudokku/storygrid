import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
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
  const imgRef = useRef<HTMLImageElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [cellSize, setCellSize] = useState({ w: 0, h: 0 });

  // Reset natural size when media URL changes so we re-read on next load
  useEffect(() => {
    setNaturalSize(null);
  }, [mediaUrl]);

  // Track cell container dimensions via ResizeObserver
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    setCellSize({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(() => {
      setCellSize({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  // Compute base cover/contain dimensions matching export.ts drawPannedCoverImage formula
  const imgRenderParams = useMemo(() => {
    if (!naturalSize || cellSize.w === 0 || cellSize.h === 0) return null;
    const { w: nw, h: nh } = naturalSize;
    const { w: cw, h: ch } = cellSize;
    const imgAspect = nw / nh;
    const cellAspect = cw / ch;
    let baseW: number, baseH: number;
    if (node?.fit === 'contain') {
      // Contain: fit inside cell
      if (imgAspect > cellAspect) {
        baseW = cw;
        baseH = cw / imgAspect;
      } else {
        baseH = ch;
        baseW = ch * imgAspect;
      }
    } else {
      // Cover (default): fill cell
      if (imgAspect > cellAspect) {
        baseH = ch;
        baseW = ch * imgAspect;
      } else {
        baseW = cw;
        baseH = cw / imgAspect;
      }
    }
    return { baseW, baseH, cw, ch };
  }, [naturalSize, cellSize, node?.fit]);

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

    const params = imgRenderParams;
    const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
    const scale = n?.panScale ?? 1;
    const fit = n?.fit ?? 'cover';

    if (params) {
      const { cw, ch } = params;
      // Convert pixel deltas to percentage of cell dimensions for consistent sensitivity
      const dxPct = (dx / cw) * 100;
      const dyPct = (dy / ch) * 100;
      let newPanX = panStartRef.current.panX + dxPct;
      let newPanY = panStartRef.current.panY + dyPct;

      if (fit === 'cover') {
        const { baseW, baseH } = params;
        // Clamp so image edges cannot leave cell boundary
        const maxPanX = ((baseW * scale - cw) / 2 / cw) * 100;
        const maxPanY = ((baseH * scale - ch) / 2 / ch) * 100;
        newPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
        newPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));
      } else {
        // Contain mode: allow free panning within [-100, 100]
        newPanX = Math.max(-100, Math.min(100, newPanX));
        newPanY = Math.max(-100, Math.min(100, newPanY));
      }

      updateCell(id, { panX: newPanX, panY: newPanY });
    } else {
      // Fallback when imgRenderParams not yet available: pixel-to-pct conversion using cell size
      const el = divRef.current;
      const cw = el?.clientWidth ?? 1;
      const ch = el?.clientHeight ?? 1;
      const dxPct = (dx / cw) * 100;
      const dyPct = (dy / ch) * 100;
      const newPanX = Math.max(-100, Math.min(100, panStartRef.current.panX + dxPct));
      const newPanY = Math.max(-100, Math.min(100, panStartRef.current.panY + dyPct));
      updateCell(id, { panX: newPanX, panY: newPanY });
    }
  }, [isPanMode, id, updateCell, imgRenderParams]);

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

  // Render the image using absolute positioning that matches the canvas export formula:
  // center the natural-aspect cover/contain image in the cell, then translate by panX% of cell width.
  const renderMedia = () => {
    if (!mediaUrl) return null;

    const panX = node.panX ?? 0;
    const panY = node.panY ?? 0;
    const scale = node.panScale ?? 1;

    if (imgRenderParams) {
      const { baseW, baseH, cw, ch } = imgRenderParams;
      const scaledW = baseW * scale;
      const scaledH = baseH * scale;
      const left = (cw - scaledW) / 2 + (panX / 100) * cw;
      const top = (ch - scaledH) / 2 + (panY / 100) * ch;
      return (
        <img
          ref={imgRef}
          src={mediaUrl}
          onLoad={handleImgLoad}
          style={{
            position: 'absolute',
            width: `${scaledW}px`,
            height: `${scaledH}px`,
            left: `${left}px`,
            top: `${top}px`,
          }}
          alt=""
          draggable={false}
        />
      );
    }

    // Fallback while natural dimensions are loading — capture load event to get dimensions
    return (
      <img
        ref={imgRef}
        src={mediaUrl}
        onLoad={handleImgLoad}
        className={node.fit === 'contain' ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
        style={node.fit === 'contain' ? { objectPosition: node.objectPosition ?? 'center center' } : undefined}
        alt=""
        draggable={false}
      />
    );
  };

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
        renderMedia()
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
