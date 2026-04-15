# Phase 23: Bottom Sheet Redesign - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 2 (1 full refactor + 1 targeted edit)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/Editor/MobileSheet.tsx` | component | request-response (user tap → state → transform) | `src/Editor/MobileSheet.tsx` (existing) + `src/Editor/Toolbar.tsx` (mobile branch) | exact (self-refactor) + role-match (button pattern) |
| `src/store/editorStore.ts` | store | CRUD (type narrowing + setter update) | `src/store/editorStore.ts` (existing) | exact (self-edit) |

---

## Pattern Assignments

### `src/Editor/MobileSheet.tsx` (component, request-response)

**Analog A:** `src/Editor/MobileSheet.tsx` (self — existing implementation to refactor)
**Analog B:** `src/Editor/Toolbar.tsx` (mobile branch, lines 43–86 — button pattern donor)

---

#### Imports pattern

Keep from existing file (lines 1–6), with two changes:
- Remove: `TemplatesPopover`, `Undo2`, `Redo2`, `Trash2`
- Add: `ChevronUp`, `ChevronDown` from `lucide-react`

Current import block (`src/Editor/MobileSheet.tsx` lines 1–6):
```tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { CanvasSettingsPanel, SelectedCellPanel } from './Sidebar';
import { TemplatesPopover } from '../components/TemplatesPopover';
import { Undo2, Redo2, Trash2 } from 'lucide-react';
```

Target import block:
```tsx
import React, { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { CanvasSettingsPanel, SelectedCellPanel } from './Sidebar';
import { ChevronUp, ChevronDown } from 'lucide-react';
```

Notes:
- `useRef`, `useCallback`, `useState` are all drag-related — remove with drag cleanup
- `useGridStore` is only needed for undo/redo/clear, which move to Toolbar — remove
- `TemplatesPopover`, `Undo2`, `Redo2`, `Trash2` — remove (now in Toolbar mobile branch)

---

#### Snap state constants

Current (`src/Editor/MobileSheet.tsx` lines 12–20):
```tsx
type SheetSnapState = 'collapsed' | 'half' | 'full';

const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  half: 'translateY(60vh)',
  collapsed: 'translateY(calc(100% - 60px))',
};

const DRAG_THRESHOLD = 50;
```

Target (remove `'half'` from type, remove `half` key, remove `DRAG_THRESHOLD`):
```tsx
type SheetSnapState = 'collapsed' | 'full';

const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  collapsed: 'translateY(calc(100% - 60px))',
};
```

Note: The local `SheetSnapState` type here mirrors the store type. Both must change to `'collapsed' | 'full'`.

---

#### Store subscriptions — what stays and what goes

Current subscriptions (`src/Editor/MobileSheet.tsx` lines 27–37):
```tsx
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
const selectedNodeId = useEditorStore(s => s.selectedNodeId);
const panModeNodeId = useEditorStore(s => s.panModeNodeId);
const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);

const undo = useGridStore(s => s.undo);
const redo = useGridStore(s => s.redo);
const clearGrid = useGridStore(s => s.clearGrid);
const canUndo = useGridStore(s => s.historyIndex > 0);
const canRedo = useGridStore(s => s.historyIndex < s.history.length - 1);
```

Target: remove all `useGridStore` lines; keep only editorStore subscriptions.

---

#### Drag state removal

Remove in full (`src/Editor/MobileSheet.tsx` lines 39–71):
```tsx
const [isDragging, setIsDragging] = useState(false);
const dragStartRef = useRef<{ y: number; snap: SheetSnapState } | null>(null);

// ... handlePointerDown, handlePointerUp, DRAG_THRESHOLD usage
```

---

#### Auto-expand useEffect

Current (`src/Editor/MobileSheet.tsx` lines 43–45):
```tsx
useEffect(() => {
  if (selectedNodeId) setSheetSnapState('half');
}, [selectedNodeId, setSheetSnapState]);
```

Target (change `'half'` to `'full'`):
```tsx
useEffect(() => {
  if (selectedNodeId) setSheetSnapState('full');
}, [selectedNodeId, setSheetSnapState]);
```

---

#### Sheet wrapper element

Current (`src/Editor/MobileSheet.tsx` lines 73–83):
```tsx
<div
  className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] rounded-t-2xl border-t border-[var(--border)] md:hidden"
  style={{
    height: '100vh',
    transform: SNAP_TRANSLATE[sheetSnapState],
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
  }}
  data-testid="mobile-sheet"
  data-sheet-snap={sheetSnapState}
>
```

Target changes:
- `height: '100vh'` → `height: '100dvh'` (use `h-dvh` class or inline style — `h-dvh` available in Tailwind v3.4)
- `transition` becomes unconditional (remove `isDragging` conditional)
- Add `motion-reduce:transition-none` class for reduced motion

```tsx
<div
  className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] rounded-t-2xl border-t border-[var(--border)] md:hidden motion-reduce:transition-none"
  style={{
    height: '100dvh',
    transform: SNAP_TRANSLATE[sheetSnapState],
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
  }}
  data-testid="mobile-sheet"
  data-sheet-snap={sheetSnapState}
>
```

---

#### Tab strip (60px handle div) — full replacement

Current handle div (`src/Editor/MobileSheet.tsx` lines 85–125) contains drag handlers, visual pill, and Undo/Redo/Clear/Templates buttons — all removed.

Target: replace with toggle button + label only. Button pattern copied from `src/Editor/Toolbar.tsx` mobile branch (lines 46–84):

```tsx
{/* Tab strip — 60px, toggle button + label */}
<div
  className="flex items-center px-4 gap-2"
  style={{ height: 60 }}
  data-testid="sheet-drag-handle"
>
  <button
    className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
    onClick={() => setSheetSnapState(sheetSnapState === 'collapsed' ? 'full' : 'collapsed')}
    aria-label={sheetSnapState === 'collapsed' ? 'Open panel' : 'Close panel'}
  >
    {sheetSnapState === 'collapsed'
      ? <ChevronUp size={20} />
      : <ChevronDown size={20} />
    }
  </button>
  <span className="text-sm font-medium text-[var(--foreground)]">
    {selectedNodeId ? 'Cell Settings' : 'Canvas Settings'}
  </span>
</div>
```

Notes:
- `data-testid="sheet-drag-handle"` is retained for Playwright backward compatibility (per UI-SPEC accessibility contract)
- Button class reuses the exact pattern from existing sheet buttons (lines 99–105 in current MobileSheet): `min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)]`
- Focus ring appended as required by UI-SPEC: `focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none`
- No `touch-none cursor-grab select-none` — drag is removed
- No `onPointerDown` / `onPointerUp` handlers

---

#### Scrollable content area — no change

Current (`src/Editor/MobileSheet.tsx` lines 127–152) is retained verbatim:
```tsx
{/* Sheet content — scrollable */}
<div
  className="overflow-y-auto"
  style={{
    height: 'calc(100% - 60px)',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  }}
>
  {panModeNodeId ? (
    <div className="p-4">
      <button
        className="w-full py-3 rounded-lg text-sm font-medium bg-[var(--sidebar-primary)] text-white"
        onClick={() => setPanModeNodeId(null)}
        data-testid="exit-pan-mode"
      >
        Exit Pan Mode
      </button>
    </div>
  ) : selectedNodeId ? (
    <SelectedCellPanel nodeId={selectedNodeId} key={selectedNodeId} />
  ) : (
    <CanvasSettingsPanel />
  )}
</div>
```

---

### `src/store/editorStore.ts` (store, CRUD)

**Analog:** `src/store/editorStore.ts` (self-edit — two targeted line changes)

---

#### Type declaration change

Current (`src/store/editorStore.ts` line 31):
```ts
sheetSnapState: 'collapsed' | 'half' | 'full';
```

Target:
```ts
sheetSnapState: 'collapsed' | 'full';
```

---

#### Setter type change

Current (`src/store/editorStore.ts` line 58):
```ts
setSheetSnapState: (v: 'collapsed' | 'half' | 'full') => void;
```

Target:
```ts
setSheetSnapState: (v: 'collapsed' | 'full') => void;
```

---

#### Initial value — no change needed

Current (`src/store/editorStore.ts` line 91):
```ts
sheetSnapState: 'collapsed' as const,
```

`'collapsed'` is valid in both old and new type — no change.

---

#### Setter implementation — no change needed

Current (`src/store/editorStore.ts` line 122):
```ts
setSheetSnapState: (v) => set({ sheetSnapState: v }),
```

No change — the implementation is type-driven; narrowing the type parameter is sufficient.

---

## Shared Patterns

### Button tap target + icon pattern (mobile)
**Source:** `src/Editor/Toolbar.tsx` lines 46–55 (mobile branch) and `src/Editor/MobileSheet.tsx` lines 98–106 (existing sheet buttons)
**Apply to:** Toggle chevron button in the new tab strip

```tsx
<button
  className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)]"
  onClick={handler}
  disabled={condition}
  aria-label="Label"
  data-testid="testid"
>
  <Icon size={20} />
</button>
```

Focus ring addition (UI-SPEC requirement — not in existing buttons, must be added):
```tsx
focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none
```

### Zustand selector pattern
**Source:** `src/Editor/MobileSheet.tsx` lines 27–31
**Apply to:** All new `useEditorStore` subscriptions in MobileSheet

```tsx
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
const selectedNodeId = useEditorStore(s => s.selectedNodeId);
```

One selector per line; inline arrow function; no destructuring.

### Conditional icon swap (state-driven)
**Source:** `src/Editor/Toolbar.tsx` lines 200–204 (Eye/EyeOff swap on `showSafeZone`)
**Apply to:** ChevronUp / ChevronDown swap on `sheetSnapState`

```tsx
{showSafeZone ? (
  <EyeOff size={16} className="text-white" />
) : (
  <Eye size={16} className="text-white" />
)}
```

Adapted for toggle chevron:
```tsx
{sheetSnapState === 'collapsed'
  ? <ChevronUp size={20} />
  : <ChevronDown size={20} />
}
```

### `React.memo` wrapper
**Source:** `src/Editor/MobileSheet.tsx` line 26
**Apply to:** Retain on refactored MobileSheet — no change needed

```tsx
export const MobileSheet = React.memo(function MobileSheet() {
```

---

## Test Impact

The existing test file `src/Editor/__tests__/phase05.1-p01-foundation.test.tsx` contains tests that will break after the refactor. The planner must account for updating these tests:

| Test (line) | Breaks because | Required fix |
|-------------|---------------|--------------|
| Line 95–100: `touch-none` class check | `touch-none` removed from handle div | Assert class is absent, or remove test |
| Lines 114–119: `sheet-undo`, `sheet-redo`, `sheet-clear` testids | These buttons are removed from MobileSheet | Remove tests (buttons now in Toolbar) |
| Lines 121–133: drag up → `60vh` transform | Drag removed; `half` state removed | Remove drag tests |
| Lines 135–153: drag down → collapsed | Same | Remove drag tests |
| Line 137: `sheetSnapState: 'half'` in setState | `'half'` no longer valid type | Remove or replace with `'full'` |

Tests that remain valid (no change needed):
- `renders with data-testid="mobile-sheet"` (line 84)
- `starts in collapsed state` (line 89)
- `has md:hidden class` (line 102)
- `has cubic-bezier transition string` (line 107)
- `shows CanvasSettingsPanel when no cell selected` (line 155)
- `shows SelectedCellPanel when a cell is selected` (line 161)
- `shows Exit Pan Mode button` (line 168)
- `Exit Pan Mode button calls setPanModeNodeId(null)` (line 175)
- `D-02 removal test` (line 200)

New tests to add (per CONTEXT.md and UI-SPEC):
- Toggle button renders `ChevronUp` when collapsed, `ChevronDown` when full
- Toggle button aria-label is `"Open panel"` when collapsed, `"Close panel"` when full
- Tapping toggle when collapsed sets state to `'full'`
- Tapping toggle when full sets state to `'collapsed'`
- Tab label shows `"Canvas Settings"` when no cell selected
- Tab label shows `"Cell Settings"` when a cell is selected
- Auto-expand: selecting a node triggers `setSheetSnapState('full')`
- `data-sheet-snap` attribute reflects current state

---

## No Analog Found

None. Both files are self-edits with close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `src/Editor/`, `src/store/`, `src/components/`
**Files scanned:** `MobileSheet.tsx`, `editorStore.ts`, `Toolbar.tsx`, `EditorShell.tsx`, `phase05.1-p01-foundation.test.tsx`, `phase05.1-p02-mobile-controls.test.tsx`
**Pattern extraction date:** 2026-04-15
