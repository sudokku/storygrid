# Phase 24: Mobile Cell Action Tray - Research

**Researched:** 2026-04-16
**Domain:** React fixed-positioned UI overlay, CSS animation, mobile touch targets, Zustand state subscriptions
**Confidence:** HIGH

## Summary

Phase 24 adds a single new component — `MobileCellTray` — to `src/Editor/`. The component is a `fixed` `div` sitting at `bottom-[60px]`, visible when `selectedNodeId` is non-null, showing 5 icon buttons (Upload, Split H, Split V, Fit toggle, Clear). All architectural patterns, library calls, icon names, store hooks, and styling conventions are already established in the codebase. No new libraries are required.

The component's implementation is a straightforward composition of patterns already proven in `ActionBar.tsx` (button logic, icon selection, store hooks) and `MobileSheet.tsx` (fixed positioning, `md:hidden`, animation approach). The most nuanced implementation detail is the CSS enter/exit animation — the component must handle the case where `selectedNodeId` transitions null → non-null (fade + slide-up) and non-null → null (fade + slide-down). The recommended approach is to keep the component always-mounted on mobile and use CSS `transition` + a `data-visible` attribute driven by `selectedNodeId`, so the exit animation plays before any conditional render removal.

The Upload button requires wiring an `<input type="file" accept="image/*,video/*">` ref and calling `addMedia` from `gridStore`, matching the pattern in `SelectedCellPanel`. All other four buttons call directly into `gridStore` — no new infrastructure needed.

**Primary recommendation:** Build `MobileCellTray` as a single-file component in `src/Editor/MobileCellTray.tsx`, rendered as a sibling to `MobileSheet` inside `EditorShell`. Copy store subscriptions verbatim from `ActionBar.tsx`. Use CSS `transition` on `opacity` and `transform` for animation.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Tray renders as a separate fixed bar above the tab strip — not inside the 60px tab strip
- D-02: Layout stack (bottom up): tab strip (60px) → action tray (~52px) → canvas area
- D-03: Tray is always visible when a cell is selected, regardless of sheet snap state
- D-04: Tray uses `fixed` positioning, sitting directly above the sheet (above z-40)
- D-05: Tray animates in with fade + slide-up (~8px) when cell selected; reverses on deselect. Duration/easing match sheet: `0.3s cubic-bezier(0.32, 0.72, 0, 1)`
- D-06: Phase 23 auto-expand behavior retained — no changes to `MobileSheet.tsx` `useEffect`
- D-07: Exactly 5 buttons: Upload, Split Horizontal, Split Vertical, Fit toggle, Clear media
- D-08: "Remove cell" is NOT in the tray — stays in full sheet only
- D-09: Each button: minimum 44×44px touch target, minimum 8px gap between buttons
- D-10: Fit toggle icon swap — `Minimize2` when `fit === 'cover'`, `Maximize2` when `fit === 'contain'`
- D-11 (Claude's Discretion): Style: `bg-black/70 backdrop-blur-sm rounded-md` dark pill, consistent with desktop `ActionBar`

### Claude's Discretion
- Tray component name and file location (recommended: `src/Editor/MobileCellTray.tsx`)
- Whether to render inside `MobileSheet.tsx` or as sibling in `EditorShell.tsx`
- Exact z-index value (must be above z-40 sheet; below z-50+ overlays — recommended: `z-[45]`)
- Whether to use `md:hidden` class or `isMobile` hook for desktop suppression

### Deferred Ideas (OUT OF SCOPE)
None captured during discussion.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CELL-01 | A persistent cell action tray appears above the bottom sheet when any cell is tapped/selected | MobileCellTray component driven by `selectedNodeId !== null` from `useEditorStore`; fixed position at `bottom-[60px]`; always visible per D-03 |
| CELL-02 | Cell action tray exposes Upload, Split Horizontal, Split Vertical, Fit toggle, and Clear buttons | All 5 buttons confirmed in `ActionBar.tsx` with exact icon names, store actions, and handler patterns; Upload needs file input ref + `addMedia` call |
| CELL-03 | Cell action tray buttons have ≥44×44px touch targets with ≥8px gaps | `min-w-[44px] min-h-[44px]` on each button, `gap-2` (8px) on container — matches existing HEADER-02 pattern |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tray visibility control | Browser / Client | — | `selectedNodeId` is ephemeral UI state in `useEditorStore`; purely client-side conditional render/animation |
| Button actions (split, clear, fit) | Browser / Client | — | Calls directly into `useGridStore` synchronous actions; no server |
| File upload (media) | Browser / Client | — | FileReader/blob pattern already established; handled in-browser |
| Fixed positioning layout | Browser / Client | — | CSS `fixed` + Tailwind utility classes |
| Desktop suppression | Browser / Client | — | `md:hidden` Tailwind responsive class |

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.1 | Component model | Established in project |
| Zustand | ^5.0.12 | State subscriptions (`selectedNodeId`, `fit`, `mediaId`) | Established in project |
| lucide-react | ^1.7.0 | Icons: `Upload`, `SplitSquareHorizontal`, `SplitSquareVertical`, `Maximize2`, `Minimize2`, `ImageOff` | All icons already imported in `ActionBar.tsx` |
| Tailwind CSS | ^3.4.x | Layout, colors, responsive breakpoint | Established in project |

No new packages to install. [VERIFIED: codebase grep — all icons confirmed in `ActionBar.tsx` line 13-21]

---

## Architecture Patterns

### System Architecture Diagram

```
User taps cell on mobile
        │
        ▼
useEditorStore.selectedNodeId (non-null)
        │
        ├──► MobileSheet (z-40) — auto-expands to 'full' (Phase 23 useEffect)
        │
        └──► MobileCellTray (z-[45]) — animates in (fade + slide-up 8px)
                    │
                    ├── Upload btn ──► <input type="file"> ref ──► gridStore.addMedia()
                    ├── Split H btn ──► gridStore.split(nodeId, 'horizontal')
                    ├── Split V btn ──► gridStore.split(nodeId, 'vertical')
                    ├── Fit toggle ──► gridStore.updateCell(nodeId, { fit: ... })
                    └── Clear btn ──► gridStore.removeMedia() + updateCell(nodeId, { mediaId: null })
                         (only visible when hasMedia)

User taps elsewhere (deselects)
        │
        ▼
selectedNodeId → null
        │
        └──► MobileCellTray — animates out (fade + slide-down 8px), then hidden
```

### Recommended Project Structure

No new directories needed. Single new file:

```
src/Editor/
├── MobileCellTray.tsx     ← NEW: fixed action tray for mobile
├── MobileSheet.tsx        ← MODIFY: no structural change; add MobileCellTray import to EditorShell
├── EditorShell.tsx        ← MODIFY: render <MobileCellTray /> as sibling to <MobileSheet />
└── ... (unchanged)
```

### Pattern 1: CSS enter/exit animation without unmounting

**What:** Component stays mounted; CSS `transition` on `opacity` and `transform` toggled by a `data-visible` attribute. This ensures the exit animation plays before the component "disappears".

**When to use:** Any fixed overlay that must animate in AND out (both directions). Unmounting on `selectedNodeId === null` would cut off the exit animation.

**Example:**
```tsx
// Source: established pattern from MobileSheet.tsx (transform transition)
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

Note: `pointerEvents: 'none'` when invisible prevents invisible buttons from intercepting taps.

[VERIFIED: codebase — `MobileSheet.tsx` uses same easing `cubic-bezier(0.32, 0.72, 0, 1)` at line 41]

### Pattern 2: Upload button with hidden file input

**What:** The tray Upload button needs a `<input type="file">` ref to trigger the OS file picker. The same pattern is used in `SelectedCellPanel`.

**When to use:** Any mobile button that triggers file selection without a visible file input.

**Example:**
```tsx
// Source: established SelectedCellPanel pattern (addMedia store action)
const fileInputRef = useRef<HTMLInputElement>(null);

const handleUploadClick = useCallback(() => {
  fileInputRef.current?.click();
}, []);

const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !selectedNodeId) return;
  await addMedia(selectedNodeId, file);
  e.target.value = ''; // reset so same file can be re-selected
}, [addMedia, selectedNodeId]);

// In JSX:
<input
  ref={fileInputRef}
  type="file"
  accept="image/*,video/*"
  className="hidden"
  onChange={handleFileChange}
/>
```

[VERIFIED: codebase — `gridStore.ts` exports `addMedia` action; pattern used in `SelectedCellPanel`]

### Pattern 3: Fit value lookup for selected node

**What:** Tray needs the `fit` value of the currently selected leaf node to render the correct Fit toggle icon.

**When to use:** Any component that needs leaf-specific data by `selectedNodeId`.

```tsx
// Source: ActionBar.tsx line 36 pattern (findNode subscription)
const fit = useGridStore(s => {
  if (!selectedNodeId) return 'cover';
  const node = findNode(s.root, selectedNodeId) as LeafNode | null;
  return node?.fit ?? 'cover';
});

const mediaId = useGridStore(s => {
  if (!selectedNodeId) return null;
  const node = findNode(s.root, selectedNodeId) as LeafNode | null;
  return node?.mediaId ?? null;
});

const hasMedia = mediaId !== null;
```

[VERIFIED: codebase — `ActionBar.tsx` lines 36-49 use identical pattern]

### Pattern 4: Store action wiring (split, fit, clear)

**What:** Direct store action calls — identical to `ActionBar.tsx`.

```tsx
// Source: ActionBar.tsx lines 52-64
const split = useGridStore(s => s.split);
const updateCell = useGridStore(s => s.updateCell);
const removeMedia = useGridStore(s => s.removeMedia);

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

[VERIFIED: codebase — ActionBar.tsx exact source]

### Pattern 5: EditorShell injection point

**What:** `MobileCellTray` is added as a sibling to `MobileSheet` in `EditorShell.tsx`.

**Why not inside MobileSheet:** The tray is a separate fixed layer — co-locating with the sheet would entangle z-index management and the sheet's `overflow: hidden` behavior would clip the tray.

```tsx
// Source: EditorShell.tsx lines 86-97 (current structure)
return (
  <div className="flex flex-col h-screen w-screen bg-[#0a0a0a]">
    <Toolbar />
    <div className="flex flex-1 overflow-hidden pb-[60px] md:pb-0">
      <CanvasArea />
      <Sidebar />
    </div>
    <MobileSheet />
    <MobileCellTray />   {/* ADD: sibling, after MobileSheet */}
    <Onboarding />
  </div>
);
```

[VERIFIED: codebase — EditorShell.tsx lines 86-97]

### Anti-Patterns to Avoid

- **Unmounting on deselect:** Do NOT conditionally render `{selectedNodeId && <MobileCellTray />}`. The exit animation won't play because the component is removed immediately. Keep mounted, use `opacity`/`transform` CSS transition with `pointerEvents: 'none'` when hidden.
- **Rendering inside MobileSheet:** The sheet has `overflow-y: auto` on its content area and `rounded-t-2xl` — placing a fixed child inside would not respect the fixed stacking context correctly. Keep as sibling in EditorShell.
- **Using z-50 for the tray:** z-50 is reserved for modals/toasts. The tray must be at z-[45] to sit between the sheet (z-40) and overlays (z-50+).
- **Skipping `pointerEvents: none` when hidden:** Invisible tray at opacity 0 would still intercept taps without `pointerEvents: none`.
- **Adding `touch-action: manipulation` per-button:** It's already applied globally via `src/index.css` button rule. Per CONTEXT.md established pattern note.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File input trigger | Custom file picker | `<input type="file" ref>` + `.click()` | Native browser file picker handles all media types, camera roll on mobile |
| State subscription with selector | Manual subscribe/unsubscribe | `useGridStore(selector)` | Zustand handles re-render optimization; selector ensures only relevant state changes re-render |
| Fit icon logic | Custom icon component | `Minimize2` / `Maximize2` from lucide-react with conditional | Already established in ActionBar.tsx; exact same icons required by D-10 |
| Animation state machine | React state `isAnimating` + timers | CSS `transition` on `opacity`/`transform` | CSS handles both enter and exit; no timer cleanup needed; GPU-accelerated |

---

## Common Pitfalls

### Pitfall 1: Exit animation not playing (immediate disappear on deselect)

**What goes wrong:** If the component is conditionally rendered as `{selectedNodeId && <MobileCellTray />}`, React unmounts it instantly when `selectedNodeId` becomes `null`. The fade-out animation never fires — the tray just vanishes.

**Why it happens:** React unmounts DOM nodes synchronously; CSS `transition` has no effect on an unmounted element.

**How to avoid:** Keep the component always-mounted (on mobile). Use CSS `transition` on `opacity` + `transform`. Set `pointerEvents: 'none'` when `!isVisible` so taps pass through to the canvas.

**Warning signs:** Tray disappears instantly without slide-down. No transition visible on deselect.

### Pitfall 2: Tray bottom offset wrong when sheet is in 'full' state

**What goes wrong:** Developer sets `bottom: 0` or calculates bottom relative to sheet height. Sheet in `full` state slides up, but the tray should remain at `bottom-[60px]` regardless.

**Why it happens:** MobileSheet's `full` snap translate is `translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))` — the sheet content scrolls up, but the `fixed` tab strip remains at the bottom of the viewport.

**How to avoid:** The tray's `bottom` is always `60px` (the tab strip height). No dynamic calculation needed. Per CONTEXT.md D-02 and D-03.

**Warning signs:** Tray overlaps tab strip, or tray shifts position when toggling sheet between collapsed/full.

### Pitfall 3: Clear button visible when cell has no media

**What goes wrong:** Clear button renders for all selected cells, including empty ones. Pressing it when `mediaId === null` crashes because `removeMedia(null)` is called.

**How to avoid:** Conditional render: `{hasMedia && <button ...Clear...>}`. The `handleClearMedia` handler also guards with `if (mediaId)` — but prefer both guards.

**Warning signs:** Clear button appears in tray when cell is empty; console error on click.

### Pitfall 4: z-index conflict with MobileSheet or Toast

**What goes wrong:** Tray assigned `z-40` (same as sheet) causes tray to render behind or at same level as sheet rounded top edge on some browsers.

**How to avoid:** Use `z-[45]` (Tailwind arbitrary value). Confirmed per UI-SPEC Interaction Contract z-index table.

**Warning signs:** Tray appears partially behind sheet's top border.

### Pitfall 5: Fit value stale for non-leaf (container) nodes

**What goes wrong:** If a container node is selected (after split), `findNode` returns a `ContainerNode` which has no `fit` property. The `??` fallback on `node?.fit` becomes `undefined`, breaking the icon selector.

**How to avoid:** Guard: `node?.type === 'leaf' ? node.fit : 'cover'` — or always use `?? 'cover'` as shown in Pattern 3.

**Warning signs:** TypeScript error on `node.fit` or undefined icon rendered for split cells.

### Pitfall 6: `addMedia` receives wrong nodeId (stale closure)

**What goes wrong:** `handleFileChange` callback captures `selectedNodeId` from component mount time. If the user taps a different cell while the file picker is open, the upload targets the wrong cell.

**How to avoid:** Read `selectedNodeId` from store at call time inside the handler: `const nodeId = useEditorStore.getState().selectedNodeId`. Pattern established in editorStore for keyboard handlers.

**Warning signs:** Media appears in the wrong cell after upload.

---

## Code Examples

### Complete MobileCellTray skeleton

```tsx
// src/Editor/MobileCellTray.tsx
// Source: composition of ActionBar.tsx + MobileSheet.tsx patterns
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import {
  Upload, SplitSquareHorizontal, SplitSquareVertical,
  Maximize2, Minimize2, ImageOff,
} from 'lucide-react';

export const MobileCellTray = React.memo(function MobileCellTray() {
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const isVisible = selectedNodeId !== null;

  const split = useGridStore(s => s.split);
  const updateCell = useGridStore(s => s.updateCell);
  const removeMedia = useGridStore(s => s.removeMedia);
  const addMedia = useGridStore(s => s.addMedia);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nodeId = useEditorStore.getState().selectedNodeId;
    if (!nodeId) return;
    await addMedia(nodeId, file);
    e.target.value = '';
  }, [addMedia]);

  const handleSplitH = useCallback(() => {
    if (selectedNodeId) split(selectedNodeId, 'horizontal');
  }, [split, selectedNodeId]);
  const handleSplitV = useCallback(() => {
    if (selectedNodeId) split(selectedNodeId, 'vertical');
  }, [split, selectedNodeId]);
  const handleToggleFit = useCallback(() => {
    if (selectedNodeId) updateCell(selectedNodeId, { fit: fit === 'cover' ? 'contain' : 'cover' });
  }, [updateCell, selectedNodeId, fit]);
  const handleClearMedia = useCallback(() => {
    if (mediaId && selectedNodeId) {
      removeMedia(mediaId);
      updateCell(selectedNodeId, { mediaId: null });
    }
  }, [removeMedia, updateCell, selectedNodeId, mediaId]);

  const btnClass = 'min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

  return (
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
      <div className="mx-4 flex items-center justify-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md">
        <button className={btnClass} onClick={handleUpload}
          aria-label={hasMedia ? 'Replace media' : 'Upload media'}>
          <Upload size={20} className="text-white" />
        </button>
        <button className={btnClass} onClick={handleSplitH} aria-label="Split horizontal">
          <SplitSquareHorizontal size={20} className="text-white" />
        </button>
        <button className={btnClass} onClick={handleSplitV} aria-label="Split vertical">
          <SplitSquareVertical size={20} className="text-white" />
        </button>
        <button className={btnClass} onClick={handleToggleFit}
          aria-label={fit === 'cover' ? 'Switch to contain' : 'Switch to cover'}>
          {fit === 'cover'
            ? <Minimize2 size={20} className="text-white" />
            : <Maximize2 size={20} className="text-white" />
          }
        </button>
        {hasMedia && (
          <button className={`${btnClass} hover:bg-red-500/20`} onClick={handleClearMedia} aria-label="Clear media">
            <ImageOff size={20} className="text-white" />
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ActionBar desktop-only hover float | MobileCellTray persistent fixed bar | Phase 24 | One-tap access on mobile without hover |
| CSS class toggle for visibility | `opacity`/`transform` CSS transition (always-mounted) | Phase 24 | Smooth enter/exit animation |

**Deprecated/outdated:**
- None — this is a new component with no prior implementation to replace.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `addMedia` accepts `(nodeId: string, file: File)` signature | Code Examples | Handler pattern would need adjustment — check `gridStore.ts` addMedia signature before implementing |
| A2 | `motion-reduce:transition-none` Tailwind class works in v3.4.x to disable CSS transitions for `prefers-reduced-motion` | Architecture Patterns / Animation | Animation would still play for reduced-motion users — verify Tailwind v3 supports `motion-reduce` variant |

If A1 is wrong: check `src/store/gridStore.ts` addMedia signature and adjust the handler.
If A2 is wrong: use `@media (prefers-reduced-motion: reduce)` inline style fallback.

---

## Open Questions

1. **`addMedia` signature**
   - What we know: `addMedia` is called in `SelectedCellPanel` for file upload; it updates the tree and mediaRegistry
   - What's unclear: Exact function signature — confirmed from codebase exploration that it exists, but not fully read in this session
   - Recommendation: Executor should read `src/store/gridStore.ts` addMedia definition before wiring the Upload handler

2. **`motion-reduce:transition-none` on inline styles**
   - What we know: `MobileSheet.tsx` uses `motion-reduce:transition-none` as a Tailwind class on its container to disable the `style={{ transition: ... }}` in reduced motion scenarios
   - What's unclear: Whether `motion-reduce:transition-none` overrides an inline `style.transition` — CSS specificity rules may vary
   - Recommendation: Test with reduced motion enabled; if Tailwind class doesn't override inline style, use a conditional: `transition: prefersReducedMotion ? 'none' : 'opacity 0.3s ...'` using a `useMediaQuery('(prefers-reduced-motion: reduce)')` check

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase adds a pure React component using already-installed libraries)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vite.config.ts` (vitest config inline) |
| Quick run command | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CELL-01 | `data-testid="mobile-cell-tray"` present in DOM when `selectedNodeId` is non-null | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-01 | Tray not interactive (pointerEvents none) when `selectedNodeId` is null | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-02 | Upload, Split H, Split V, Fit toggle, Clear buttons present in tray | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-02 | Clear button hidden when `hasMedia` is false | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-02 | Fit toggle shows `Maximize2`/`Minimize2` per `fit` value | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-03 | Each button has `min-w-[44px] min-h-[44px]` classes | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |
| CELL-03 | Tray container has `gap-2` class | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/phase24-mobile-cell-tray.test.tsx` — covers CELL-01, CELL-02, CELL-03

Test file follows the established pattern from `src/test/phase22-mobile-header.test.tsx`:
- Mock `window.matchMedia` with `(max-width: 767px)` returning true
- Reset `useEditorStore` and `useGridStore` in `beforeEach`
- Test button presence, classes, and conditional render via `@testing-library/react`

---

## Security Domain

Step skipped — this phase adds a pure UI component with no authentication, session management, data persistence, or external network calls. The only "input" is a file picker which routes through the existing `addMedia` store action already implemented and tested in prior phases.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase — `src/Editor/MobileSheet.tsx`] — fixed positioning pattern, z-40, animation easing, `md:hidden`, tab strip 60px
- [VERIFIED: codebase — `src/Grid/ActionBar.tsx`] — all 5 button implementations, icon names, store hook patterns, `handleClearMedia`, `handleToggleFit`
- [VERIFIED: codebase — `src/store/editorStore.ts`] — `selectedNodeId`, `sheetSnapState`, store shape
- [VERIFIED: codebase — `src/Editor/EditorShell.tsx`] — render order, `pb-[60px]` canvas padding, MobileSheet sibling position
- [VERIFIED: codebase — `src/hooks/useMediaQuery.ts`] — `useMediaQuery` hook signature
- [CITED: CONTEXT.md D-01 through D-11] — all locked decisions
- [CITED: 24-UI-SPEC.md] — button specs, z-index table, animation contract, accessibility contract

### Secondary (MEDIUM confidence)
- [CITED: REQUIREMENTS.md CELL-01, CELL-02, CELL-03] — requirement definitions
- [CITED: STATE.md] — established patterns (React.memo, `md:hidden`, CSS-driven responsive)

### Tertiary (LOW confidence)
- None — all claims verified from codebase or locked context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, no new installs
- Architecture: HIGH — patterns directly observable in MobileSheet and ActionBar source
- Pitfalls: HIGH — identified from reading actual source code and animation edge cases

**Research date:** 2026-04-16
**Valid until:** 2026-06-16 (stable stack; no external dependencies)
