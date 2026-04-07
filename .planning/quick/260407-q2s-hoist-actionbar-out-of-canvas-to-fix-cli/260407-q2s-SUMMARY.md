---
phase: quick-260407-q2s
plan: 01
subsystem: editor-ui
tags: [actionbar, portal, stacking-context, hover, ui-polish]
requires:
  - src/store/editorStore.ts  # adds hoveredNodeId
provides:
  - src/lib/cellRegistry.ts
  - src/Editor/GlobalActionBar.tsx
affects:
  - src/Grid/LeafNode.tsx
  - src/Editor/EditorShell.tsx
  - src/Grid/ActionBar.tsx
tech_stack:
  added: []
  patterns:
    - react-portal-via-createPortal
    - module-level-element-registry
    - hover-only-store-field (no selection fallback)
key_files:
  created:
    - src/lib/cellRegistry.ts
    - src/Editor/GlobalActionBar.tsx
  modified:
    - src/store/editorStore.ts
    - src/Grid/LeafNode.tsx
    - src/Editor/EditorShell.tsx
    - src/Grid/ActionBar.tsx
    - src/test/phase05-p02-pan-zoom.test.tsx
    - src/Grid/__tests__/ActionBar.test.tsx
decisions:
  - "D-01: Hover-only semantics — ActionBar driven by hoveredNodeId ONLY, no selectedNodeId fallback. Selection retains its ring but never forces ActionBar visibility."
  - "D-02: Fixed w-8 h-8 ActionBar button sizing — portal lives in viewport pixels, no canvas scale compensation needed. BTN_SIZE clamp() constant removed."
  - "D-03: Portal mounted at document.body via createPortal — escapes every stacking context, transform containing block, and overflow:hidden ancestor in the grid tree."
  - "D-04: Module-level Map<string, HTMLElement> cell registry (registerCell/unregisterCell/getCellElement) — browser-only app, no SSR concerns."
  - "D-05: No @floating-ui/react dependency — single anchored toolbar with clamp-top logic is simpler than flip/shift collision detection."
  - "80ms debounce on pointer-leave from cell — allows the cursor to cross from the cell into the portal ActionBar (which is no longer a DOM descendant) without flicker. Portal div re-asserts hoveredNodeId on its own onPointerEnter as a second guard."
  - "GlobalActionBar mounted in EditorShell between MobileSheet and Onboarding — Onboarding overlay stays on top per z-index pitfall in RESEARCH."
  - "handleUploadClick on the portal uses el.querySelector('input[type=file]') on the cell element to dispatch upload — zero new wiring; the hidden file input is unchanged and still lives inside LeafNode."
metrics:
  duration_minutes: ~12
  completed: 2026-04-07
  tasks: 2 (auto) + 1 (checkpoint)
  commits:
    - 05ae9c1 "feat(quick-260407-q2s): add hoveredNodeId store field, cellRegistry, and GlobalActionBar portal component"
    - 1967219 "feat(quick-260407-q2s): wire portal ActionBar, remove inline mount, revert fixed sizing"
    - 303850c "test(quick-260407-q2s): update tests for portal ActionBar architecture"
---

# Quick 260407-q2s: Hoist ActionBar Out of Canvas Summary

Portal-based GlobalActionBar replaces the inline LeafNode ActionBar, fixing the clipping-by-neighbouring-cells bug that Phase 07-01's overflow/ isolate cleanup could not reach.

## What Changed and Why

**Root cause (from RESEARCH).** The cell root has `isolate` (new stacking context). Each sibling cell creates its own stacking context and paints after the previous cell in document order. An ActionBar inside cell A that visually overflows cell A's box is therefore **overpainted** by cell B's canvas + ring — regardless of `z-index` or `overflow` settings on ancestors. The `transform: scale()` on `canvas-surface` additionally traps `position: fixed` descendants, so there is no CSS-only escape.

**Fix.** Hoist the ActionBar out of the per-cell DOM subtree into a single React portal mounted at `document.body`. A portal escapes every stacking context, transform containing block, and `overflow: hidden` ancestor in one move.

## Architecture

```
EditorShell
├── Toolbar
├── CanvasArea
│   └── CanvasWrapper (isolate + transform:scale + overflow:hidden)
│       └── recursive GridNode tree
│           └── LeafNode (registers its divRef in cellRegistry;
│                         writes hoveredNodeId on pointer enter/leave)
├── MobileSheet
├── GlobalActionBar  ← NEW: createPortal(..., document.body)
└── Onboarding
```

### Components and data flow

1. **`src/lib/cellRegistry.ts`** — `Map<string, HTMLElement>` with `registerCell`, `unregisterCell`, `getCellElement`. Module-level state is fine because the app is browser-only.

2. **`src/store/editorStore.ts`** — added `hoveredNodeId: string | null` and `setHoveredNode(id)`. Drives ActionBar visibility directly — there is **no** `selectedNodeId` fallback (locked D-01).

3. **`src/Editor/GlobalActionBar.tsx`** — subscribes to `hoveredNodeId` and `panModeNodeId`. When both are set to the same id, the bar is suppressed (pan mode hides it). Otherwise, it looks up the cell's `HTMLElement` via the registry, reads `getBoundingClientRect()`, and renders a portal `<div style={{position:'fixed', top:rect.top-44, left:rect.left+rect.width/2, transform:translateX(-50%), zIndex:1000}}>` containing the `ActionBar` component.

   Position is recalculated on:
   - `ResizeObserver` on the cell (handles divider drag + container resize)
   - `window.scroll` (capture phase for nested scrollers) + `window.resize`
   - `useGridStore.subscribe(update)` — any tree mutation
   - `useEditorStore.subscribe(update)` — zoom / canvasScale / pan mode changes

4. **`src/Grid/LeafNode.tsx`** changes:
   - Registers `divRef.current` in `cellRegistry` inside the existing `useLayoutEffect` (and unregisters in cleanup).
   - `onMouseEnter` writes `hoveredNodeId = id` imperatively via `useEditorStore.getState().setHoveredNode(id)`.
   - `onMouseLeave` schedules a **80 ms debounced clear** via `setTimeout` so the pointer can cross from the cell into the portal ActionBar (which is NOT a DOM descendant of the cell) without flicker. The portal `<div>` additionally re-asserts `hoveredNodeId` on its own `onPointerEnter` as a second safety net.
   - Local `isHovered` state is **kept** — it still drives the cell-local hover dim overlay. The store hover field is only consumed by GlobalActionBar.
   - Inline ActionBar JSX block (the scale-compensation wrapper and its `<ActionBar .../>` child) is deleted.
   - `canvasScale` selector dropped (no longer referenced after deleting the inline mount).
   - `handleUploadClick` dropped (file input click is now triggered by the portal via `el.querySelector('input[type=file]')?.click()`).

5. **`src/Editor/EditorShell.tsx`** mounts `<GlobalActionBar />` between `<MobileSheet />` and `<Onboarding />` so Onboarding stays on top.

6. **`src/Grid/ActionBar.tsx`** reverts to fixed `w-8 h-8` sizing. The `BTN_SIZE = 'clamp(28px, 2.2vw, 36px)'` constant and every `style={{ width: BTN_SIZE, height: BTN_SIZE }}` inline prop are removed — the portal lives in viewport pixels, so scale compensation is unnecessary. `ICON_SIZE = 16` is unchanged.

## Key Decisions Honored

| Decision | Value |
| --- | --- |
| D-01 hover semantics | hover-only (no `selectedNodeId ?? hoveredNodeId` fallback) |
| D-02 sizing | fixed `w-8 h-8` (no clamp, no `scale(1/canvasScale)`) |
| D-03 portal target | `document.body` via `createPortal` |
| D-04 lookup | module-level `cellRegistry` Map, registered in LeafNode `useLayoutEffect` |
| D-05 dependency | no `@floating-ui/react`; plain `getBoundingClientRect` + `clamp top` |

## Test Updates

Two test files were updated because they asserted the old architecture.

1. **`src/Grid/__tests__/ActionBar.test.tsx`** — Test 2 previously asserted that buttons did **not** carry `w-8 / h-8` classes (clamp()-based sizing from 07-01). Inverted: now asserts the fixed classes are present. Comment updated to reference the quick-260407-q2s reversion.

2. **`src/test/phase05-p02-pan-zoom.test.tsx`** — The `ActionBar hidden in pan mode (D-12)` test previously rendered `<LeafNodeComponent />` alone and queried `action-bar-leaf-1` from the cell's subtree. Updated to:
   - Render both `<LeafNodeComponent />` and `<GlobalActionBar />`.
   - Set `hoveredNodeId = 'leaf-1'` and `panModeNodeId = 'leaf-1'` on the editor store, then assert `queryByTestId('action-bar-leaf-1')` is `null` (portal suppressed).
   - Added a positive-case sibling test: with hover set and no pan mode, the portal **does** render the ActionBar.

No other tests required changes. Full suite: **423 passed / 2 skipped** (unchanged from baseline).

## Automated Verification (Task 3 — checkpoint portion)

- `npm run build` — passes. Bundle 339.28 kB / gzip 107.97 kB (well under the 500 kB budget). Pre-existing CSS `@custom-variant` / `@utility` lightningcss warnings are unrelated.
- `npm run test -- --run` — **423 passed, 2 skipped, 0 failed** across 37 test files.

## Manual Smoke Verification

**Pending — deferred to user per checkpoint-gate in the plan.** The following steps from Task 3 `<how-to-verify>` require human review and have not been performed:

- Hover clipping check across neighbouring cells in a 2×2 grid
- Pointer flicker check when crossing from cell into portal ActionBar
- Zoom / divider drag / scroll anchoring
- Selection-only (no hover) confirms ActionBar stays hidden
- Pan-mode suppression + restoration on Escape
- Upload button triggers file picker for hovered cell
- Cell swap via drag handle across the portal boundary
- Mobile viewport (<768px): ActionBar hidden entirely (`hidden md:block`)

Report any regressions and I will iterate.

## Deviations from Plan

None. The plan was executed exactly as written. One incidental cleanup: `handleUploadClick` in `LeafNode` was deleted (not just un-wired) because it became dead code after the inline ActionBar block was removed, and the project's TS config would flag it as unused.

## Files Modified

| File | Change |
| --- | --- |
| `src/store/editorStore.ts` | +hoveredNodeId, +setHoveredNode |
| `src/lib/cellRegistry.ts` | NEW — 3 exports |
| `src/Editor/GlobalActionBar.tsx` | NEW — portal component |
| `src/Grid/LeafNode.tsx` | register/unregister cell, hover → store w/ 80 ms debounce, delete inline ActionBar block, drop canvasScale selector and handleUploadClick |
| `src/Editor/EditorShell.tsx` | mount `<GlobalActionBar />` |
| `src/Grid/ActionBar.tsx` | revert to fixed `w-8 h-8`, drop BTN_SIZE constant and per-button style={{...}} |
| `src/test/phase05-p02-pan-zoom.test.tsx` | assert pan-mode suppression via portal; add positive-case test |
| `src/Grid/__tests__/ActionBar.test.tsx` | invert sizing assertion for quick-260407-q2s revert |

## Self-Check: PASSED

- `src/lib/cellRegistry.ts` FOUND
- `src/Editor/GlobalActionBar.tsx` FOUND
- `editorStore.hoveredNodeId` FOUND
- `EditorShell.tsx` contains `<GlobalActionBar />` FOUND
- `ActionBar.tsx` BTN_SIZE constant REMOVED (confirmed)
- Commit 05ae9c1 FOUND
- Commit 1967219 FOUND
- Commit 303850c FOUND
- `npm run build` PASSED
- `npm run test -- --run` PASSED (423/425, 2 skipped)
