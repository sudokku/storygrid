import type { ExportMetrics } from '../types/exportMetrics';

// ---------------------------------------------------------------------------
// ExportMetricsPanel — developer overlay for real-time export diagnostics
// Only rendered when VITE_ENABLE_EXPORT_METRICS=true (feature-flagged off in
// production). See .planning/phases/16-export-metrics-panel/16-SPEC.md.
// ---------------------------------------------------------------------------

type ExportMetricsPanelProps = {
  metrics: ExportMetrics | null;
  visible: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] uppercase text-neutral-500 mt-2 mb-1">{title}</div>
  );
}

function Separator() {
  return <div className="border-t border-white/10 my-2" />;
}

function formatPhase(phase: ExportMetrics['phase']): string {
  return phase.toUpperCase();
}

function formatProgress(framesEncoded: number, totalFrames: number): string {
  return `${framesEncoded} / ${totalFrames}`;
}

function formatPercent(framesEncoded: number, totalFrames: number): string {
  if (totalFrames === 0) return '0%';
  return `${Math.round((framesEncoded / totalFrames) * 100)}%`;
}

export function ExportMetricsPanel({
  metrics,
  visible,
  collapsed,
  onToggleCollapse,
}: ExportMetricsPanelProps) {
  // Guard: no metrics or not visible
  if (!metrics || !visible) return null;

  const {
    phase,
    framesEncoded,
    totalFrames,
    encodeFps,
    lastFrameMs,
    averageFrameMs,
    elapsedMs,
    heapUsedMB,
    heapTotalMB,
    heapLimitMB,
    activeBitmaps,
    activeVideoFrames,
    nullSampleCount,
    deviceMemoryGB,
    cpuCores,
    decodeSetupMs,
  } = metrics;

  // D-10: Chrome-only heap guard — if all three are 0, display N/A
  const isHeapAvailable = heapUsedMB !== 0 || heapTotalMB !== 0 || heapLimitMB !== 0;

  const heapDisplay = isHeapAvailable
    ? `${heapUsedMB.toFixed(0)} / ${heapTotalMB.toFixed(0)} MB`
    : 'N/A';
  const heapLimitDisplay = isHeapAvailable ? `${heapLimitMB.toFixed(0)} MB` : 'N/A';

  // D-04: ETA only when encodeFps > 0
  const etaSeconds =
    encodeFps > 0 ? ((totalFrames - framesEncoded) / encodeFps).toFixed(1) : null;

  // Collapsed state (D-01): single clickable status line
  if (collapsed) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[9999] bg-black/85 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-neutral-200 cursor-pointer transition-all duration-200 hover:bg-black/90"
        onClick={onToggleCollapse}
        title="Click to expand metrics"
      >
        <span className="text-neutral-400 mr-2">{formatPhase(phase)}</span>
        <span>{formatPercent(framesEncoded, totalFrames)}</span>
      </div>
    );
  }

  // Expanded state: full panel
  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-black/85 border border-white/10 rounded-lg p-3 font-mono text-[11px] min-w-[280px] max-w-xs transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-neutral-300 font-semibold tracking-wide text-[10px] uppercase">
          Export Metrics
        </span>
        <button
          onClick={onToggleCollapse}
          className="text-neutral-500 hover:text-neutral-300 transition-colors ml-3 leading-none"
          title="Collapse panel"
          aria-label="Collapse metrics panel"
        >
          ×
        </button>
      </div>

      {/* Timing + throughput section */}
      <MetricRow label="Phase" value={formatPhase(phase)} />
      <MetricRow label="Progress" value={formatProgress(framesEncoded, totalFrames)} />
      <MetricRow label="Encode FPS" value={`${encodeFps.toFixed(1)} fps`} />
      <MetricRow label="Frame time" value={`${lastFrameMs.toFixed(1)} ms`} />
      <MetricRow label="Avg frame" value={`${averageFrameMs.toFixed(1)} ms`} />
      <MetricRow label="Elapsed" value={`${(elapsedMs / 1000).toFixed(1)} s`} />
      {/* D-04: ETA row omitted entirely when encodeFps <= 0 */}
      {etaSeconds !== null && (
        <MetricRow label="ETA" value={`${etaSeconds} s`} />
      )}

      <Separator />

      {/* Memory section */}
      <SectionHeader title="Memory" />
      <MetricRow label="JS Heap" value={heapDisplay} />
      <MetricRow label="Heap limit" value={heapLimitDisplay} />
      <MetricRow label="Active bitmaps" value={activeBitmaps} />
      <MetricRow label="Active frames" value={activeVideoFrames} />
      <MetricRow label="Null samples" value={nullSampleCount} />

      <Separator />

      {/* Device section */}
      <SectionHeader title="Device" />
      <MetricRow label="RAM" value={deviceMemoryGB > 0 ? `${deviceMemoryGB} GB` : 'N/A'} />
      <MetricRow label="CPU cores" value={cpuCores} />
      {decodeSetupMs > 0 && (
        <MetricRow label="Decode setup" value={`${decodeSetupMs.toFixed(0)} ms`} />
      )}
    </div>
  );
}
