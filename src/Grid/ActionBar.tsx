import React, { useCallback } from 'react';
import { useGridStore } from '../store/gridStore';
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
} from 'lucide-react';

interface ActionBarProps {
  nodeId: string;
  fit: 'cover' | 'contain';
}

export const ActionBar = React.memo(function ActionBar({ nodeId, fit }: ActionBarProps) {
  const split = useGridStore(s => s.split);
  const remove = useGridStore(s => s.remove);
  const updateCell = useGridStore(s => s.updateCell);

  const handleSplitH = useCallback(() => split(nodeId, 'horizontal'), [split, nodeId]);
  const handleSplitV = useCallback(() => split(nodeId, 'vertical'), [split, nodeId]);
  const handleRemove = useCallback(() => remove(nodeId), [remove, nodeId]);
  const handleToggleFit = useCallback(
    () => updateCell(nodeId, { fit: fit === 'cover' ? 'contain' : 'cover' }),
    [updateCell, nodeId, fit]
  );

  const btnClass = 'flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 transition-colors';

  return (
    <TooltipProvider delay={300}>
      <div
        className="flex items-center gap-1 px-1 py-1 rounded-md bg-black/70 backdrop-blur-sm"
        data-testid={`action-bar-${nodeId}`}
      >
        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleSplitH} aria-label="Split horizontal" />}>
            <SplitSquareHorizontal size={16} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Split horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleSplitV} aria-label="Split vertical" />}>
            <SplitSquareVertical size={16} className="text-white" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Split vertical</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={`${btnClass} hover:bg-red-500/20`} onClick={handleRemove} aria-label="Remove cell" />}>
            <Trash2 size={16} className="text-red-500" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Remove cell</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<button className={btnClass} onClick={handleToggleFit} aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'} />}>
            {fit === 'cover'
              ? <Minimize2 size={16} className="text-white" />
              : <Maximize2 size={16} className="text-white" />
            }
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
