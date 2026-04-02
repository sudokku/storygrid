import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import { autoFillCells } from '../lib/media';
import { loadImage, drawLeafToCanvas } from '../lib/export';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Holds the loaded HTMLImageElement — never rendered to DOM
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const cellSizeRef = useRef({ w: 0, h: 0 });
  const drawRef = useRef<() => void>(() => {});

  // Track cell container dimensions via ResizeObserver
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    cellSizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      cellSizeRef.current = { w, h };
      // Update canvas physical pixel dimensions
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      drawRef.current();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build stable redraw function — reads latest state directly from stores
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current;
      const img = imgElRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w: cw, h: ch } = cellSizeRef.current;
      if (cw === 0 || ch === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const physW = Math.round(cw * dpr);
      const physH = Math.round(ch * dpr);

      // Ensure canvas dimensions are up to date
      if (canvas.width !== physW || canvas.height !== physH) {
        canvas.width = physW;
        canvas.height = physH;
      }

      // Reset transform and clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, physW, physH);

      // Scale context for DPR so all draw calls are in CSS pixels
      ctx.scale(dpr, dpr);

      const leafState = findNode(useGridStore.getState().root, id) as LeafNode | null;
      if (!leafState) return;

      const br = useEditorStore.getState().borderRadius;
      if (br > 0) {
        ctx.save();
        ctx.beginPath();
        const r = Math.min(br, cw / 2, ch / 2);
        if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
          (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(0, 0, cw, ch, r);
        } else {
          ctx.moveTo(r, 0);
          ctx.arcTo(cw, 0, cw, ch, r);
          ctx.arcTo(cw, ch, 0, ch, r);
          ctx.arcTo(0, ch, 0, 0, r);
          ctx.arcTo(0, 0, cw, 0, r);
          ctx.closePath();
        }
        ctx.clip();
      }

      drawLeafToCanvas(ctx, img, { x: 0, y: 0, w: cw, h: ch }, leafState);

      if (br > 0) {
        ctx.restore();
      }
    };
  }, [id]);

  // Load image when mediaUrl changes and trigger a redraw
  useEffect(() => {
    if (!mediaUrl) {
      imgElRef.current = null;
      return;
    }
    let cancelled = false;
    loadImage(mediaUrl).then(img => {
      if (!cancelled) {
        imgElRef.current = img;
        drawRef.current();
      }
    }).catch(() => {
      if (!cancelled) imgElRef.current = null;
    });
    return () => { cancelled = true; };
  }, [mediaUrl]);

  // Subscribe to gridStore for per-cell pan/zoom/fit/media changes (bypass React re-render)
  useEffect(() => {
    const unsubGrid = useGridStore.subscribe((state, prev) => {
      const curr = findNode(state.root, id) as LeafNode | null;
      const prevLeaf = findNode(prev.root, id) as LeafNode | null;
      if (!curr || !prevLeaf) return;
      if (
        curr.panX !== prevLeaf.panX ||
        curr.panY !== prevLeaf.panY ||
        curr.panScale !== prevLeaf.panScale ||
        curr.fit !== prevLeaf.fit ||
        curr.mediaId !== prevLeaf.mediaId ||
        curr.objectPosition !== prevLeaf.objectPosition
      ) {
        drawRef.current();
      }
    });

    const unsubEditor = useEditorStore.subscribe((state, prev) => {
      if (state.borderRadius !== prev.borderRadius) {
        drawRef.current();
      }
    });

    return () => {
      unsubGrid();
      unsubEditor();
    };
  }, [id]);

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

      // Re-clamp panX/panY for the new scale to prevent cover constraint violation
      const img = imgElRef.current;
      const { w: cw, h: ch } = cellSizeRef.current;
      let clampedPanX = n?.panX ?? 0;
      let clampedPanY = n?.panY ?? 0;

      if (img && cw > 0 && ch > 0 && (n?.fit ?? 'cover') === 'cover') {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const cellAspect = cw / ch;
        let baseW: number, baseH: number;
        if (imgAspect > cellAspect) {
          baseH = ch;
          baseW = ch * imgAspect;
        } else {
          baseW = cw;
          baseH = cw / imgAspect;
        }
        const maxPanX = ((baseW * newScale - cw) / 2 / cw) * 100;
        const maxPanY = ((baseH * newScale - ch) / 2 / ch) * 100;
        clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, clampedPanX));
        clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, clampedPanY));
      }

      updateCell(id, { panScale: newScale, panX: clampedPanX, panY: clampedPanY });
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

  // Fix: setPointerCapture on the wrapper div, not e.target
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPanMode) return;
    e.preventDefault();
    e.stopPropagation();
    divRef.current?.setPointerCapture?.(e.pointerId);
    const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: n?.panX ?? 0, panY: n?.panY ?? 0 };
  }, [isPanMode, id]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanMode || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    const { w: cw, h: ch } = cellSizeRef.current;
    const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
    const scale = n?.panScale ?? 1;
    const fit = n?.fit ?? 'cover';
    const img = imgElRef.current;

    // Use cell dimensions if available; fall back to 1 so percentage conversion still works
    const effectiveCw = cw > 0 ? cw : 1;
    const effectiveCh = ch > 0 ? ch : 1;

    const dxPct = (dx / effectiveCw) * 100;
    const dyPct = (dy / effectiveCh) * 100;
    let newPanX = panStartRef.current.panX + dxPct;
    let newPanY = panStartRef.current.panY + dyPct;

    if (fit === 'cover' && img && cw > 0 && ch > 0) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const cellAspect = cw / ch;
      let baseW: number, baseH: number;
      if (imgAspect > cellAspect) {
        baseH = ch;
        baseW = ch * imgAspect;
      } else {
        baseW = cw;
        baseH = cw / imgAspect;
      }
      // Clamp so image edges cannot leave cell boundary
      const maxPanX = ((baseW * scale - cw) / 2 / cw) * 100;
      const maxPanY = ((baseH * scale - ch) / 2 / ch) * 100;
      newPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
      newPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));
    } else {
      // Contain mode or no image dimensions: allow free panning within [-100, 100]
      newPanX = Math.max(-100, Math.min(100, newPanX));
      newPanY = Math.max(-100, Math.min(100, newPanY));
    }

    updateCell(id, { panX: newPanX, panY: newPanY });
  }, [isPanMode, id, updateCell]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current) {
      divRef.current?.releasePointerCapture?.(e.pointerId);
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
        relative w-full h-full isolate overflow-hidden select-none
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
      style={{
        borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
        backfaceVisibility: 'hidden',
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

      {/* Canvas for media rendering — always present when media is loaded */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: mediaUrl ? 'block' : 'none' }}
      />

      {!mediaUrl && (
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
