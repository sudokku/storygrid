---
phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
plan: 01
subsystem: infra
tags: [mediabunny, ffmpeg, video-export, npm, vercel, netlify, coop-coep]

# Dependency graph
requires: []
provides:
  - "mediabunny@1.40.1 and @mediabunny/aac-encoder installed in package.json"
  - "ffmpeg packages (@ffmpeg/ffmpeg, @ffmpeg/util) removed from package.json"
  - "src/lib/transcodeToMp4.ts deleted"
  - "COOP/COEP headers removed from vercel.json and public/_headers (both files deleted)"
  - "videoExport.ts transcodeWebmToMp4 import removed (ready for Plan 14-02 rewrite)"
affects:
  - "14-02 — Mediabunny pipeline implementation (builds directly on this cleanup)"

# Tech tracking
tech-stack:
  added:
    - "mediabunny@1.40.1 — WebCodecs-based direct MP4 encoder"
    - "@mediabunny/aac-encoder@1.40.1 — AAC audio encoder extension for Mediabunny"
  patterns:
    - "ffmpeg.wasm removed from dependency tree — no COOP/COEP headers required"

key-files:
  created: []
  modified:
    - "package.json — mediabunny + aac-encoder added, @ffmpeg/ffmpeg + @ffmpeg/util removed"
    - "src/lib/videoExport.ts — transcodeWebmToMp4 import removed"
  deleted:
    - "src/lib/transcodeToMp4.ts — ffmpeg.wasm singleton transcode helper (D-09)"
    - "vercel.json — contained only COOP/COEP headers (D-10)"
    - "public/_headers — contained only COOP/COEP headers (D-10)"

key-decisions:
  - "vercel.json deleted entirely (only contained COOP/COEP headers; no other Vercel config needed)"
  - "public/_headers deleted entirely (same reason)"
  - "videoExport.ts import commented out rather than deleting usage — Plan 14-02 will rewrite the file"

patterns-established: []

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-04-10
---

# Phase 14 Plan 01: Dependency Cleanup Summary

**Removed @ffmpeg/ffmpeg + @ffmpeg/util, installed mediabunny@1.40.1 + @mediabunny/aac-encoder, deleted transcodeToMp4.ts and COOP/COEP header files to clear the way for the Mediabunny pipeline in Plan 14-02**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-10T00:00:00Z
- **Completed:** 2026-04-10T00:08:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 deleted, 1 deleted, 1 modified, 1 modified + deleted + lock updated)

## Accomplishments
- Uninstalled @ffmpeg/ffmpeg and @ffmpeg/util; installed mediabunny@1.40.1 and @mediabunny/aac-encoder
- Deleted src/lib/transcodeToMp4.ts (the ffmpeg.wasm singleton transcode helper)
- Removed the broken import in videoExport.ts so the build won't fail on the missing module
- Deleted vercel.json and public/_headers (both contained only COOP/COEP headers; no longer needed without SharedArrayBuffer)

## Task Commits

1. **Task 1: Remove ffmpeg packages, reinstall mediabunny + aac-encoder, delete transcodeToMp4.ts** - `56c35d7` (chore)
2. **Task 2: Remove COOP/COEP headers from vercel.json and public/_headers** - `5f87342` (chore)

## Files Created/Modified
- `package.json` — removed @ffmpeg/ffmpeg + @ffmpeg/util; added mediabunny + @mediabunny/aac-encoder
- `package-lock.json` — updated to reflect new dependency tree
- `src/lib/videoExport.ts` — transcodeWebmToMp4 import replaced with comment (line 6)
- `src/lib/transcodeToMp4.ts` — **deleted**
- `vercel.json` — **deleted** (only contained COOP/COEP headers)
- `public/_headers` — **deleted** (only contained COOP/COEP headers)

## Decisions Made
- Deleted vercel.json and public/_headers entirely rather than emptying them — both files contained only COOP/COEP headers and no other configuration. An empty vercel.json or _headers file would be misleading.
- Left the rest of videoExport.ts intact (including the transcodeWebmToMp4 call at line 469) — Plan 14-02 will rewrite the entire function. Only the import was removed to prevent a "missing module" build error.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 14-02 can now proceed to implement the Mediabunny CanvasSource + WebCodecs pipeline in videoExport.ts without import conflicts or stale dependencies. The mediabunny and @mediabunny/aac-encoder packages are installed and ready to import.

---
*Phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media*
*Completed: 2026-04-10*
