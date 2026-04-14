---
phase: 13
plan: 01
subsystem: overlay-store
tags: [overlay, store, types, zustand, immer, undo-redo, tdd]
dependency_graph:
  requires: []
  provides: [overlay-types, overlay-store, sticker-registry, editor-overlay-selection, gridstore-overlay-history]
  affects: [src/store/gridStore.ts, src/store/editorStore.ts, src/store/index.ts]
tech_stack:
  added: [nanoid (existing)]
  patterns: [zustand-immer-store, circular-static-import, tdd-red-green]
key_files:
  created:
    - src/store/overlayStore.ts
    - src/store/__tests__/overlayStore.test.ts
    - src/store/__tests__/stickerRegistry.test.ts
    - src/utils/__tests__/canvasExport.test.ts
  modified:
    - src/types/index.ts
    - src/store/editorStore.ts
    - src/store/gridStore.ts
    - src/store/index.ts
decisions:
  - Circular static import between overlayStore and gridStore is safe (Zustand stores are factory singletons; getState() called lazily inside action bodies)
  - pushOverlaySnapshot is a separate gridStore action called from overlayStore add/delete — avoids async pattern while keeping undo unified
  - setSelectedNode and setSelectedOverlayId each use Zustand set(state => ...) callback to read current counterpart state before clearing — no stale closure risk
  - history snapshot shape extended from { root } to { root, overlays } with ?? [] backward-compatibility guard for old snapshots
metrics:
  duration: 25min
  completed: 2026-04-09
  tasks_completed: 2
  files_changed: 8
---

# Phase 13 Plan 01: Overlay Data Foundation Summary

Overlay type union (TextOverlay | EmojiOverlay | StickerOverlay), Zustand+Immer overlayStore with stickerRegistry, editorStore.selectedOverlayId with mutual-exclusion wiring, and gridStore history extended to { root, overlays } snapshots — all with Wave 0 RED test stubs committed first.

## What Was Built

### Task 1 (TDD RED): Wave 0 Test Stubs + Overlay Types

Extended `src/types/index.ts` with the canonical overlay type union: `OverlayBase`, `TextOverlay`, `EmojiOverlay`, `StickerOverlay`, `Overlay`. Added VISUAL CENTER coordinate convention doc comment (D-08 override — `x`/`y` are center coordinates matching DOM `translate(-50%,-50%)` in Plan 02 and center-to-top-left conversion in Plan 03).

Created three Wave 0 test stubs:
- `src/store/__tests__/overlayStore.test.ts` — 13 tests across 7 describe blocks covering OVL-01, OVL-14, OVL-15, OVL-17
- `src/store/__tests__/stickerRegistry.test.ts` — 4 tests for registry add/get/remove round-trip
- `src/utils/__tests__/canvasExport.test.ts` — Wave 0 RED stub for OVL-10/11/12; intentionally fails until Plan 03 Task 1 creates `src/lib/overlayExport.ts`

All three files confirmed RED with "Cannot find module" for `overlayStore` and `overlayExport`.

### Task 2 (TDD GREEN): Implementation

**`src/store/overlayStore.ts`** — Full Zustand+Immer store with all 8 actions:
- `addOverlay`: computes `maxZ+1` for zIndex, pushes to overlays array, calls `pushOverlaySnapshot()` for undo integration
- `deleteOverlay`: filters array, calls `pushOverlaySnapshot()`
- `updateOverlay`: Object.assign on found index — no snapshot (D-04: move/resize not undoable)
- `bringForward` / `sendBackward`: zIndex ±1 with `Math.max(0, ...)` clamp — no snapshot
- `addSticker` / `removeSticker`: stickerRegistry map only — no snapshot (D-06: registry is side-channel)
- `replaceAll`: direct array replacement — no snapshot (called BY undo/redo)

**`src/store/editorStore.ts`** — Added `selectedOverlayId: string | null` state and `setSelectedOverlayId` action. Both `setSelectedNode` and `setSelectedOverlayId` use `set(state => ...)` callback pattern to atomically clear the counterpart field when a non-null id is set (OVL-15 mutual exclusion).

**`src/store/gridStore.ts`** — Three changes:
1. History snapshot type extended from `{ root: GridNode }` to `{ root: GridNode; overlays: Overlay[] }`
2. `pushSnapshot` reads `useOverlayStore.getState().overlays` and includes in snapshot; initial history entry and `clearGrid` reset both include `overlays: []`
3. `undo`/`redo` now call `useOverlayStore.getState().replaceAll(structuredClone(plainSnap.overlays ?? []))` after restoring root — `?? []` handles pre-Phase-13 snapshots
4. New `pushOverlaySnapshot` exported action: replicates pushSnapshot logic without mutating root; called from overlayStore for overlay-only history entries

**`src/store/index.ts`** — Added `export { useOverlayStore } from './overlayStore'`

## Test Results

- Task 1 commit: 3 files RED (Cannot find module — confirmed)
- Task 2 commit: 37 tests GREEN across overlayStore + stickerRegistry + gridStore (no regressions)
- Full suite: 584 tests pass, 1 test file intentionally fails (`canvasExport.test.ts` Wave 0 stub — goes GREEN in Plan 03 Task 1)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| File | Description |
|------|-------------|
| `src/utils/__tests__/canvasExport.test.ts` | Wave 0 RED stub for OVL-10/11/12 canvas overlay export — intentional; Plan 03 Task 1 expands with full draw-pass suite |

This stub is intentional by design — it satisfies the 13-VALIDATION.md Wave 0 contract and will be expanded (not replaced) in Plan 03 Task 1.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The stickerRegistry inline-data isolation (T-13-02) is enforced by type structure and test assertions.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/store/overlayStore.ts exists | FOUND |
| src/store/__tests__/overlayStore.test.ts exists | FOUND |
| src/store/__tests__/stickerRegistry.test.ts exists | FOUND |
| src/utils/__tests__/canvasExport.test.ts exists | FOUND |
| test(13-01) commit exists | FOUND |
| feat(13-01) commit exists | FOUND |
| export type Overlay in types/index.ts | FOUND |
| VISUAL CENTER comment in types/index.ts | FOUND |
| stickerRegistryId in types/index.ts | FOUND |
| selectedOverlayId in editorStore.ts | FOUND |
| pushOverlaySnapshot in gridStore.ts | FOUND |
| useOverlayStore in store/index.ts | FOUND |
