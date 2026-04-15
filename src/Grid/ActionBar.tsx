import React, { useCallback } from 'react';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  Trash2,
  Maximize2,
  Minimize2,
  Upload,
  ImageOff,
  GripVertical,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ActionBarProps {
  nodeId: string;
  fit: 'cover' | 'contain';
  hasMedia: boolean;
  onUploadClick: () => void;
}

export const ActionBar = React.memo(function ActionBar({ nodeId, fit, hasMedia, onUploadClick }: ActionBarProps) {
  const split = useGridStore(s => s.split);
  const remove = useGridStore(s => s.remove);
  const updateCell = useGridStore(s => s.updateCell);
  const removeMedia = useGridStore(s => s.removeMedia);
  const mediaId = useGridStore(s => (findNode(s.root, nodeId) as LeafNode | null)?.mediaId ?? null);
  const mediaType = useGridStore(s => {
    const leaf = findNode(s.root, nodeId) as LeafNode | null;
    if (!leaf || leaf.type !== 'leaf' || !leaf.mediaId) return null;
    return s.mediaTypeMap[leaf.mediaId] ?? null;
  });
  const audioEnabled = useGridStore(s => {
    const leaf = findNode(s.root, nodeId) as LeafNode | null;
    return leaf && leaf.type === 'leaf' ? leaf.audioEnabled : true;
  });
  const hasAudioTrack = useGridStore(s => {
    const leaf = findNode(s.root, nodeId) as LeafNode | null;
    return leaf && leaf.type === 'leaf' ? (leaf.hasAudioTrack ?? false) : false;
  });
  const toggleAudioEnabled = useGridStore(s => s.toggleAudioEnabled);

  const handleSplitH = useCallback(() => split(nodeId, 'horizontal'), [split, nodeId]);
  const handleSplitV = useCallback(() => split(nodeId, 'vertical'), [split, nodeId]);
  const handleRemove = useCallback(() => remove(nodeId), [remove, nodeId]);
  const handleToggleFit = useCallback(
    () => updateCell(nodeId, { fit: fit === 'cover' ? 'contain' : 'cover' }),
    [updateCell, nodeId, fit]
  );
  const handleClearMedia = useCallback(() => {
    if (mediaId) {
      removeMedia(mediaId);
      updateCell(nodeId, { mediaId: null });
    }
  }, [removeMedia, updateCell, nodeId, mediaId]);

  const ICON_SIZE = 32; // logical icon size (kept as number for lucide)
  const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors w-16 h-16';

  return (
    <TooltipProvider delay={300}>
      <div
        className="flex items-center gap-1 px-1 py-1 rounded-md bg-black/70 backdrop-blur-sm"
        data-testid={`action-bar-${nodeId}`}
      >
        {/* Button order: Drag Handle (always) → Upload/Replace → Split H → Split V → Toggle Fit → Clear Media → Remove Cell */}

        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/cell-id', nodeId);
            e.dataTransfer.effectAllowed = 'move';
          }}
          className={`${btnClass} cursor-grab active:cursor-grabbing`}
          aria-label="Drag to move"
          title="Drag to move"
          data-testid={`drag-handle-${nodeId}`}
        >
          <GripVertical size={ICON_SIZE} className="text-white" />
        </button>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={onUploadClick} aria-label={hasMedia ? 'Replace image' : 'Upload image'} />}>
            <Upload size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{hasMedia ? 'Replace image' : 'Upload image'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleSplitH} aria-label="Split horizontal" />}>
            <SplitSquareHorizontal size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Split horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleSplitV} aria-label="Split vertical" />}>
            <SplitSquareVertical size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Split vertical</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleToggleFit} aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'} />}>
            {fit === 'cover'
              ? <Minimize2 size={ICON_SIZE} className="text-white" />
              : <Maximize2 size={ICON_SIZE} className="text-white" />
            }
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
          </TooltipContent>
        </Tooltip>

        {mediaType === 'video' && (
          hasAudioTrack ? (
            // Interactive toggle — unchanged from existing behavior
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    data-testid="audio-button"
                    className={`${btnClass} ${!audioEnabled ? 'hover:bg-red-500/20' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAudioEnabled(nodeId);
                    }}
                    aria-label={audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
                  />
                }
              >
                {audioEnabled
                  ? <Volume2 size={ICON_SIZE} className="text-white" />
                  : <VolumeX size={ICON_SIZE} className="text-red-500" />
                }
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
              </TooltipContent>
            </Tooltip>
          ) : (
            // Locked state — no audio track detected
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    data-testid="audio-button"
                    className={`${btnClass} cursor-not-allowed`}
                    disabled
                    aria-label="No audio track"
                  />
                }
              >
                <VolumeX size={ICON_SIZE} className="text-gray-400 opacity-40" />
              </TooltipTrigger>
              <TooltipContent side="bottom">No audio track</TooltipContent>
            </Tooltip>
          )
        )}

        {hasMedia && (
          <Tooltip>
            <TooltipTrigger render={<button className={`${btnClass} hover:bg-red-500/20`} onClick={handleClearMedia} aria-label="Clear media" />}>
              <ImageOff size={ICON_SIZE} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear media</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger render={<button className={`${btnClass} hover:bg-red-500/20`} onClick={handleRemove} aria-label="Remove cell" />}>
            <Trash2 size={ICON_SIZE} className="text-red-500" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Remove cell</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
