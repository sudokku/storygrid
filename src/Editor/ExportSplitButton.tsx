import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { exportGrid, downloadDataUrl, hasVideoCell } from '../lib/export';
import type { CanvasSettings } from '../lib/export';
import { Toast } from './Toast';
import type { ToastState } from './Toast';

// ---------------------------------------------------------------------------
// ExportSplitButton component
// ---------------------------------------------------------------------------

export function ExportSplitButton() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isExporting = useEditorStore(s => s.isExporting);
  const exportFormat = useEditorStore(s => s.exportFormat);
  const exportQuality = useEditorStore(s => s.exportQuality);
  const setIsExporting = useEditorStore(s => s.setIsExporting);
  const setExportFormat = useEditorStore(s => s.setExportFormat);
  const setExportQuality = useEditorStore(s => s.setExportQuality);

  const root = useGridStore(s => s.root);
  const mediaRegistry = useGridStore(s => s.mediaRegistry);

  // Canvas settings for export
  const gap = useEditorStore(s => s.gap);
  const borderRadius = useEditorStore(s => s.borderRadius);
  const borderColor = useEditorStore(s => s.borderColor);
  const backgroundMode = useEditorStore(s => s.backgroundMode);
  const backgroundColor = useEditorStore(s => s.backgroundColor);
  const backgroundGradientFrom = useEditorStore(s => s.backgroundGradientFrom);
  const backgroundGradientTo = useEditorStore(s => s.backgroundGradientTo);
  const backgroundGradientDir = useEditorStore(s => s.backgroundGradientDir);

  // -------------------------------------------------------------------------
  // Outside-click and Escape key handler (per RESEARCH Pitfall 6)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!popoverOpen) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setPopoverOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  // -------------------------------------------------------------------------
  // Export handler
  // -------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    // Video guard — per D-09
    if (hasVideoCell(root, mediaRegistry)) {
      setToastState('video-blocked');
      return;
    }

    setIsExporting(true);
    setPopoverOpen(false);

    try {
      const canvasSettings: CanvasSettings = {
        gap,
        borderRadius,
        borderColor,
        backgroundMode,
        backgroundColor,
        backgroundGradientFrom,
        backgroundGradientTo,
        backgroundGradientDir,
      };
      const dataUrl = await exportGrid(
        root,
        mediaRegistry,
        exportFormat,
        exportQuality,
        (stage) => setToastState(stage),
        canvasSettings,
      );
      setToastState(null); // dismiss on success per D-07
      const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
      const filename = `storygrid-${Date.now()}.${ext}`;
      downloadDataUrl(dataUrl, filename);
    } catch {
      setToastState('error');
    } finally {
      // MUST be in finally per RESEARCH Pitfall 7
      setIsExporting(false);
    }
  }, [
    isExporting,
    root,
    mediaRegistry,
    exportFormat,
    exportQuality,
    setIsExporting,
    gap,
    borderRadius,
    borderColor,
    backgroundMode,
    backgroundColor,
    backgroundGradientFrom,
    backgroundGradientTo,
    backgroundGradientDir,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <div ref={containerRef} className="relative flex items-center border border-white/10 rounded">
        {/* Left segment — immediate export */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          aria-label={`Export ${exportFormat.toUpperCase()}`}
          className="flex items-center gap-2 h-8 px-2 rounded-l hover:bg-white/10 transition-colors text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          <span className="text-xs">
            Export {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-white/20 self-center" />

        {/* Right segment — popover toggle */}
        <button
          onClick={() => !isExporting && setPopoverOpen(!popoverOpen)}
          disabled={isExporting}
          aria-label="Export settings"
          aria-expanded={popoverOpen}
          className={`flex items-center justify-center w-5 h-8 rounded-r hover:bg-white/10 transition-colors text-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed${popoverOpen ? ' bg-white/10' : ''}`}
        >
          <ChevronDown size={12} />
        </button>

        {/* Popover */}
        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute top-full right-0 mt-1 w-56 bg-[#1c1c1c] border border-white/10 rounded-md shadow-lg p-2 z-50"
            role="dialog"
            aria-label="Export settings"
          >
            {/* Format toggle */}
            <span className="text-xs text-neutral-400 mb-2 block">Format</span>
            <div className="flex rounded border border-white/10 overflow-hidden" role="radiogroup">
              <button
                onClick={() => setExportFormat('png')}
                className={`flex-1 h-7 text-xs rounded transition-colors ${exportFormat === 'png' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-neutral-300'}`}
                role="radio"
                aria-checked={exportFormat === 'png'}
              >
                PNG
              </button>
              <button
                onClick={() => setExportFormat('jpeg')}
                className={`flex-1 h-7 text-xs rounded transition-colors ${exportFormat === 'jpeg' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-neutral-300'}`}
                role="radio"
                aria-checked={exportFormat === 'jpeg'}
              >
                JPEG
              </button>
            </div>

            {/* Quality slider — visible only when JPEG */}
            <div className={exportFormat === 'jpeg' ? 'mt-3' : 'hidden'}>
              <span className="text-xs text-neutral-400">
                Quality: {Math.round(exportQuality * 100)}%
              </span>
              <input
                type="range"
                min={0.7}
                max={1.0}
                step={0.05}
                value={exportQuality}
                onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                className="w-full accent-white mt-2"
                aria-label="Export quality"
                aria-valuetext={`${Math.round(exportQuality * 100)} percent`}
              />
            </div>

            {/* Download button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full h-8 mt-3 rounded text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Download {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}
            </button>
          </div>
        )}
      </div>

      {/* Toast notification */}
      <Toast
        state={toastState}
        onRetry={handleExport}
        onDismiss={() => setToastState(null)}
      />
    </>
  );
}
