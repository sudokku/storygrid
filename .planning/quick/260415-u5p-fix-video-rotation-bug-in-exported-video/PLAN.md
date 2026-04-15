---
quick_id: 260415-u5p
slug: fix-video-rotation-bug-in-exported-video
description: Fix video rotation bug in exported video
date: 2026-04-15
status: complete
---

# Fix: Video Rotation in Exported Video

## Problem
In the exported MP4, all video cells were rotated 90° counter-clockwise. They looked fine in the canvas preview.

## Root Cause
Mobile-shot videos store a clockwise rotation tag in MP4 metadata (e.g. 90°). The browser's `<video>` element applies this automatically, so the preview was correct. But Mediabunny's `VideoSampleSink` yields raw decoded frames **before** rotation is applied — `toVideoFrame()` → `createImageBitmap()` produces an un-rotated bitmap.

## Fix
1. Import `Rotation` type from mediabunny.
2. Add `rotation: Rotation` to `VideoStreamEntry` — read from `track.rotation` in `buildVideoStreams`.
3. Add `applyBitmapRotation(bitmap, rotation)` helper: draws the bitmap onto a temp canvas with the correct clockwise transform, outputting correct display dimensions.
4. In the encode loop, call `applyBitmapRotation` on each decoded bitmap before adding it to `frameMap`.

## Files Changed
- `src/lib/videoExport.ts`
