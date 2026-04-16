# Phase 24: Mobile Cell Action Tray - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 3 (1 new, 2 modified)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Editor/MobileCellTray.tsx` | component | request-response (button → store action) | `src/Grid/ActionBar.tsx` | exact (same button set, same store hooks, same icon logic) |
| `src/Editor/EditorShell.tsx` | component (shell) | — | `src/Editor/EditorShell.tsx` (self-modify) | n/a — add one JSX line |
| `src/test/phase24-mobile-cell-tray.test.tsx` | test | — | `src/test/phase22-mobile-header.test.tsx` | exact (same matchMedia mock, same store reset, same assertion style) |

---

## Pattern Assignments

### `src/Editor/MobileCellTray.tsx` (component, request-response)

**Primary analog:** `src/Grid/ActionBar.tsx`
**Secondary analog:** `src/Editor/MobileSheet.tsx` (fixed positioning, animation, `md:hidden`)

---

#### Imports pattern — from `src/Grid/ActionBar.tsx` lines 1-22

```tsx
import React, { useCallback, useRef } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  Maximize2,
  Minimize2,
  Upload,
  ImageOff,
} from 'lucide-react';
```

Note: No `Tooltip`/`TooltipProvider` needed — mobile touch targets do not use hover tooltips.

---

#### Fixed positioning + animation pattern — from `src/Editor/MobileSheet.tsx` lines 36-43

```tsx
// MobileSheet uses:
<div
  className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] ... md:hidden motion-reduce:transition-none"
  style={{
    height: '100dvh',
    transform: SNAP_TRANSLATE[sheetSnapState],
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
  }}
>
```

For MobileCellTray, adapt this as always-mounted opacity/transform toggle (see below). The easing `cubic-bezier(0.32, 0.72, 0, 1)` and `md:hidden motion-reduce:transition-none` classes are copied verbatim.

**Always-mounted visibility pattern** (do NOT unmount on deselect — exit animation won't play):

```tsx
const isVisible = selectedNodeId !== null;

<div
  className="fixed left-0 right-0 z-[45] md:hidden motion-reduce:transition-none"
  style={{
    bottom: '60px',
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
    pointerEvents: isVisible ? 'auto' : 'none',
    transition: 'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
  }}
  data-testid="mobile-cell-tray"
>
```

Key points:
- `bottom: '60px'` — always above the 60px tab strip; never changes with sheet snap state
- `z-[45]` — above sheet z-40, below overlays z-50+
- `pointerEvents: 'none'` when hidden — prevents invisible buttons intercepting taps

---

#### selectedNodeId subscription pattern — from `src/Editor/MobileSheet.tsx` lines 22-24

```tsx
const selectedNodeId = useEditorStore(s => s.selectedNodeId);
```

---

#### Fit value + mediaId lookup pattern — from `src/Grid/ActionBar.tsx` lines 36-49

```tsx
// ActionBar reads fit and mediaId via findNode selector
const mediaId = useGridStore(s => (findNode(s.root, nodeId) as LeafNode | null)?.mediaId ?? null);

// For MobileCellTray, selectedNodeId is the nodeId. Guard for non-leaf (container) nodes:
const fit = useGridStore(s => {
  if (!selectedNodeId) return 'cover' as const;
  const node = findNode(s.root, selectedNodeId) as LeafNode | null;
  return (node?.type === 'leaf' ? node.fit : 'cover') ?? 'cover';
});
const mediaId = useGridStore(s => {
  if (!selectedNodeId) return null;
  const node = findNode(s.root, selectedNodeId) as LeafNode | null;
  return node?.type === 'leaf' ? (node.mediaId ?? null) : null;
});
const hasMedia = mediaId !== null;
```

---

#### Store actions wiring pattern — from `src/Grid/ActionBar.tsx` lines 32-64

```tsx
// Direct store subscriptions (verbatim from ActionBar.tsx lines 32-35)
const split = useGridStore(s => s.split);
const updateCell = useGridStore(s => s.updateCell);
const removeMedia = useGridStore(s => s.removeMedia);

// Handlers (verbatim from ActionBar.tsx lines 52-64)
const handleSplitH = useCallback(() => split(nodeId, 'horizontal'), [split, nodeId]);
const handleSplitV = useCallback(() => split(nodeId, 'vertical'), [split, nodeId]);
const handleToggleFit = useCallback(
  () => updateCell(nodeId, { fit: fit === 'cover' ? 'contain' : 'cover' }),
  [updateCell, nodeId, fit]
);
const handleClearMedia = useCallback(() => {
  if (mediaId) {
    removeMedia(mediaId);
    updateCell(nodeId, { mediaId: null });
  }
}, [removeMedia, updateCell, nodeId, mediaId]);
```

Where `nodeId` = `selectedNodeId` (guard with `if (selectedNodeId)` before calling).

---

#### Upload button + file input pattern — from `src/Editor/Sidebar.tsx` lines 229-284

**CRITICAL:** `addMedia(mediaId, dataUri, type)` takes a pre-converted dataUri/blobUrl + nanoid-generated mediaId — NOT a raw `File`. The RESEARCH.md skeleton is incorrect on this point. Copy the Sidebar.tsx pattern:

```tsx
// From Sidebar.tsx SelectedCellPanel (lines 229-284, condensed)
const addMedia = useGridStore(s => s.addMedia);
const setMedia = useGridStore(s => s.setMedia);
const inputRef = useRef<HTMLInputElement>(null);

const handleUploadClick = useCallback(() => inputRef.current?.click(), []);

const handleFileChange = useCallback(
  async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Read selectedNodeId at call time to avoid stale closure (per EditorShell keyboard handler pattern)
    const nodeId = useEditorStore.getState().selectedNodeId;
    if (!nodeId) return;

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
  },
  [addMedia, setMedia],
);

// JSX:
<input
  ref={inputRef}
  type="file"
  accept="image/*,video/*"
  className="hidden"
  onChange={handleFileChange}
  aria-hidden="true"
/>
```

Note: Read `selectedNodeId` via `useEditorStore.getState().selectedNodeId` inside the async handler (not from closure) — established pattern from `src/Editor/EditorShell.tsx` lines 41-52.

---

#### Fit toggle icon pattern — from `src/Grid/ActionBar.tsx` lines 113-122

```tsx
// Verbatim from ActionBar.tsx (D-10: Minimize2 when cover, Maximize2 when contain)
{fit === 'cover'
  ? <Minimize2 size={20} className="text-white" />
  : <Maximize2 size={20} className="text-white" />
}
```

---

#### Button class + container style — from `src/Grid/ActionBar.tsx` lines 67-74 + `src/Editor/MobileSheet.tsx` tab strip

```tsx
// ActionBar desktop btn class uses w-16 h-16 — mobile uses min-w/min-h for 44px minimum
const btnClass = 'min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

// ActionBar container style (lines 71-74):
<div className="flex items-center gap-1 px-1 py-1 rounded-md bg-black/70 backdrop-blur-sm">

// For MobileCellTray: use gap-2 (≥8px per D-09) and center horizontally with mx-4:
<div className="mx-4 flex items-center justify-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md">
```

---

#### React.memo wrapping — from `src/Grid/ActionBar.tsx` line 31

```tsx
export const MobileCellTray = React.memo(function MobileCellTray() {
  // ...
});
```

---

### `src/Editor/EditorShell.tsx` (shell component — single-line modification)

**Change:** Add `<MobileCellTray />` as sibling after `<MobileSheet />` at line 93.

**Pattern — from `src/Editor/EditorShell.tsx` lines 86-96 (current):**

```tsx
return (
  <div className="flex flex-col h-screen w-screen bg-[#0a0a0a]">
    <Toolbar />
    <div className="flex flex-1 overflow-hidden pb-[60px] md:pb-0">
      <CanvasArea />
      <Sidebar />
    </div>
    <MobileSheet />
    <MobileCellTray />   {/* ADD after MobileSheet */}
    <Onboarding />
  </div>
);
```

Also add import at top of file:
```tsx
import { MobileCellTray } from './MobileCellTray';
```

**Why not inside MobileSheet:** MobileSheet has `overflow-y: auto` on its content area and `rounded-t-2xl` border — a `fixed` child inside would not form a correct stacking context. Keep as a sibling. (Established pattern: MobileSheet itself is a sibling to Onboarding, not nested.)

---

### `src/test/phase24-mobile-cell-tray.test.tsx` (test)

**Primary analog:** `src/test/phase22-mobile-header.test.tsx`

---

#### Test file structure pattern — from `src/test/phase22-mobile-header.test.tsx` lines 1-82

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileCellTray } from '../Editor/MobileCellTray';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';

// matchMedia mock — forces mobile (max-width: 767px) = true
let originalMatchMedia: typeof window.matchMedia;

function mockMatchMedia() {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 767px)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
```

---

#### Store reset pattern — from `src/test/phase22-mobile-header.test.tsx` lines 37-77

```tsx
const singleLeaf = {
  type: 'leaf' as const,
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover' as const,
  objectPosition: 'center center',
  backgroundColor: null,
  audioEnabled: true,
};

beforeEach(() => {
  mockMatchMedia();
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    mediaTypeMap: {},
    history: [{ root: singleLeaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    selectedNodeId: null,
    // ... other required fields (copy full setState from phase22 test)
    sheetSnapState: 'collapsed',
  });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});
```

---

#### Test assertion patterns — from `src/test/phase22-mobile-header.test.tsx` lines 119-147

```tsx
// Button class assertion (CELL-03):
it('Upload button has min-w-[44px] min-h-[44px] classes', () => {
  useEditorStore.setState({ selectedNodeId: 'leaf-1' });
  render(<MobileCellTray />);
  const btn = screen.getByLabelText(/upload media/i);
  expect(btn.className).toContain('min-w-[44px]');
  expect(btn.className).toContain('min-h-[44px]');
});

// pointerEvents assertion (CELL-01):
it('tray has pointerEvents none when no cell selected', () => {
  render(<MobileCellTray />);
  const tray = screen.getByTestId('mobile-cell-tray');
  expect(tray.style.pointerEvents).toBe('none');
});

// Conditional render assertion (CELL-02):
it('Clear button hidden when hasMedia is false', () => {
  useEditorStore.setState({ selectedNodeId: 'leaf-1' });
  render(<MobileCellTray />);
  expect(screen.queryByLabelText(/clear media/i)).not.toBeInTheDocument();
});
```

---

## Shared Patterns

### `md:hidden` desktop suppression
**Source:** `src/Editor/MobileSheet.tsx` line 38
**Apply to:** `MobileCellTray` outer wrapper div
```tsx
className="... md:hidden ..."
```

### `motion-reduce:transition-none` reduced motion
**Source:** `src/Editor/MobileSheet.tsx` line 38
**Apply to:** `MobileCellTray` outer wrapper div (alongside `md:hidden`)
```tsx
className="fixed left-0 right-0 z-[45] md:hidden motion-reduce:transition-none"
```
Note: This Tailwind class suppresses the CSS `transition` for users with `prefers-reduced-motion: reduce`. If testing reveals the class does not override the inline `style.transition`, fall back to a `useMediaQuery('(prefers-reduced-motion: reduce)')` check and conditionally omit the transition string.

### `getState()` for stale-closure prevention in async handlers
**Source:** `src/Editor/EditorShell.tsx` lines 41-52 (keyboard handler pattern)
**Apply to:** `handleFileChange` in `MobileCellTray`
```tsx
const nodeId = useEditorStore.getState().selectedNodeId;
```
Read ephemeral selectedNodeId at call time inside async callbacks — not from React closure — so media uploads target the cell that was selected when the file picker was opened.

### Dark pill action surface style
**Source:** `src/Grid/ActionBar.tsx` lines 71-74
**Apply to:** Inner container div of `MobileCellTray`
```tsx
className="... bg-black/70 backdrop-blur-sm rounded-md ..."
```

---

## No Analog Found

None. All three files have direct codebase analogs.

---

## Critical Correction vs. RESEARCH.md

The RESEARCH.md Code Examples skeleton (lines 382-388) calls `addMedia(nodeId, file)` with a raw `File` object. **This is wrong.** The actual `addMedia` signature (from `src/store/gridStore.ts` line 110) is:

```ts
addMedia: (mediaId: string, dataUri: string, type?: 'image' | 'video') => void;
```

The Upload handler must:
1. Generate a new `mediaId` via `nanoid()`
2. Convert the file to `blobUrl` (video) or `dataUri` (image) via `fileToBase64`
3. Call `addMedia(newId, dataUri, type)`
4. Call `setMedia(nodeId, newId)` to link the media to the cell

See the **Upload button + file input pattern** section above for the corrected implementation copied from `src/Editor/Sidebar.tsx` lines 229-284.

---

## Metadata

**Analog search scope:** `src/Editor/`, `src/Grid/`, `src/test/`, `src/store/`
**Files scanned:** `ActionBar.tsx`, `MobileSheet.tsx`, `EditorShell.tsx`, `Sidebar.tsx` (SelectedCellPanel), `gridStore.ts` (addMedia signature), `phase22-mobile-header.test.tsx`
**Pattern extraction date:** 2026-04-16
