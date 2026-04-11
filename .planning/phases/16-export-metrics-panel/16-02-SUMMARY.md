---
phase: 16-export-metrics-panel
plan: "02"
subsystem: editor-ui
tags: [metrics, overlay, ExportMetricsPanel, ExportSplitButton, feature-flag]
dependency_graph:
  requires: [ExportMetrics-interface, onMetrics-callback-in-exportVideoGrid]
  provides: [ExportMetricsPanel-component, ExportSplitButton-wired-metrics]
  affects: [src/Editor/ExportMetricsPanel.tsx, src/Editor/ExportSplitButton.tsx, .env.development]
tech_stack:
  added: []
  patterns:
    - ref-based polling pattern (metricsRef + 250ms setInterval → metricsSnapshot state)
    - VITE_ENABLE_EXPORT_METRICS feature flag (dev-only via .env.development)
    - Vite tree-shaking eliminates all metrics code from production bundle
key_files:
  created:
    - src/Editor/ExportMetricsPanel.tsx
    - .env.development
  modified:
    - src/Editor/ExportSplitButton.tsx
decisions:
  - Ref-based polling (metricsRef.current written by onMetrics callback, read by 250ms interval) avoids React re-renders on every frame
  - .env.development sets VITE_ENABLE_EXPORT_METRICS=true; production builds (npm run build) never load this file so metrics are tree-shaken away
  - Panel stays with final snapshot post-export (poll stops, last ref value frozen as state)
  - ETA row omitted entirely when encodeFps <= 0 (no placeholder, no "---")
  - Chrome heap guard: shows N/A when heapUsedMB/heapTotalMB/heapLimitMB all 0
metrics:
  duration_minutes: 15
  completed_date: "2026-04-11"
  tasks_completed: 3
  files_changed: 3
human_verified: true
verification_result: |
  Tested on 749-frame export:
  Phase: FINALIZING, Progress: 749/749, Encode FPS: 81.5, Frame time: 2.6ms,
  Avg frame: 6.5ms, Elapsed: 9.2s, ETA: 0.0s,
  JS Heap: 60/67 MB (limit 2248 MB), Active bitmaps: 0, Active frames: 0,
  Null samples: 0, RAM: 8GB, CPU: 8 cores, Decode setup: 177ms.
  All counters at 0 confirms no memory leaks. Panel collapsed/expanded correctly.
  Production safety confirmed: .env.development not loaded by npm run build.
---

# Phase 16 Plan 02: ExportMetricsPanel + ExportSplitButton Wiring Summary

Complete developer metrics overlay for video export — fixed bottom-right panel showing real-time phase, throughput, memory, and device metrics. Feature-flagged off in production via Vite's .env.development mechanism.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ExportMetricsPanel component and .env.development | abbca08 | src/Editor/ExportMetricsPanel.tsx, .env.development |
| 2 | Wire ExportMetricsPanel into ExportSplitButton | 9551e78 | src/Editor/ExportSplitButton.tsx |
| 3 | Human verification — end-to-end in browser | (human) | — |

## What Was Built

### Task 1: ExportMetricsPanel Component

`src/Editor/ExportMetricsPanel.tsx` — fixed overlay at `bottom-4 right-4 z-[9999]`:

- **Expanded state:** Three sections separated by dividers:
  - Timing/Throughput: Phase, Progress (n/total), Encode FPS, Frame time, Avg frame, Elapsed, ETA
  - Memory: JS Heap (used/total MB), Heap limit, Active bitmaps, Active frames, Null samples
  - Device: RAM, CPU cores, Decode setup (shown once > 0)
- **ETA row:** Omitted entirely when `encodeFps <= 0` — no placeholder, not rendered
- **Chrome heap guard:** Renders "N/A" for all three heap rows when all are 0 (Firefox/Safari)
- **Collapsed state:** Single clickable status line showing `phase ENCODING 49%` — calls `onToggleCollapse`
- **Null/invisible guard:** Returns null when `metrics` is null or `visible` is false
- **Styling:** `bg-black/85 font-mono text-[11px] rounded-lg p-3 border border-white/10`, row labels `text-neutral-400`, values `text-neutral-200`

`.env.development` — contains `VITE_ENABLE_EXPORT_METRICS=true` (Vite only loads this in dev mode).

### Task 2: ExportSplitButton Wiring

Changes to `src/Editor/ExportSplitButton.tsx`:

1. **Imports:** `ExportMetricsPanel` from `./ExportMetricsPanel`, `type ExportMetrics` from `../types/exportMetrics`
2. **Feature flag:** `const METRICS_ENABLED = import.meta.env.VITE_ENABLE_EXPORT_METRICS === 'true'` at module level
3. **State/refs:** `metricsRef`, `metricsSnapshot`, `metricsVisible` (default false), `metricsCollapsed` (default false), `metricsIntervalRef`
4. **Polling effect:** `useEffect` on `isExporting` — starts 250ms interval when exporting, stops on export end and freezes final snapshot
5. **Shift+M effect:** `document.addEventListener('keydown')` toggles `metricsVisible`
6. **Export start reset:** `setMetricsVisible(true)`, `setMetricsCollapsed(false)`, clears ref — runs at start of each video export (D-03)
7. **onMetrics callback:** Passed as last arg to `exportVideoGrid`, writes to `metricsRef.current`, gated on `METRICS_ENABLED`
8. **JSX render:** `{METRICS_ENABLED && <ExportMetricsPanel ... />}` after Toast

### Task 3: Human Verification

Verified on a 749-frame export:
- Panel appeared automatically at export start (bottom-right corner)
- All metric sections rendered correctly
- ETA absent during decoding, present during encoding
- Collapse/expand worked via [×] and clicking status line
- Panel retained final snapshot post-export
- Memory result: **60/67 MB JS heap** with activeBitmaps=0, activeVideoFrames=0, nullSamples=0 — confirms streaming architecture has zero memory accumulation

## Verification

- `npx tsc --noEmit` passes
- `grep ExportMetricsPanel src/Editor/ExportSplitButton.tsx` → found
- `grep METRICS_ENABLED src/Editor/ExportSplitButton.tsx` → found
- `grep "e.shiftKey && e.key === 'M'" src/Editor/ExportSplitButton.tsx` → found
- Human-verified end-to-end on real video export

## Deviations from Plan

None.

## Known Stubs

None.

## Threat Flags

None — local-only developer tool, feature-flagged off in production. No network, no auth, no user input.

## Self-Check: PASSED

- ExportMetricsPanel.tsx created with all required sections and behaviors
- .env.development created with VITE_ENABLE_EXPORT_METRICS=true
- ExportSplitButton.tsx wired: onMetrics, polling, Shift+M, panel render
- TypeScript compiles clean
- Human verification passed
