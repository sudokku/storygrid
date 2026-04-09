---
phase: 13
plan: 03
subsystem: overlay-export
tags: [overlay, export, canvas, tdd, png, mp4, video-export]
dependency_graph:
  requires: [overlay-types, overlay-store]
  provides: [overlay-export-draw-pass, overlay-png-integration, overlay-mp4-integration]
  affects: [src/lib/export.ts, src/lib/videoExport.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, canvas-draw-pass, zustand-getstate-direct, image-cache-per-export]
key_files:
  created:
    - src/lib/overlayExport.ts
    - src/lib/__tests__/overlayExport.test.ts
  modified:
    - src/lib/export.ts
    - src/lib/videoExport.ts
    - src/utils/__tests__/canvasExport.test.ts
decisions:
  - drawOverlaysToCanvas reads from useOverlayStore.getState() directly per D-24 — no prop threading
  - overlayImageCache created outside the video frame loop (T-13-07) — prevents per-frame sticker reloads
  - document.fonts.ready awaited before any ctx.fillText per D-18 — ensures Google Fonts are loaded
  - Integration point in export.ts is renderGridToCanvas (after renderGridIntoContext, before canvas returned)
  - Integration point in videoExport.ts is inside renderFrame and preflight render — after cell draw, before frame emitted
  - overlay.x/overlay.y are VISUAL CENTER — center-to-top-left conversion applied for fillText/drawImage
metrics:
  duration: 15min
  completed: 2026-04-09
  tasks_completed: 2
  files_changed: 5
---

# Phase 13 Plan 03: Overlay Export Draw Pass Summary

Pure `drawOverlaysToCanvas()` helper built and integrated into both PNG (`export.ts`) and MP4 (`videoExport.ts`) export pipelines — overlays now render identically in the live DOM preview, PNG export, and every MP4 frame.

## What Was Built

### Task 1 (TDD): drawOverlaysToCanvas + unit tests + Wave 0 canvasExport stub expansion

**`src/lib/overlayExport.ts`** — New async helper:
- Sorts overlays by ascending `zIndex` before draw
- Awaits `document.fonts.ready` before any `ctx.fillText` (D-18 — prevents Google Fonts fallback)
- TextOverlay: sets `ctx.font` with bold/regular weight + fontSize + fontFamily; converts VISUAL CENTER (overlay.x/y) to top-left for `ctx.fillText`; respects `textAlign` ('left'/'center'/'right') anchor point
- EmojiOverlay: `ctx.fillText(char, overlay.x, overlay.y)` with `textBaseline: 'middle'` — center-anchored
- StickerOverlay: loads image from `stickerRegistry[stickerRegistryId]`; uses `imageCache` parameter to prevent duplicate loads; draws at center → top-left offset
- Rotation: `ctx.translate(cx,cy)` → `ctx.rotate(rad)` → `ctx.translate(-cx,-cy)` around visual center
- Empty array returns immediately (no-op)

**`src/lib/__tests__/overlayExport.test.ts`** — 9 tests:
1. Text: verifies `ctx.fillText` called with content + font set to `bold 64px "Playfair Display"`
2. Emoji: verifies `ctx.fillText` with emoji char + font matches `100px serif`
3. Sticker: verifies `ctx.drawImage` called with loaded HTMLImageElement
4. zIndex ordering: three overlays with zIndex 3/1/2 drawn in order 1/2/3
5. Rotation: save/translate/rotate/translate(-cx,-cy)/restore sequence verified
6. document.fonts.ready: fillText only called after fonts.ready promise resolves
7. Image cache: second export call with same stickerRegistryId creates Image only once
8. Empty no-op: empty array triggers no save/fillText/drawImage
9. Integration spy: `renderGridIntoContext` fills at least one `fillRect` (background) before function returns; verifies export pipeline context

**`src/utils/__tests__/canvasExport.test.ts`** — Wave 0 stub from Plan 01 expanded:
- Kept original `exports drawOverlaysToCanvas` test (now GREEN — file exists)
- Added `renders a text overlay via ctx.fillText (smoke)` — Proxy-wrapped ctx records calls; asserts `fillText` called with 'hello'

### Task 2: Integration into PNG and MP4 export paths

**`src/lib/export.ts`** — Two changes:
1. Imports: `drawOverlaysToCanvas` from `./overlayExport`; `useOverlayStore` from `../store/overlayStore`
2. `renderGridToCanvas`: after `renderGridIntoContext` call, reads `{ overlays, stickerRegistry }` from `useOverlayStore.getState()`, creates `overlayImageCache`, calls `await drawOverlaysToCanvas(ctx, overlays, stickerRegistry, overlayImageCache)` — BEFORE canvas is returned for encoding

**`src/lib/videoExport.ts`** — Three changes:
1. Imports: same as export.ts
2. Before `return new Promise(...)`: reads `overlayState = useOverlayStore.getState()` ONCE (D-23 — positions static over video) and creates `overlayImageCache = new Map()` ONCE (T-13-07 — reuse across frames)
3. Three `drawOverlaysToCanvas` calls added — each AFTER a `renderGridIntoContext` call:
   - Pre-flight frame (before recorder.start())
   - Final frame (after export completes)
   - Per-frame in renderFrame loop

## Test Results

- Task 1 commit `3c8e800`: 11 tests GREEN (9 overlayExport + 2 canvasExport)
- Task 2 commit `7483dc4`: 597 tests pass (595 passing + 2 skipped), 0 regressions
- `npx tsc --noEmit`: exits 0
- Call order verified by grep awk: overlay line > cell draw line in both export.ts and videoExport.ts

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all overlay draw paths fully wired for text, emoji, and sticker types.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. `drawOverlaysToCanvas` reads from in-memory store state only; sticker data is already user-provided base64 from stickerRegistry (sanitized at upload per Plan 04).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/overlayExport.ts exists | FOUND |
| export async function drawOverlaysToCanvas in overlayExport.ts | FOUND |
| document.fonts.ready in overlayExport.ts | FOUND |
| .sort((a, b) => a.zIndex - b.zIndex) in overlayExport.ts | FOUND |
| ctx.rotate in overlayExport.ts | FOUND |
| ctx.drawImage in overlayExport.ts | FOUND |
| ctx.fillText >= 2 in overlayExport.ts | FOUND (5 matches) |
| src/lib/__tests__/overlayExport.test.ts exists with 9 tests | FOUND |
| call-order evidence in overlayExport.test.ts | FOUND |
| canvasExport.test.ts has both Wave 0 stub AND fillText smoke test | FOUND |
| drawOverlaysToCanvas in export.ts | FOUND |
| useOverlayStore in export.ts | FOUND |
| drawOverlaysToCanvas in videoExport.ts | FOUND |
| useOverlayStore in videoExport.ts | FOUND |
| overlayImageCache in videoExport.ts | FOUND |
| feat(13-03): drawOverlaysToCanvas commit 3c8e800 | FOUND |
| feat(13-03): wire drawOverlaysToCanvas commit 7483dc4 | FOUND |
| npx vitest run exits 0 | PASSED (597 tests) |
| npx tsc --noEmit exits 0 | PASSED |
