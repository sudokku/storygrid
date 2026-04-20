import { useCallback, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { Undo2, Redo2, Minus, Plus, Eye, EyeOff, Layers, Trash2, PlusCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { ExportSplitButton } from './ExportSplitButton';
import { TemplatesPopover } from '../components/TemplatesPopover';
import { AddOverlayMenu } from './AddOverlayMenu';
import { useMediaQuery } from '../hooks/useMediaQuery';

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
  const showOverlays = useEditorStore(s => s.showOverlays);
  const toggleOverlayVisibility = useEditorStore(s => s.toggleOverlayVisibility);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const handleZoomOut = useCallback(() => setZoom(zoom - 0.1), [setZoom, zoom]);
  const handleZoomIn = useCallback(() => setZoom(zoom + 0.1), [setZoom, zoom]);
  const handleClearGrid = useCallback(() => {
    if (window.confirm('Clear the canvas? This will remove all cells and images.')) {
      clearGrid();
    }
  }, [clearGrid]);

  if (isMobile) {
    return (
      <header className="flex items-center justify-around h-11 px-2 gap-2 bg-[var(--card)] border-b border-[var(--border)] shrink-0">
        {/* Undo */}
        <button
          className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--foreground)] disabled:opacity-40"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          data-testid="mobile-undo"
        >
          <Undo2 size={20} />
        </button>

        {/* Redo */}
        <button
          className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--foreground)] disabled:opacity-40"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          data-testid="mobile-redo"
        >
          <Redo2 size={20} />
        </button>

        {/* Templates */}
        <div className="w-11 h-11 flex items-center justify-center">
          <TemplatesPopover key="mobile-templates" />
        </div>

        {/* Export (mobile icon-only form) */}
        <ExportSplitButton isMobile />

        {/* Clear */}
        <button
          className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--foreground)]"
          onClick={handleClearGrid}
          aria-label="Clear canvas"
          data-testid="mobile-clear"
        >
          <Trash2 size={20} />
        </button>
      </header>
    );
  }

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

          {/* Add overlay button + popover */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className={btnClass}
                    onClick={() => setAddMenuOpen(v => !v)}
                    aria-label="Add overlay"
                    aria-haspopup="true"
                    aria-expanded={addMenuOpen}
                  />
                }
              >
                <PlusCircle size={16} className="text-white" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Add overlay</TooltipContent>
            </Tooltip>
            <AddOverlayMenu open={addMenuOpen} onOpenChange={setAddMenuOpen} />
          </div>
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

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={btnClass}
                  onClick={toggleOverlayVisibility}
                  aria-label={showOverlays ? 'Hide overlays' : 'Show overlays'}
                  aria-pressed={showOverlays}
                />
              }
            >
              <Layers size={16} className={showOverlays ? 'text-white' : 'text-neutral-500'} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {showOverlays ? 'Hide overlays' : 'Show overlays'}
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
