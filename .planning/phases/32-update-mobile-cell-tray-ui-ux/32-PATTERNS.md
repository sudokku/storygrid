# Phase 32: Update Mobile Cell Tray UI/UX — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 5 (4 modified + 1 test extended)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Editor/MobileCellTray.tsx` | component | request-response (user gesture → Zustand action) | `src/Grid/ActionBar.tsx` | exact (same role, same stores, same icon set) |
| `src/Editor/MobileSheet.tsx` | component | event-driven (Zustand state → CSS transform) | `src/Editor/MobileCellTray.tsx` | role-match (same fixed-position, same snap animation pattern) |
| `src/Editor/Toolbar.tsx` | component | request-response | `src/Editor/MobileSheet.tsx` (tab strip height) | partial (mobile branch compaction only) |
| `src/store/editorStore.ts` | store | — | itself (read-only reference; no new fields needed) | exact |
| `src/Editor/MobileCellTray.test.ts` | test | — | itself (extend existing file) | exact |

---

## Pattern Assignments

### `src/Editor/MobileCellTray.tsx` (component, request-response)

**Analog:** `src/Grid/ActionBar.tsx`

**Imports pattern** — current file lines 7–20; new icons to add:
```tsx
// Current imports (MobileCellTray.tsx lines 7–20)
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useDragStore } from '../dnd';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import {
  Upload,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Maximize2,
  Minimize2,
  ImageOff,
} from 'lucide-react';

// ADD to lucide-react import (mirror ActionBar.tsx lines 18–21):
  Volume2,
  VolumeX,
  SlidersHorizontal,   // Effects button — no existing usage; SlidersHorizontal is the standard choice
```

**Visibility condition pattern** — current file lines 107–109; extend for D-07:
```tsx
// Current (MobileCellTray.tsx lines 107–109)
opacity: isDragging ? 0 : (isVisible ? 1 : 0),
pointerEvents: (isDragging || !isVisible) ? 'none' : 'auto',

// Phase 32 extension — add sheetSnapState guard (D-07):
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
const hiddenBySheet = sheetSnapState === 'full';

opacity: (isDragging || hiddenBySheet) ? 0 : (isVisible ? 1 : 0),
transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
pointerEvents: (isDragging || hiddenBySheet || !isVisible) ? 'none' : 'auto',
```

**BTN_CLASS update** — current file lines 22–23; update for D-04 (stacked icon + label):
```tsx
// Current BTN_CLASS (MobileCellTray.tsx lines 22–23)
const BTN_CLASS =
  'min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

// Updated for D-04 — add flex-col gap-1 (4px — UI-SPEC xs spacing, gap-0.5/2px too tight):
const BTN_CLASS =
  'min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-1 rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';
```

**Label element pattern** — add below every icon (D-04):
```tsx
// Pattern: icon + label span stacked vertically inside each button
<Upload size={20} className="text-white" />
<span className="text-[10px] text-white leading-none">Upload</span>
```

**Horizontal scroll container** — current file line 115; update for D-06:
```tsx
// Current inner div (MobileCellTray.tsx line 115)
<div className="mx-4 flex items-center justify-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md">

// Phase 32 — drop justify-center, add overflow-x-auto, flex-nowrap, scrollbar hiding:
<div className="mx-4 flex items-center justify-start gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md overflow-x-auto [&::-webkit-scrollbar]:hidden flex-nowrap">
  {/* All buttons need flex-shrink-0 */}
```

**Audio state selectors** — copy from ActionBar.tsx lines 36–49; adapt for tray context:
```tsx
// Source: ActionBar.tsx lines 36–49 (exact pattern to mirror)
const mediaType = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  if (!leaf || leaf.type !== 'leaf' || !leaf.mediaId) return null;
  return s.mediaTypeMap[leaf.mediaId] ?? null;
});
const audioEnabled = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf && leaf.type === 'leaf' ? leaf.audioEnabled : true;
});
const hasAudioTrack = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf && leaf.type === 'leaf' ? (leaf.hasAudioTrack ?? false) : false;
});
const toggleAudioEnabled = useGridStore(s => s.toggleAudioEnabled);

// In tray, nodeId is the Zustand-selected selectedNodeId, not a prop:
// Use selectedNodeId from useEditorStore instead of prop nodeId.
// Derive isVideo: mediaId !== null && mediaType === 'video'
```

**Audio button JSX pattern** — copy from ActionBar.tsx lines 109–153; adapted to tray size:
```tsx
// Source: ActionBar.tsx lines 109–153
{mediaType === 'video' && (
  hasAudioTrack ? (
    <button
      type="button"
      className={BTN_CLASS}
      onClick={() => { if (selectedNodeId) toggleAudioEnabled(selectedNodeId); }}
      aria-label={audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
    >
      {audioEnabled
        ? <Volume2 size={20} className="text-white" />
        : <VolumeX size={20} className="text-red-500" />
      }
      <span className="text-[10px] text-white leading-none">Audio</span>
    </button>
  ) : (
    <button
      type="button"
      className={`${BTN_CLASS} cursor-not-allowed`}
      disabled
      aria-label="No audio track"
    >
      <VolumeX size={20} className="text-gray-400 opacity-40" />
      <span className="text-[10px] text-white leading-none opacity-40">Audio</span>
    </button>
  )
)}
```

**Effects button JSX pattern** — new button, always shown when cell selected (D-01, D-08):
```tsx
// New — no existing analog for Effects in tray; pattern follows Clear button + setSheetSnapState call
<button
  type="button"
  className={BTN_CLASS}
  onClick={() => setSheetSnapState('full')}
  aria-label="Open effects"
>
  <SlidersHorizontal size={20} className="text-white" />
  <span className="text-[10px] text-white leading-none">Effects</span>
</button>
```

**Conditional Clear button pattern** — current file lines 152–161; add label for D-04:
```tsx
// Current (MobileCellTray.tsx lines 152–161)
{hasMedia && (
  <button
    type="button"
    className={`${BTN_CLASS} hover:bg-red-500/20`}
    onClick={handleClearMedia}
    aria-label="Clear media"
  >
    <ImageOff size={20} className="text-white" />
  </button>
)}

// Phase 32 — add label below icon:
{hasMedia && (
  <button
    type="button"
    className={`${BTN_CLASS} hover:bg-red-500/20`}
    onClick={handleClearMedia}
    aria-label="Clear media"
  >
    <ImageOff size={20} className="text-white" />
    <span className="text-[10px] text-white leading-none">Clear</span>
  </button>
)}
```

**Tray bottom position** — current file line 106; update to match new tab strip height (D-12, Pitfall 5):
```tsx
// Current (MobileCellTray.tsx line 106)
bottom: '60px',

// Phase 32 — update to match new tab strip height (48px target):
bottom: '48px',
```

---

### `src/Editor/MobileSheet.tsx` (component, event-driven)

**Analog:** `src/Editor/MobileCellTray.tsx` (same file family — fixed position, Zustand snap state)

**useEffect to delete** — current file lines 31–36 (D-09):
```tsx
// DELETE THIS BLOCK ONLY (MobileSheet.tsx lines 31–36):
const prevSelectedRef = useRef(selectedNodeId);
useEffect(() => {
  const prev = prevSelectedRef.current;
  prevSelectedRef.current = selectedNodeId;
  if (!prev && selectedNodeId) setSheetSnapState('full');
}, [selectedNodeId, setSheetSnapState]);

// NOTE: The prevSelectedRef declaration on line 31 must also be deleted.
// The useRef import may still be needed by prevOverlayRef (line 39) — keep.
```

**useEffect to keep** — current file lines 39–44 (D-10):
```tsx
// KEEP UNCHANGED (MobileSheet.tsx lines 39–44):
const prevOverlayRef = useRef(selectedOverlayId);
useEffect(() => {
  const prev = prevOverlayRef.current;
  prevOverlayRef.current = selectedOverlayId;
  if (!prev && selectedOverlayId) setSheetSnapState('full');
}, [selectedOverlayId, setSheetSnapState]);
```

**SNAP_TRANSLATE constant** — current file lines 13–16; update for D-12 and D-13:
```tsx
// Current (MobileSheet.tsx lines 13–16)
const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  collapsed: 'translateY(calc(100% - 60px))',
};

// Phase 32 — tab strip 60px → 48px (D-12); header 48px → ~44px (D-11/D-13):
const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 44px), 56px))',  // 56px → 44px (header h-11)
  collapsed: 'translateY(calc(100% - 48px))',                             // 60px → 48px (tab strip)
};
```

**Tab strip height** — current file line 60; update for D-12:
```tsx
// Current (MobileSheet.tsx line 60)
style={{ height: 60 }}

// Phase 32:
style={{ height: 48 }}
```

**Content area height calc** — current file line 86; update all three occurrences of 60px (Pitfall 3):
```tsx
// Current (MobileSheet.tsx line 86)
height: 'calc(100dvh - 60px - max(calc(env(safe-area-inset-top) + 56px), 72px))',

// Phase 32 — match new tab strip (48px) and header (44px) values:
height: 'calc(100dvh - 48px - max(calc(env(safe-area-inset-top) + 44px), 56px))',
```

---

### `src/Editor/Toolbar.tsx` (component, request-response)

**Analog:** itself (mobile branch `<header>` element)

**Mobile header height** — current file line 45; update for D-11:
```tsx
// Current (Toolbar.tsx line 45) — mobile branch header
<header className="flex items-center justify-around h-12 px-2 gap-2 bg-[var(--card)] border-b border-[var(--border)] shrink-0">

// Phase 32 — h-12 (48px) → h-11 (44px); buttons are w-11 h-11 (44px) and must not be clipped:
// h-11 outer matches the 44px buttons exactly — no overflow, no padding waste.
<header className="flex items-center justify-around h-11 px-2 gap-2 bg-[var(--card)] border-b border-[var(--border)] shrink-0">
```

Note: The desktop branch header (Toolbar.tsx line 90) uses `h-12` and must NOT be changed — only the `if (isMobile)` branch (lines 44–86) is in scope.

---

### `src/store/editorStore.ts` (store, reference)

**Read-only reference** — no changes needed for Phase 32. Confirmed shape:

```tsx
// editorStore.ts lines 31, 58 — confirmed existing selectors used by tray:
sheetSnapState: 'collapsed' | 'full';          // line 31
setSheetSnapState: (v: 'collapsed' | 'full') => void;  // line 58

// Usage pattern (copy verbatim into MobileCellTray.tsx):
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
```

---

### `src/Editor/MobileCellTray.test.ts` (test, extend existing)

**Analog:** itself (extend existing file)

**Existing mock structure** — current file lines 18–40; extend for new icons:
```tsx
// Current mock (MobileCellTray.test.ts lines 18–25)
vi.mock('lucide-react', () => ({
  Upload: () => React.createElement('span', { 'data-testid': 'icon-upload' }),
  SplitSquareHorizontal: () => React.createElement('span'),
  SplitSquareVertical: () => React.createElement('span'),
  Maximize2: () => React.createElement('span'),
  Minimize2: () => React.createElement('span'),
  ImageOff: () => React.createElement('span'),
}));

// Phase 32 — add new icons used by Effects and Audio buttons:
vi.mock('lucide-react', () => ({
  Upload: () => React.createElement('span', { 'data-testid': 'icon-upload' }),
  SplitSquareHorizontal: () => React.createElement('span'),
  SplitSquareVertical: () => React.createElement('span'),
  Maximize2: () => React.createElement('span'),
  Minimize2: () => React.createElement('span'),
  ImageOff: () => React.createElement('span'),
  SlidersHorizontal: () => React.createElement('span', { 'data-testid': 'icon-effects' }),
  Volume2: () => React.createElement('span', { 'data-testid': 'icon-volume2' }),
  VolumeX: () => React.createElement('span', { 'data-testid': 'icon-volumex' }),
}));
```

**beforeEach baseline** — current file line 57; already sets `sheetSnapState: 'collapsed'` (GREEN baseline):
```tsx
// Already correct in MobileCellTray.test.ts line 57:
useEditorStore.setState({ selectedNodeId: 'cell-1', sheetSnapState: 'collapsed' });
```

**New test cases to add** — D-07 (sheetSnapState gate):
```tsx
// Pattern: mirrors existing drag tests (lines 69–93); swap useDragStore for useEditorStore.setState
it('opacity is "0" when sheetSnapState is "full" (D-07)', () => {
  useEditorStore.setState({ sheetSnapState: 'full' });
  const { getByTestId } = render(React.createElement(MobileCellTray));
  const el = getByTestId('mobile-cell-tray');
  expect(el.style.opacity).toBe('0');
});

it('pointerEvents is "none" when sheetSnapState is "full" (D-07)', () => {
  useEditorStore.setState({ sheetSnapState: 'full' });
  const { getByTestId } = render(React.createElement(MobileCellTray));
  const el = getByTestId('mobile-cell-tray');
  expect(el.style.pointerEvents).toBe('none');
});

it('opacity restores to "1" when sheetSnapState returns to "collapsed" (D-07)', () => {
  useEditorStore.setState({ sheetSnapState: 'full' });
  const { getByTestId, rerender } = render(React.createElement(MobileCellTray));
  act(() => { useEditorStore.setState({ sheetSnapState: 'collapsed' }); });
  rerender(React.createElement(MobileCellTray));
  const el = getByTestId('mobile-cell-tray');
  expect(el.style.opacity).toBe('1');
});
```

---

## Shared Patterns

### Zustand Store Access
**Source:** `src/Editor/MobileCellTray.tsx` lines 26–35 (existing tray pattern)
**Apply to:** All modifications in `MobileCellTray.tsx`
```tsx
// Selector per-field pattern (do not destructure the whole store):
const selectedNodeId = useEditorStore(s => s.selectedNodeId);
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
const isDragging = useDragStore(s => s.status === 'dragging');
```

### Conditional Button Rendering
**Source:** `src/Editor/MobileCellTray.tsx` lines 152–161 (existing Clear button pattern)
**Apply to:** Audio button (D-02) and Clear button label addition (D-04)
```tsx
// Guard pattern — conditional render, not disabled prop:
{hasMedia && (
  <button type="button" className={BTN_CLASS} onClick={handler} aria-label="...">
    <Icon size={20} className="text-white" />
    <span className="text-[10px] text-white leading-none">Label</span>
  </button>
)}
```

### Icon Swap for Stateful Buttons
**Source:** `src/Editor/MobileCellTray.tsx` lines 146–151 (Fit button) and `src/Grid/ActionBar.tsx` lines 126–131 (Audio button)
**Apply to:** Audio button in tray (D-05 — no color changes, icon swap only)
```tsx
// Icon swap pattern — ternary on state, same button element:
{audioEnabled
  ? <Volume2 size={20} className="text-white" />
  : <VolumeX size={20} className="text-red-500" />
}
```

### Cross-Component Zustand Action Call
**Source:** `src/dnd/dragStore.ts` lines 85–87 (dragStore calls useEditorStore.getState() from outside React)
**Apply to:** Effects button in tray calling `setSheetSnapState('full')` (D-08)
```tsx
// Inside React component: use selector hook (not getState()):
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
// Then in onClick: () => setSheetSnapState('full')
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Critical Pitfalls (for planner)

These appear in RESEARCH.md and must be surfaced in plan action items:

1. **Pitfall 3 (tab strip height in 3 places):** `MobileSheet.tsx` has `60px` in three locations: `style={{ height: 60 }}` (line 60), `SNAP_TRANSLATE.collapsed` (line 15), and the content area `height:` calc (line 86). All three must be updated consistently to the new value.

2. **Pitfall 5 (tray `bottom` position):** `MobileCellTray.tsx` line 106 has `bottom: '60px'` hardcoded to match the tab strip. Must be updated to match new strip height.

3. **Pitfall 2 (wrong useEffect deleted):** Both `useEffect` blocks in `MobileSheet.tsx` (lines 31–36 and 39–44) look nearly identical. Only the cell block (lines 31–36, using `selectedNodeId`/`prevSelectedRef`) is deleted. The overlay block (lines 39–44, using `selectedOverlayId`/`prevOverlayRef`) is kept.

4. **Pitfall 1 (justify-center breaks scroll):** `justify-center` on line 115 of `MobileCellTray.tsx` must be replaced with `justify-start` (or removed) for `overflow-x-auto` to work.

4. **Pitfall 4 (header `h-10` clips 44px buttons):** Use `h-11` (44px) for the outer mobile header, not `h-10` (40px). `h-10` would clip the existing `w-11 h-11` buttons.

---

## Metadata

**Analog search scope:** `src/Editor/`, `src/Grid/`, `src/store/`, `src/dnd/`
**Files read:** 7 (MobileCellTray.tsx, MobileSheet.tsx, Toolbar.tsx, ActionBar.tsx, editorStore.ts, dragStore.ts, MobileCellTray.test.ts)
**Pattern extraction date:** 2026-04-20
