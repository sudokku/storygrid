---
phase: 13-text-sticker-overlay-layer
fixed_at: 2026-04-10T00:00:00Z
review_path: .planning/phases/13-text-sticker-overlay-layer/13-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-04-10
**Source review:** .planning/phases/13-text-sticker-overlay-layer/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical + 4 Warning)
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-02: `@emoji-mart/react` and `@emoji-mart/data` missing from package.json

**Files modified:** `package.json`, `package-lock.json`
**Commit:** 8600fb6
**Applied fix:** Ran `npm install @emoji-mart/react @emoji-mart/data`. Both packages (`@emoji-mart/data@^1.2.1` and `@emoji-mart/react@^1.1.1`) were added to `dependencies` in `package.json` and `package-lock.json` was updated.

---

### CR-03: `React` namespace used without import in two files

**Files modified:** `src/Editor/EmojiPickerPopover.tsx`, `src/Editor/StickerUpload.tsx`
**Commit:** 39f58d1
**Applied fix:** In `EmojiPickerPopover.tsx`, replaced `import { useState, useEffect } from 'react'` with `import { type ComponentType, useState, useEffect } from 'react'` and changed `React.ComponentType<any>` to `ComponentType<any>`. In `StickerUpload.tsx`, replaced `import { useRef } from 'react'` with `import { useRef, type ChangeEvent } from 'react'` and changed `React.ChangeEvent<HTMLInputElement>` to `ChangeEvent<HTMLInputElement>`. Both files no longer reference the `React` namespace.

---

### WR-01: `InlineTextEditor` double-commit on outside click

**Files modified:** `src/Editor/InlineTextEditor.tsx`
**Commit:** 1703734
**Applied fix:** Added `const committedRef = useRef(false)` to track whether a commit has already been issued. In the `pointerdown` listener, set `committedRef.current = true` before calling `onCommit`. Changed `onBlur` from unconditional `onCommit(...)` to `() => { if (!committedRef.current) onCommit(ref.current?.textContent ?? ''); }`. This prevents the second `updateOverlay` write when the user clicks outside the editor.

---

### WR-02: `OverlayLayer` renders `<img src={undefined}>` for missing sticker registry entries

**Files modified:** `src/Grid/OverlayLayer.tsx`
**Commit:** ac4137c
**Applied fix:** Changed the sticker render condition from `overlay.type === 'sticker'` to `overlay.type === 'sticker' && stickerRegistry[overlay.stickerRegistryId]`. The `<img>` element is now only rendered when the registry entry exists, preventing the broken-image network request to `"undefined"`.

---

### WR-03: `CanvasWrapper.handleBgClick` does not clear selected overlay

**Files modified:** `src/Grid/CanvasWrapper.tsx`
**Commit:** 1244eae
**Applied fix:** Added `const setSelectedOverlayId = useEditorStore(s => s.setSelectedOverlayId)` selector, added `setSelectedOverlayId(null)` call inside `handleBgClick` when `e.target === e.currentTarget`, and added `setSelectedOverlayId` to the `useCallback` dependency array. Clicking the canvas background now deselects overlays as well as grid nodes.

---

### WR-04: `overlayExport.ts` multi-line text renders as single line via `ctx.fillText`

**Files modified:** `src/lib/overlayExport.ts`
**Commit:** 1ce040a
**Applied fix:** Replaced the single `ctx.fillText(overlay.content, alignX, drawY)` call with a loop: split `overlay.content` on `'\n'`, then call `ctx.fillText(line, alignX, drawY + i * (overlay.fontSize * 1.2))` for each line. This matches the `white-space: pre-wrap` behavior of the DOM layer and produces correct multi-line text in exported PNG/video.

---

## Skipped Issues

### CR-01: `dompurify` missing from package.json — SVG sanitization broken at runtime

**File:** `src/lib/svgSanitize.ts:1`
**Reason:** skipped: code context differs from review — `dompurify@^3.3.3` and `@types/dompurify@^3.0.5` were already present in `package.json` at the time of fix. The package was installed prior to the review being written or was added in a concurrent change. No action was required.
**Original issue:** `import DOMPurify from 'dompurify'` would crash at runtime if `dompurify` were missing from `package.json`. Since it is already present, SVG sanitization is functional.

---

_Fixed: 2026-04-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
