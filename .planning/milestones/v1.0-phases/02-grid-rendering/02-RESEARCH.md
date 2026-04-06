# Phase 2: Grid Rendering - Research

**Researched:** 2026-04-01
**Domain:** React recursive component trees, pointer-event drag, CSS transform scaling, Zustand per-node selectors, shadcn/Radix Tooltip
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three divider visibility states — (a) cursor not on canvas: no lines visible; (b) cursor on canvas: 2px dividers visible between all siblings; (c) cursor hovering a specific divider: explicit grab handle appears on that divider.
- **D-02:** Same behavior applies to horizontal dividers between vertically stacked cells.
- **D-03:** Drag uses local React state only — no store writes during `pointermove`. A single `resize()` action commits to the store on `pointerup`. This keeps undo/redo clean (one step per drag) and avoids re-renders mid-drag.
- **D-04:** The floating action bar appears top-center inside the cell on hover.
- **D-05:** Icons only with shadcn/ui Tooltips (Radix UI `@radix-ui/react-tooltip`) for label discoverability.
- **D-06:** Bar fades in/out with a short hover delay using `transition-opacity` — prevents flickering when the cursor briefly passes over a cell.
- **D-07:** Phase 2 actions: Split H, Split V, Remove, Toggle Fit (cover ↔ contain).
- **D-08:** Canvas auto-fits to ~90% of the available editor area using `CSS transform: scale()`. Scale factor recalculates on window resize (use `ResizeObserver` on the CanvasArea container).
- **D-09:** `editorStore.zoom` acts as a multiplier on top of auto-fit (zoom=1.0 = auto-fit baseline).
- **D-10:** The inner div is always 1080×1920px; only the `transform: scale()` value changes.
- **D-11:** Only leaf nodes are selectable in Phase 2.
- **D-12:** Two deselect gestures: click the canvas background OR click the already-selected cell again.
- **D-13:** Leaf renders `<img>` with `object-fit` from `leaf.fit` and `object-position` from `leaf.objectPosition` (default: `center center`).
- **D-14:** Each LeafNode wrapper has `isolation: isolate` CSS (REND-10).
- **D-15:** Every `ContainerNode` and `LeafNode` component is wrapped in `React.memo`. Each subscribes to its own node slice in Zustand (no whole-tree subscriptions).
- **D-16:** shadcn/ui (Radix UI primitives) is the chosen UI component library. Phase 2 introduces `@radix-ui/react-tooltip` as the first Radix dependency.

### Claude's Discretion

- Exact grab handle visual (pill, dot, or double-arrow icon) — implement a clean, standard resize cursor affordance
- Divider hit area width (e.g. 8–12px transparent zone around the 2px line)
- Exact fade timing values (delay duration, transition duration) — keep snappy; ~150ms delay, ~150ms fade
- `ResizeObserver` debounce strategy for canvas scale recalculation

### Deferred Ideas (OUT OF SCOPE)

- Phase 5 — Replace "double-click to enter pan mode" with direct image drag (objectPosition hook present in Phase 2 but no drag interaction)
- Future — Container selection (architecture ready via selectedNodeId; not wired in Phase 2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REND-01 | GridNode component dispatches to Container or Leaf based on node type; is React.memo'd | React.memo + discriminated union dispatch; per-node Zustand slice selector |
| REND-02 | Container renders as flex row/column with each child's size driven by `flex: {fraction}` from `sizes[]` | CSS flex shorthand `flex: {n}` maps directly to flex-grow proportional layout |
| REND-03 | Divider between siblings is draggable via pointer events (setPointerCapture); updates size ratios in real-time; commits resize action on pointerup | Pointer capture API; local React state for live preview; single store write on pointerup; resize(containerId, index, delta) signature |
| REND-04 | Leaf renders empty state with dashed border, upload prompt, and drag-drop target | Tailwind `border-dashed` + centered flex content; Phase 3 wires actual upload |
| REND-05 | Leaf renders media state with `<img>` using `object-fit: cover` or `contain` matching `leaf.fit` | Standard CSS object-fit; `object-position` from leaf.objectPosition for Phase 5 hook |
| REND-06 | Leaf shows blue selection border when selected; hover state reveals floating action bar | Tailwind ring or border for selection; absolute-positioned ActionBar; CSS group/hover pattern |
| REND-07 | Canvas wrapper maintains 9:16 aspect ratio via CSS transform scale; centered in editor area | ResizeObserver on container; `transform: scale()` + `transform-origin: top center`; 50ms debounce |
| REND-08 | Optional safe zone overlay shows dashed guides 250px from top and bottom (toggleable) | Absolute-positioned divs using `--safe-zone-top` / `--safe-zone-bottom` CSS variables already in index.css |
| REND-09 | Each ContainerNode and LeafNode uses React.memo with per-node Zustand slice selectors (no whole-tree subscriptions) | Zustand v5 selector pattern with stable identity; React.memo prevents re-renders when sibling changes |
| REND-10 | Each LeafNode container has `isolation: isolate` for Safari overflow/border-radius compatibility | Known Safari flex + overflow clip bug; `isolation: isolate` creates new stacking context to fix it |
</phase_requirements>

---

## Summary

Phase 2 converts the completed Zustand grid store into a visible, interactive flex layout. The work is entirely frontend React — no new libraries are needed beyond initializing shadcn and installing `@radix-ui/react-tooltip`. All decisions are locked; research confirms every implementation approach is standard and well-supported.

The most technically nuanced area is the Divider drag interaction. The store's `resize(containerId, index, delta)` signature takes a delta (float), not absolute sizes. The Divider component must track start position and start sizes in local state, compute pixel delta on pointermove, convert that to a weight delta (pixel delta / container total pixels), and pass it to live local state for rendering — then commit the final delta on pointerup. This avoids store writes on every frame.

A critical type-system gap exists: `LeafNode` in `src/types/index.ts` does not yet have an `objectPosition` field (CONTEXT.md D-13 requires it). Phase 2 must add `objectPosition?: string` to the `LeafNode` type before rendering, and `createLeaf()` in `lib/tree.ts` should default it to `'center center'`. shadcn is not yet initialized (`components.json` absent) — the executor must run `npx shadcn init` and `npx shadcn add tooltip` before building ActionBar.

**Primary recommendation:** Build components in dependency order: type extension → GridNode dispatcher → ContainerNode + Divider → LeafNode + ActionBar → CanvasWrapper + SafeZoneOverlay → wire into CanvasArea.

---

## Standard Stack

### Core (all already installed — no new installs except Radix)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.1 | Component tree, memo, hooks | Pinned per CLAUDE.md; avoid React 19 peer dep issues |
| Zustand | ^5.0.12 | Per-node store subscriptions | Already in store; v5 selector API is stable |
| Tailwind CSS | ^3.4.19 | Utility classes for layout, states, colors | Already configured with PostCSS; v3 pinned |
| lucide-react | ^1.7.0 | Action bar icons | Already installed; shadcn's internal icon library |
| @radix-ui/react-tooltip | (via shadcn) | Tooltip on action bar buttons (D-05) | shadcn wraps Radix; required by D-16 |

### Supporting (shadcn dependencies — installed by `npx shadcn init`)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | latest | shadcn variant utilities | Installed by shadcn init; used in shadcn generated components |
| clsx | latest | Conditional class merging | Installed by shadcn init; used by `cn()` utility |
| tailwind-merge | latest | Merges Tailwind classes safely | Installed by shadcn init; prevents conflicting utility collisions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `CSS transform: scale()` for canvas scaling | `zoom` CSS property | `zoom` not in CSS standard; inconsistent cross-browser behavior; `transform` is correct |
| `setPointerCapture` for divider drag | @dnd-kit | dnd-kit causes whole-tree re-renders on pointermove; explicit decision to use raw pointer events (STATE.md) |
| `React.memo` + per-node selector | Context + useMemo | Context causes all consumers to re-render when any slice changes; Zustand selectors are more granular |
| shadcn Tooltip | Custom tooltip | Custom tooltip requires manual ARIA wiring and positioning logic; Radix handles both (D-16) |

**Installation (shadcn init — required before ActionBar):**
```bash
npx shadcn init
npx shadcn add tooltip
```

shadcn init installs: `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge`, and generates `src/lib/utils.ts` with `cn()`.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── Grid/
│   ├── GridNode.tsx         # Dispatcher: ContainerNode | LeafNode
│   ├── ContainerNode.tsx    # flex row/column + Dividers
│   ├── LeafNode.tsx         # empty/filled/selected states + ActionBar
│   ├── Divider.tsx          # pointer capture drag, local state only
│   ├── ActionBar.tsx        # icon buttons + shadcn Tooltip
│   ├── CanvasWrapper.tsx    # 1080×1920 inner div + ResizeObserver scale
│   ├── SafeZoneOverlay.tsx  # dashed guides at safe zone boundaries
│   └── index.ts             # re-exports
├── Editor/
│   └── CanvasArea.tsx       # replace placeholder with <CanvasWrapper>
├── types/
│   └── index.ts             # ADD objectPosition?: string to LeafNode
└── lib/
    └── tree.ts              # ADD objectPosition default to createLeaf()
```

### Pattern 1: Per-Node Zustand Selector (REND-09)
**What:** Each component subscribes only to its own node slice using a memoized selector. When a sibling's state changes, only the sibling's component re-renders.
**When to use:** Every GridNode, ContainerNode, and LeafNode.
```typescript
// Source: Zustand v5 docs — zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';

const ContainerNode = React.memo(({ id }: { id: string }) => {
  const node = useGridStore(state => findNode(state.root, id) as ContainerNode | null);
  // Only re-renders when this specific node's data changes
  if (!node || node.type !== 'container') return null;
  return (/* render */);
});
```

### Pattern 2: Divider Drag with Pointer Capture (REND-03)
**What:** Divider tracks drag entirely in local state; commits one store write on pointerup.
**When to use:** Every Divider component between siblings.
```typescript
// Source: MDN Web Docs — Element.setPointerCapture()
// Converts pixel delta to weight delta for the resize(containerId, index, delta) store action
const handlePointerDown = (e: React.PointerEvent) => {
  e.currentTarget.setPointerCapture(e.pointerId);
  dragState.current = {
    startX: e.clientX,
    startY: e.clientY,
    startSizes: [...containerSizes],  // snapshot from store at drag start
  };
};

const handlePointerMove = (e: React.PointerEvent) => {
  if (!dragState.current) return;
  const isVertical = direction === 'vertical'; // container splits vertically = horizontal divider
  const pixelDelta = isVertical
    ? e.clientY - dragState.current.startY
    : e.clientX - dragState.current.startX;
  const containerPixels = isVertical ? containerRef.current!.offsetHeight : containerRef.current!.offsetWidth;
  const totalWeight = dragState.current.startSizes.reduce((a, b) => a + b, 0);
  const weightDelta = (pixelDelta / containerPixels) * totalWeight;
  // Update local state for live preview — NO store write
  setLocalSizes(computeNewSizes(dragState.current.startSizes, siblingIndex, weightDelta));
};

const handlePointerUp = () => {
  if (!dragState.current || !localSizes) return;
  const totalWeight = dragState.current.startSizes.reduce((a, b) => a + b, 0);
  const finalDelta = localSizes[siblingIndex] - dragState.current.startSizes[siblingIndex];
  gridStore.resize(containerId, siblingIndex, finalDelta);  // single store write
  dragState.current = null;
  setLocalSizes(null);
};
```

**Critical:** `resize(containerId, index, delta)` takes a delta, not absolute sizes. The store applies `sizes[index] += delta; sizes[index+1] -= delta` and clamps to `MIN_CELL_WEIGHT = 0.1`.

### Pattern 3: Canvas Scale with ResizeObserver (REND-07)
**What:** CanvasWrapper observes its container with ResizeObserver, derives scale factor, applies via CSS transform.
**When to use:** CanvasWrapper component only.
```typescript
// Source: MDN Web Docs — ResizeObserver
// Scale formula from UI-SPEC.md §Canvas Scaling
const [scale, setScale] = useState(1);
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new ResizeObserver(
    debounce((entries) => {
      const { height } = entries[0].contentRect;
      const autoFit = (height * 0.90) / 1920;
      setScale(autoFit * zoom);  // zoom from editorStore
    }, 50)  // 50ms trailing debounce
  );
  if (containerRef.current) observer.observe(containerRef.current);
  return () => observer.disconnect();
}, [zoom]);

// Inner div: always 1080×1920, never scaled
// Outer wrapper: transform: scale(scale), transform-origin: 'top center'
```

### Pattern 4: CSS Group-Hover for Divider Visibility (D-01)
**What:** Tailwind `group` on CanvasWrapper drives `group-hover:opacity-100` on all Divider children — no JS state needed for canvas-hover visibility toggle.
**When to use:** CanvasWrapper sets `group` class; Divider uses `opacity-0 group-hover:opacity-100`.

### Pattern 5: shadcn Tooltip on Icon Buttons (D-05)
**What:** Each ActionBar button is wrapped in a shadcn `<Tooltip>` with `<TooltipTrigger asChild>` and `<TooltipContent>`.
**When to use:** All four ActionBar buttons.
```typescript
// Source: shadcn/ui tooltip docs — ui.shadcn.com/docs/components/tooltip
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button aria-label="Split horizontal" className="...">
        <SplitSquareHorizontal size={16} />
      </button>
    </TooltipTrigger>
    <TooltipContent>Split horizontal</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Note: `TooltipProvider` should wrap the entire ActionBar (or higher), not each tooltip individually.

### Anti-Patterns to Avoid

- **Whole-tree store subscription:** `const root = useGridStore(s => s.root)` in a node component — causes every node to re-render on any tree change. Use `findNode(state.root, id)` selector.
- **Store writes on pointermove:** Writing to gridStore during drag causes a full React render cycle on every pointer event frame (~60/sec). Use local ref for drag state.
- **Conditional rendering of CanvasWrapper:** CanvasWrapper (and later ExportSurface) must never unmount — conditional rendering causes blank-frame bugs on first render.
- **Scaling the inner 1080×1920 div:** Only the outer wrapper transforms via `scale()`. The inner div stays at literal 1080×1920px so Phase 4 export can reuse it at 1:1.
- **Using `zoom` CSS property instead of `transform: scale()`:** `zoom` is non-standard and has inconsistent box model behavior across browsers.
- **Missing `objectPosition` in LeafNode type:** D-13 requires `leaf.objectPosition` — it is not yet in `src/types/index.ts`. Failing to add it will cause TypeScript errors when the `<img>` renders it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip with ARIA | Custom tooltip div + positioning | shadcn `<Tooltip>` (Radix) | Radix handles `aria-describedby`, focus management, portal placement, keyboard dismiss |
| Debounce for ResizeObserver | Custom setTimeout | Simple inline debounce (5 lines) or lodash.debounce | ResizeObserver fires synchronously; a 50ms trailing debounce prevents layout thrash; trivial to inline |
| Pointer capture drag | mousedown/mousemove/mouseup global listeners | `element.setPointerCapture(e.pointerId)` | Pointer capture keeps events routed to the element even when cursor leaves; handles touch and pen too |
| CSS class merging | String concatenation | shadcn's `cn()` (clsx + tailwind-merge) | Avoids conflicting Tailwind class collisions (e.g., two border-width utilities) |

**Key insight:** The only custom logic in this phase is the pixel-to-weight delta conversion in Divider drag. Everything else delegates to established patterns.

---

## Common Pitfalls

### Pitfall 1: Stale `sizes` in Divider Drag
**What goes wrong:** The Divider reads `containerNode.sizes` directly in `pointermove`. After store mutations from other interactions, sizes may differ from drag start, causing jumps.
**Why it happens:** Zustand subscription updates sizes between dragstart and pointerup if any other action runs concurrently.
**How to avoid:** Snapshot `startSizes` into a local `ref` on `pointerdown`. All delta computations during drag use `startSizes`, not live store values.
**Warning signs:** Divider jumps to wrong position when another action fires mid-drag (unlikely in practice but architecturally important).

### Pitfall 2: ResizeObserver Loop
**What goes wrong:** ResizeObserver callback changes DOM layout (e.g., via state that affects the observed element), triggering another ResizeObserver callback, causing infinite loop.
**Why it happens:** Setting scale changes the wrapper, which ResizeObserver watches.
**How to avoid:** Apply `transform: scale()` to the inner div — not the container div that ResizeObserver observes. The container div should have stable dimensions (100% of CanvasArea). The `transform` does not affect layout box size, so ResizeObserver does not re-fire.
**Warning signs:** Browser console "ResizeObserver loop limit exceeded" warning.

### Pitfall 3: `flex` Shorthand Rendering in Safari
**What goes wrong:** `flex: {n}` (e.g., `flex: 2`) sets `flex-grow: n; flex-shrink: 1; flex-basis: 0%`. In Safari 15, `flex-basis: 0%` on a flex child inside a container without explicit height can collapse to zero height.
**Why it happens:** Safari's legacy flexbox implementation requires explicit `min-height: 0` on flex children to allow shrinking below content size.
**How to avoid:** Add `min-h-0` (min-height: 0) and `min-w-0` (min-width: 0) to every ContainerNode child wrapper. Required for both row and column containers.
**Warning signs:** Cells collapse to 0 height/width in Safari 15 on first render.

### Pitfall 4: `isolation: isolate` Not Applied
**What goes wrong:** In Safari, overflow: hidden + border-radius on a flex child inside a nested flex does not clip correctly — images bleed outside the cell border.
**Why it happens:** Safari uses different stacking context rules for nested flex.
**How to avoid:** Every LeafNode wrapper must have `isolation: isolate` (Tailwind: `isolate` utility class). This is REND-10 — do not omit it.
**Warning signs:** Rounded corners on leaf cells show image corners bleeding through in Safari.

### Pitfall 5: shadcn init Overwrites Tailwind Config
**What goes wrong:** `npx shadcn init` may add CSS variable configuration to `tailwind.config.js` that conflicts with existing canvas dimension variables or changes the `content` paths.
**Why it happens:** shadcn init generates a new tailwind config with its own theme extensions.
**How to avoid:** After running `npx shadcn init`, verify `tailwind.config.js` still contains the canvas content paths (`./src/**/*.{js,ts,jsx,tsx}`) and that `--canvas-width` / `--canvas-height` in `index.css` are not replaced by shadcn's CSS variable system.
**Warning signs:** Canvas dimension utility classes stop working after shadcn init; Tailwind purges Grid component classes.

### Pitfall 6: objectPosition Field Missing from LeafNode Type
**What goes wrong:** CONTEXT.md D-13 requires `leaf.objectPosition` but the current `LeafNode` type in `src/types/index.ts` only has `{ type, id, mediaId, fit }`. Building the Leaf renderer against the current type will cause TypeScript errors.
**Why it happens:** Phase 1 did not include this field (it's a Phase 2 requirement per D-13).
**How to avoid:** Add `objectPosition?: string` to `LeafNode` before building components. Update `createLeaf()` in `lib/tree.ts` to default `objectPosition: 'center center'`. Update `updateLeaf()` calls in gridStore accordingly (they use `Partial<Omit<LeafNode, 'type' | 'id'>>` — the Partial covers this automatically).
**Warning signs:** TypeScript error "Property 'objectPosition' does not exist on type 'LeafNode'".

### Pitfall 7: React.memo Equality on Object Props
**What goes wrong:** Passing an object prop (e.g., `sizes={node.sizes}`) to a memo'd component breaks memoization — the array reference changes on every Zustand update even if values are the same.
**Why it happens:** React.memo uses shallow equality on props. Array references from Zustand selectors are new objects on each state update (immutable update pattern).
**How to avoid:** Pass only primitive props where possible (e.g., `id` string, not the entire node object). Let each component subscribe to its own slice internally. The `id` prop is stable; the component re-renders only when `findNode(state.root, id)` returns a new reference.
**Warning signs:** Whole subtree re-renders visible in React DevTools profiler even with React.memo applied.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### GridNode Dispatcher (REND-01)
```typescript
// Pattern: discriminated union dispatch, React.memo
import React from 'react';
import type { GridNode } from '../types';
import { ContainerNode } from './ContainerNode';
import { LeafNode } from './LeafNode';

interface GridNodeProps {
  id: string;
}

export const GridNodeComponent = React.memo(({ id }: GridNodeProps) => {
  const nodeType = useGridStore(state => findNode(state.root, id)?.type);
  if (nodeType === 'container') return <ContainerNode id={id} />;
  if (nodeType === 'leaf') return <LeafNode id={id} />;
  return null;
});
GridNodeComponent.displayName = 'GridNode';
```

### ContainerNode Flex Layout (REND-02)
```typescript
// Source: MDN Flexbox — flex shorthand
// direction 'horizontal' → flex-row; direction 'vertical' → flex-col
// sizes[] drives flex-grow proportions
<div
  className={`flex ${node.direction === 'horizontal' ? 'flex-row' : 'flex-col'} w-full h-full`}
>
  {node.children.map((child, i) => (
    <React.Fragment key={child.id}>
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flex: node.sizes[i] }}
      >
        <GridNodeComponent id={child.id} />
      </div>
      {i < node.children.length - 1 && (
        <Divider
          containerId={node.id}
          siblingIndex={i}
          direction={node.direction}
          sizes={node.sizes}
        />
      )}
    </React.Fragment>
  ))}
</div>
```

### Leaf Empty/Filled States (REND-04, REND-05)
```typescript
// object-fit and object-position from leaf fields (D-13)
// isolation: isolate for Safari (D-14, REND-10)
<div
  className={`
    relative w-full h-full isolate overflow-hidden
    ${isSelected ? 'ring-2 ring-blue-500' : 'border border-dashed border-[#333333]'}
    bg-[#1c1c1c]
  `}
  onClick={handleClick}
>
  {node.mediaId ? (
    <img
      src={mediaRegistry[node.mediaId]}
      className={`w-full h-full ${node.fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      style={{ objectPosition: node.objectPosition ?? 'center center' }}
      alt=""
      draggable={false}
    />
  ) : (
    <div className="flex flex-col items-center justify-center w-full h-full gap-2">
      <ImageIcon size={24} className="text-[#666666]" />
      <span className="text-sm text-[#666666]">Drop image or click to upload</span>
    </div>
  )}
  {/* ActionBar shown on hover */}
</div>
```

### CanvasWrapper Scale Calculation (REND-07)
```typescript
// Scale formula from UI-SPEC §Canvas Scaling
// transform-origin: top center keeps canvas top-aligned during scale
const CANVAS_H = 1920;
const CANVAS_W = 1080;

const containerRef = useRef<HTMLDivElement>(null);
const [autoFitScale, setAutoFitScale] = useState(1);
const zoom = useEditorStore(s => s.zoom);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(
    debounce((entries: ResizeObserverEntry[]) => {
      const { height, width } = entries[0].contentRect;
      const scaleByH = (height * 0.9) / CANVAS_H;
      const scaleByW = (width * 0.9) / CANVAS_W;
      setAutoFitScale(Math.min(scaleByH, scaleByW)); // fit both axes
    }, 50)
  );
  ro.observe(el);
  return () => ro.disconnect();
}, []);

const finalScale = autoFitScale * zoom;

return (
  <div ref={containerRef} className="flex flex-1 items-start justify-center overflow-hidden bg-[#111111]">
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        transform: `scale(${finalScale})`,
        transformOrigin: 'top center',
        flexShrink: 0,
      }}
    >
      {/* Grid root + SafeZoneOverlay */}
    </div>
  </div>
);
```

### SafeZoneOverlay (REND-08)
```typescript
// Uses CSS variables already defined in src/index.css
// position: absolute, pointer-events: none so it doesn't intercept clicks
export function SafeZoneOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-x-0 border-t border-dashed border-white/20"
        style={{ top: 'var(--safe-zone-top)' }}
      />
      <div
        className="absolute inset-x-0 border-t border-dashed border-white/20"
        style={{ bottom: 'var(--safe-zone-bottom)' }}
      />
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| mousedown/mousemove with global listener | `setPointerCapture` on element | ~2020 (Pointer Events L2 stable) | No global listener cleanup needed; handles touch/pen automatically |
| Manual tooltip div + js positioning | Radix UI Tooltip (shadcn) | ~2022 | Handles portal, ARIA, keyboard dismiss out of the box |
| React Context for shared state | Zustand per-component selectors | ~2021 | Eliminates over-rendering; no Provider nesting |
| `zoom` CSS property for canvas scale | `transform: scale()` | Always | `zoom` has non-standard box model impact; `transform` is isolated |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Abandoned; replaced by @dnd-kit in this project
- Global mouse event listeners for drag: Pointer capture API is the correct modern approach

---

## Open Questions

1. **Scale calculation: fit-by-height vs fit-by-both-axes**
   - What we know: UI-SPEC formula is `(containerHeight * 0.90) / 1920`
   - What's unclear: If the editor area is very wide (ultrawide monitor), fitting by height may make the canvas wider than the container, causing horizontal overflow
   - Recommendation: Use `Math.min(scaleByH, scaleByW)` to fit both axes. This is a one-line deviation from the UI-SPEC formula that prevents layout breakage on wide screens.

2. **Divider: should ContainerNode pass sizes as prop or does Divider subscribe to store?**
   - What we know: Divider needs `sizes` to compute local live-resize preview; ContainerNode already has them
   - What's unclear: If Divider subscribes to store for sizes, it re-renders on every resize action (during pointerup). If ContainerNode passes sizes as prop, Divider only re-renders when ContainerNode does.
   - Recommendation: Pass `sizes` and `direction` as props from ContainerNode to Divider. Divider does not need its own store subscription — its parent already handles that.

3. **shadcn init: CSS variable conflicts**
   - What we know: shadcn init modifies tailwind.config.js and may add `@layer base` CSS variable definitions
   - What's unclear: Whether shadcn's dark theme CSS variables (`--background`, `--foreground`, etc.) will conflict with project's existing `:root` variables
   - Recommendation: After `npx shadcn init`, review the generated `src/index.css` additions. Keep project's `--canvas-width`, `--canvas-height`, `--safe-zone-*` variables intact. shadcn's theme variables use different names and should not conflict.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | shadcn CLI, npm | ✓ | v22.22.2 | — |
| npm | package installs | ✓ | 10.9.7 | — |
| npx shadcn | shadcn init + add tooltip | ✓ | 4.1.2 | — |
| @radix-ui/react-tooltip | ActionBar tooltips (D-05) | ✗ (not yet installed) | — | None — installed by `npx shadcn add tooltip` |
| lucide-react | Action bar icons | ✓ | ^1.7.0 | — |
| ResizeObserver | Canvas scale | ✓ | Browser native — Chrome 64+, Safari 13.1+ | — |
| setPointerCapture | Divider drag | ✓ | Browser native — Chrome 55+, Safari 13+ | — |

**Missing dependencies with no fallback:**
- `@radix-ui/react-tooltip` — installed via `npx shadcn add tooltip` in Wave 0

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test block; jsdom environment) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

**Baseline:** 79 tests pass (7 test files) as of Phase 1 completion. Phase 2 must not break existing tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REND-01 | GridNode dispatches to Container or Leaf by type | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-02 | Container renders flex row/column; sizes[] drives flex proportions | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-03 | Divider drag: pointer events, local state, single store write on pointerup | unit | `npx vitest run src/test/divider.test.tsx` | ❌ Wave 0 |
| REND-04 | Leaf empty state: dashed border, upload prompt | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-05 | Leaf filled state: img with correct object-fit | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-06 | Selected leaf border; hover reveals action bar | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-07 | Canvas scales 9:16 via transform; ResizeObserver | integration (smoke) | `npx vitest run src/test/canvas-wrapper.test.tsx` | ❌ Wave 0 |
| REND-08 | Safe zone overlay toggleable at 250px positions | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-09 | No whole-tree re-renders on single-node change | unit (React profiler / spy) | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |
| REND-10 | LeafNode wrapper has isolation: isolate in DOM | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run` (full suite, ~1.3s)
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/grid-rendering.test.tsx` — covers REND-01, REND-02, REND-04, REND-05, REND-06, REND-08, REND-09, REND-10
- [ ] `src/test/divider.test.tsx` — covers REND-03 (pointer event simulation, local state, store write timing)
- [ ] `src/test/canvas-wrapper.test.tsx` — covers REND-07 (ResizeObserver mock, scale calculation)

---

## Project Constraints (from CLAUDE.md)

All directives from CLAUDE.md apply. Key constraints for this phase:

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| React pinned to ^18.3.1 — do not allow React 19 | shadcn init must not upgrade React; verify package.json after init |
| Tailwind CSS v3.4.x — PIN TO v3, do not use v4 | shadcn init with v3 tailwind is standard; no v4 migration |
| Tailwind utility classes only (no inline styles on layout) | Use `style={{ flex: n }}` only for dynamic values from store (sizes[]); static layout via Tailwind classes |
| `@dnd-kit/react` (alpha/beta) — do NOT use | Divider drag uses native pointer events per decisions; dnd-kit not involved |
| Zustand v5: use `useShallow` from `zustand/react/shallow` if shallow comparison needed | Selectors return primitives (string type, boolean) where possible to avoid shallow comparison |
| React.memo required for recursive GridNode tree | Explicitly required by D-15 and REND-09 |
| Vitest + jsdom for tests — no Jest | All test files use Vitest import (`from 'vitest'`) |
| `isolation: isolate` on LeafNode — Safari fix | REND-10 is mandatory, not optional |
| ExportSurface always mounted — no conditional rendering | CanvasWrapper sets precedent: do not unmount canvas components |

---

## Sources

### Primary (HIGH confidence)

- Existing codebase (`src/types/index.ts`, `src/store/gridStore.ts`, `src/store/editorStore.ts`, `src/lib/tree.ts`, `src/index.css`, `src/Editor/CanvasArea.tsx`) — verified implementation state
- CLAUDE.md — locked tech stack decisions
- `.planning/phases/02-grid-rendering/02-CONTEXT.md` — locked design decisions D-01 through D-16
- `.planning/phases/02-grid-rendering/02-UI-SPEC.md` — visual contract, interaction states, component inventory

### Secondary (MEDIUM confidence)

- MDN Web Docs — `Element.setPointerCapture()`, ResizeObserver, CSS `flex` shorthand, `object-fit`, CSS transforms
- Zustand v5 docs (zustand.docs.pmnd.rs) — selector patterns, useShallow
- shadcn/ui docs (ui.shadcn.com) — Tooltip component API, init process

### Tertiary (LOW confidence)

- Safari 15 `flex-basis: 0%` behavior on nested flex — based on known cross-browser compatibility patterns; recommend testing against Safari 15 in validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed except @radix-ui/react-tooltip (installed by shadcn add tooltip)
- Architecture: HIGH — patterns match existing codebase conventions; all locked by CONTEXT.md decisions
- Pitfalls: HIGH for items 1-4 and 6-7 (well-documented patterns); MEDIUM for item 5 (shadcn init behavior)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries; shadcn CLI updates frequently but breaking changes are unlikely within 30 days)
