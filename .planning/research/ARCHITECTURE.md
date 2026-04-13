# Architecture Patterns: StoryGrid

**Domain:** Browser-based recursive split-grid collage editor
**Researched:** 2026-03-31
**Overall confidence:** HIGH (stack pre-decided; patterns verified against official docs and authoritative sources)

---

## Recommended Architecture

StoryGrid is a tree-state editor with two render surfaces: a scaled DOM preview and a hidden full-resolution export div. The component tree mirrors the data tree. State flows down via Zustand selectors; mutations flow up via store actions.

```
App
├── EditorLayout
│   ├── Toolbar              (undo/redo, zoom, export, safe zone toggle)
│   ├── CanvasArea
│   │   ├── CanvasWrapper    (transform: scale; aspect-ratio container)
│   │   │   └── GridNode     (recursive — root of the tree)
│   │   │       ├── ContainerNode  (flex row/column + Divider)
│   │   │       └── LeafNode       (media display + hover controls)
│   │   └── SafeZoneOverlay  (pointer-events: none; dashed guides)
│   └── Sidebar              (selection-aware cell controls)
└── ExportSurface            (position: fixed; left: -9999px; 1080×1920px)
    └── GridNode             (same tree, different render context)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `GridNode` | Dispatches to Container or Leaf based on node type | Reads own node from store |
| `ContainerNode` | Renders `display: flex` + children + Dividers | Reads children IDs; dispatches resize |
| `LeafNode` | Renders media / empty state; shows hover actions | Reads leaf data; dispatches split/media/remove |
| `Divider` | Captures pointer drag; updates sibling flex fractions | Dispatches `resizeSiblings` action |
| `CanvasWrapper` | Applies `transform: scale()` to fit viewport | Reads zoom from editorStore |
| `ExportSurface` | Hidden 1080×1920 div; targeted by html-to-image | Mounts same `<GridNode root>` |
| `Toolbar` | Global actions: undo/redo, zoom, export | Reads/dispatches gridStore + editorStore |
| `Sidebar` | Selection-scoped controls | Reads `selectedNodeId` from editorStore |

### Data Flow

```
User gesture
  → React event handler (Divider, LeafNode, Toolbar)
    → Zustand action (gridStore / editorStore)
      → Immer draft mutation
        → New state snapshot pushed to history[]
          → Zustand notifies all subscribers
            → Memoized components with matching selectors re-render
```

The export path is separate:

```
Export button click
  → exportStore.startExport()
    → React renders ExportSurface (or it is always mounted, visibility: hidden)
      → html-to-image.toPng(exportRef.current, { pixelRatio: 1, width: 1080, height: 1920 })
        → Promise resolves → trigger <a> download
          → exportStore.finishExport()
```

---

## State Management: Zustand + Immer

### Store Structure

Split into two stores to prevent unnecessary coupling:

**gridStore** — owns the tree and mutation history:

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'

interface GridState {
  root: GridNode
  history: GridNode[]   // past states
  future: GridNode[]    // redo stack
}

interface GridActions {
  splitNode: (nodeId: string, direction: SplitDirection) => void
  mergeNode: (nodeId: string) => void
  removeNode: (nodeId: string) => void
  resizeSiblings: (parentId: string, index: number, ratio: number) => void
  setMedia: (nodeId: string, media: MediaItem) => void
  updateCell: (nodeId: string, patch: Partial<LeafNode>) => void
  undo: () => void
  redo: () => void
}

export const useGridStore = create<GridState & GridActions>()(
  devtools(
    immer((set, get) => ({
      root: createLeaf('root'),
      history: [],
      future: [],

      splitNode: (nodeId, direction) =>
        set((state) => {
          // Push snapshot BEFORE mutation
          state.history.push(structuredClone(state.root))
          state.future = []
          // Mutate draft directly — Immer handles immutability
          const node = findNode(state.root, nodeId)
          if (!node) return
          const parent = findParent(state.root, nodeId)
          // ... split logic using pure tree functions
        }),

      undo: () =>
        set((state) => {
          const prev = state.history.pop()
          if (!prev) return
          state.future.push(structuredClone(state.root))
          state.root = prev
        }),

      redo: () =>
        set((state) => {
          const next = state.future.pop()
          if (!next) return
          state.history.push(structuredClone(state.root))
          state.root = next
        }),
    })),
  ),
)
```

**editorStore** — owns UI-only state (no undo/redo needed):

```typescript
interface EditorState {
  selectedNodeId: string | null
  zoom: number
  showSafeZone: boolean
  tool: 'select' | 'split-h' | 'split-v'
  isExporting: boolean
}
```

### Key Immer Rules

1. Mutate properties on the Immer draft directly — never reassign `state` itself.
2. Use `structuredClone` (not spread) for the history snapshot to avoid shared references.
3. All pure tree functions (`findNode`, `splitNode`, etc.) receive a mutable draft and return void, or receive plain objects and return new objects — pick one convention and stick to it. Recommendation: pure functions receive immutable objects and return new values; the Zustand action handler applies them to the draft.

Pattern for tree mutation with pure functions:

```typescript
splitNode: (nodeId, direction) =>
  set((state) => {
    state.history.push(structuredClone(state.root))
    state.future = []
    // splitNodePure returns a new root tree
    state.root = splitNodePure(state.root, nodeId, direction)
  }),
```

This keeps tree logic testable outside of Zustand and avoids accidental draft-escape bugs.

---

## Memoization Strategy

### Which Components to Memo

Every component in the recursive tree must be memoized. The tree can be 10–20 nodes deep; an un-memoized root re-render would cascade to all descendants.

| Component | `React.memo` | Custom comparator | Reason |
|-----------|-------------|-------------------|--------|
| `GridNode` | YES | No (ID-based selector avoids prop churn) | Dispatches to Container/Leaf |
| `ContainerNode` | YES | Compare `childrenIds` array (shallow) + `direction` | Children array changes only on split/remove |
| `LeafNode` | YES | Compare `nodeId` + `mediaUrl` + `isSelected` + `fitMode` | Media swaps most frequent change |
| `Divider` | YES | Compare `parentId` + `index` | Only identity needed; callbacks stable via `useCallback` |
| `SafeZoneOverlay` | YES | Compare `showSafeZone` only | Pure presentational |
| `Toolbar` | YES | No (reads shallow global flags) | Prevents re-render on tree change |

### Selector Pattern: Nodes Subscribe to Their Own Slice

Each node component subscribes only to its own node data, not the whole tree:

```typescript
// ContainerNode.tsx
const ContainerNode = React.memo(({ nodeId }: { nodeId: string }) => {
  const direction = useGridStore(
    useCallback((s) => findNode(s.root, nodeId)?.direction, [nodeId])
  )
  const childrenIds = useGridStore(
    useCallback((s) => findNode(s.root, nodeId)?.children.map(c => c.id) ?? [], [nodeId]),
    shallow   // shallow array compare — avoids re-render if IDs unchanged
  )
  // ...
})
```

This achieves surgical re-renders: only nodes whose data actually changed will re-render, regardless of mutations elsewhere in the tree.

### Stable Callbacks

All event handlers passed to memoized children must be stabilized:

```typescript
const handleSplit = useCallback(
  (direction: SplitDirection) => splitNode(nodeId, direction),
  [nodeId, splitNode]
)
```

`splitNode` from the store is already stable (Zustand actions never change identity).

### React Compiler (React 19+) Note

React Compiler (released stable in React 19 / announced Dec 2025) automatically memoizes components. If the project upgrades to React 19 during development, manual `React.memo` and `useCallback` can be removed. For React 18 (current project requirement), manual memoization is required.

---

## Recursive Tree Rendering

### Node Type Dispatch

`GridNode` is a thin dispatcher — it reads only the node type and renders either `ContainerNode` or `LeafNode`:

```typescript
const GridNode = React.memo(({ nodeId }: { nodeId: string }) => {
  const type = useGridStore(
    useCallback((s) => findNode(s.root, nodeId)?.type, [nodeId])
  )
  if (type === 'container') return <ContainerNode nodeId={nodeId} />
  return <LeafNode nodeId={nodeId} />
})
```

`ContainerNode` renders children recursively — each child is a `GridNode`:

```typescript
const ContainerNode = React.memo(({ nodeId }: { nodeId: string }) => {
  const { direction, childrenIds, sizes } = useContainerNode(nodeId)

  return (
    <div style={{ display: 'flex', flexDirection: direction, width: '100%', height: '100%' }}>
      {childrenIds.map((childId, i) => (
        <React.Fragment key={childId}>
          <div style={{ flex: sizes[i] }}>
            <GridNode nodeId={childId} />
          </div>
          {i < childrenIds.length - 1 && (
            <Divider parentId={nodeId} index={i} direction={direction} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
})
```

The `flex: sizes[i]` pattern (where `sizes` sums to 1.0 or uses arbitrary weights) drives proportional sizing. FlexLayout uses this same weight-based approach. No absolute pixel values — everything is fractional.

### Tree Data Shape

```typescript
type SplitDirection = 'horizontal' | 'vertical'

interface BaseNode {
  id: string
  type: 'container' | 'leaf'
}

interface ContainerNode extends BaseNode {
  type: 'container'
  direction: SplitDirection
  children: GridNode[]   // always length >= 2
  sizes: number[]        // parallel to children; values are flex weights (e.g., [0.5, 0.5])
}

interface LeafNode extends BaseNode {
  type: 'leaf'
  media: MediaItem | null
  fitMode: 'cover' | 'contain'
  backgroundColor: string
}

type GridNode = ContainerNode | LeafNode
```

---

## Drag-to-Resize Dividers

### Pointer Events Pattern

Use the Pointer Events API (not mouse events) for cross-device consistency. The divider manages its own drag state via `useRef` to avoid triggering React re-renders during drag:

```typescript
const Divider = React.memo(({ parentId, index, direction }: DividerProps) => {
  const dividerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startPos: number; startSizes: number[] } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeSiblings = useGridStore((s) => s.resizeSiblings)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const parent = dividerRef.current?.parentElement
    if (!parent) return
    containerRef.current = parent as HTMLDivElement
    const currentSizes = /* read from store snapshot */ []
    dragState.current = {
      startPos: direction === 'horizontal' ? e.clientX : e.clientY,
      startSizes: currentSizes,
    }
    dividerRef.current?.setPointerCapture(e.pointerId)
  }, [direction])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || !containerRef.current) return
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    const containerSize = direction === 'horizontal'
      ? containerRef.current.offsetWidth
      : containerRef.current.offsetHeight
    const delta = (currentPos - dragState.current.startPos) / containerSize
    // Compute new sizes, clamp to min (e.g., 0.1)
    const newSizes = computeNewSizes(dragState.current.startSizes, index, delta)
    resizeSiblings(parentId, newSizes)
  }, [direction, index, parentId, resizeSiblings])

  const onPointerUp = useCallback(() => {
    dragState.current = null
  }, [])

  return (
    <div
      ref={dividerRef}
      className={`divider ${direction === 'horizontal' ? 'cursor-col-resize w-2' : 'cursor-row-resize h-2'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
})
```

Critical details:
- `setPointerCapture` keeps events firing on the divider even when the pointer moves outside it — essential for fast drags.
- `dragState` is a `useRef`, not `useState` — avoids a re-render on every pointer move tick. Only the final `resizeSiblings` dispatch triggers a React re-render.
- During drag, consider throttling `resizeSiblings` dispatches via `requestAnimationFrame` if profiling shows jank. For 10–20 cells this is unlikely to be needed.
- Minimum cell size should be enforced in `computeNewSizes` (e.g., floor at 10% / 0.1 weight).
- Divider hit target: render a narrow visible line inside a wider invisible hit area (e.g., 2px visual, 12px click target via padding or pseudo-element).

---

## Dual-Render Strategy: Preview + Export

### Architecture

Two `<GridNode>` trees are mounted simultaneously sharing the same store state:

```
CanvasWrapper (transform: scale(zoom); will-change: transform)
  └── GridNode (root)   ← PREVIEW — visible, scaled

ExportSurface (position: fixed; left: -9999px; width: 1080px; height: 1920px; visibility: hidden)
  └── GridNode (root)   ← EXPORT — hidden, actual pixel dimensions
```

Both trees read from the same Zustand store. The export surface uses `visibility: hidden` (not `display: none`) so that layout and image rendering is computed by the browser.

### Scaling the Preview

```typescript
// CanvasWrapper.tsx
const CanvasWrapper = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const availH = containerRef.current.parentElement!.offsetHeight - 32 // padding
      const availW = containerRef.current.parentElement!.offsetWidth - 32
      const scaleByH = availH / 1920
      const scaleByW = availW / 1080
      setScale(Math.min(scaleByH, scaleByW, 1))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: 1080,
        height: 1920,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        willChange: 'transform',
      }}
    >
      <GridNode nodeId="root" />
    </div>
  )
}
```

This avoids the need for any `zoom` value in the store to be used by GridNode children — the transform is applied at the wrapper boundary only.

### Export Trigger

```typescript
// useExport.ts
export const useExport = (exportRef: RefObject<HTMLDivElement>) => {
  const setExporting = useEditorStore((s) => s.setExporting)

  const exportPng = useCallback(async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,    // already at native resolution; no upscaling needed
        style: {
          visibility: 'visible',   // override hidden state for capture
        },
      })
      const link = document.createElement('a')
      link.download = `storygrid-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      // Show error toast
    } finally {
      setExporting(false)
    }
  }, [exportRef, setExporting])

  return { exportPng }
}
```

---

## Export Architecture: html-to-image vs Canvas API

### Approach Comparison

| Criterion | html-to-image | Canvas API (manual) |
|-----------|--------------|---------------------|
| Implementation effort | Low — 5 lines | High — rewrite all rendering logic |
| CSS fidelity (object-fit) | MEDIUM — SVG serialization; object-fit rendered correctly in most browsers | HIGH — full control |
| CSS transforms | MEDIUM — basic transforms work; complex stacking contexts can fail | HIGH |
| Custom fonts | LOW-MEDIUM — requires font pre-loading; multiple bug reports (#534, #535) | HIGH — explicit font load |
| Border-radius | MEDIUM — generally works; edge cases with overflow | HIGH |
| Cross-origin images | LOW out-of-box — requires base64 pre-conversion of user images | HIGH |
| CORS (user-uploaded files) | N/A — user uploads become object URLs; no CORS issue | N/A |
| Safari compatibility | LOW — non-functional on some Safari versions (issue #569) | HIGH |
| Performance at 1080×1920 | MEDIUM — Chrome handles well; issues reported with Chrome 138+ (issues #542, #544) | HIGH |
| Maintenance | MEDIUM — active but with unresolved issues | N/A (bespoke) |

### Recommendation: html-to-image for MVP with Canvas fallback

Use `html-to-image.toPng()` as the default export path. It handles the use case correctly when:

1. All images are user-uploaded files (object URLs — no CORS issue).
2. The export div is at native resolution (no pixelRatio scaling needed).
3. Fonts used are system fonts or pre-loaded web fonts (bundle them as base64 or use `fontEmbedCSS` option).

Build the Canvas API fallback path as a Phase 4 option, triggered if html-to-image throws or produces a blank export. The Canvas fallback draws each `LeafNode` manually using `drawImage()` with `object-fit` logic replicated in JavaScript.

### Known html-to-image Issues to Mitigate

| Issue | Mitigation |
|-------|------------|
| Fonts not embedded | Call `toPng` twice in sequence — first call embeds fonts into the SVG, second call renders with them (known workaround) |
| Chrome 138+ freezing on complex DOMs | Limit tree depth; test and fall back to Canvas API if hang detected via timeout |
| Safari non-functional | Detect Safari via UA; show "Chrome/Firefox recommended for export" warning |
| `visibility: hidden` on export div | Pass `style: { visibility: 'visible' }` in options to override |
| Incomplete capture of off-screen content | Export div is `position: fixed` at negative left — still in layout flow, fully rendered |
| Repeating gradients broken | Avoid `repeating-linear-gradient` in Phase 5 canvas background; use `linear-gradient` instead |

### Double-Render Workaround for Fonts

```typescript
// Call toPng twice — first call forces font embedding
const warmup = await toPng(exportRef.current, { width: 1080, height: 1920 })
const final = await toPng(exportRef.current, { width: 1080, height: 1920 })
// Use `final` for download
```

This is a documented community workaround for html-to-image font embedding failures. It doubles export time but ensures fonts render.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Pixel Dimensions in Tree Nodes
**What:** Saving `{ width: 540, height: 1920 }` on each node instead of flex weights.
**Why bad:** Pixel values break when tree structure changes; flex weights compose automatically.
**Instead:** Store only `sizes: number[]` (flex weights) on container nodes. Pixel dimensions are derived at render time from the container's actual layout.

### Anti-Pattern 2: Single Monolithic Store Subscription
**What:** `const { root, selectedNodeId, zoom } = useGridStore()` in every component.
**Why bad:** Any state change (even `zoom`) re-renders every component subscribed to the whole store.
**Instead:** Each component subscribes to the minimum slice it needs. Use per-field selectors + `shallow` or `useShallow` hook.

### Anti-Pattern 3: Mutations Inside the Recursive Component
**What:** `LeafNode` calling `setMedia()` and updating tree structure directly inside render.
**Why bad:** Causes render-time side effects, potential infinite loops, React Strict Mode violations.
**Instead:** All mutations are triggered from event handlers only. Components are pure functions of state.

### Anti-Pattern 4: Re-rendering ExportSurface on Every State Change
**What:** ExportSurface always re-renders even when not exporting.
**Why bad:** Doubles all render work. The export surface is 1080×1920px — expensive.
**Instead:** ExportSurface renders conditionally when `isExporting` is true, OR is always mounted but uses `React.memo` aggressively so it only updates when tree data actually changes. Option B (always mounted) is preferred to avoid a layout + paint cycle at export time which would delay the capture.

### Anti-Pattern 5: Calling `findNode` on Every Render
**What:** `findNode(root, nodeId)` called in render body without memoization.
**Why bad:** O(n) traversal on every render. In a 20-node tree this is negligible, but it's a smell.
**Instead:** The Zustand selector already caches the result until state changes. Wrap in `useCallback` to stabilize the selector function identity.

### Anti-Pattern 6: Using `display: none` on the Export Surface
**What:** Hiding the export div with `display: none`.
**Why bad:** Browser does not compute layout for `display: none` elements — images may not load, dimensions are 0.
**Instead:** Use `visibility: hidden` + `position: fixed; left: -9999px`. This keeps the element in layout flow, fully rendered, just off-screen.

---

## Performance Optimization Patterns

### Pattern 1: ID-Based Component Keys
Always key recursive components by node ID, never by array index:
```tsx
{childrenIds.map((id) => <GridNode key={id} nodeId={id} />)}
```
This ensures React correctly reconciles the tree when nodes are split, merged, or reordered.

### Pattern 2: Separate Read and Write Hooks
```typescript
// Read: subscribes to re-renders
const media = useGridStore((s) => findNode(s.root, nodeId)?.media)
// Write: stable reference, no re-render subscription
const setMedia = useGridStore((s) => s.setMedia)
```
Never destructure both in one call — it creates a subscription to the whole state shape.

### Pattern 3: Throttle Divider Dispatches
During drag, dispatch at most once per animation frame:
```typescript
const rafId = useRef<number | null>(null)
const onPointerMove = (e) => {
  if (rafId.current) cancelAnimationFrame(rafId.current)
  rafId.current = requestAnimationFrame(() => {
    resizeSiblings(parentId, newSizes)
  })
}
```

### Pattern 4: History Size Cap
Cap undo history at 50 entries to prevent unbounded memory growth:
```typescript
state.history.push(structuredClone(state.root))
if (state.history.length > 50) state.history.shift()
```

### Pattern 5: `will-change: transform` on Canvas Wrapper
Promotes the scaled canvas to its own compositing layer, preventing the rest of the UI from repainting when only the canvas content changes.

---

## Build Order Dependencies

```
Phase 1: Types + Pure Tree Functions
  ↓ (required by everything)
Phase 2a: gridStore + editorStore (Zustand + Immer)
  ↓ (required before any rendering)
Phase 2b: GridNode + ContainerNode + LeafNode (rendering shell, no media)
  ↓
Phase 2c: Divider (requires ContainerNode to exist)
  ↓
Phase 3a: LeafNode media upload + file drop (requires LeafNode)
  ↓
Phase 3b: Sidebar + Toolbar (requires store actions exist)
  ↓
Phase 4a: ExportSurface mount (requires tree rendering complete)
  ↓
Phase 4b: html-to-image integration (requires ExportSurface)
  ↓
Phase 4c: Canvas API fallback (requires Phase 4b to know failure modes)
  ↓
Phase 5: Polish — templates, gap, border-radius, bg (requires full tree + export)
  ↓
Phase 6 (v1): Video cells + ffmpeg.wasm (requires full image pipeline)
```

Key dependency constraints:
- **Divider cannot be built before ContainerNode** — it is rendered inside ContainerNode's flex layout and needs a stable parent reference for dimension calculation.
- **ExportSurface cannot be tested before LeafNode renders images** — an empty tree exports fine but won't validate object-fit, border-radius, or font rendering.
- **undo/redo must be in the store from Phase 1** — retrofitting history onto an existing store requires restructuring all action signatures.
- **Font pre-loading must happen before Phase 4** — html-to-image embeds fonts at capture time; if fonts are lazily loaded, the first export attempt will use fallback fonts.

---

## Scalability Considerations

| Concern | At 4–6 cells (MVP) | At 20–30 cells | At 50+ cells |
|---------|-------------------|----------------|--------------|
| Re-render performance | Negligible | Needs `React.memo` everywhere | Needs virtualization (not needed for this product) |
| Tree traversal (`findNode`) | O(n) is fine | O(n) is fine | Consider node ID map (`Record<id, node>`) |
| History memory | 50 snapshots × ~1KB JSON = ~50KB | 50 × ~5KB = ~250KB | Cap history |
| Export time (html-to-image) | ~200ms | ~500ms | ~1–2s; show progress indicator |
| Undo history clone cost | Negligible | `structuredClone` of 30-node tree is still <1ms | Still fast |

A 50+ cell tree is not a use case StoryGrid needs to support (Instagram Story = 1–12 cells typically). The above patterns are sufficient for the foreseeable product scope without adding complexity.

---

## Sources

- [React.memo — React official docs](https://react.dev/reference/react/memo) — HIGH confidence
- [Zustand Immer middleware — official Zustand docs](https://zustand.docs.pmnd.rs/reference/integrations/immer-middleware) — HIGH confidence
- [html-to-image GitHub repository and issues](https://github.com/bubkoo/html-to-image) — HIGH confidence
- [FlexLayout tree model — caplin/FlexLayout GitHub](https://github.com/caplin/FlexLayout) — HIGH confidence (reference implementation of same architectural pattern)
- [Zustand selectors and re-rendering — DeepWiki](https://deepwiki.com/pmndrs/zustand/2.3-selectors-and-re-rendering) — MEDIUM confidence
- [html-to-image vs html2canvas comparison](https://npm-compare.com/dom-to-image,html-to-image,html2canvas) — MEDIUM confidence
- [React Compiler 1.0 stable release — InfoQ](https://www.infoq.com/news/2025/12/react-compiler-meta/) — HIGH confidence (React 19 / compiler stable; project uses React 18)
- [Zundo undo/redo middleware for Zustand](https://github.com/charkour/zundo) — MEDIUM confidence (considered but not recommended — adds dependency; snapshot approach is simpler for this use case)
- Font double-render workaround — LOW confidence (community pattern from GitHub issues; not officially documented)
