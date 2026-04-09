import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import { autoFillCells } from '../lib/media';
import { loadImage, drawLeafToCanvas } from '../lib/export';
import { videoElementRegistry, registerVideo, unregisterVideo } from '../lib/videoRegistry';
import type { LeafNode } from '../types';
import { ImageIcon, ArrowLeftRight } from 'lucide-react';
import { ActionBar } from './ActionBar';

interface LeafNodeProps {
  id: string;
}

/**
 * Recompute totalDuration as the max duration across all registered video elements.
 * Called whenever a video loads or is unregistered.
 */
function recomputeTotalDuration() {
  let maxDur = 0;
  for (const video of videoElementRegistry.values()) {
    if (video.duration && isFinite(video.duration)) {
      maxDur = Math.max(maxDur, video.duration);
    }
  }
  useEditorStore.getState().setTotalDuration(maxDur);
}

export const LeafNodeComponent = React.memo(function LeafNodeComponent({ id }: LeafNodeProps) {
  const node = useGridStore(state => findNode(state.root, id) as LeafNode | null);
  const mediaUrl = useGridStore(state => {
    const n = findNode(state.root, id) as LeafNode | null;
    return n?.mediaId ? state.mediaRegistry[n.mediaId] ?? null : null;
  });
  const mediaType = useGridStore(state => {
    const n = findNode(state.root, id) as LeafNode | null;
    return n?.mediaId ? state.mediaTypeMap[n.mediaId] ?? 'image' : 'image';
  });
  const isSelected = useEditorStore(s => s.selectedNodeId === id);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);
  const borderRadius = useEditorStore(s => s.borderRadius);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const canvasScale = useEditorStore(s => s.canvasScale);
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);
  const split = useGridStore(s => s.split);
  const updateCell = useGridStore(s => s.updateCell);
  const moveCell = useGridStore(s => s.moveCell);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  type ActiveZone = 'top' | 'bottom' | 'left' | 'right' | 'center' | null;
  const [activeZone, setActiveZone] = useState<ActiveZone>(null);
  const [isTooSmall, setIsTooSmall] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Holds the loaded HTMLImageElement — never rendered to DOM
  const imgElRef = useRef<HTMLImageElement | null>(null);
  // Holds the programmatically created HTMLVideoElement — never rendered to DOM
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number>(0);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const cellSizeRef = useRef({ w: 0, h: 0 });
  const drawRef = useRef<() => void>(() => {});

  // Derived: is this cell currently showing a video?
  const isVideo = mediaType === 'video';

  // Track cell container dimensions via ResizeObserver
  // Also drives isTooSmall state for empty placeholder label hiding (D-08)
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    cellSizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    const observer = new ResizeObserver((entries) => {
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
      // Hide label when cell rendered height is below 80px (D-08)
      const observedH = entries[0]?.contentRect.height ?? h;
      setIsTooSmall(observedH < 80);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [id]);

  // Build stable redraw function — reads latest state directly from stores
  // Handles both image and video sources
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current;
      // Use video element if available, fall back to image element
      const source: HTMLImageElement | HTMLVideoElement | null =
        videoElRef.current ?? imgElRef.current;
      if (!canvas || !source) return;
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

      drawLeafToCanvas(ctx, source, { x: 0, y: 0, w: cw, h: ch }, leafState);

      if (br > 0) {
        ctx.restore();
      }
    };
  }, [id]);

  // Load image when mediaUrl changes for image cells
  useEffect(() => {
    if (isVideo || !mediaUrl) {
      if (!isVideo) imgElRef.current = null;
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
  }, [mediaUrl, isVideo]);

  // Create/destroy hidden video element when mediaUrl changes for video cells
  useEffect(() => {
    if (!isVideo || !mediaUrl) {
      // Cleanup: if no longer a video cell, ensure unregistered
      if (videoElRef.current) {
        videoElRef.current.src = '';
        videoElRef.current = null;
        unregisterVideo(id);
        recomputeTotalDuration();
      }
      return;
    }

    // Create a programmatic video element — never inserted into the DOM
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.src = mediaUrl;

    let firstSeekDone = false;

    const onLoadedMetadata = () => {
      // Report duration to editor store
      recomputeTotalDuration();
      // Seek to time 0 to get first frame
      video.currentTime = 0;
    };

    const onSeeked = () => {
      if (!firstSeekDone) {
        firstSeekDone = true;
        // Draw the first frame
        drawRef.current();
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.load();

    videoElRef.current = video;

    // Register in global registry so playback controller and export can access it
    registerVideo(id, video, () => drawRef.current());

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.src = '';
      videoElRef.current = null;
      unregisterVideo(id);
      recomputeTotalDuration();
    };
  }, [mediaUrl, isVideo, id]);

  // rAF loop — runs only while isPlaying=true and this cell has a video
  useEffect(() => {
    if (!isPlaying || !isVideo) {
      // Draw one final still frame when stopping
      if (isVideo && videoElRef.current) {
        drawRef.current();
      }
      return;
    }

    function tick() {
      drawRef.current();
      rafIdRef.current = requestAnimationFrame(tick);
    }
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [isPlaying, isVideo]);

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
        curr.objectPosition !== prevLeaf.objectPosition ||
        curr.effects !== prevLeaf.effects
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
      const vid = videoElRef.current;
      const { w: cw, h: ch } = cellSizeRef.current;
      let clampedPanX = n?.panX ?? 0;
      let clampedPanY = n?.panY ?? 0;

      // Use video dimensions for video cells, image dimensions for image cells
      const naturalW = img ? img.naturalWidth : (vid?.videoWidth ?? 0);
      const naturalH = img ? img.naturalHeight : (vid?.videoHeight ?? 0);
      const hasMediaDimensions = (img != null || vid != null) && naturalW > 0 && naturalH > 0;

      if (hasMediaDimensions && cw > 0 && ch > 0 && (n?.fit ?? 'cover') === 'cover') {
        const imgAspect = naturalW / naturalH;
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

  // Pinch-to-zoom touch handlers — registered with passive:false to allow preventDefault
  useEffect(() => {
    if (!isPanMode) return;
    const el = divRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const n = findNode(useGridStore.getState().root, id) as LeafNode | null;
        pinchStartScaleRef.current = n?.panScale ?? 1;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault(); // prevent page scroll during pinch
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.max(1, Math.min(3, pinchStartScaleRef.current * ratio));
      updateCell(id, { panScale: newScale });
    };

    const handleTouchEnd = () => {
      pinchStartDistRef.current = 0;
      pinchStartScaleRef.current = 1;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
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

    if (isCellDrag) {
      // Phase 9 D-01: 5-zone hit detection during cell-to-cell drag.
      const rect = divRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        // 20% of short dimension, minimum 20px physical band so small cells stay usable.
        const threshold = Math.max(20, Math.min(w, h) * 0.2);
        let zone: ActiveZone;
        if (y < threshold) zone = 'top';
        else if (y > h - threshold) zone = 'bottom';
        else if (x < threshold) zone = 'left';
        else if (x > w - threshold) zone = 'right';
        else zone = 'center';
        setActiveZone(zone);
      }
      // Do NOT set isDragOver for cell drags — that is the file-drop indicator.
    } else {
      // File drag — preserve existing behavior.
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const zoneAtDrop = activeZone;
    setActiveZone(null);

    // D-16 (MVP scope): Cell swap uses native HTML5 drag events (dataTransfer text/cell-id).
    // Native HTML5 drag events do not fire on iOS/Android touch — cell swap is desktop-only.
    // See .planning/decisions/adr-cell-swap-touch.md
    //
    // Phase 9 D-04: Drop routing goes through moveCell (not swapCells directly). The
    // 'center' edge delegates to swap semantics inside the store; other edges perform a
    // structural move via moveLeafToEdge.
    const fromId = e.dataTransfer.getData('text/cell-id');
    if (fromId && fromId !== id) {
      moveCell(fromId, id, zoneAtDrop ?? 'center');
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
  }, [id, activeZone, moveCell, addMedia, setMedia, split]);

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
    const vid = videoElRef.current;

    // Use cell dimensions if available; fall back to 1 so percentage conversion still works
    const effectiveCw = cw > 0 ? cw : 1;
    const effectiveCh = ch > 0 ? ch : 1;

    const dxPct = (dx / effectiveCw) * 100;
    const dyPct = (dy / effectiveCh) * 100;
    let newPanX = panStartRef.current.panX + dxPct;
    let newPanY = panStartRef.current.panY + dyPct;

    // Use video dimensions for video cells, image dimensions for image cells
    const naturalW = img ? img.naturalWidth : (vid?.videoWidth ?? 0);
    const naturalH = img ? img.naturalHeight : (vid?.videoHeight ?? 0);
    const hasMediaDimensions = (img != null || vid != null) && naturalW > 0 && naturalH > 0;

    if (fit === 'cover' && hasMediaDimensions && cw > 0 && ch > 0) {
      const imgAspect = naturalW / naturalH;
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
        relative w-full h-full overflow-visible select-none
        ${isHovered && !isPanMode ? 'z-20' : ''}
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
      style={{
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
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Canvas clipping wrapper — overflow-hidden isolates media rendering from cell overflow (D-01, D-02, D-03) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: mediaUrl ? 'block' : 'none' }}
        />
      </div>

      {!mediaUrl && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2">
          <ImageIcon
            style={{ width: 'clamp(40px, 3.2vw, 64px)', height: 'clamp(40px, 3.2vw, 64px)' }}
            className="text-[#666666]"
          />
          <span className={`text-[clamp(20px,1.4vw,28px)] text-[#666666] ${isTooSmall ? 'hidden' : ''}`}>
            Drop image or use Upload button
          </span>
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
      {/* Drop target highlight (file drag only — cell drags use the 5-zone overlays below) */}
      {isDragOver && (
        <div className="absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10" data-testid={`drop-target-${id}`} />
      )}

      {/*
        Phase 9 D-02: 5-zone drop overlays during cell-to-cell drag.
        - Edge zones render a thick accent-blue insertion line (scale-stable via 1/canvasScale).
        - Center zone renders a dimmed swap overlay with an icon.
        - pointer-events-none prevents overlays from stealing dragover/drop events (Pitfall 4).
      */}
      {activeZone === 'top' && (
        <div
          data-testid={`edge-line-top-${id}`}
          className="absolute pointer-events-none z-20"
          style={{ top: 0, left: 0, right: 0, height: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }}
        />
      )}
      {activeZone === 'bottom' && (
        <div
          data-testid={`edge-line-bottom-${id}`}
          className="absolute pointer-events-none z-20"
          style={{ bottom: 0, left: 0, right: 0, height: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }}
        />
      )}
      {activeZone === 'left' && (
        <div
          data-testid={`edge-line-left-${id}`}
          className="absolute pointer-events-none z-20"
          style={{ top: 0, bottom: 0, left: 0, width: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }}
        />
      )}
      {activeZone === 'right' && (
        <div
          data-testid={`edge-line-right-${id}`}
          className="absolute pointer-events-none z-20"
          style={{ top: 0, bottom: 0, right: 0, width: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }}
        />
      )}
      {activeZone === 'center' && (
        <div
          data-testid={`swap-overlay-${id}`}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        >
          <ArrowLeftRight size={32 / canvasScale} className="text-white" />
        </div>
      )}

      {/*
        ActionBar — sibling of the canvas-clip-wrapper (NOT a descendant), so it
        is not subject to overflow:hidden. Cell root is overflow-visible and has
        no `isolate`, so z-50 escapes per-cell stacking and paints above any
        neighbouring sibling cell the bar overflows into.

        CELL-01 (Phase 10, v1.1 audit): do NOT re-introduce `isolate` on the root
        div. `isolate` creates a per-cell stacking context that traps the z-50
        ActionBar wrapper inside the cell and clips it at sibling boundaries at
        small cell sizes. The audit flagged this as a real-browser regression
        risk even though jsdom could not detect it.
      */}
      {isHovered && !isPanMode && (
        <div
          className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 z-50"
          data-testid={`action-bar-wrapper-${id}`}
        >
          <ActionBar
            nodeId={id}
            fit={node.fit}
            hasMedia={hasMedia}
            onUploadClick={handleUploadClick}
          />
        </div>
      )}
    </div>
  );
});
