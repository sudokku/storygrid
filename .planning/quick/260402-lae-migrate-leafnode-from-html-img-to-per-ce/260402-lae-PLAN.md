---
phase: quick
plan: 260402-lae
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/export.ts
  - src/Grid/LeafNode.tsx
autonomous: true
must_haves:
  truths:
    - "Each leaf cell renders its image via a <canvas> element, not an <img>"
    - "Canvas preview is pixel-identical to export output (shared draw functions)"
    - "Pan/zoom redraws at 60fps via Zustand subscribe, not React re-render"
    - "Panning continues smoothly when pointer leaves cell bounds (setPointerCapture on correct element)"
    - "Zooming out re-clamps panX/panY so image edges never leave cell boundary"
    - "No visible 1px border/ring on media-filled, unselected cells"
  artifacts:
    - path: "src/lib/export.ts"
      provides: "drawPannedCoverImage and drawContainImage exported for reuse by LeafNode canvas"
    - path: "src/Grid/LeafNode.tsx"
      provides: "Canvas-based media rendering with Zustand-subscribed redraws"
  key_links:
    - from: "src/Grid/LeafNode.tsx"
      to: "src/lib/export.ts"
      via: "import drawPannedCoverImage, drawContainImage, drawCoverImage, loadImage"
      pattern: "import.*from.*lib/export"
    - from: "src/Grid/LeafNode.tsx"
      to: "src/store/gridStore.ts"
      via: "useGridStore.subscribe for canvas redraw outside React"
      pattern: "useGridStore\\.subscribe"
---

<objective>
Replace the HTML `<img>` render path in LeafNode with a per-cell `<canvas>` element that reuses the same draw functions from `export.ts`. This guarantees WYSIWYG between live preview and export, enables 60fps pan/zoom via direct Zustand subscription (bypassing React renders), and fixes pointer capture + pan clamping bugs.

Purpose: Eliminate visual discrepancy between preview and export, improve pan/zoom performance, fix UX bugs.
Output: Updated LeafNode.tsx with canvas rendering, updated export.ts with shared draw helpers.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/Grid/LeafNode.tsx
@src/lib/export.ts
@src/types/index.ts
@src/store/gridStore.ts
@src/store/editorStore.ts
@src/Grid/ContainerNode.tsx

<interfaces>
From src/types/index.ts:
```typescript
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  panX: number;    // percentage offset -100 to +100, default 0
  panY: number;    // percentage offset -100 to +100, default 0
  panScale: number; // 1.0-3.0, default 1
};
```

From src/lib/export.ts:
```typescript
export function drawPannedCoverImage(ctx, img, rect, objPos, panX, panY, panScale): void;
export function drawCoverImage(ctx, img, rect, objPos): void;
export function drawContainImage(ctx, img, rect, objPos, bgColor): void;
export function loadImage(dataUri: string): Promise<HTMLImageElement>;
export function parseObjectPosition(pos: string): ObjPos;
```

From src/store/gridStore.ts:
```typescript
updateCell: (nodeId: string, updates: Partial<Omit<LeafNode, 'type' | 'id'>>) => void;
// Store shape: { root: GridNode; mediaRegistry: Record<string, string>; ... }
```

From src/store/editorStore.ts:
```typescript
panModeNodeId: string | null;
canvasScale: number;
borderRadius: number;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract shared draw helper and add drawPannedContainImage to export.ts</name>
  <files>src/lib/export.ts</files>
  <action>
The existing `drawPannedCoverImage` in export.ts already handles cover mode with pan/zoom. Add a companion `drawPannedContainImage` that handles contain mode with pan/zoom using the same clip-translate-scale pattern:

1. Add `export function drawPannedContainImage(ctx, img, rect, objPos, bgColor, panX, panY, panScale)`:
   - `ctx.save()` then clip to rect (same as drawPannedCoverImage)
   - Fill rect with bgColor first (letterbox background)
   - Translate to cell center + panX/panY offset (same formula as drawPannedCoverImage)
   - Scale by panScale
   - Compute contain dimensions: if imgAspect > cellAspect then drawW=rect.w, drawH=rect.w/imgAspect, else drawH=rect.h, drawW=rect.h*imgAspect
   - Draw image centered at transformed origin with objPos offset
   - `ctx.restore()`

2. Also export a convenience `drawLeafToCanvas(ctx, img, rect, leaf)` function that encapsulates the full leaf rendering logic (the same logic currently in `renderNode` for leaf type). This function:
   - Takes `ctx: CanvasRenderingContext2D`, `img: HTMLImageElement`, `rect: {x,y,w,h}`, `leaf: LeafNode` (only the fields needed: fit, objectPosition, panX, panY, panScale, backgroundColor)
   - Computes objPos via parseObjectPosition
   - Determines hasPan from panX/panY/panScale
   - Calls the appropriate draw function (drawPannedCoverImage for cover+pan, drawCoverImage for cover+noPan, drawPannedContainImage for contain+pan, drawContainImage for contain+noPan)
   - Does NOT handle borderRadius clipping or empty-cell fill -- caller handles those

3. Update `renderNode` to call `drawLeafToCanvas` instead of duplicating the logic.

4. Do NOT add a drawPannedContainImage if contain mode doesn't actually support pan in the current UI -- check: the wheel handler and pointer handler in LeafNode don't restrict by fit mode, so pan IS supported in contain mode. Proceed with adding it.
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx vitest run src/test/canvas-export.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>drawPannedContainImage and drawLeafToCanvas exported from export.ts. renderNode uses drawLeafToCanvas. Existing export tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Replace img with canvas in LeafNode, wire Zustand subscribe for 60fps redraws, fix bugs</name>
  <files>src/Grid/LeafNode.tsx</files>
  <action>
Rewrite the media rendering in LeafNode.tsx to use a `<canvas>` element instead of `<img>`. Key changes:

**Canvas element setup:**
- Replace `imgRef` (HTMLImageElement) with `canvasRef` (HTMLCanvasElement) and keep a separate `imgElRef` for the loaded HTMLImageElement (never rendered to DOM).
- The canvas element: `<canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: mediaUrl ? 'block' : 'none' }} />`
- Canvas width/height attributes set to `cellW * dpr` and `cellH * dpr` where `dpr = window.devicePixelRatio || 1`. Update these in the ResizeObserver callback.
- CSS width/height via `className="absolute inset-0 w-full h-full"` ensures canvas fills cell in CSS pixels.

**Image loading:**
- When `mediaUrl` changes, call `loadImage(mediaUrl)` from export.ts. Store the resulting HTMLImageElement in `imgElRef.current`. Then trigger a redraw.
- Remove `handleImgLoad`, `naturalSize` state, `imgRenderParams` useMemo -- all replaced by canvas draw.

**Redraw function (defined as a stable ref callback):**
- `drawRef.current = () => { ... }` -- reads canvasRef, imgElRef, node state from `useGridStore.getState()`, cellSize from divRef.
- Gets ctx via `canvasRef.current.getContext('2d')`.
- Calls `ctx.scale(dpr, dpr)` after `ctx.setTransform(1,0,0,1,0,0)` (reset before each draw).
- Calls `ctx.clearRect(0, 0, cw, ch)`.
- Calls `drawLeafToCanvas(ctx, imgElRef.current, { x: 0, y: 0, w: cw, h: ch }, leafState)` from export.ts.
- If borderRadius > 0, apply clip with roundedRect before drawing (import roundedRect or inline the clip).

**Zustand subscription for 60fps redraws (bypass React):**
- In a useEffect, subscribe to gridStore: `useGridStore.subscribe((state, prev) => { ... })`.
- Inside callback: extract current leaf via `findNode(state.root, id)` and previous leaf via `findNode(prev.root, id)`. Compare panX, panY, panScale, fit, mediaId, objectPosition. If any changed, call `drawRef.current()`.
- Also subscribe to editorStore for `borderRadius` changes: `useEditorStore.subscribe(...)`.
- Return unsubscribe functions in cleanup.

**Also trigger redraw from ResizeObserver** -- when cell size changes, update canvas width/height attributes and call `drawRef.current()`.

**Fix: setPointerCapture on the wrapper div, not e.target:**
- In `handlePointerDown`, change `(e.target as HTMLElement).setPointerCapture(e.pointerId)` to `divRef.current?.setPointerCapture(e.pointerId)`. This ensures pointer capture is on the stable container div, not whatever child element (canvas, overlay) happened to be under the cursor. Same fix in `handlePointerUp`: `divRef.current?.releasePointerCapture(e.pointerId)`.

**Fix: Re-clamp panX/panY when panScale changes (wheel handler):**
- After computing `newScale` in the wheel handler, read current panX/panY and re-clamp them for the new scale using the same clamping formula from handlePointerMove (maxPanX = ((baseW * scale - cw) / 2 / cw) * 100). Compute baseW/baseH from imgElRef.current.naturalWidth/Height and cellSize.
- Call `updateCell(id, { panScale: newScale, panX: clampedPanX, panY: clampedPanY })`.

**Fix: Remove 1px border on media-filled cells:**
- In the `ringClass` computation (line 242-246), the empty-media case adds `border border-dashed border-[#333333]`. This is fine for empty cells.
- Check if there's any `outline` class on the wrapper div -- the STATE.md mentions "LeafNode border uses outline (not border)". If an outline is present on all cells, remove it from media-filled unselected cells. Ensure the wrapper div has NO border/outline/ring when the cell has media and is neither selected nor in pan mode (ringClass should be `''` in that case, which it already is in current code).
- The visible 1px line between cells is likely sub-pixel rendering from adjacent `overflow-hidden` divs. Add `style={{ backfaceVisibility: 'hidden' }}` to the wrapper div to force GPU layer and prevent sub-pixel gaps. If that doesn't help, the real fix may be `outline: 1px solid transparent` or checking if the canvas/bg needs to extend by 0.5px. Keep it minimal -- just ensure no explicit border/outline/ring classes are applied to media-filled unselected cells.

**Preserve all existing overlays:**
- Keep hover overlay, dim overlay, drop target highlight, ActionBar -- all as absolute-positioned divs on top of canvas. No changes to overlay logic.
- Keep all drag/drop handlers, click handlers, file input unchanged.

**Remove dead code:**
- Remove `imgRenderParams` useMemo
- Remove `naturalSize` state and its reset effect
- Remove `handleImgLoad` callback
- Remove `imgRef`
- Remove the `renderMedia()` function and its `<img>` elements
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
- LeafNode renders a canvas element instead of img for media display
- drawLeafToCanvas from export.ts is called for both preview and export (WYSIWYG guaranteed)
- Zustand subscribe triggers canvas redraw directly (no React setState for pan/zoom)
- setPointerCapture is on divRef.current so panning continues when pointer leaves cell
- Wheel zoom re-clamps panX/panY to prevent cover constraint violation
- No visible border/ring on media-filled unselected cells
- All existing tests pass
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/radu/Developer/storygrid && npx vitest run --reporter=verbose` -- all tests pass
2. `cd /Users/radu/Developer/storygrid && npx tsc --noEmit` -- no type errors
3. Manual: open app, add images to cells, verify canvas renders identically to export
4. Manual: enter pan mode, drag beyond cell boundary -- panning should continue
5. Manual: zoom out with scroll wheel -- image should re-clamp (no gap at edges)
6. Manual: check no 1px border visible between media-filled cells
</verification>

<success_criteria>
- LeafNode uses <canvas> elements for media rendering (no <img> in DOM when media loaded)
- Preview rendering reuses exact same draw functions as export pipeline
- Pan/zoom updates bypass React render cycle via Zustand subscribe
- setPointerCapture on wrapper div prevents pan-stop on pointer leave
- panX/panY re-clamped on panScale change
- No spurious borders on media cells
- All existing tests pass, TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/260402-lae-migrate-leafnode-from-html-img-to-per-ce/260402-lae-SUMMARY.md`
</output>
