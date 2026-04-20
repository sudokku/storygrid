---
phase: 32-update-mobile-cell-tray-ui-ux
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/Editor/MobileCellTray.tsx
  - src/Editor/MobileSheet.tsx
  - src/Editor/MobileCellTray.test.ts
  - src/test/phase24-mobile-cell-tray.test.tsx
  - src/Editor/__tests__/phase05.1-p01-foundation.test.tsx
  - src/Editor/Toolbar.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-04-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 32 adds Effects and Audio buttons to `MobileCellTray`, introduces text labels and horizontal scroll, and gates tray visibility via `sheetSnapState`. `MobileSheet` gains an overlay auto-expand effect and a two-state toggle (collapsed / full). `Toolbar.tsx` is unchanged relative to this phase and is clean.

The code is generally well-structured and the new UI logic is sound. Three warnings require attention before ship: (1) unhandled async rejection in `handleFileChange`, (2) a subtle `useRef` initialization edge case in `MobileSheet`'s overlay auto-expand effect, and (3) the Fit toggle being active with no media, creating silent undo-history pollution. Four info items flag test hygiene and naming opportunities.

---

## Warnings

### WR-01: `handleFileChange` — async rejections are silently swallowed

**File:** `src/Editor/MobileCellTray.tsx:85-108`

**Issue:** `handleFileChange` is `async` and is attached directly to `onChange`. Any rejection thrown inside it (e.g. `fileToBase64` failing, `nanoid` dynamic import failing on a flaky connection) is silently swallowed by the browser — no error is surfaced to the user and no recovery path exists. The comment on line 90 documents the `useEditorStore.getState()` escape hatch to avoid a stale closure, which is correct, but the absence of a `try/catch` means a failed upload leaves the UI in a broken state (spinner never clears, no feedback).

```tsx
// Fix: wrap the async body in try/catch
const handleFileChange = useCallback(
  async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const nodeId = useEditorStore.getState().selectedNodeId;
    if (!nodeId) return;
    try {
      const { nanoid } = await import('nanoid');
      const newId = nanoid();
      if (file.type.startsWith('video/')) {
        const blobUrl = URL.createObjectURL(file);
        addMedia(newId, blobUrl, 'video');
      } else {
        const { fileToBase64 } = await import('../lib/media');
        const dataUri = await fileToBase64(file);
        addMedia(newId, dataUri, 'image');
      }
      setMedia(nodeId, newId);
    } catch (err) {
      console.error('[MobileCellTray] media upload failed', err);
      // surface to user via toast or similar
    }
  },
  [addMedia, setMedia],
);
```

---

### WR-02: `MobileSheet` — `prevOverlayRef` initialized from live state causes missed auto-expand on remount

**File:** `src/Editor/MobileSheet.tsx:31`

**Issue:** `prevOverlayRef` is initialized to `selectedOverlayId` at render time (line 31). If the component remounts while `selectedOverlayId` is already non-null (e.g. React Strict Mode double-invoke in development, or any parent that conditionally unmounts `MobileSheet` while an overlay is active), the effect guard `if (!prev && selectedOverlayId)` on line 35 never fires because `prev` starts equal to the current value. The sheet would stay collapsed even though an overlay is selected.

```tsx
// Current
const prevOverlayRef = useRef(selectedOverlayId);

// Fix: always start null so a non-null value at mount triggers the expand
const prevOverlayRef = useRef<string | null>(null);
```

---

### WR-03: `MobileCellTray` — Fit toggle enabled when no media is present, pollutes undo history

**File:** `src/Editor/MobileCellTray.tsx:172-184`

**Issue:** The Fit toggle button is always rendered and always interactive, regardless of `hasMedia`. Calling `updateCell` when no media is present writes a store mutation and creates an undo entry for an action with no visible effect. The Clear button is correctly gated behind `{hasMedia && ...}` (line 185); the Fit toggle should apply the same guard unless there is a documented intent to allow pre-configuring fit before media is added.

```tsx
// Fix: disable when no media, or conditionally render alongside Clear
<button
  type="button"
  className={`${BTN_CLASS} flex-shrink-0${!hasMedia ? ' opacity-40 cursor-not-allowed' : ''}`}
  onClick={handleToggleFit}
  disabled={!hasMedia}
  aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}
>
```

---

## Info

### IN-01: `MobileCellTray` — `isVisible` name is misleading given three-part visibility logic

**File:** `src/Editor/MobileCellTray.tsx:31`

**Issue:** `isVisible` is derived solely from `selectedNodeId !== null`, but actual tray visibility also depends on `isDragging` and `hiddenBySheet`. The name implies "the tray is visible" when it actually means "a cell is selected." This creates a false mental model when reading the JSX inline style.

```tsx
// Current
const isVisible = selectedNodeId !== null;

// Suggested
const hasSelection = selectedNodeId !== null;
```

---

### IN-02: `MobileCellTray.test.ts` — imports `useDragStore` directly from sub-file, bypassing barrel

**File:** `src/Editor/MobileCellTray.test.ts:16`

**Issue:** `src/dnd/index.ts` explicitly documents "All DnD consumers import from 'src/dnd' — never directly from sub-files." The test imports `useDragStore` from `'../dnd/dragStore'` directly, violating this convention. The source file itself (`MobileCellTray.tsx:10`) correctly imports from `'../dnd'`.

```ts
// Current (test)
import { useDragStore } from '../dnd/dragStore';

// Fix
import { useDragStore } from '../dnd';
```

---

### IN-03: `MobileCellTray.test.ts` — stale "Phase 30" header references obsolete plan stubs

**File:** `src/Editor/MobileCellTray.test.ts:2-8`

**Issue:** The file-level JSDoc says "Phase 30" and references plan stubs ("Plan 30-04", "Wave 2 (Plan 30-05)") that were resolved in a prior phase. The mock (line 41-42) now includes Phase 32 additions (`toggleAudioEnabled`, `mediaTypeMap`). The stale header causes confusion when diagnosing test failures.

**Fix:** Update the header comment to reflect Phase 32 ownership and remove the obsolete plan references.

---

### IN-04: `phase05.1-p01-foundation.test.tsx` — `beforeEach` omits `showOverlays` from store reset

**File:** `src/Editor/__tests__/phase05.1-p01-foundation.test.tsx:55-74`

**Issue:** The `beforeEach` sets explicit `useEditorStore` state without including `showOverlays`. The Phase 24 test's `beforeEach` (in `phase24-mobile-cell-tray.test.tsx:68`) does include `showOverlays: true`. Because Zustand's `setState` merges rather than replaces, the store default value holds and this is not a functional bug. However the inconsistency means tests in this file implicitly depend on whatever state a previously-run test left in `showOverlays`, which can cause ordering-sensitive failures if the field is ever mutated in a test without cleanup.

**Fix:** Add `showOverlays: true` to the `beforeEach` reset block for consistency and test isolation.

---

_Reviewed: 2026-04-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
