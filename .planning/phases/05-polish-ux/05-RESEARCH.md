# Phase 5: Polish & UX - Research

**Researched:** 2026-04-01
**Domain:** React UX patterns — drag-and-drop cell swap (@dnd-kit), pan/zoom pointer events, canvas style settings (Zustand), template presets, dark theme, keyboard shortcuts, onboarding overlay
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Permanent "Canvas" section at top of sidebar (above cell-selected panel). Contains: Gap slider, Border Radius slider, Border Color picker, Background picker. No collapse.
- **D-02:** Sidebar sections top-to-bottom: Templates (toolbar popover), Canvas controls, Cell panel (shown when selected).
- **D-03:** Background: toggle Solid / Gradient. Solid = one color picker. Gradient = two color pickers + direction toggle (top→bottom, left→right, diagonal 135°). CSS `linear-gradient()` on canvas container.
- **D-04:** All style settings (gap, radius, border color, background) apply identically in both editor preview and the Canvas API export renderer (renderGridToCanvas). These values live in `editorStore` or a new `canvasSettingsStore`.
- **D-05:** "Templates" button in toolbar opens a 2×3 popover grid of thumbnail buttons. Six presets: 2×1 (stacked), 1×2 (side-by-side), 2×2 (quad), 3-row, L-shape, Mosaic.
- **D-06:** Applying template to non-empty grid → confirm dialog. On confirm: `clearGrid()` + build new tree. Pushes to undo history.
- **D-07:** Applying template to empty grid (single leaf, no media) → silent, no dialog.
- **D-08:** Pan mode entered via double-click on a selected cell with media. First click = select; double-click = pan mode.
- **D-09:** Pan mode visual: other cells get semi-transparent dimmed overlay (`bg-black/40`). Active cell shows amber/orange ring (different from blue selection ring).
- **D-10:** Pan/zoom state stored on leaf node as `panX: number` (% offset -100–+100), `panY: number`, `panScale: number` (1.0–3.0). Applied via CSS `transform: translate(panX%, panY%) scale(panScale)` on `<img>`.
- **D-11:** Drag in pan mode = reposition (updates panX/panY). Scroll in pan mode = zoom (updates panScale). Escape or click-outside exits pan mode.
- **D-12:** Hover action bar hidden while pan mode active. Pan mode state in `editorStore` as `panModeNodeId: string | null`.
- **D-13:** Drag handle button in top-left corner of filled cell's ActionBar. Icon: drag/move icon. Visible on hover.
- **D-14:** @dnd-kit handles the cell-swap drag. On drop: swap all leaf content (mediaId, fit, bgColor, panX, panY, panScale). Grid structure unchanged.
- **D-15:** Swap is single undoable action (pushes to undo history).
- **D-16:** Swap works between any two cells (empty↔filled, filled↔filled).
- **D-17:** Dark theme colors fully specified: bg `#0a0a0a`–`#141414`, surfaces `#1a1a1a`–`#222`, borders `#333`, accent `#3b82f6`. Apply consistently; no theming system — just update Tailwind utility classes.
- **D-18:** Editor outer canvas area: `#0f0f0f`. Collage canvas container shows user-selected background color.
- **D-19:** Shortcuts: `Ctrl+E` (export), `Delete`/`Backspace` (remove selected), `H` (split H), `V` (split V), `F` (toggle fit), `Escape` (deselect / exit pan mode). `Ctrl+Z`/`Ctrl+Shift+Z` already implemented.
- **D-20:** Global `keydown` listeners in `EditorShell`. No-ops when focus is in text input.
- **D-21:** 3-step highlight overlay shown once on first load. Controlled by `localStorage` key `storygrid_onboarding_done`. Dismissed/completed → never shown again.
- **D-22:** Steps: Step 1: highlights canvas → "Click a cell to select. Hover to see split options." / Step 2: highlights hover zone → "Drop images or click a cell to upload." / Step 3: highlights toolbar Export button → "Export your collage as a PNG."
- **D-23:** Always-visible [Skip] button. "Next →" advances. Final step: "Done" dismisses. Semi-transparent dark backdrop with highlighted cutout.
- **D-24:** Full-screen fixed overlay with `clip-path` or `box-shadow` spotlight on highlighted element. Popover tooltip card positioned near highlighted element.
- **D-25:** Minimum 1024px width. At 1024–1200px: sidebar collapses to icon-only or reduced width. Below 1024px: "StoryGrid works best on desktop" notice.

### Claude's Discretion

- Whether gap/radius/border settings live in `editorStore` (extending it) or a new `canvasSettingsStore`
- Template thumbnail rendering: small SVG previews or styled divs
- Exact L-shape and Mosaic tree structures
- Drag handle button position within ActionBar (top-left of bar, visually distinct)
- Onboarding overlay spotlight technique (box-shadow inset, clip-path, or portal)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLH-01 | Preset templates panel: 2×1, 1×2, 2×2, 3-row, L-shape, Mosaic | Tree construction patterns; toolbar popover pattern from ExportSplitButton |
| POLH-02 | Global gap slider (0–20px) between cells via CSS gap | CSS gap on flex containers; store extension pattern; Canvas API gap rendering |
| POLH-03 | Global border radius slider (0–24px) on all leaf cells | CSS border-radius + overflow:hidden on leaf; Canvas API roundRect() |
| POLH-04 | Border color picker for cell borders | CSS outline/ring on leaf; Canvas API stroke rendering |
| POLH-05 | Canvas background color picker with gradient option | CSS linear-gradient on canvas container; Canvas API fillRect with gradient |
| POLH-06 | Per-cell pan/zoom: double-click to enter pan mode, drag to reposition, scroll to scale | pointer events on img, CSS transform, double-click detection |
| POLH-07 | Cell-swap-by-drag via drag handle | @dnd-kit useDraggable + useDroppable, DndContext, swapLeafContent() tree function |
| POLH-08 | Dark editor theme — bg #0a0a0a–#141414, surfaces #1a1a1a–#222, borders #333, accent #3b82f6 | Tailwind utility class updates; existing dark structure already present |
| POLH-09 | Keyboard shortcuts: Ctrl+E, Delete/Backspace, H, V, F, Escape | Extend existing EditorShell keydown handler pattern |
| POLH-10 | First-time onboarding overlay with 3-step highlights | localStorage gate; box-shadow spotlight technique |
| POLH-11 | Gap/radius/background in both editor preview and exported PNG | Canvas API renderNode augmentation; store values passed to renderGridToCanvas |
| POLH-12 | Responsive at 1024px desktop min; sidebar collapses gracefully | Tailwind responsive breakpoints; min-w guard |
</phase_requirements>

---

## Summary

Phase 5 is a pure frontend polish phase. All technical decisions are locked from the CONTEXT.md discussion. No new npm packages are required — the project already has @dnd-kit/core v6.3.1, Zustand v5, Tailwind v3, and Vitest. The implementation draws from three main technical domains: (1) @dnd-kit useDraggable/useDroppable for cell swap with a drag handle, (2) pointer events for in-cell pan/zoom, and (3) canvas settings propagated through Zustand to both the live CSS editor and the Canvas API export renderer (`renderGridToCanvas`).

The biggest integration challenge is POLH-11: gap, border radius, and background must render identically in the CSS-based editor preview and the Canvas API renderer in `src/lib/export.ts`. This requires (a) store values passed as parameters to `renderGridToCanvas`, (b) gap rendering via dead-air rectangles between cells in the Canvas, and (c) border radius clipping via `ctx.roundRect()` (or `ctx.arc()` fallback). The Canvas API path is the source of truth for export — not the DOM.

The second largest challenge is the pan/zoom interaction (POLH-06). Double-click selection → pan mode requires careful event handling to prevent accidental split triggers. The implementation uses pointer capture (`setPointerCapture`) consistent with the existing Divider drag pattern, stores pan state on the LeafNode type, and applies it as a CSS transform on the `<img>` in the editor and as a translated/scaled crop in the Canvas export.

**Primary recommendation:** Extend `editorStore` with canvas settings (gap, borderRadius, borderColor, background) rather than a separate store — this phase has only 8 new state fields and no separate subscription topology concerns. All canvas-settings values must also be threaded through to `renderGridToCanvas`.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @dnd-kit/core | 6.3.1 | Cell swap drag interactions | `useDraggable` + `useDroppable`; do NOT use @dnd-kit/react (alpha) |
| @dnd-kit/utilities | 3.2.2 | CSS.Transform helpers | `CSS.Transform.toString()` for drag overlay transform |
| Zustand | 5.0.12 | Store for canvas settings + pan mode state | Extend editorStore; use `useShallow` for multi-value selectors |
| Immer (via zustand/middleware/immer) | 10.2.0 | gridStore mutations for swapCells action | Already in use |
| Tailwind CSS | 3.4.19 | Dark theme utility classes | Arbitrary value syntax `bg-[#0a0a0a]` already in use |
| lucide-react | 1.7.0 | GripVertical icon for drag handle | Already installed |
| Vitest + @testing-library/react | 2.1.9 / 16.3.2 | Phase tests | Already configured |

### No New Packages Required

The phase is implementable with existing dependencies. The @dnd-kit packages already support drag handles via the `useDraggable` `listeners` pattern (attach listeners to handle element only, not the whole cell). No new drag library, animation library, or color picker library is needed — native `<input type="color">` is already used in the sidebar for backgroundColor.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── store/
│   ├── editorStore.ts         # EXTEND: add panModeNodeId, gap, borderRadius, borderColor, background
│   └── gridStore.ts           # EXTEND: add swapCells(idA, idB) action
├── types/
│   └── index.ts               # EXTEND: LeafNode gets panX, panY, panScale fields
├── lib/
│   ├── tree.ts                # EXTEND: add swapLeafContent(root, idA, idB) pure function
│   └── export.ts              # EXTEND: renderGridToCanvas accepts CanvasSettings param
├── Editor/
│   ├── EditorShell.tsx        # EXTEND: add 6 new keydown shortcuts (Ctrl+E, Del, H, V, F, Escape)
│   ├── Sidebar.tsx            # EXTEND: add CanvasSettingsPanel above existing panels
│   ├── Toolbar.tsx            # EXTEND: add Templates popover button
│   └── Onboarding.tsx         # NEW: 3-step highlight overlay (mounted once in EditorShell)
├── Grid/
│   ├── LeafNode.tsx           # EXTEND: double-click → pan mode; pointer drag in pan mode; dnd-kit droppable
│   └── ActionBar.tsx          # EXTEND: add drag handle button (useDraggable listeners); hide in pan mode
└── components/
    └── TemplatesPopover.tsx   # NEW: 2×3 grid of template thumbnails
```

### Pattern 1: Extending editorStore with Canvas Settings

**What:** Add 8 new fields to `editorStore` — `panModeNodeId`, `gap`, `borderRadius`, `borderColor`, `backgroundMode`, `backgroundColor`, `backgroundGradientFrom`, `backgroundGradientTo`, `backgroundGradientDir`. No separate store.

**When to use:** When new state shares the same React lifecycle as existing editor state (zoom, selectedNodeId) and doesn't require separate subscription patterns.

**Example:**
```typescript
// In editorStore.ts — append to EditorState type:
panModeNodeId: string | null;
gap: number;           // 0–20, pixels
borderRadius: number;  // 0–24, pixels
borderColor: string;   // hex string e.g. '#333333'
backgroundMode: 'solid' | 'gradient';
backgroundColor: string;
backgroundGradientFrom: string;
backgroundGradientTo: string;
backgroundGradientDir: 'to-bottom' | 'to-right' | 'diagonal';

// Selectors in components:
const { gap, borderRadius } = useEditorStore(
  useShallow(s => ({ gap: s.gap, borderRadius: s.borderRadius }))
);
```

Use `useShallow` from `zustand/react/shallow` when selecting multiple fields — required in Zustand v5 (custom equality fn removed from `create`).

### Pattern 2: @dnd-kit Drag Handle for Cell Swap

**What:** `useDraggable` returns `{listeners, attributes, setActivatorNodeRef, transform, isDragging}`. Attach `listeners` + `attributes` to the drag handle button only (not the cell div). Use `useDroppable` on every LeafNode to make it a drop target. Wrap the whole editor in a single `DndContext` with `onDragEnd`.

**When to use:** Cell swap between arbitrary leaf nodes.

**Example:**
```typescript
// In ActionBar.tsx
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const { attributes, listeners, setActivatorNodeRef, isDragging } = useDraggable({
  id: `cell-drag-${nodeId}`,
  data: { nodeId },
});

// Drag handle button — listeners ONLY on the handle, not the cell
<button
  ref={setActivatorNodeRef}
  {...listeners}
  {...attributes}
  aria-label="Drag to swap"
>
  <GripVertical size={16} />
</button>

// In LeafNode.tsx — every leaf is a drop target
import { useDroppable } from '@dnd-kit/core';
const { setNodeRef: setDropRef, isOver } = useDroppable({
  id: `cell-drop-${id}`,
  data: { nodeId: id },
});

// In EditorShell.tsx (or CanvasArea parent) — single DndContext
import { DndContext } from '@dnd-kit/core';

function handleDragEnd(event: DragEndEvent) {
  const fromId = event.active.data.current?.nodeId;
  const toId = event.over?.data.current?.nodeId;
  if (fromId && toId && fromId !== toId) {
    swapCells(fromId, toId);
  }
}

<DndContext onDragEnd={handleDragEnd}>
  {/* ... editor tree ... */}
</DndContext>
```

**Critical:** The `DndContext` must wrap both the draggable and droppable elements. Place it in `EditorShell` wrapping the whole canvas area, not inside individual leaf nodes. This is the single source of truth for drag state.

### Pattern 3: Per-Cell Pan/Zoom via Pointer Events

**What:** Double-click enters pan mode (stored in `editorStore.panModeNodeId`). In pan mode, pointer events on the `<img>` element drive translation. Scroll drives scale. Consistent with the existing Divider pattern (`setPointerCapture`).

**When to use:** Per-cell image repositioning without leaving the cell bounds.

**Example:**
```typescript
// In LeafNode.tsx
const isPanMode = useEditorStore(s => s.panModeNodeId === id);

const handleDoubleClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (isSelected && hasMedia) {
    setPanModeNodeId(id);
  }
}, [isSelected, hasMedia, id, setPanModeNodeId]);

// Drag in pan mode
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (!isPanMode) return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  // store startX, startY in refs
}, [isPanMode]);

const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (!isPanMode || !e.buttons) return;
  // compute delta from startX/startY, update panX/panY via updateCell
}, [isPanMode]);

// Scroll in pan mode
const handleWheel = useCallback((e: React.WheelEvent) => {
  if (!isPanMode) return;
  e.preventDefault();
  // update panScale (clamp 1.0–3.0)
}, [isPanMode]);

// CSS transform on img
<img
  style={{
    transform: `translate(${panX}%, ${panY}%) scale(${panScale})`,
    transformOrigin: 'center center',
  }}
  ...
/>
```

**Pan mode exit:** Escape key in EditorShell keydown handler sets `panModeNodeId = null`. Click-outside: CanvasWrapper's `handleBgClick` already calls `setSelectedNode(null)` — add `setPanModeNodeId(null)` there too.

### Pattern 4: Canvas Settings in Export Renderer

**What:** `renderGridToCanvas` currently takes `(root, mediaRegistry, width, height)`. For POLH-11, it needs canvas settings. Extend signature to accept a `CanvasSettings` parameter.

**Critical:** Gap in the Canvas export requires **actual dead-air space** between cells — not CSS gap. This means adjusting child rects in `renderNode` to account for the gap value.

**Example:**
```typescript
export type CanvasSettings = {
  gap: number;           // pixels at 1080×1920 scale
  borderRadius: number;  // pixels
  borderColor: string;
  backgroundMode: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundGradientFrom: string;
  backgroundGradientTo: string;
  backgroundGradientDir: 'to-bottom' | 'to-right' | 'diagonal';
};

// In renderNode (container branch):
// Distribute gap: total gap = gap * (children.length - 1)
// Adjust child rects: shrink each by gap/2 on each shared edge

// Border radius clipping per leaf:
ctx.save();
ctx.beginPath();
ctx.roundRect(rect.x, rect.y, rect.w, rect.h, settings.borderRadius);
ctx.clip();
// ... draw image ...
ctx.restore();

// ctx.roundRect is available in Chrome 99+, Firefox 112+, Safari 15.4+
// Project targets Chrome 90+, Firefox 90+, Safari 15+ — need fallback for Safari 15.0–15.3
// Fallback: manual arc-based rounded rect path
```

**Safari 15 roundRect gap:** `ctx.roundRect()` is available in Safari 15.4+ but NOT Safari 15.0–15.3. Since the project targets Safari 15+, add a manual arc fallback using the classic rounded-rect path.

### Pattern 5: Template Tree Construction

**What:** Each preset is a pure function returning a `GridNode` tree built from `createLeaf()` and container nodes. Templates replace the grid via `clearGrid()` + direct tree injection.

**Preset tree structures:**

```typescript
// 2×1 stacked (two cells top/bottom)
{ type: 'container', direction: 'vertical', sizes: [1, 1],
  children: [createLeaf(), createLeaf()] }

// 1×2 side-by-side
{ type: 'container', direction: 'horizontal', sizes: [1, 1],
  children: [createLeaf(), createLeaf()] }

// 2×2 quad
{ type: 'container', direction: 'vertical', sizes: [1, 1],
  children: [
    { type: 'container', direction: 'horizontal', sizes: [1, 1],
      children: [createLeaf(), createLeaf()] },
    { type: 'container', direction: 'horizontal', sizes: [1, 1],
      children: [createLeaf(), createLeaf()] },
  ] }

// 3-row
{ type: 'container', direction: 'vertical', sizes: [1, 1, 1],
  children: [createLeaf(), createLeaf(), createLeaf()] }

// L-shape: big cell left, two stacked right
{ type: 'container', direction: 'horizontal', sizes: [2, 1],
  children: [
    createLeaf(),
    { type: 'container', direction: 'vertical', sizes: [1, 1],
      children: [createLeaf(), createLeaf()] },
  ] }

// Mosaic: top split 3-wide, bottom split 2-wide
{ type: 'container', direction: 'vertical', sizes: [1, 1],
  children: [
    { type: 'container', direction: 'horizontal', sizes: [1, 1, 1],
      children: [createLeaf(), createLeaf(), createLeaf()] },
    { type: 'container', direction: 'horizontal', sizes: [1, 1],
      children: [createLeaf(), createLeaf()] },
  ] }
```

**Critical:** Each container and leaf needs a fresh nanoid. Use `createLeaf()` (already handles this). Container IDs need `nanoid()` explicitly.

### Pattern 6: Onboarding Spotlight Technique

**What:** Box-shadow with a large inset spread creates a semi-transparent backdrop with a "cutout" around the highlighted element. No extra library needed.

**Example:**
```typescript
// Get bounding rect of highlighted element, then set box-shadow on overlay:
const rect = targetElement.getBoundingClientRect();
// The overlay is position:fixed, inset-0
// Use a combination of a dark overlay + box-shadow outline on the element itself:
// Option A: box-shadow on overlay with hole via clip-path
// Option B: add a highlight border to the target element + dark overlay with lower z-index

// Recommended: add a fixed "spotlight" div positioned over the target
const style = {
  position: 'fixed',
  top: rect.top - 4,
  left: rect.left - 4,
  width: rect.width + 8,
  height: rect.height + 8,
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
  borderRadius: 8,
  pointerEvents: 'none',
  zIndex: 9998,
};
```

This approach (box-shadow with huge spread) is the de facto browser-compatible spotlight method and avoids `clip-path` browser inconsistencies across Chrome/Firefox/Safari 15+.

### Anti-Patterns to Avoid

- **Subscribing to all of editorStore in LeafNode:** Use granular selectors — `s.panModeNodeId === id` only; do not subscribe to `gap` etc. in LeafNode (subscribe in ContainerNode for gap rendering, in LeafNode for border radius only).
- **Applying gap via `flex-gap` in ContainerNode and hoping Canvas export matches:** The Canvas API has no CSS gap — must compute dead-air space in the recursive `renderNode` function. If CSS gap is used in the editor but not replicated in Canvas, POLH-11 will fail.
- **Creating a new DndContext per LeafNode:** One `DndContext` at EditorShell (or CanvasWrapper) level. Multiple DndContext instances won't detect cross-context drag events.
- **Attaching drag listeners to the entire cell div:** Only attach `useDraggable.listeners` to the drag handle button. If attached to the whole cell, every click initiates a drag, breaking click-to-select and double-click-to-pan.
- **Storing panX/panY as pixels:** Store as percentage offsets (e.g., `panX: 10` = 10% from center). This makes the transform resolution-independent and identical between the scaled editor and the full-res Canvas export.
- **Using CSS transform on the img element for export:** The Canvas API export does not read CSS transforms. Pan/zoom must be re-implemented in `renderNode` using manual crop math (consistent with the existing `drawCoverImage` approach — extend it with panX/panY/panScale offsets).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag handle + drag events | Raw mouse/pointer event + coordinate tracking | @dnd-kit `useDraggable` with `listeners` on handle button | Handles pointer capture, accessibility attributes, multi-device support |
| Color picker | Custom SVG/Canvas color picker | Native `<input type="color">` | Already used for backgroundColor; zero-bundle cost; sufficient for MVP |
| Undo stack for cell swap | Custom history management | Existing `pushSnapshot` + `gridStore` action pattern | Consistency with other undoable actions |
| Confirmation dialog | Custom modal component | Native `window.confirm()` | Already used in `handleClearGrid` in Toolbar; consistent pattern |
| Template IDs | uuid/crypto | `nanoid()` (already imported in `tree.ts`) | Already in use, ESM-compatible |
| Backdrop with cutout | SVG masks, CSS clip-path | `box-shadow` with massive spread (e.g., `0 0 0 9999px rgba(0,0,0,0.7)`) | Browser-compatible across all targets, no SVG layout gotchas |

---

## Common Pitfalls

### Pitfall 1: Gap in Canvas Export Fails to Match CSS Gap

**What goes wrong:** Gap in the editor (CSS `gap` on flex container) produces visible spacing, but `renderGridToCanvas` fills cells edge-to-edge, giving a different result in the export PNG.

**Why it happens:** The Canvas API has no concept of flex gap. `renderNode` currently subdivides the 1080×1920 rect proportionally with no gap allocation.

**How to avoid:** When `settings.gap > 0`, reduce each child rect and offset their origins. For a container with N children and gap G:
- Total gap space = G * (N - 1) px
- Each child gets `(totalSize - totalGapSpace) * fraction` of remaining space
- Children are offset by `previousChildSize + G` increments

Apply gap in both horizontal and vertical containers.

**Warning signs:** Export PNG shows cells touching edge-to-edge while editor shows gaps.

### Pitfall 2: Double-Click Triggers Split Instead of Pan Mode

**What goes wrong:** Double-clicking a cell enters split flow (or triggers other click-time actions) before pan mode is recognized.

**Why it happens:** The existing `handleClick` in `LeafNode` calls `setSelectedNode` on first click. A double-click fires two click events + one dblclick event. If the split action bar is visible and the user double-clicks on a split button, the second click fires as a button click.

**How to avoid:** 
1. Add an `onDoubleClick` handler on the leaf div (not the ActionBar buttons).
2. In the double-click handler: if `isSelected && hasMedia` → enter pan mode + `e.stopPropagation()`.
3. The ActionBar `isHovered` visibility should check `!isPanMode` before rendering action buttons.
4. Confirmed in D-12: "The hover action bar is hidden while pan mode is active."

**Warning signs:** Users report accidental splits when trying to reposition images.

### Pitfall 3: Pan State Lost on Undo

**What goes wrong:** After editing panX/panY, hitting Undo reverts to old pan state — which is unexpected if the user considers undo to revert "content" changes only, not repositioning.

**Why it happens:** panX, panY, panScale are stored on LeafNode (per D-10), which is part of the undo-tracked tree.

**How to avoid:** This is intentional per the decisions — panX/panY IS part of the undoable tree (D-10 says it lives on the leaf node, which is always snapshotted). The implementation should use `updateCell()` for pan changes, which calls `pushSnapshot()`. This is correct behavior. Tests should verify pan state appears in snapshots.

### Pitfall 4: Safari 15.0–15.3 ctx.roundRect() Not Available

**What goes wrong:** `ctx.roundRect()` crashes or is undefined in Safari 15.0–15.3.

**Why it happens:** `roundRect()` was added to the Canvas 2D API in Safari 15.4. The project targets Safari 15+.

**How to avoid:** Wrap in a feature check or always use the manual arc fallback:
```typescript
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Arc fallback (works in all Safari 15.x)
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
```

### Pitfall 5: DndContext Drag Blocks Pointer Events Inside CanvasWrapper

**What goes wrong:** When a drag is in progress from a cell's drag handle, pointer events on the canvas (e.g., clicking cells, scrolling) are intercepted by the DndContext, causing unresponsive UI.

**Why it happens:** `DndContext` wraps the canvas with a document-level pointer event listener during active drag.

**How to avoid:** Place `DndContext` at the `EditorShell` level (wrapping everything). This is the standard @dnd-kit pattern. Drag interactions are short-lived; the performance note in CLAUDE.md about @dnd-kit Issue #389 only applies to large sortable lists (this project has ≤20 cells).

### Pitfall 6: Template Application Bypasses undo History

**What goes wrong:** Applying a template calls `clearGrid()` which explicitly resets history (per Phase 3 decision: "clearGrid does NOT push history snapshot — it IS the reset"). Template application would then be unrecoverable with Undo.

**Why it happens:** `clearGrid()` sets `history = [{ root: freshTree }]` and `historyIndex = 0`.

**How to avoid:** Template application must NOT use `clearGrid()` for the tree replacement. Instead: push a snapshot of the current state, then replace root with the template tree, keeping the history intact. Implement as a new `applyTemplate(templateRoot: GridNode)` action in gridStore that calls `pushSnapshot()` then sets `state.root = templateRoot` and clears mediaRegistry. Per D-06.

### Pitfall 7: Pan/Zoom Transform in Export Not Matching Editor

**What goes wrong:** CSS transform on `<img>` in the editor shows the image offset/scaled, but the Canvas API export ignores CSS and draws the image at 100% covering the cell, producing a different result.

**Why it happens:** `renderGridToCanvas` reads `node.objectPosition` for cover mode, but does not read `panX`, `panY`, `panScale`.

**How to avoid:** In `drawCoverImage` (or a new `drawPannedImage` variant), incorporate panX/panY as positional offsets on the source crop window, and panScale as an additional zoom factor on the crop region. The math:
- `panScale` zooms in: reduce the source crop region by `1/panScale`
- `panX/panY` shift: offset the crop origin within the remaining headroom

---

## Code Examples

### swapLeafContent — pure tree function

```typescript
// Source: tree.ts pattern (consistent with updateLeaf/mapNode)
// Swaps all leaf content fields between two leaf nodes
export function swapLeafContent(root: GridNode, idA: string, idB: string): GridNode {
  const leafA = findNode(root, idA) as LeafNode | null;
  const leafB = findNode(root, idB) as LeafNode | null;
  if (!leafA || leafA.type !== 'leaf') return root;
  if (!leafB || leafB.type !== 'leaf') return root;

  const contentA = {
    mediaId: leafA.mediaId,
    fit: leafA.fit,
    backgroundColor: leafA.backgroundColor,
    panX: leafA.panX ?? 0,
    panY: leafA.panY ?? 0,
    panScale: leafA.panScale ?? 1,
  };
  const contentB = {
    mediaId: leafB.mediaId,
    fit: leafB.fit,
    backgroundColor: leafB.backgroundColor,
    panX: leafB.panX ?? 0,
    panY: leafB.panY ?? 0,
    panScale: leafB.panScale ?? 1,
  };

  let result = updateLeaf(root, idA, contentB);
  result = updateLeaf(result, idB, contentA);
  return result;
}
```

### LeafNode type extension

```typescript
// In src/types/index.ts
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  // Phase 5 pan/zoom additions
  panX: number;    // percentage offset, -100 to +100; default 0
  panY: number;    // percentage offset, -100 to +100; default 0
  panScale: number; // 1.0–3.0; default 1
};
```

### Keyboard shortcut additions in EditorShell

```typescript
// Extend handleKeyDown in EditorShell.useEffect:
const { selectedNodeId, panModeNodeId, setPanModeNodeId, setSelectedNode } = useEditorStore(...);
const { split, remove, updateCell } = useGridStore(...);
const exportRef = useRef<{ trigger?: () => void }>({}); // passed to ExportSplitButton

if (e.key === 'Escape') {
  e.preventDefault();
  if (panModeNodeId) { setPanModeNodeId(null); }
  else { setSelectedNode(null); }
} else if (e.key === 'Delete' || e.key === 'Backspace') {
  if (selectedNodeId) { e.preventDefault(); remove(selectedNodeId); setSelectedNode(null); }
} else if (e.key === 'h' || e.key === 'H') {
  if (selectedNodeId) { e.preventDefault(); split(selectedNodeId, 'horizontal'); }
} else if (e.key === 'v' || e.key === 'V') {
  if (selectedNodeId) { e.preventDefault(); split(selectedNodeId, 'vertical'); }
} else if (e.key === 'f' || e.key === 'F') {
  if (selectedNodeId) { e.preventDefault(); /* toggle fit via updateCell */ }
} else if (e.ctrlKey && e.key === 'e') {
  e.preventDefault();
  exportRef.current?.trigger?.();
}
```

### Background CSS rendering (editor side)

```typescript
// In CanvasWrapper.tsx — applied to the canvas surface div:
function buildBackgroundStyle(settings: CanvasSettings): React.CSSProperties {
  if (settings.backgroundMode === 'solid') {
    return { background: settings.backgroundColor };
  }
  const dirMap = {
    'to-bottom': 'to bottom',
    'to-right': 'to right',
    'diagonal': '135deg',
  };
  const dir = dirMap[settings.backgroundGradientDir];
  return {
    background: `linear-gradient(${dir}, ${settings.backgroundGradientFrom}, ${settings.backgroundGradientTo})`,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| html-to-image DOM capture (Phase 4 plan) | Canvas API `renderGridToCanvas` (quick task 260401-oca) | Export now uses Canvas API — POLH-11 must implement gap/radius in Canvas renderer, not DOM |
| No pan/zoom on images | Per-cell CSS transform + Canvas crop offsets | Phase 5 addition |
| No cell swap | @dnd-kit drag handle + swapLeafContent() | Phase 5 addition |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely in-browser code changes. No external CLIs, services, databases, or runtimes beyond the existing Node/npm toolchain (already verified in prior phases).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vite.config.ts` (inline `test:` key) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLH-01 | Templates popover renders 6 preset buttons | unit | `npx vitest run src/test/phase05-p01-templates.test.tsx` | ❌ Wave 0 |
| POLH-01 | Template application replaces grid tree (non-empty with confirm, empty silent) | unit | `npx vitest run src/test/phase05-p01-templates.test.tsx` | ❌ Wave 0 |
| POLH-02 | Gap slider updates editorStore.gap; ContainerNode applies CSS gap | unit | `npx vitest run src/test/phase05-p01-canvas-settings.test.tsx` | ❌ Wave 0 |
| POLH-03 | Border radius slider updates editorStore.borderRadius | unit | `npx vitest run src/test/phase05-p01-canvas-settings.test.tsx` | ❌ Wave 0 |
| POLH-04 | Border color picker updates editorStore.borderColor | unit | `npx vitest run src/test/phase05-p01-canvas-settings.test.tsx` | ❌ Wave 0 |
| POLH-05 | Background solid/gradient toggle updates store; CSS applied to canvas surface | unit | `npx vitest run src/test/phase05-p01-canvas-settings.test.tsx` | ❌ Wave 0 |
| POLH-06 | Double-click on selected media cell enters pan mode (panModeNodeId set) | unit | `npx vitest run src/test/phase05-p02-pan-zoom.test.tsx` | ❌ Wave 0 |
| POLH-06 | Escape exits pan mode (panModeNodeId cleared) | unit | `npx vitest run src/test/phase05-p02-pan-zoom.test.tsx` | ❌ Wave 0 |
| POLH-07 | swapLeafContent() pure function swaps all leaf fields | unit | `npx vitest run src/test/phase05-p02-cell-swap.test.ts` | ❌ Wave 0 |
| POLH-07 | gridStore.swapCells() calls pushSnapshot and updates tree | unit | `npx vitest run src/test/phase05-p02-cell-swap.test.ts` | ❌ Wave 0 |
| POLH-08 | EditorShell outer bg is dark (#0f0f0f or equivalent) | unit | `npx vitest run src/test/phase05-p03-dark-theme.test.tsx` | ❌ Wave 0 |
| POLH-09 | Delete key removes selected cell; H/V split selected; F toggles fit; Ctrl+E triggers export | unit | `npx vitest run src/test/phase05-p03-shortcuts.test.tsx` | ❌ Wave 0 |
| POLH-09 | Shortcuts are no-ops when focus is in INPUT (extends existing keyboard test pattern) | unit | `npx vitest run src/test/phase05-p03-shortcuts.test.tsx` | ❌ Wave 0 |
| POLH-10 | Onboarding overlay renders on first load (no localStorage key) | unit | `npx vitest run src/test/phase05-p03-onboarding.test.tsx` | ❌ Wave 0 |
| POLH-10 | Onboarding overlay NOT rendered when localStorage key present | unit | `npx vitest run src/test/phase05-p03-onboarding.test.tsx` | ❌ Wave 0 |
| POLH-11 | renderGridToCanvas applies gap: renders dead-air between cells | unit | `npx vitest run src/test/phase05-p02-export-settings.test.ts` | ❌ Wave 0 |
| POLH-11 | renderGridToCanvas applies canvas background color | unit | `npx vitest run src/test/phase05-p02-export-settings.test.ts` | ❌ Wave 0 |
| POLH-12 | Below 1024px: "works best on desktop" notice shown | unit | `npx vitest run src/test/phase05-p03-responsive.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All test files for this phase are new. Wave 0 must create:

- [ ] `src/test/phase05-p01-templates.test.tsx` — covers POLH-01
- [ ] `src/test/phase05-p01-canvas-settings.test.tsx` — covers POLH-02, POLH-03, POLH-04, POLH-05
- [ ] `src/test/phase05-p02-pan-zoom.test.tsx` — covers POLH-06
- [ ] `src/test/phase05-p02-cell-swap.test.ts` — covers POLH-07 (pure function + store action)
- [ ] `src/test/phase05-p02-export-settings.test.ts` — covers POLH-11
- [ ] `src/test/phase05-p03-dark-theme.test.tsx` — covers POLH-08
- [ ] `src/test/phase05-p03-shortcuts.test.tsx` — covers POLH-09
- [ ] `src/test/phase05-p03-onboarding.test.tsx` — covers POLH-10
- [ ] `src/test/phase05-p03-responsive.test.tsx` — covers POLH-12

Existing test infrastructure (jsdom, setup.ts ResizeObserver polyfill, @testing-library/react) covers all new needs. No additional setup required.

**Canvas API mock note:** `renderGridToCanvas` tests in jsdom require mocking `HTMLCanvasElement.getContext`. The existing canvas-export.test.ts already sets this up — use the same mock pattern.

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are binding on the planner:

| Constraint | Directive |
|------------|-----------|
| Tech stack | Vite 8 + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — no substitutions |
| Tailwind version | Pin to v3.4.x — DO NOT use v4 |
| React version | Pin to 18 — DO NOT allow v19 |
| @dnd-kit version | Use @dnd-kit/core ^6.3.1 — DO NOT migrate to @dnd-kit/react (alpha) |
| @dnd-kit for UI drag | @dnd-kit handles drag-between-cells; native drag events for file-from-desktop drops |
| Zustand v5 shallow | Use `useShallow` from `zustand/react/shallow` for multi-value selectors — not custom equality fn |
| Immer direct dep | `immer` is a direct dependency — already installed, required for store middleware |
| No html2canvas | html2canvas cannot handle CSS transforms reliably — already replaced by Canvas API |
| Tailwind classes only | All editor layout uses Tailwind utility classes only (no inline style for theming) |
| Export engine | Canvas API used (quick task 260401-oca) — not html-to-image |

---

## Open Questions

1. **Export-side pan/zoom math for cover mode**
   - What we know: `drawCoverImage` implements cover-fit using `objectPosition` (0–1 fractions). `panX/panY` are percentage offsets (-100–+100), `panScale` is 1.0–3.0.
   - What's unclear: The exact crop math when combining `panScale` + `panX/panY` + `objectPosition`. Need to verify whether `objectPosition` becomes redundant once pan/zoom is active, or if they compose.
   - Recommendation: Treat `panX/panY` as the primary repositioning mechanism in pan mode. If `panScale > 1 || panX != 0 || panY != 0`, use pan-mode crop math exclusively and ignore objectPosition for that cell. Document this in code comments.

2. **DndContext placement relative to existing CanvasWrapper click handler**
   - What we know: CanvasWrapper has `handleBgClick` which deselects on canvas background click. DndContext wraps the canvas and fires `onDragEnd` after pointer up.
   - What's unclear: Does the DndContext `pointerup` event suppress the `onClick` on the canvas background?
   - Recommendation: Place DndContext above CanvasWrapper (in EditorShell), not inside. Monitor for click-suppression issues in testing; add `e.stopPropagation()` in drag end handler if needed.

3. **Template confirm dialog re `window.confirm`**
   - What we know: `window.confirm` is already used in Toolbar (handleClearGrid) for the "Clear canvas" confirmation.
   - What's unclear: Whether the planner should match this pattern for template application confirm (D-06) for consistency.
   - Recommendation: Yes — use `window.confirm` for template application to non-empty grids. Consistent with existing pattern, zero bundle cost.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/store/editorStore.ts`, `src/store/gridStore.ts`, `src/types/index.ts`, `src/lib/tree.ts`, `src/lib/export.ts` — direct inspection
- Codebase: `src/Grid/LeafNode.tsx`, `src/Grid/ActionBar.tsx`, `src/Grid/ContainerNode.tsx`, `src/Grid/CanvasWrapper.tsx` — direct inspection
- Codebase: `src/Editor/EditorShell.tsx`, `src/Editor/Toolbar.tsx`, `src/Editor/Sidebar.tsx` — direct inspection
- `CLAUDE.md` — project tech stack constraints
- `05-CONTEXT.md` — all locked decisions (D-01 through D-25)

### Secondary (MEDIUM confidence)

- [@dnd-kit useDraggable docs](https://dndkit.com/api-documentation/draggable/usedraggable) — attributes/listeners pattern for drag handles
- [@dnd-kit useDroppable docs](https://dndkit.com/api-documentation/droppable/usedroppable) — setNodeRef + isOver + data pattern
- MDN Canvas API: `ctx.roundRect()` — available Chrome 99+, Firefox 112+, Safari 15.4+ (not 15.0–15.3)

### Tertiary (LOW confidence)

- Box-shadow spotlight technique for onboarding overlays — multiple community tutorials; specific implementation varies

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use; versions verified from package.json
- Architecture: HIGH — patterns derived directly from existing codebase analysis
- Canvas export gap/radius: HIGH — Canvas API behavior is well-documented; Safari roundRect limitation is verified
- @dnd-kit drag handle pattern: HIGH — verified from official dnd-kit docs
- Pitfalls: HIGH — derived from codebase analysis and known API constraints

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable ecosystem; @dnd-kit maintenance is slow but API stable)
