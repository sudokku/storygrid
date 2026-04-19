import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { CanvasWrapper } from '../Grid/CanvasWrapper';
import { useGridStore } from '../store/gridStore';
import { autoFillCells } from '../lib/media';
import { PlaybackTimeline } from './PlaybackTimeline';

export function CanvasArea() {
  const hasVideos = useGridStore(s => Object.values(s.mediaTypeMap).some(t => t === 'video'));
  const addMedia = useGridStore(s => s.addMedia);
  const setMedia = useGridStore(s => s.setMedia);
  const split = useGridStore(s => s.split);
  const setHasAudioTrack = useGridStore(s => s.setHasAudioTrack);

  const [isFileDragOver, setIsFileDragOver] = useState(false);
  // D-16: counter pattern — increments on dragenter, decrements on dragleave.
  // Only clear visual state when counter reaches 0 (true leave of <main>, not nested transition).
  const dragCounter = useRef(0);

  const isFileDrag = (e: React.DragEvent): boolean => {
    return Array.from(e.dataTransfer.types).includes('Files');
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(e)) return; // D-15: ignore cell-swap drags
    e.preventDefault();
    dragCounter.current += 1;
    setIsFileDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); // required to allow drop
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(e)) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsFileDragOver(false);
    }
  }, []);

  // D-18: capture-phase reset — fires BEFORE LeafNode.handleDrop's stopPropagation,
  // so the workspace drop overlay clears even when files are dropped into a cell.
  // This is purely visual state cleanup; LeafNode still owns file consumption for cell drops.
  const handleDropCapture = useCallback((e: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(e)) return;
    dragCounter.current = 0;
    setIsFileDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLElement>) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setIsFileDragOver(false);

      // D-07: cell drops are intercepted by LeafNode.handleDrop (which calls stopPropagation),
      // so this handler only fires for drops on <main> background / padding outside any cell.
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // D-08: route through existing autoFillCells helper — no new routing logic.
      await autoFillCells(files, {
        addMedia,
        setMedia,
        split,
        getRoot: () => useGridStore.getState().root,
        setHasAudioTrack,
      });
    },
    [addMedia, setMedia, split, setHasAudioTrack],
  );

  return (
    <main
      className={
        'relative flex flex-col flex-1 items-center overflow-hidden bg-[#0f0f0f] p-0 pt-2 md:p-8' +
        (isFileDragOver ? ' ring-4 ring-[#3b82f6] ring-inset' : '')
      }
      style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDropCapture={handleDropCapture}
      onDrop={handleDrop}
      data-testid="workspace-main"
    >
      <div className="flex-1 flex items-start justify-center w-full overflow-hidden">
        <CanvasWrapper />
      </div>
      {hasVideos && <PlaybackTimeline />}

      {/* D-13: top-center label pill — only while a file is being dragged over */}
      {isFileDragOver && (
        <div
          className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-medium shadow-lg"
          data-testid="workspace-drop-pill"
        >
          Drop image or video
        </div>
      )}
    </main>
  );
}
