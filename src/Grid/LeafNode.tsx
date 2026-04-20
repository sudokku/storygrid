import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import { autoFillCells, detectAudioTrack } from '../lib/media';
import { loadImage, drawLeafToCanvas } from '../lib/export';
import { videoElementRegistry, registerVideo, unregisterVideo } from '../lib/videoRegistry';
import type { LeafNode } from '../types';
import { ImageIcon } from 'lucide-react';
import { ActionBar } from './ActionBar';
import { useCellDraggable, useCellDropTarget, DropZoneIndicators, useDragStore } from '../dnd';

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
  const setHasAudioTrack = useGridStore(s => s.setHasAudioTrack);
  const updateCell = useGridStore(s => s.updateCell);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTooSmall, setIsTooSmall] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
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
    // NOTE: do NOT set video.muted here. The Web Audio API wires this element
    // as a MediaElementAudioSourceNode source; muting it silences audio before
    // it can reach the GainNode graph (Bug: phase-21-no-audio-preview).
    const video = document.createElement('video');
    video.playsInline = true;
    video.loop = true;
    video.src = mediaUrl;

    let firstSeekDone = false;

    const onLoadedMetadata = () => {
      // Report duration to editor store
      recomputeTotalDuration();
      // Seek to time 0 to get first frame
      video.currentTime = 0;
      // D-03: iOS Safari does not fire seeked unless the decoder is activated by play().
      // File drop is a user gesture — play() is allowed even on unmuted video.
      // Do NOT await — seeked fires as a side effect; AbortError is benign.
      video.play().catch(() => { /* AbortError from seek-triggered pause is benign */ });
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

  // Phase 28: single-engine drag wiring
  const {
    setNodeRef: setDragRef,
    listeners: dragListeners,
    attributes: dragAttributes,
    isDragging,
    style: dragStyle,  // CROSS-02 + CROSS-03 (D-02)
  } = useCellDraggable(id);
  const { setNodeRef: setDropRef } = useCellDropTarget(id);

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    divRef.current = el;
    setDragRef(el);
    setDropRef(el);
  }, [setDragRef, setDropRef]);

  // dragStore selectors for per-cell visual state
  const isSource = useDragStore((s) => s.sourceId === id && s.status === 'dragging');
  const isDropTarget = useDragStore((s) => s.overId === id && s.status === 'dragging');
  const isLastDrop = useDragStore((s) => s.lastDropId === id);

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
      setHasAudioTrack,
    });
  }, [addMedia, setMedia, split, setHasAudioTrack]);

  // Phase 25: file-drop from desktop preserved as a separate handler.
  // Only handles actual file drops (dataTransfer.files) — not @dnd-kit pointer events.
  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (files.length === 1) {
      // DROP-03 / SC6: Single file targets THIS cell exactly
      const file = files[0];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
      const { nanoid } = await import('nanoid');
      const mediaId = nanoid();
      if (file.type.startsWith('video/')) {
        const blobUrl = URL.createObjectURL(file);
        addMedia(mediaId, blobUrl, 'video');
      } else {
        const { fileToBase64 } = await import('../lib/media');
        const dataUri = await fileToBase64(file);
        addMedia(mediaId, dataUri, 'image');
      }
      setMedia(id, mediaId);
      // D-02: Audio detection for single-file direct drops
      const hasAudio = file.type.startsWith('video/')
        ? await detectAudioTrack(file)
        : false;
      setHasAudioTrack(id, hasAudio);
    } else {
      // Multi-file: use BFS autoFillCells
      await autoFillCells(files, {
        addMedia,
        setMedia,
        split,
        getRoot: () => useGridStore.getState().root,
        setHasAudioTrack,
      });
    }
  }, [id, addMedia, setMedia, split, setHasAudioTrack]);

  const handleFileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only react to file drags from desktop (not @dnd-kit pointer drags)
    const hasFiles = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleFileDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Fix: setPointerCapture on the wrapper div, not e.target
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // D-01/D-02: record pointer coords at true pointerdown time.
    // MUST be called before the !isPanMode guard — the grab-point offset fix
    // in grabOffsetModifier reads these coords regardless of pan mode.
    useDragStore.getState().setPointerDown(e.clientX, e.clientY);
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
    : isDropTarget && !isSource
      ? 'ring-2 ring-primary ring-inset'   // DROP-04: 2px accent outline on hovered target
      : isSelected
        ? 'ring-2 ring-[#3b82f6] ring-inset'
        : !mediaUrl ? 'border border-dashed border-[#333333]' : '';

  return (
    <div
      ref={setRefs}
      {...dragAttributes}
      className={`
        relative w-full h-full overflow-visible select-none
        ${isHovered && !isPanMode ? 'z-20' : ''}
        ${isDragging ? 'z-50' : ''}
        ${isDragging ? 'animate-cell-wobble' : ''}
        ${isLastDrop ? 'animate-drop-flash' : ''}
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
      style={{
        ...dragStyle,                        // touchAction:'none', WebkitTouchCallout:'none' (D-02)
        backfaceVisibility: 'hidden',
        transition: 'opacity 150ms ease-out',
        cursor: isPanMode ? undefined : 'grab',  // DRAG-01: grab on hover at all times
        opacity: isSource ? 0.4 : 1,             // GHOST-07: source cell dims to 40%
        // NOTE: touchAction:'none' removed here — now sourced from dragStyle (D-02 single-source-of-truth)
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      {...(!isPanMode ? dragListeners : {})}     /* PITFALL 1: spread LAST after every explicit handler */
      data-testid={`leaf-${id}`}
      aria-label="Drag to move"
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
      {/* Drop target highlight (file drag only — cell drags use DropZoneIndicators below) */}
      {isDragOver && (
        <div className="absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10" data-testid={`drop-target-${id}`} />
      )}

      {/* DROP-01: 5-zone drop indicators rendered only on the hovered drop-target cell */}
      {isDropTarget && !isSource && (
        <DropZoneIndicators cellId={id} canvasScale={canvasScale} />
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
