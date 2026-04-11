# Phase 16: Export Metrics Panel — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a real-time metrics overlay that appears during video export and displays every observable browser signal (timing, throughput, JS heap, custom resource counters). The panel is fully decoupled from the export pipeline — it is wired only through an optional `onMetrics` callback in `exportVideoGrid`. Controlled by `VITE_ENABLE_EXPORT_METRICS` env flag; absent from production builds.

**What is in scope:**
- `ExportMetrics` interface in `src/types/exportMetrics.ts`
- Instrumentation hooks in `videoExport.ts` (`onMetrics?` param + local counters for activeBitmaps, activeVideoFrames, nullSamples)
- `ExportMetricsPanel.tsx` overlay component
- `ExportSplitButton.tsx` wiring — conditional render + `onMetrics` callback
- `.env.development` feature flag
- `performance.mark/measure` spans gated behind `METRICS_ENABLED`

**What is NOT in scope:**
- Any changes to the audio mix pipeline
- PNG export pipeline
- Persistent settings or localStorage
- New dependencies

</domain>

<decisions>
## Implementation Decisions

### Dismiss Behavior
- **D-01:** When user clicks `[×]` during an active export, the panel **collapses to a single status line** showing current phase + progress %. It does NOT fully dismiss.
- **D-02:** Clicking the collapsed status line re-expands the panel to full view.
- **D-03:** The panel **always reappears expanded** at the start of each new export. The collapsed/dismissed state is per-export only — not persisted between exports.

### ETA Calculation
- **D-04:** ETA uses simple frames extrapolation: `ETA = (totalFrames - framesEncoded) / encodeFps`. Available once encoding starts (encodeFps > 0). ETA row is hidden during `preparing` and `decoding` phases — show "—" or omit until `encodeFps` is non-zero.

### Performance.mark() Spans
- **D-05:** Emit `performance.mark` / `performance.measure` spans per encode frame, gated behind `METRICS_ENABLED`. Marks: `frame-encode-start` / `frame-encode-end` per frame. This makes Chrome DevTools Performance tab traces useful without production overhead.

### Post-Export State
- **D-06:** When export finishes (success or error), the panel **stays visible with the final metrics snapshot** until the user explicitly clicks `[×]`. This allows copy-paste or screenshot of the final numbers.

### Feature Flag
- **D-07:** `VITE_ENABLE_EXPORT_METRICS=true` in `.env.development` (checked in — not a secret). In code: `const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true'`. Vite tree-shakes the dead branch in production.

### Spec Decisions (locked from SPEC.md)
- **D-08:** Polling rate: `setInterval` at **250ms** (not rAF — rAF stalls during encode).
- **D-09:** Decoupling: `videoExport.ts` must NOT import `ExportMetricsPanel`. Flow is `ExportSplitButton → onMetrics? → videoExport.ts fires callbacks`.
- **D-10:** `performance.memory` is Chrome/Edge only — guard every access, display "N/A" on other browsers.
- **D-11:** `activeBitmaps` and `activeVideoFrames` are local variables in `exportVideoGrid` — no global state.
- **D-12:** Keyboard shortcut `Shift+M` toggles visibility during export (as specified in SPEC.md).

### Claude's Discretion
- Animation/transition style for collapse/expand (CSS transition is fine)
- Exact color of the status line in collapsed state
- Whether to use `useRef` vs `useState` for the interval handle
- Exact wording of "N/A" vs "—" for unavailable metrics on non-Chrome

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specification
- `.planning/phases/16-export-metrics-panel/16-SPEC.md` — Full spec: ExportMetrics interface, layout mockup, pitfall list (P-01..P-11), instrumentation points, removal checklist, success criteria

### Prior Phase Context (integration points)
- `.planning/phases/15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder/15-CONTEXT.md` — Current videoExport.ts architecture (VideoSampleSink pipeline, onProgress signature, stage union)

### Current Source Files
- `src/lib/videoExport.ts` — `exportVideoGrid` signature at line 396; `onProgress` pattern at line 402; `buildVideoStreams` at line 209
- `src/Editor/ExportSplitButton.tsx` — existing `onProgress` handler and Toast wiring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `onProgress` callback pattern (line 402 in `videoExport.ts`): same optional-callback pattern to follow for `onMetrics`
- `ExportSplitButton.tsx` Toast state management: local `useState` for ephemeral export UI — same pattern for metrics state
- `setInterval`-based polling to be added in `ExportSplitButton` (panel reads from a `metricsRef` updated by `onMetrics` callback)

### Established Patterns
- `import.meta.env.*` for feature flags (already used in codebase)
- Local counters (`activeBitmaps`, `activeVideoFrames`) follow same pattern as existing local vars in `exportVideoGrid`

### Integration Points
- `exportVideoGrid` (src/lib/videoExport.ts:396) — add `onMetrics?: (m: ExportMetrics) => void` as last optional param
- `ExportSplitButton.tsx` — the only call site for `exportVideoGrid`; add `onMetrics` wiring and render `<ExportMetricsPanel />` conditionally

</code_context>

<specifics>
## Specific Ideas

- Panel stays visible with final snapshot after export completes — user must explicitly close it (good for screenshotting metrics)
- Collapsed state is a single line (phase + %) not a full dismiss
- Panel always resets to expanded on each new export start
- ETA row hidden until `encodeFps > 0` (during preparing/decoding phases)
- `performance.mark('frame-encode-start')` / `performance.measure('frame-encode', 'frame-encode-start', 'frame-encode-end')` per frame — gated behind METRICS_ENABLED

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-export-metrics-panel*
*Context gathered: 2026-04-11*
