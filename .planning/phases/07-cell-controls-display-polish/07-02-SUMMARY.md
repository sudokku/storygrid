---
phase: 07-cell-controls-display-polish
plan: 02
subsystem: store, sidebar
tags: [media, video, thumbnail, zustand, jsdom]
dependency_graph:
  requires: []
  provides: [thumbnailMap, captureVideoThumbnail, sidebar-video-thumbnail]
  affects: [gridStore, Sidebar, SelectedCellPanel]
tech_stack:
  added: []
  patterns: [async-fire-and-forget, _capture-indirection-for-testability, displayUrl-computed-from-mediaType]
key_files:
  created:
    - src/test/phase07-02-gridstore-thumbnail.test.ts
    - src/test/phase07-02-sidebar-thumbnail.test.tsx
  modified:
    - src/store/gridStore.ts
    - src/Editor/Sidebar.tsx
decisions:
  - captureVideoThumbnail uses loadedmetadata → seeked sequence (not loadeddata) for reliable first-frame seek
  - 2s timeout confirmed — resolves null on timeout, store skips thumbnailMap assignment
  - _capture indirection object exports { fn: captureVideoThumbnail } — allows vi.fn() override in tests without ES module namespace tricks
  - store creator changed from (set) to (set, get) to allow post-capture verification that mediaId still exists
  - displayUrl computed as mediaType === 'video' ? thumbnailUrl : mediaUrl — clean separation of display logic
  - URL.revokeObjectURL mocked via vi.spyOn in tests that call removeMedia with blob URLs
metrics:
  duration: 468s
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 4
---

# Phase 7 Plan 02: Video Thumbnail First-Frame Capture Summary

Implements MEDIA-01: video cells now show a recognizable first-frame preview in the sidebar instead of a broken blob URL rendered via `<img>`.

## What Was Built

**gridStore.ts — backend:**
- `captureVideoThumbnail(blobUrl)`: async helper that creates a hidden `<video>` element, sets `currentTime = 0` on `loadedmetadata`, captures frame on `seeked` via `canvas.toDataURL('image/jpeg', 0.8)`, with a 2-second timeout that resolves `null`
- `_capture` indirection object exported for test overrides: `export const _capture = { fn: captureVideoThumbnail }`
- `thumbnailMap: Record<string, string>` added to `GridStoreState`
- `addMedia` updated: fires `_capture.fn(dataUri).then(...)` for video type (fire-and-forget); verifies mediaId still exists before writing to `thumbnailMap`
- `removeMedia`, `clearGrid`, `applyTemplate`, `cleanupStaleBlobMedia` all delete `thumbnailMap[mediaId]` on cleanup
- Store creator changed from `(set)` to `(set, get)` for post-capture state verification

**Sidebar.tsx — frontend:**
- Added `mediaType` selector: reads `s.mediaTypeMap[n.mediaId]`
- Added `thumbnailUrl` selector: reads `s.thumbnailMap[n.mediaId]`
- Added `displayUrl` computation: `mediaType === 'video' ? thumbnailUrl : mediaUrl`
- Thumbnail render block updated from `{mediaUrl ?` to `{displayUrl ?`
- Video cell without thumbnail (still capturing / failed) shows `ImageIcon` placeholder — no broken `<img>`

## captureVideoThumbnail Implementation Choices

**loadedmetadata vs loadeddata:** Used `loadedmetadata` because it fires as soon as the video dimensions and duration are known, allowing an immediate `currentTime = 0` seek. `loadeddata` waits for the first frame to be buffered, which is slower and sometimes doesn't fire for blob URLs in jsdom.

**Timeout value:** 2000ms confirmed. Resolves `null` on timeout. Store checks `if (!thumb) return` — thumbnailMap entry simply remains absent, ImageIcon shown.

## jsdom Mocking Strategy

Since jsdom does not implement HTMLVideoElement media loading, tests use the `_capture` indirection:
- Tests import `_capture` and set `_capture.fn = vi.fn().mockResolvedValue(thumb)` 
- `beforeEach`/`afterEach` reset `_capture.fn = captureVideoThumbnail`
- `URL.revokeObjectURL` mocked with `vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})` for tests that call `removeMedia` with blob URLs

The `captureVideoThumbnail` unit test for error handling mocks `document.createElement('video')` to return a fake video that fires the `error` event when `src` is set.

## Zustand Creator Signature Change

Changed from `immer((set) => ({...}))` to `immer((set, get) => ({...}))` to enable the post-capture verification:
```ts
const snapshot = get();
if (snapshot.mediaRegistry[mediaId]) {
  set(state => { state.thumbnailMap[mediaId] = thumb; });
}
```
This prevents writing to `thumbnailMap` for media that was removed during the async capture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import statement misplacement**
- **Found during:** Task 1 implementation
- **Issue:** When adding `captureVideoThumbnail` before the tree imports, the `import { splitNode, ... }` block ended up after the function declaration
- **Fix:** Rewrote the full gridStore.ts to restore proper import order at the top of the file
- **Files modified:** src/store/gridStore.ts

**2. [Rule 2 - Missing Critical] _capture indirection for testability**
- **Found during:** Task 1 test execution
- **Issue:** `vi.spyOn` on `captureVideoThumbnail` from another module cannot intercept direct calls within the same module
- **Fix:** Added `export const _capture = { fn: captureVideoThumbnail }` and changed `addMedia` to call `_capture.fn(dataUri)` instead of `captureVideoThumbnail(dataUri)` directly
- **Files modified:** src/store/gridStore.ts
- **Commit:** 95ed104

**3. [Rule 2 - Missing Critical] URL.revokeObjectURL mock for jsdom**
- **Found during:** Task 1 test execution
- **Issue:** jsdom does not implement `URL.revokeObjectURL`; `removeMedia` with a blob URL throws "URL.revokeObjectURL is not a function"
- **Fix:** Used `vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})` in tests that call `removeMedia` with blob URLs
- **Files modified:** src/test/phase07-02-gridstore-thumbnail.test.ts

## Known Stubs

None — `thumbnailMap` is fully wired from capture through store to Sidebar rendering.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/store/gridStore.ts exists | FOUND |
| src/Editor/Sidebar.tsx exists | FOUND |
| src/test/phase07-02-gridstore-thumbnail.test.ts exists | FOUND |
| src/test/phase07-02-sidebar-thumbnail.test.tsx exists | FOUND |
| Commit 95ed104 (Task 1) | FOUND |
| Commit bbc99a4 (Task 2) | FOUND |
| All 37 test files pass (422 tests) | PASSED |
| npm run build | PASSED |
