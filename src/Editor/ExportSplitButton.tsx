import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { exportGrid, downloadDataUrl, hasVideoCell } from '../lib/export';
import { exportVideoGrid } from '../lib/videoExport';
import type { CanvasSettings } from '../lib/export';
import { Toast } from './Toast';
import type { ToastState } from './Toast';
import { ExportMetricsPanel } from './ExportMetricsPanel';
import type { ExportMetrics } from '../types/exportMetrics';

// Feature flag — Vite tree-shakes dead branches in production when not set
const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true';

// ---------------------------------------------------------------------------
// ExportSplitButton component
// ---------------------------------------------------------------------------

export function ExportSplitButton() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);
  const [encodingPercent, setEncodingPercent] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // D-03: track audio warning to show after successful download
  const audioWarningRef = useRef<string | null>(null);

  const isExporting = useEditorStore(s => s.isExporting);
  const exportFormat = useEditorStore(s => s.exportFormat);
  const exportQuality = useEditorStore(s => s.exportQuality);
  const setIsExporting = useEditorStore(s => s.setIsExporting);
  const setExportFormat = useEditorStore(s => s.setExportFormat);
  const setExportQuality = useEditorStore(s => s.setExportQuality);

  // Metrics panel state (D-07: only active when METRICS_ENABLED)
  const metricsRef = useRef<ExportMetrics | null>(null);
  const [metricsSnapshot, setMetricsSnapshot] = useState<ExportMetrics | null>(null);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const root = useGridStore(s => s.root);
  const mediaRegistry = useGridStore(s => s.mediaRegistry);
  const mediaTypeMap = useGridStore(s => s.mediaTypeMap);

  // Canvas settings for export
  const gap = useEditorStore(s => s.gap);
  const borderRadius = useEditorStore(s => s.borderRadius);
  const backgroundMode = useEditorStore(s => s.backgroundMode);
  const backgroundColor = useEditorStore(s => s.backgroundColor);
  const backgroundGradientFrom = useEditorStore(s => s.backgroundGradientFrom);
  const backgroundGradientTo = useEditorStore(s => s.backgroundGradientTo);
  const backgroundGradientDir = useEditorStore(s => s.backgroundGradientDir);

  // Auto-detect whether current composition has video cells (per D-14)
  const hasVideos = hasVideoCell(root, mediaTypeMap);

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
  // Metrics polling effect (D-08: setInterval at 250ms, not rAF — P-07)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!METRICS_ENABLED) return;
    if (!isExporting) {
      // Stop polling when export ends — panel stays with final snapshot (D-06)
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
      // Set final snapshot so panel keeps showing last metrics
      if (metricsRef.current) {
        setMetricsSnapshot({ ...metricsRef.current });
      }
      return;
    }
    // Start polling at 250ms
    metricsIntervalRef.current = setInterval(() => {
      if (metricsRef.current) {
        setMetricsSnapshot({ ...metricsRef.current });
      }
    }, 250);
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    };
  }, [isExporting]);

  // -------------------------------------------------------------------------
  // Shift+M keyboard shortcut to toggle panel visibility (D-12)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!METRICS_ENABLED) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'M') {
        setMetricsVisible(v => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // Export handler
  // -------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setPopoverOpen(false);
    audioWarningRef.current = null;

    try {
      const canvasSettings: CanvasSettings = {
        gap,
        borderRadius,
        backgroundMode,
        backgroundColor,
        backgroundGradientFrom,
        backgroundGradientTo,
        backgroundGradientDir,
      };

      if (hasVideos) {
        // D-03: Reset panel to expanded on each new export
        if (METRICS_ENABLED) {
          metricsRef.current = null;
          setMetricsSnapshot(null);
          setMetricsVisible(true);
          setMetricsCollapsed(false);
        }

        // Video export path — auto-detected (per D-14)
        const totalDuration = useEditorStore.getState().totalDuration;
        const blob = await exportVideoGrid(
          root,
          mediaRegistry,
          mediaTypeMap,
          canvasSettings,
          totalDuration,
          (stage, percent) => {
            if (stage === 'preparing') {
              setToastState('preparing');
            } else if (stage === 'decoding') {
              setToastState('decoding');
              if (percent !== undefined) setEncodingPercent(percent);
            } else {
              setToastState('encoding');
              if (percent !== undefined) setEncodingPercent(percent);
            }
          },
          // onWarning: called when audio encoding is unavailable (D-03)
          (message) => {
            console.warn(message);
            // Store for post-export display (D-03)
            audioWarningRef.current = message;
          },
          // onMetrics callback (D-09: only when METRICS_ENABLED)
          METRICS_ENABLED ? (m: ExportMetrics) => { metricsRef.current = m; } : undefined,
        );
        setToastState(null);
        // Download blob — extension matches actual container (mp4).
        const ext = 'mp4';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `storygrid-${Date.now()}.${ext}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        // D-03: show audio-warning toast after successful download
        if (audioWarningRef.current) {
          setToastState('audio-warning');
        }
      } else {
        // Image export path — unchanged
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
      }
    } catch (err) {
      console.error('[export] Export failed:', err);
      setToastState('error');
    } finally {
      // MUST be in finally per RESEARCH Pitfall 7
      setIsExporting(false);
    }
  }, [
    isExporting,
    hasVideos,
    root,
    mediaRegistry,
    exportFormat,
    exportQuality,
    setIsExporting,
    gap,
    borderRadius,
    backgroundMode,
    backgroundColor,
    backgroundGradientFrom,
    backgroundGradientTo,
    backgroundGradientDir,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const exportLabel = hasVideos
    ? 'Export Video'
    : `Export ${exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}`;

  return (
    <>
      <div ref={containerRef} className="relative flex items-center border border-white/10 rounded">
        {/* Left segment — immediate export */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          aria-label={exportLabel}
          data-testid="export-button"
          className="flex items-center gap-2 h-8 px-2 rounded-l hover:bg-white/10 transition-colors text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          <span className="text-xs">
            {exportLabel}
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
            {hasVideos ? (
              <>
                {/* Video mode — no format/quality controls */}
                <div className="text-xs text-neutral-400 py-2">
                  Exports as MP4 (H.264)
                </div>

                {/* Download button */}
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full h-8 mt-1 rounded text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Export Video
                </button>
              </>
            ) : (
              <>
                {/* Image mode — format toggle and quality slider */}
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Toast notification */}
      <Toast
        state={toastState}
        encodingPercent={encodingPercent}
        onRetry={handleExport}
        onDismiss={() => setToastState(null)}
      />

      {/* Export metrics overlay (development only, D-07) */}
      {METRICS_ENABLED && (
        <ExportMetricsPanel
          metrics={metricsSnapshot}
          visible={metricsVisible}
          collapsed={metricsCollapsed}
          onToggleCollapse={() => setMetricsCollapsed(c => !c)}
        />
      )}
    </>
  );
}
