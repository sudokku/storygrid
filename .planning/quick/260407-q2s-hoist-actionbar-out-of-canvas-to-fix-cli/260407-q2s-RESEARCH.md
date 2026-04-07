# Quick Task 260407-q2s: Hoist ActionBar Out of Canvas — Research

**Researched:** 2026-04-07
**Domain:** React stacking contexts, portals, floating UI positioning
**Confidence:** HIGH

## Summary

Phase 07-01 attempted to fix ActionBar clipping by changing the LeafNode root from `overflow-hidden` to `overflow-visible`, moving media clipping to an inner wrapper, and removing `overflow-hidden` from ContainerNode's child wrapper. That fix was **necessary but insufficient**: it solved the overflow clipping problem, but the ActionBar is still being visually covered by neighbouring cells because of **CSS stacking context isolation**, not overflow clipping.

**Root cause:** `src/Grid/LeafNode.tsx:531` has `isolate` on the cell root, which creates a new stacking context. The ActionBar's `z-20` (line 603) is scoped to that cell's stacking context only. Sibling cells in the same flex container each create their own stacking contexts and paint after the previous cell in DOM order — so the neighbour's canvas/ring paints **on top of** the overflowing ActionBar.

**Primary recommendation:** Render a **single ActionBar component via `React.createPortal` to `document.body`**, driven by `selectedNodeId` + hovered cell from the editor store, positioned via `getBoundingClientRect()` on the target cell with a `ResizeObserver` + scroll/resize listeners. This escapes every stacking context and overflow/transform ancestor in one move. No new dependency required — `createPortal` is built into `react-dom`.

## Current Implementation

### The ActionBar mount point (`src/Grid/LeafNode.tsx:599-610`)

```tsx
{/* ActionBar: visible on hover, hidden in pan mode, hidden on mobile */}
<div
  className={`
    hidden md:block
    absolute top-2 left-1/2 z-20
    transition-opacity duration-150
    ${isHovered && !isPanMode ? 'opacity-100 delay-150' : 'opacity-0 pointer-events-none'}
  `}
  style={{ transform: `translateX(-50%) scale(${1 / canvasScale})`, transformOrigin: 'top center' }}
>
  <ActionBar nodeId={id} fit={node.fit} hasMedia={hasMedia} onUploadClick={handleUploadClick} />
</div>
```

The ActionBar lives **inside each LeafNode** as a DOM descendant of the cell div. The cell div is itself a descendant of `ContainerNode` flex children, nested recursively down to the canvas surface inside `CanvasWrapper`.

### Why Phase 07-01's fix is not enough

1. **LeafNode root (`src/Grid/LeafNode.tsx:528-537`)** now has `overflow-visible` AND `isolate`:
   ```tsx
   className={`
     relative w-full h-full isolate overflow-visible select-none
     ${ringClass}
     ${hasMedia ? '' : 'bg-[#1c1c1c]'}
   `}
   ```
   `isolate` (Tailwind for `isolation: isolate`) **creates a new stacking context**. The ActionBar's `z-20` is completely scoped inside this context.

2. **ContainerNode child wrapper (`src/Grid/ContainerNode.tsx:32-36`)** already had overflow-hidden removed:
   ```tsx
   <div className="min-h-0 min-w-0" style={{ flex: activeSizes[i] }}>
     <GridNodeComponent id={child.id} />
   </div>
   ```
   So overflow is not clipping horizontally. But the wrapper is a block element that contains the next sibling cell — and that next sibling **also creates its own stacking context** (via its own `isolate`), and it paints **after** this one in document order.

3. **Net result:** Cell A's ActionBar overflows the cell top and extends into cell B's rendered box. Cell A's stacking context ends at cell A's box. Cell B's stacking context is painted next in the parent flex container — **above** A's overflowing content. The ActionBar is drawn, then immediately overpainted by cell B's canvas + ring.

4. **Secondary issue — `CanvasWrapper` outer overflow (`src/Grid/CanvasWrapper.tsx:80`)**:
   ```tsx
   className="flex flex-1 h-full items-start justify-center overflow-hidden"
   ```
   This outer container has `overflow-hidden`. It does not affect the inner-cell clipping problem, but it WILL clip an ActionBar overflowing the top cell into the toolbar area. For an ActionBar on the very top row of cells, this is the final boundary.

5. **`transform: scale()` on `canvas-surface` (`src/Grid/CanvasWrapper.tsx:88`)**: The entire 1080×1920 canvas is CSS-scaled via `transform: scale(finalScale)`. A `transform` on an ancestor **also creates a containing block for `position: fixed` descendants** — so even `position: fixed` inside the canvas tree gets contained by the scaled ancestor. This rules out `position: fixed` as an escape hatch. A **portal to `document.body`** escapes the transform containing block.

### Canvas scale compensation

The wrapper applies `transform: scale(${1 / canvasScale})` so the ActionBar buttons remain a stable physical size regardless of the canvas `transform: scale(${finalScale})` on the parent. Any new architecture must preserve this **physical-pixel-stable sizing** behavior — either by rendering outside the scaled ancestor entirely (portal) or by re-computing the inverse scale.

## Why the Current Approach is Fundamentally Constrained

A recursive grid tree with per-cell stacking contexts (via `isolate`, `transform`, `opacity`, `filter`, or `will-change`) is architecturally incompatible with "a floating control that visually extends beyond its own cell box." Each cell is its own stacking sandbox by design — removing `isolate` would break the `ring-inset` overlay and the `z-10` dim/drop overlays that currently depend on cell-local layering.

Even if we removed `isolate` and all `z-index` rules, we would still face:

- **Document order painting:** Later siblings paint over earlier ones when they overlap.
- **`transform: scale()` on `canvas-surface` creates a containing block** that traps `position: fixed`.
- **`overflow-hidden` on `canvas-container`** (`src/Grid/CanvasWrapper.tsx:80`) clips anything escaping the canvas bounds vertically.

A DOM descendant of the cell **cannot escape** without one of:
1. **Portal** to a DOM node outside the grid tree (document.body or a sibling of CanvasWrapper).
2. **Hoisting** the ActionBar up the tree to a single mount point outside all cells.

Both approaches work. Portal is the standard pattern for this class of problem.

## Alternative Architectures

### Option A: React Portal + Store-Driven Single ActionBar (RECOMMENDED)

Render a **single** `<GlobalActionBar />` instance at the editor root, which uses `createPortal(<div>...</div>, document.body)` internally. It subscribes to `editorStore` for `selectedNodeId` (and a new `hoveredNodeId`), queries the selected/hovered cell's DOM via a `nodeId → HTMLElement` registry or `querySelector`, and positions itself using `getBoundingClientRect()`.

**Pros:**
- Escapes every stacking context, `transform`, and `overflow` in one move.
- Free: no new dependency. `createPortal` is built into React.
- Single component instance — cheap to render, centralized callback wiring.
- Naturally solves the physical-size problem: positioned in viewport coordinates, not canvas coordinates, so no `scale(1/canvasScale)` compensation is needed.
- Matches the pattern used by Figma, Excalidraw, tldraw, Google Slides for contextual toolbars.

**Cons:**
- Position must be recomputed on: cell resize, canvas resize, zoom change, window scroll, window resize, divider drag, sidebar open/close, mobile sheet snap change.
- Hover tracking becomes cross-component — needs a store field, not local state.
- Event bubbling changes: the ActionBar is no longer a DOM descendant of the cell, so `onMouseLeave` on the cell fires when the pointer crosses into the portal. Need to treat the cell+ActionBar as a single hover region.

### Option B: Hoisted ActionBar to Canvas Root (No Portal)

Render a single ActionBar inside `CanvasWrapper`'s `canvas-surface` div, positioned absolutely using the cell's coordinates within that surface. No portal; stays in the React tree at the canvas level.

**Pros:**
- No portal machinery.
- Coordinates are in canvas space (1080×1920), so can reuse existing canvas scale logic.

**Cons:**
- Still inside `canvas-surface`, which has `transform: scale(finalScale)` — so an ActionBar placed at the top of the top row **still gets clipped by `canvas-container` `overflow-hidden`** (`src/Grid/CanvasWrapper.tsx:80`).
- Requires removing `overflow-hidden` from `canvas-container`, which currently prevents the grid from extending into the toolbar area during layout. Risky.
- Does NOT solve the fundamental escape problem for any future overlay that needs to extend above the canvas top edge (e.g., split-menu dropdowns, future text-overlay toolbars).

### Option C: `@floating-ui/react`

Purpose-built library for anchor-positioned floating elements. Handles flip/shift/arrow/collision detection automatically. Uses portals internally.

**Pros:**
- Best-in-class positioning logic: handles flip (place below if no room above), shift (slide along the edge to stay in viewport), and auto-update via `autoUpdate()` which batches scroll, resize, and layout listeners.
- Used by Radix, shadcn, and most modern React UI libraries.
- Actively maintained, TypeScript-native.

**Cons:**
- ~8KB gzipped added to bundle.
- More abstraction than needed for a single anchored toolbar; we don't need flip/arrow/collision — we need "render above cell, clamp into canvas."
- The project already pulls `base-ui` tooltip, which uses Floating UI internally — so it may already be transitively present.

### Option D: Plain CSS fix (NOT VIABLE)

Cannot fix via CSS alone because:
- Removing `isolate` breaks existing z-layered overlays (ring, dim, drop-target) that depend on cell-local stacking.
- Raising `z-index` on the ActionBar does not cross stacking context boundaries.
- `position: fixed` is captured by the `transform: scale()` ancestor (`canvas-surface`).

## Recommended Path

**Option A: Portal-based GlobalActionBar driven by editorStore.**

### Architecture

```
EditorShell
├── Toolbar
├── CanvasArea
│   └── CanvasWrapper (canvas-container, canvas-surface with transform:scale)
│       └── GridNode tree (cells mount here, with hover/select tracking)
├── GlobalActionBar  ← NEW: portal to document.body
└── Sidebar / MobileSheet / Onboarding
```

### Store changes (`src/store/editorStore.ts`)

Add:
```ts
hoveredNodeId: string | null;
setHoveredNode: (id: string | null) => void;
```

The `selectedNodeId` field already exists and is fine to reuse.

### Cell → Element registry (`src/lib/cellRegistry.ts` NEW)

```ts
const cellElements = new Map<string, HTMLElement>();
export const registerCell = (id: string, el: HTMLElement) => cellElements.set(id, el);
export const unregisterCell = (id: string) => cellElements.delete(id);
export const getCellElement = (id: string) => cellElements.get(id) ?? null;
```

LeafNode registers/unregisters its `divRef` in a `useLayoutEffect`. This avoids a brittle `querySelector([data-testid="leaf-${id}"])` lookup.

### GlobalActionBar component (`src/Editor/GlobalActionBar.tsx` NEW)

```tsx
export function GlobalActionBar() {
  const selectedId = useEditorStore(s => s.selectedNodeId);
  const hoveredId = useEditorStore(s => s.hoveredNodeId);
  const panMode = useEditorStore(s => s.panModeNodeId);
  const activeId = hoveredId ?? selectedId; // hover wins, fallback to selection
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Read node/mediaId from gridStore for the active cell
  const node = useGridStore(s => activeId ? findNode(s.root, activeId) : null);

  useLayoutEffect(() => {
    if (!activeId || panMode) { setRect(null); return; }
    const el = getCellElement(activeId);
    if (!el) { setRect(null); return; }

    const update = () => setRect(el.getBoundingClientRect());
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('scroll', update, true); // capture phase for nested scrollers
    window.addEventListener('resize', update);

    // Also subscribe to gridStore for divider drags (which resize cells via flex but
    // may not trigger ResizeObserver at every frame — force update on tree mutation)
    const unsub = useGridStore.subscribe(update);
    // Subscribe to editorStore for zoom / canvasScale changes
    const unsubEditor = useEditorStore.subscribe(update);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      unsub();
      unsubEditor();
    };
  }, [activeId, panMode]);

  if (!rect || !node || node.type !== 'leaf') return null;

  // Position ActionBar 8px above the top edge of the cell, centered horizontally.
  // Clamp into viewport so it never goes off-screen on small cells near edges.
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.max(8, rect.top - 44), // 44 = ActionBar height + gap
    left: Math.max(8, Math.min(window.innerWidth - 8, rect.left + rect.width / 2)),
    transform: 'translateX(-50%)',
    zIndex: 1000,
    pointerEvents: 'auto',
  };

  return createPortal(
    <div style={style} className="hidden md:block">
      <ActionBar
        nodeId={activeId!}
        fit={node.fit}
        hasMedia={!!node.mediaId}
        onUploadClick={() => triggerUploadFor(activeId!)}
      />
    </div>,
    document.body
  );
}
```

### LeafNode changes

- **Remove** the entire inline ActionBar block (`src/Grid/LeafNode.tsx:599-610`).
- **Remove** the `scale(1/canvasScale)` compensation — no longer needed since the portal lives in viewport coordinates.
- **Add** `registerCell(id, el)` / `unregisterCell(id)` in the existing `useLayoutEffect` that already has `divRef` observed (`src/Grid/LeafNode.tsx:74-96`).
- **Update hover tracking:** replace local `setIsHovered` with `useEditorStore.setHoveredNode`. On `onMouseEnter`, call `setHoveredNode(id)`; on `onMouseLeave`, call `setHoveredNode(null)` after a short delay to give pointer time to enter the portal ActionBar (prevents flicker).

### Upload trigger

The current `inputRef` lives inside LeafNode and the file input is clicked via `handleUploadClick`. With the portal, the ActionBar no longer has access to the cell's input ref.

**Solution:** Keep `<input type="file">` inside LeafNode. Expose the trigger via a callback registry keyed by nodeId, OR move the file input into `GlobalActionBar` itself and dispatch the result through the existing `autoFillCells` helper with `selectedNodeId` as target. The second approach is simpler and centralizes upload UX.

### Hover-vs-selection semantics

User prompt said "when hovering or selecting." Recommendation:
- **Selection** is the primary driver — selected cell always shows its ActionBar.
- **Hover** additionally shows the ActionBar for the hovered cell when nothing is selected (or when hovering a different cell than the selected one — in which case hover takes precedence).
- **Computed as:** `activeId = hoveredId ?? selectedId` (hover wins when present; falls back to selection).
- This matches Figma's behavior: click a frame to lock the toolbar; hover a different frame to preview its controls.
- In **pan mode**, the ActionBar is hidden entirely — preserve current behavior.

### Position update triggers

| Event | Mechanism |
|-------|-----------|
| Cell resize (divider drag) | `ResizeObserver` on cell element |
| Canvas resize (window resize) | `window.addEventListener('resize')` |
| Zoom change | `useEditorStore.subscribe` (canvasScale/zoom) |
| Window scroll | `window.addEventListener('scroll', update, true)` (capture) |
| Tree mutation (split/merge/remove) | `useGridStore.subscribe` — cell's bounding rect may change |
| Sidebar open/close, mobile sheet snap | Covered by `window resize` + ResizeObserver |
| Selection/hover change | `useEffect` dependency on `activeId` |

All of these call the same `update()` that re-reads `getBoundingClientRect()` and sets local `rect` state. Keep `update` referentially stable with `useCallback` or an inline ref.

### Transition on selection change

**Recommendation: snap, not animate.** When selection changes from cell A to cell B, the ActionBar should jump to cell B's position immediately. Animating between positions in viewport coordinates looks jittery when cells differ wildly in size and position. Fade opacity 150ms is fine and already in the current code.

## Pitfalls to Avoid

1. **Stale rects after layout shifts.** `getBoundingClientRect()` is synchronous but only reflects current layout. Updates must happen **after** the layout settles. Solution: use `useLayoutEffect` (not `useEffect`) for the initial measurement, and always call `update()` from the ResizeObserver callback and from store subscriptions (which fire after React commits).

2. **Z-index wars.** `zIndex: 1000` on the portal must be higher than the Sidebar (currently no explicit z-index), toolbar, and mobile sheet, but **lower** than the Onboarding overlay (which should always be on top) and any modal/toast. Audit `src/Editor/*` for existing z-index values and pick a value that sits above all editor chrome but below onboarding/modals. Consider defining a z-index scale in a constant file.

3. **Pointer-event leakage.** The portal `<div>` needs `pointerEvents: 'auto'` on the ActionBar container itself, but must not block clicks on the rest of the page. Since it's only as large as the ActionBar, this is fine — but do not wrap it in a full-viewport div.

4. **Hover flicker when pointer crosses from cell to ActionBar.** The ActionBar is no longer a DOM descendant of the cell, so `onMouseLeave` on the cell fires when the pointer enters the ActionBar region. Solutions:
   - Add a small `setTimeout` (80ms) before clearing `hoveredNodeId` on `onMouseLeave`, cancel it if a new `onMouseEnter` fires on the same or another cell or on the ActionBar itself.
   - OR make the ActionBar also call `setHoveredNode(activeId)` on its own `onMouseEnter` to keep itself visible.
   - Simplest: debounce the `setHoveredNode(null)` call.

5. **Cell unmount while hovered.** If a cell is removed/merged while hovered, the registry entry must clear. Handle in the `useLayoutEffect` cleanup in LeafNode.

6. **Multiple portals on the same page during tests.** Tests using `@testing-library/react` sometimes leak portal DOM between tests. Ensure `cleanup()` runs after each test (vitest + jsdom usually does this automatically).

7. **SSR: not a concern.** This app is client-only, no Next.js SSR. `document.body` is always available at mount.

8. **Initial render flash.** On first mount, `rect` is `null` until the first measurement — render nothing. Alternatively, return `null` guard already handles this.

9. **Stale `node` closure.** Must read `node` from `useGridStore` selector (not captured once) so ActionBar updates when media changes via a different code path (e.g., drop, external setMedia).

10. **Drag handle interaction.** The ActionBar currently has a draggable "grip" button that sets `text/cell-id` for cell swap (`src/Grid/ActionBar.tsx:62-77`). Native HTML5 drag events still work from a portal — the dataTransfer payload is global. Drop targets (cells) are unaffected. **Verify in manual QA** that cell-swap still works after the move.

## Bundle Size Implications

- **Portal approach (Option A):** Zero additional bundle cost. `createPortal` is already imported via `react-dom`.
- **Floating UI (Option C):** ~8KB gzipped. Possibly already partially present via `base-ui` tooltip dependency — worth checking `npm ls @floating-ui/react` before adopting.

Given Option A requires no new dependencies and fully solves the problem, **reject Option C** unless future requirements need flip/shift/collision (e.g., multiple contextual menus, submenu placement).

## Files to Touch

| File | Change |
|------|--------|
| `src/store/editorStore.ts` | Add `hoveredNodeId` + `setHoveredNode` |
| `src/lib/cellRegistry.ts` | NEW: nodeId → HTMLElement registry |
| `src/Editor/GlobalActionBar.tsx` | NEW: portal-based single ActionBar with positioning logic |
| `src/Editor/EditorShell.tsx` | Mount `<GlobalActionBar />` inside the shell |
| `src/Grid/LeafNode.tsx` | Remove inline ActionBar block (lines 599-610); register/unregister cell element; replace local `isHovered` with store `hoveredNodeId`; remove `scale(1/canvasScale)` wrapper (no longer needed) |
| `src/Grid/ActionBar.tsx` | No functional changes — keep as-is. Remove BTN_SIZE clamp (no longer inside scaled canvas — can use stable px sizing). Optional. |
| `src/Grid/__tests__/LeafNode.test.tsx` | Update tests that assert ActionBar is rendered inside the cell |
| `src/Editor/__tests__/GlobalActionBar.test.tsx` | NEW: position calculation, hover/select logic, pan-mode hide |

## Open Questions

1. **Should ActionBar buttons revert to fixed px sizing?** The original `clamp(28px, 2.2vw, 36px)` from Phase 07-01 was motivated by the canvas being visually scaled — the buttons needed to stay physically stable regardless of zoom. Once the ActionBar lives in viewport pixels (not canvas pixels), fixed `w-8 h-8` is correct. Recommend reverting to fixed sizing for simpler reasoning.

2. **Does the mobile sheet path still need the ActionBar?** Current code has `hidden md:block` — ActionBar is desktop-only. Mobile uses `SelectedCellPanel` in the sheet. Keep the same: `className="hidden md:block"` on the portal div.

3. **What happens when the hovered cell is below the safe-zone toolbar area?** On tall cells near the top of the canvas, the ActionBar positioned at `rect.top - 44` may land on top of the app toolbar. Solution: clamp `top: Math.max(8, ...)`. When clamped, ActionBar sits at viewport top; cell may be partially obscured. Alternative: flip below the cell (`rect.bottom + 8`) when no room above. Decide at implementation time based on visual testing.

## Sources

### Primary (HIGH confidence — verified in codebase)
- `src/Grid/LeafNode.tsx:528-610` — current cell root, isolate, z-20 ActionBar mount, canvas clipping wrapper
- `src/Grid/ContainerNode.tsx:32-36` — child wrapper (overflow-hidden already removed)
- `src/Grid/CanvasWrapper.tsx:80-99` — outer overflow-hidden, transform:scale canvas-surface
- `src/Grid/ActionBar.tsx:1-131` — current stateless ActionBar component
- `src/store/editorStore.ts` — current editor store shape
- `.planning/phases/07-cell-controls-display-polish/07-01-SUMMARY.md` — Phase 07-01 fix details and decisions

### Secondary (HIGH confidence — standard web platform behavior)
- CSS `isolation: isolate` creates a new stacking context — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation)
- CSS `transform` creates a containing block for `position: fixed` descendants — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/position#fixed_positioning)
- React portals escape DOM hierarchy but preserve React event bubbling — [React docs](https://react.dev/reference/react-dom/createPortal)
