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

  // CELL-02: viewport-stable sizing via clamp() — re-landed after 1476df2 revert.
  // Buttons scale linearly with viewport width between a 28px floor (small laptop)
  // and a 36px ceiling (4K display). Icons scale proportionally.
  const btnStyle: React.CSSProperties = {
    width: 'clamp(28px, 2.2vw, 36px)',
    height: 'clamp(28px, 2.2vw, 36px)',
  };
  const iconStyle: React.CSSProperties = {
    width: 'clamp(16px, 1.4vw, 20px)',
    height: 'clamp(16px, 1.4vw, 20px)',
  };
  const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors';

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
          style={btnStyle}
          className={`${btnClass} cursor-grab active:cursor-grabbing`}
          aria-label="Drag to move"
          title="Drag to move"
          data-testid={`drag-handle-${nodeId}`}
        >
          <GripVertical style={iconStyle} className="text-white" />
        </button>

        <Tooltip>
          <TooltipTrigger render={<button style={btnStyle} className={btnClass} onClick={onUploadClick} aria-label={hasMedia ? 'Replace image' : 'Upload image'} />}>
            <Upload style={iconStyle} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{hasMedia ? 'Replace image' : 'Upload image'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button style={btnStyle} className={btnClass} onClick={handleSplitH} aria-label="Split horizontal" />}>
            <SplitSquareHorizontal style={iconStyle} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Split horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button style={btnStyle} className={btnClass} onClick={handleSplitV} aria-label="Split vertical" />}>
            <SplitSquareVertical style={iconStyle} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Split vertical</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button style={btnStyle} className={btnClass} onClick={handleToggleFit} aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'} />}>
            {fit === 'cover'
              ? <Minimize2 style={iconStyle} className="text-white" />
              : <Maximize2 style={iconStyle} className="text-white" />
            }
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
          </TooltipContent>
        </Tooltip>

        {hasMedia && (
          <Tooltip>
            <TooltipTrigger render={<button style={btnStyle} className={`${btnClass} hover:bg-red-500/20`} onClick={handleClearMedia} aria-label="Clear media" />}>
              <ImageOff style={iconStyle} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear media</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger render={<button style={btnStyle} className={`${btnClass} hover:bg-red-500/20`} onClick={handleRemove} aria-label="Remove cell" />}>
            <Trash2 style={iconStyle} className="text-red-500" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Remove cell</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
