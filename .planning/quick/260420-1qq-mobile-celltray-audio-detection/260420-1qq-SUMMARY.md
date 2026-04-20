---
plan: 260420-1qq
status: complete
commit: 2ef7e91
date: 2026-04-20
---

## Summary

Fixed missing audio track detection in `MobileCellTray.handleFileChange`. Videos uploaded via the mobile Upload button now correctly detect audio presence and update the store.

## Changes

**`src/Editor/MobileCellTray.tsx`**
- Added static import of `detectAudioTrack` from `'../lib/media'`
- Destructured `setHasAudioTrack` from `useGridStore` alongside `toggleAudioEnabled`
- After `setMedia(nodeId, newId)` in `handleFileChange`, added three-line audio detection block mirroring `LeafNode.tsx` lines 465–469
- Added `setHasAudioTrack` to `useCallback` dep array

## Root Cause

`MobileCellTray.handleFileChange` called `addMedia` + `setMedia` but never `detectAudioTrack`/`setHasAudioTrack`. This left `hasAudioTrack=false` permanently for mobile uploads. `useAudioMix.updateGains()` filters to cells where `audioEnabled && hasAudioTrack`, so gain was always 0 → silence on mobile.

## Verification

TypeScript build passes clean. Audio toggle now enables correctly for videos with audio tracks uploaded via MobileCellTray.
