import { useCallback } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { Undo2, Redo2, Minus, Plus, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { ExportSplitButton } from './ExportSplitButton';
import { TemplatesPopover } from '../components/TemplatesPopover';

const btnClass =
  'flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 transition-colors text-neutral-300';

export function Toolbar() {
  const undo = useGridStore(s => s.undo);
  const redo = useGridStore(s => s.redo);
  const clearGrid = useGridStore(s => s.clearGrid);
  const canUndo = useGridStore(s => s.historyIndex > 0);
  const canRedo = useGridStore(s => s.historyIndex < s.history.length - 1);
  const zoom = useEditorStore(s => s.zoom);
  const setZoom = useEditorStore(s => s.setZoom);
  const showSafeZone = useEditorStore(s => s.showSafeZone);
  const toggleSafeZone = useEditorStore(s => s.toggleSafeZone);

  const handleZoomOut = useCallback(() => setZoom(zoom - 0.1), [setZoom, zoom]);
  const handleZoomIn = useCallback(() => setZoom(zoom + 0.1), [setZoom, zoom]);
  const handleClearGrid = useCallback(() => {
    if (window.confirm('Clear the canvas? This will remove all cells and images.')) {
      clearGrid();
    }
  }, [clearGrid]);

  return (
    <header className="flex items-center gap-1 h-12 px-4 bg-[#1c1c1c] border-b border-[#2a2a2a] shrink-0">
      <TooltipProvider delay={300}>
        {/* Left: Undo / Redo / Templates */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={`${btnClass}${!canUndo ? ' opacity-40 cursor-not-allowed' : ''}`}
                  onClick={undo}
                  aria-label="Undo"
                  disabled={!canUndo}
                />
              }
            >
              <Undo2 size={16} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={`${btnClass}${!canRedo ? ' opacity-40 cursor-not-allowed' : ''}`}
                  onClick={redo}
                  aria-label="Redo"
                  disabled={!canRedo}
                />
              }
            >
              <Redo2 size={16} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <TemplatesPopover />
        </div>

        {/* Center: Zoom */}
        <div className="flex items-center gap-1 ml-4">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={`${btnClass}${zoom <= 0.5 ? ' opacity-40 cursor-not-allowed' : ''}`}
                  onClick={handleZoomOut}
                  aria-label="Zoom out"
                  disabled={zoom <= 0.5}
                />
              }
            >
              <Minus size={16} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Zoom out</TooltipContent>
          </Tooltip>

          <span className="text-sm text-neutral-400 w-12 text-center select-none" data-testid="zoom-label">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={`${btnClass}${zoom >= 1.5 ? ' opacity-40 cursor-not-allowed' : ''}`}
                  onClick={handleZoomIn}
                  aria-label="Zoom in"
                  disabled={zoom >= 1.5}
                />
              }
            >
              <Plus size={16} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Zoom in</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Safe Zone, Export, New/Clear */}
        <div className="flex items-center gap-1 ml-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={btnClass}
                  onClick={toggleSafeZone}
                  aria-label="Toggle safe zone"
                  aria-pressed={showSafeZone}
                />
              }
            >
              {showSafeZone ? (
                <EyeOff size={16} className="text-white" />
              ) : (
                <Eye size={16} className="text-white" />
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {showSafeZone ? 'Hide safe zone' : 'Show safe zone'}
            </TooltipContent>
          </Tooltip>

          <ExportSplitButton />

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={btnClass}
                  onClick={handleClearGrid}
                  aria-label="New / Clear canvas"
                />
              }
            >
              <Trash2 size={16} className="text-white" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">New / Clear canvas</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </header>
  );
}
