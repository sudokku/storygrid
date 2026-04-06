---
phase: 06-video-support-v2
plan: "01"
subsystem: store,media,export,config
tags: [video, infrastructure, coop-coep, media-registry, playback-state]
dependency_graph:
  requires: []
  provides: [mediaTypeMap, videoRegistry, COOP-COEP-headers, video-upload-flow, hasVideoCell-fix]
  affects: [gridStore, editorStore, media.ts, export.ts, Toolbar, ExportSplitButton]
tech_stack:
  added: [videoRegistry (new module)]
  patterns: [blob-URL-for-video, mediaTypeMap-parallel-to-mediaRegistry, COOP-COEP-three-env-pattern]
key_files:
  created:
    - src/lib/videoRegistry.ts
    - vercel.json
    - public/_headers
  modified:
    - src/store/gridStore.ts
    - src/store/editorStore.ts
    - src/lib/media.ts
    - src/lib/export.ts
    - vite.config.ts
    - src/Editor/Toolbar.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/test/canvas-export.test.ts
    - src/test/phase04-01-task2.test.tsx
    - src/test/phase04-02-task1.test.tsx
decisions:
  - mediaTypeMap stored in gridStore parallel to mediaRegistry — not in undo history snapshots (same as mediaRegistry)
  - Videos use blob URLs (URL.createObjectURL), images keep base64 data URIs — blob URLs revoked on removeMedia/clearGrid/applyTemplate
  - cleanupStaleBlobMedia action added for D-03 startup cleanup (blob URLs don't survive page reload)
  - COOP/COEP headers added to all three environments: vite dev server, vercel.json, public/_headers
  - hasVideoCell signature changed from mediaRegistry to mediaTypeMap — simpler, no string prefix scan
  - draw functions in export.ts now accept HTMLImageElement | HTMLVideoElement via getSourceDimensions helper
metrics:
  duration: 261s
  completed: "2026-04-05"
  tasks: 2
  files: 10
---

# Phase 06 Plan 01: Infrastructure Foundation for Video Support Summary

Dual-mode media registry (image base64 + video blob URLs), video element registry, playback state in editorStore, COOP/COEP headers in three environments, video-ready upload flow, and mediaTypeMap-based hasVideoCell.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Store updates, videoRegistry, COOP/COEP headers | 8a068ef | gridStore.ts, editorStore.ts, videoRegistry.ts, vite.config.ts, vercel.json, public/_headers |
| 2 | Video upload flow and hasVideoCell fix | 6f4ef1a | media.ts, export.ts, Toolbar.tsx, ExportSplitButton.tsx, 3 test files |

## What Was Built

### gridStore.ts
- Added `mediaTypeMap: Record<string, 'image' | 'video'>` initialized as `{}`
- `addMedia` now accepts optional `type` parameter, defaults to `'image'`
- `removeMedia` revokes blob URLs before deleting entries
- `clearGrid` and `applyTemplate` revoke all blob URLs then reset `mediaTypeMap`
- Added `cleanupStaleBlobMedia` action for D-03 startup blob cleanup — nulls out leaves referencing stale blob mediaIds

### editorStore.ts
- Added `isPlaying: boolean`, `playheadTime: number`, `totalDuration: number` with initial values
- Added `setIsPlaying`, `setPlayheadTime`, `setTotalDuration` setters

### src/lib/videoRegistry.ts (new)
- Global `videoElementRegistry: Map<string, HTMLVideoElement>`
- Global `videoDrawRegistry: Map<string, () => void>`
- `registerVideo(nodeId, video, draw)` and `unregisterVideo(nodeId)` exports

### COOP/COEP headers
- `vite.config.ts`: dev server headers for `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy`
- `vercel.json`: production headers for Vercel deployment
- `public/_headers`: Netlify fallback headers

### media.ts
- `FillActions.addMedia` accepts optional `type` parameter
- `autoFillCells` now accepts both `image/*` and `video/*` files
- Video files use `URL.createObjectURL` (blob URL) — not base64
- Image files continue using `fileToBase64`

### export.ts
- Added `getSourceDimensions(src)` helper for image/video dimension access
- `drawCoverImage`, `drawContainImage`, `drawPannedCoverImage`, `drawPannedContainImage` all accept `HTMLImageElement | HTMLVideoElement`
- `drawLeafToCanvas` accepts `HTMLImageElement | HTMLVideoElement`
- `hasVideoCell` signature changed to `(root, mediaTypeMap)` — checks `mediaTypeMap[leaf.mediaId] === 'video'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical update] Update callers of hasVideoCell in Toolbar.tsx and ExportSplitButton.tsx**
- **Found during:** Task 2 — after changing hasVideoCell signature
- **Issue:** Two callers still passed `mediaRegistry` (old signature); would have been TypeScript errors
- **Fix:** Updated both callers to use `mediaTypeMap` from store; `ExportSplitButton.tsx` subscribes to `mediaTypeMap` via `useGridStore`
- **Files modified:** src/Editor/Toolbar.tsx, src/Editor/ExportSplitButton.tsx
- **Commit:** 6f4ef1a

**2. [Rule 1 - Bug] Updated test fixtures for hasVideoCell signature change**
- **Found during:** Task 2 — tests called hasVideoCell with string data URI maps
- **Issue:** Three test files called `hasVideoCell(leaf, { vid1: 'data:video/mp4;...' })` — no longer valid
- **Fix:** Updated to pass `{ vid1: 'video' }` mediaTypeMap format; also updated ExportSplitButton test to set `mediaTypeMap` in store state
- **Files modified:** src/test/canvas-export.test.ts, src/test/phase04-01-task2.test.tsx, src/test/phase04-02-task1.test.tsx
- **Commit:** 6f4ef1a

## Known Stubs

None. All infrastructure is wired correctly. Video blob URLs are stored in the registry; `cleanupStaleBlobMedia` is defined but not yet called from App.tsx (will be wired in Plan 02 or during video rendering integration).

## Verification Results

- `npx vitest run`: 32 test files, 392 passed, 2 skipped — no regressions
- `vercel.json` and `public/_headers` contain correct COOP/COEP headers
- `vite.config.ts` serves COOP/COEP headers in dev server

## Self-Check: PASSED
