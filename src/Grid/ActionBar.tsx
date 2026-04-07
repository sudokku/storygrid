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

  const BTN_SIZE = 'clamp(28px, 2.2vw, 36px)';
  const ICON_SIZE = 16; // logical icon size (kept as number for lucide)
  const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors';

  return (
    <TooltipProvider delay={300}>
      <div
        className="flex items-center gap-1 px-1 py-1 rounded-md bg-black/70 backdrop-blur-sm"
        data-testid={`action-bar-${nodeId}`}
      >
        {/* Button order: Drag Handle (if media) → Upload/Replace → Split H → Split V → Toggle Fit → Clear Media → Remove Cell */}

        {hasMedia && (
          <button
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/cell-id', nodeId);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className={`${btnClass} cursor-grab active:cursor-grabbing`}
            style={{ width: BTN_SIZE, height: BTN_SIZE }}
            aria-label="Drag to swap"
            title="Drag to swap"
            data-testid={`drag-handle-${nodeId}`}
          >
            <GripVertical size={ICON_SIZE} className="text-white" />
          </button>
        )}

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={onUploadClick} aria-label={hasMedia ? 'Replace image' : 'Upload image'} />}>
            <Upload size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{hasMedia ? 'Replace image' : 'Upload image'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={handleSplitH} aria-label="Split horizontal" />}>
            <SplitSquareHorizontal size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Split horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={handleSplitV} aria-label="Split vertical" />}>
            <SplitSquareVertical size={ICON_SIZE} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Split vertical</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={handleToggleFit} aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'} />}>
            {fit === 'cover'
              ? <Minimize2 size={ICON_SIZE} className="text-white" />
              : <Maximize2 size={ICON_SIZE} className="text-white" />
            }
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
          </TooltipContent>
        </Tooltip>

        {hasMedia && (
          <Tooltip>
            <TooltipTrigger render={<button className={`${btnClass} hover:bg-red-500/20`} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={handleClearMedia} aria-label="Clear media" />}>
              <ImageOff size={ICON_SIZE} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Clear media</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger render={<button className={`${btnClass} hover:bg-red-500/20`} style={{ width: BTN_SIZE, height: BTN_SIZE }} onClick={handleRemove} aria-label="Remove cell" />}>
            <Trash2 size={ICON_SIZE} className="text-red-500" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Remove cell</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
