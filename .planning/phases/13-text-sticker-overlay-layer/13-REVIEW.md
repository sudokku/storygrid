---
phase: 13-text-sticker-overlay-layer
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - index.html
  - package.json
  - src/Editor/AddOverlayMenu.tsx
  - src/Editor/EmojiPickerPopover.tsx
  - src/Editor/InlineTextEditor.tsx
  - src/Editor/OverlayHandles.tsx
  - src/Editor/OverlayPanel.tsx
  - src/Editor/Sidebar.tsx
  - src/Editor/StickerUpload.tsx
  - src/Editor/Toolbar.tsx
  - src/Editor/__tests__/OverlayHandles.test.tsx
  - src/Editor/__tests__/OverlayPanel.test.tsx
  - src/Grid/CanvasWrapper.tsx
  - src/Grid/OverlayLayer.tsx
  - src/Grid/__tests__/OverlayLayer.test.tsx
  - src/lib/__tests__/overlayExport.test.ts
  - src/lib/__tests__/svgSanitize.test.ts
  - src/lib/export.ts
  - src/lib/overlayExport.ts
  - src/lib/svgSanitize.ts
  - src/lib/videoExport.ts
  - src/store/__tests__/overlayStore.test.ts
  - src/store/__tests__/stickerRegistry.test.ts
  - src/store/editorStore.ts
  - src/store/gridStore.ts
  - src/store/index.ts
  - src/store/overlayStore.ts
  - src/types/index.ts
  - src/utils/__tests__/canvasExport.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 13 adds the text/sticker/emoji overlay layer: a new `overlayStore`, overlay type definitions, `OverlayLayer` rendering, `OverlayHandles` for drag/resize/rotate, `InlineTextEditor` for in-place text editing, `OverlayPanel` sidebar controls, `StickerUpload` with SVG sanitization, `EmojiPickerPopover` with lazy loading, and canvas/video export integration.

The architecture is sound — coordinate semantics are well-documented, the undo/redo integration via `pushOverlaySnapshot` is clean, the SVG sanitization path is correct, and the export ordering (cells first, overlays second) is properly enforced. Test coverage is thorough across all store actions and rendering behaviors.

Three critical issues require immediate attention: two missing npm packages that cause build/runtime failures, and one `React` namespace reference without an import that causes TypeScript compilation to fail. Four warnings cover a double-commit bug in the inline editor, an unguarded sticker `<img>` src, a canvas deselection gap, and a multi-line text export limitation. Two informational items cover a magic number and a redundant variable.

## Critical Issues

### CR-01: `dompurify` missing from package.json — SVG sanitization broken at runtime

**File:** `src/lib/svgSanitize.ts:1`
**Issue:** `import DOMPurify from 'dompurify'` is executed at module load time. `dompurify` does not appear in `package.json` (neither `dependencies` nor `devDependencies`). Any upload of an SVG sticker will crash at runtime with a module-not-found error, and the sanitization that prevents XSS from malicious SVG content (D-07, T-13-09) will not run.
**Fix:**
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```
The import in `svgSanitize.ts` is already correct once the package is installed.

---

### CR-02: `@emoji-mart/react` and `@emoji-mart/data` missing from package.json — emoji picker fails at runtime

**File:** `src/Editor/EmojiPickerPopover.tsx:25-26`
**Issue:** `EmojiPickerPopover` dynamically imports `@emoji-mart/react` and `@emoji-mart/data` on first render. Neither package is listed in `package.json`. The dynamic `import()` will reject, the `catch` branch will set the error state to `'Failed to load emoji picker'`, and the feature is non-functional. The build itself will succeed (dynamic imports resolve at runtime), but the feature silently fails for users.
**Fix:**
```bash
npm install @emoji-mart/react @emoji-mart/data
```

---

### CR-03: `React` namespace used without import in two files — TypeScript compile error

**File:** `src/Editor/EmojiPickerPopover.tsx:16`, `src/Editor/StickerUpload.tsx:14`
**Issue:** Both files reference the `React` namespace directly — `React.ComponentType<any>` in `EmojiPickerPopover.tsx` and `React.ChangeEvent<HTMLInputElement>` in `StickerUpload.tsx` — without importing `React`. With `"jsx": "react-jsx"` the JSX runtime is auto-injected but the `React` namespace is not placed in scope. TypeScript with `strict: true` will error: `Cannot find name 'React'`. The build (`tsc -b && vite build`) will fail.
**Fix:**
```typescript
// EmojiPickerPopover.tsx — add at top
import type React from 'react';

// StickerUpload.tsx — add at top
import type React from 'react';
```
Alternatively, replace the `React.*` type references with equivalent standalone types from `react`:
```typescript
// EmojiPickerPopover.tsx line 16
import { type ComponentType, useState, useEffect } from 'react';
const [PickerComponent, setPickerComponent] = useState<ComponentType<unknown> | null>(null);

// StickerUpload.tsx line 14
import { useRef, type ChangeEvent } from 'react';
const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
```

---

## Warnings

### WR-01: `InlineTextEditor` — double-commit on outside click (onBlur + pointerdown both fire)

**File:** `src/Editor/InlineTextEditor.tsx:28-35, 48`
**Issue:** When a user clicks outside the editor, the browser fires `pointerdown` on the document first, then `blur` on the `contentEditable` div. The `pointerdown` listener calls `onCommit(ref.current.textContent)` at line 30, which updates the overlay and unmounts the `InlineTextEditor` (via `setEditingOverlayId(null)` in `OverlayLayer`). Immediately after, `onBlur` at line 48 fires on the unmounting component and calls `onCommit` again with `ref.current?.textContent ?? ''`. The second call triggers a second `updateOverlay` write. While this is likely harmless (same content), it causes two distinct state mutations and may cause issues if `onCommit` has side effects (e.g., future validation logic).
**Fix:** Remove the `onBlur` handler and rely solely on the `pointerdown` listener and the `Escape` key handler:
```typescript
// Remove line 48:
// onBlur={() => onCommit(ref.current?.textContent ?? '')}

// If blur-based commit is needed as a safety net, guard against already-committed state:
onBlur={() => {
  // Only commit if the component is still active (not already committed via pointerdown)
  if (ref.current) {
    onCommit(ref.current.textContent ?? '');
  }
}}
```
The safest fix is to add a `committed` ref flag:
```typescript
const committedRef = useRef(false);
// In pointerdown handler:
committedRef.current = true;
onCommit(ref.current.textContent ?? '');
// In onBlur:
onBlur={() => { if (!committedRef.current) onCommit(ref.current?.textContent ?? ''); }}
```

---

### WR-02: `OverlayLayer` renders `<img src={undefined}>` when sticker data is missing from registry

**File:** `src/Grid/OverlayLayer.tsx:111-118`
**Issue:** For `StickerOverlay` items, the `src` is set to `stickerRegistry[overlay.stickerRegistryId]`, which is `undefined` when the registry entry is missing (e.g., after undo restores an overlay whose sticker was added in a later session, or if `removeSticker` was called). `<img src={undefined}>` renders as `<img src="undefined">` in the DOM, causing a failed network request to a URL literally named `"undefined"` and a broken image icon visible to the user.
**Fix:** Guard against missing registry entries:
```typescript
{overlay.type === 'sticker' && stickerRegistry[overlay.stickerRegistryId] && (
  <img
    src={stickerRegistry[overlay.stickerRegistryId]}
    style={{ width: overlay.width, height: 'auto', display: 'block' }}
    draggable={false}
    alt=""
  />
)}
```

---

### WR-03: `CanvasWrapper.handleBgClick` does not clear selected overlay — overlay stays "selected" after clicking canvas background

**File:** `src/Grid/CanvasWrapper.tsx:70-76`
**Issue:** `handleBgClick` calls `setSelectedNode(null)` and `setPanModeNodeId(null)` but does not call `setSelectedOverlayId(null)`. When the user clicks the canvas background (outside any overlay), the selected overlay remains selected (its handles remain visible and the `OverlayPanel` stays open in the sidebar). The mutual exclusion in `setSelectedNode` only clears `selectedOverlayId` when a non-null node id is provided; passing `null` preserves the current `selectedOverlayId`.
**Fix:**
```typescript
const setSelectedOverlayId = useEditorStore(s => s.setSelectedOverlayId);

const handleBgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (e.target === e.currentTarget) {
    setSelectedNode(null);
    setPanModeNodeId(null);
    setSelectedOverlayId(null); // deselect overlay on canvas background click
  }
}, [setSelectedNode, setPanModeNodeId, setSelectedOverlayId]);
```

---

### WR-04: `overlayExport.ts` — multi-line text overlay renders only one line via `ctx.fillText`

**File:** `src/lib/overlayExport.ts:97`
**Issue:** `ctx.fillText(overlay.content, alignX, drawY)` draws the entire text content as a single string. The DOM layer correctly uses `white-space: pre-wrap` (line 88 of `OverlayLayer.tsx`) which wraps newlines. However, Canvas 2D `fillText` does not interpret `\n` characters — multi-line text will render as a single run (typically displayed as a rectangle in most browsers or simply ignoring the newline character). The exported PNG/video will show text overlay content on one line instead of multiple lines, creating a visual mismatch between the canvas preview and the export.
**Fix:** Split `overlay.content` on newlines and draw each line separately:
```typescript
const lines = overlay.content.split('\n');
lines.forEach((line, i) => {
  ctx.fillText(line, alignX, drawY + i * (overlay.fontSize * 1.2));
});
```

---

## Info

### IN-01: Magic number `0.6` in `overlayExport.ts` should be a named constant

**File:** `src/lib/overlayExport.ts:84`
**Issue:** `const drawY = overlay.y - (overlay.fontSize * 0.6)` uses a magic multiplier `0.6` to estimate the vertical offset from visual center to text baseline. The value is undocumented — it appears to be an approximation of half the line height for `textBaseline: 'top'`, but is not labeled or explained.
**Fix:**
```typescript
// Canvas textBaseline='top': the font cap-height is approximately 60% of fontSize.
// We shift up by half a cap-height to visually center the first line on overlay.y.
const CAP_HEIGHT_RATIO = 0.6;
const drawY = overlay.y - (overlay.fontSize * CAP_HEIGHT_RATIO);
```

---

### IN-02: `overlayExport.test.ts` Test 9 — spy does not actually verify ordering; acceptance comment undermines the test

**File:** `src/lib/__tests__/overlayExport.test.ts:372-435`
**Issue:** Test 9 is described as an "integration call-order spy" but the assertion only verifies that `fillRect` was called at some point (`expect(fillRectIdx).toBeGreaterThanOrEqual(0)`). It does not check that `drawOverlaysToCanvas` was called after `fillRect`. The comment on line 368 acknowledges this: "the ordering is enforced by the implementation — we verify the implementation's line order via acceptance criteria grep." The test provides false confidence that overlay draw ordering is validated; it would pass even if overlays were drawn before cells.
**Fix:** Either strengthen the assertion to verify `drawOverlaysToCanvas` was called and that `fillRect` appeared before it in `callLog`, or rename the test to accurately reflect what it actually checks (that `renderGridIntoContext` calls `fillRect` at all). The current test body already has the `drawOverlaysSpy` wired but never asserts `drawOverlaysSpy.mock.calls.length > 0`.

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
