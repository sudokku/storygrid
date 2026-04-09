---
phase: 13
plan: "02"
subsystem: overlay-layer
tags: [overlay, drag, resize, rotate, delete, pointer-events, google-fonts, emoji-mart]
dependency_graph:
  requires: [13-01]
  provides: [OverlayLayer, OverlayHandles, canvas-surface-integration, overlay-keyboard-delete]
  affects: [src/Grid/CanvasWrapper.tsx, src/store/editorStore.ts, src/store/overlayStore.ts]
tech_stack:
  added: [emoji-mart@5.6.0, "@emoji-mart/react@1.1.1", "@emoji-mart/data@1.2.1", dompurify@3.3.3, "@types/dompurify@3.2.0"]
  patterns: [setPointerCapture pointer loop, center-based overlay positioning, keyboard delete guard]
key_files:
  created:
    - src/Grid/OverlayLayer.tsx
    - src/Editor/OverlayHandles.tsx
    - src/Grid/__tests__/OverlayLayer.test.tsx
    - src/Editor/__tests__/OverlayHandles.test.tsx
  modified:
    - src/Grid/CanvasWrapper.tsx
    - index.html
    - package.json
    - package-lock.json
decisions:
  - Center-based overlay.x/overlay.y with translate(-50%,-50%) DOM transform matches Plan 03 export path — no WYSIWYG drift
  - setPointerCapture uses optional chaining (?.) on all three handles to avoid jsdom test errors (follows Phase 05 precedent)
  - Delete/Backspace handler guards against INPUT, TEXTAREA, and isContentEditable targets (T-13-04 security requirement)
  - OverlayHandles rotation uses Math.atan2 + 90° offset for 12 o'clock handle position convention
  - getBoundingClientRect on canvas-surface used to compute overlay center in viewport space for rotation math
metrics:
  duration: "~10min"
  completed: "2026-04-10"
  tasks: 2
  files: 8
---

# Phase 13 Plan 02: DOM Overlay Layer + Drag/Resize/Rotate Handles Summary

**One-liner:** Center-based DOM overlay layer with pointer-capture drag/resize/rotate handles, Delete-key guard for sidebar inputs, Google Fonts preload, and emoji-mart + dompurify installed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install deps, preload fonts, scaffold OverlayLayer + tests | 9c036c0 | package.json, index.html, OverlayLayer.tsx, OverlayHandles.tsx (stub), CanvasWrapper.tsx, OverlayLayer.test.tsx |
| 2 | Implement drag/resize/rotate handles | f739c6f | OverlayHandles.tsx (full), OverlayHandles.test.tsx |

## What Was Built

### OverlayLayer (src/Grid/OverlayLayer.tsx)

Renders all overlays from `useOverlayStore` as absolutely-positioned divs inside `canvas-surface`. Key properties:
- Container: `position: absolute; inset: 0; pointer-events: none; z-index: 10`
- Each overlay wrapper: `translate(-50%, -50%) rotate(Ndeg)` — overlay.x/y are visual center coordinates (D-08 / coordinate override in plan)
- Overlay types: `text` (fontFamily/fontSize/color/fontWeight/textAlign), `emoji` (fontSize = width), `sticker` (img from stickerRegistry)
- `onPointerDown` calls `setSelectedOverlayId(overlay.id)` and stops propagation
- Window `keydown` listener: `Delete` / `Backspace` calls `deleteOverlay(selectedOverlayId)` then `setSelectedOverlayId(null)`
- Security guard (T-13-04): guard checks `target.tagName === 'INPUT' || 'TEXTAREA' || target.isContentEditable` before deleting
- Selected overlay renders `<OverlayHandles />` as a child

### OverlayHandles (src/Editor/OverlayHandles.tsx)

Three interaction handles on the selected overlay:

1. **Drag body** (covers 100% of overlay bounds, cursor: move)
   - `setPointerCapture?.(pointerId)` on pointerdown
   - viewportDelta / canvasScale = canvasDelta → `onUpdate({ x, y })`

2. **Corner resize handle** (12px, bottom-right, `nwse-resize` cursor)
   - `Math.hypot(dx, dy) * Math.sign(dx + dy)` for proportional resize
   - `Math.max(40, startWidth + canvasDelta)` — 40px minimum width clamp
   - Scaled by `scale(1/canvasScale)` for visual stability at any zoom

3. **Rotation handle** (12px circle, amber, top center)
   - `Math.atan2(e.clientY - centerViewportY, e.clientX - centerViewportX)` → degrees + 90° offset
   - Overlay center in viewport computed from `canvas-surface` `getBoundingClientRect()` + overlay.x * canvasScale
   - Scaled by `scale(1/canvasScale)` matching corner handle pattern

All `setPointerCapture` / `releasePointerCapture` calls use optional chaining (`?.`) for jsdom compatibility.

### CanvasWrapper Integration

`<OverlayLayer />` mounted inside `canvas-surface` after `<GridNodeComponent>` and before `<SafeZoneOverlay>`.

### Dependencies + Fonts

- `emoji-mart@5.6.0`, `@emoji-mart/react@1.1.1`, `@emoji-mart/data@1.2.1` — available for Plan 04 picker
- `dompurify@3.3.3` + `@types/dompurify@3.2.0` — available for Plan 04 SVG sanitization
- Google Fonts preconnect + Playfair Display + Dancing Script loaded in `index.html` for Plan 05 font picker

## Test Coverage

### OverlayLayer.test.tsx (5 tests — all GREEN)
1. Renders overlay wrapper divs for each overlay in store
2. Clicking overlay sets `selectedOverlayId` in editorStore
3. Delete keydown removes selected overlay + clears selectedOverlayId
4. Delete inside INPUT does NOT remove overlay (T-13-04 guard)
5. Backspace inside TEXTAREA does NOT remove overlay (T-13-04 guard)

### OverlayHandles.test.tsx (5 tests — all GREEN)
1. Drag at canvasScale=1: viewport delta 50,25 → canvas update x+50, y+25
2. Drag at canvasScale=0.5: viewport delta 50,25 → canvas update x+100, y+50
3. Resize corner: Math.hypot proportional resize grows from startWidth=200
4. Rotate: produces finite numeric rotation value from atan2 + 90° offset
5. jsdom guard: setPointerCapture=undefined does not throw

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All plan goals delivered. OverlayHandles stub from Task 1 was replaced by full implementation in Task 2.

## Threat Flags

No new security surface beyond what the plan's `<threat_model>` covered:
- T-13-04 keyboard delete guard implemented and verified by 2 tests (INPUT + TEXTAREA + Backspace)
- T-13-05 drag math client-side only (accepted per plan)

## Self-Check: PASSED

All 4 created/modified files confirmed on disk. Both task commits (9c036c0, f739c6f) confirmed in git log.
