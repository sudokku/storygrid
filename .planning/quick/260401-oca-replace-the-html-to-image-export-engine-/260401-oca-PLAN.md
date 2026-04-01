---
phase: quick
plan: 260401-oca
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/export.ts
  - src/Grid/ExportSurface.tsx
  - src/Grid/ExportModeContext.tsx
  - src/Editor/ExportSplitButton.tsx
  - src/Editor/EditorShell.tsx
  - src/Editor/Toolbar.tsx
  - src/Grid/LeafNode.tsx
  - src/Grid/ContainerNode.tsx
  - src/test/phase04-01-task1.test.tsx
  - src/test/phase04-01-task2.test.tsx
  - src/test/phase04-02-task1.test.tsx
  - package.json
autonomous: true
must_haves:
  truths:
    - "Export produces a 1080x1920 PNG/JPEG from the grid tree without any DOM capture"
    - "Object-fit cover/contain and objectPosition are rendered correctly on the canvas"
    - "Container nodes split bounding rects by sizes array weights and direction"
    - "Empty leaves render with white background (no black patches)"
    - "html-to-image is fully removed from the codebase and package.json"
    - "ExportSurface and ExportModeContext are deleted; no components reference them"
    - "ExportSplitButton reads root/mediaRegistry from store directly (no exportRef)"
  artifacts:
    - path: "src/lib/export.ts"
      provides: "Canvas API export: renderGridToCanvas + exportGrid"
      min_lines: 100
    - path: "src/Editor/ExportSplitButton.tsx"
      provides: "Export trigger reading from store, no exportRef"
    - path: "src/Editor/EditorShell.tsx"
      provides: "No ExportSurface, no exportRef"
    - path: "src/Editor/Toolbar.tsx"
      provides: "No exportRef prop"
  key_links:
    - from: "src/lib/export.ts"
      to: "useGridStore"
      via: "receives root + mediaRegistry args"
      pattern: "root.*mediaRegistry"
    - from: "src/Editor/ExportSplitButton.tsx"
      to: "src/lib/export.ts"
      via: "calls exportGrid with root and mediaRegistry from store"
      pattern: "exportGrid"
---

<objective>
Replace the html-to-image DOM-capture export engine with a Canvas API implementation that walks the Zustand grid tree, computes bounding boxes from flex ratios, and draws images with correct object-fit/objectPosition. Remove all DOM-capture infrastructure (ExportSurface, ExportModeContext, exportRef plumbing).

Purpose: html-to-image is abandoned with unfixable bugs (blank output, Chrome 138 JPEG regression). Canvas API is zero-dependency, deterministic, and handles object-fit correctly.
Output: New Canvas-based export.ts, cleaned components, updated tests, html-to-image removed from deps.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/types/index.ts
@src/lib/tree.ts
@src/store/gridStore.ts
@src/lib/export.ts
@src/Grid/ExportSurface.tsx
@src/Grid/ExportModeContext.tsx
@src/Editor/ExportSplitButton.tsx
@src/Editor/EditorShell.tsx
@src/Editor/Toolbar.tsx
@src/Grid/LeafNode.tsx
@src/Grid/ContainerNode.tsx
@src/test/phase04-01-task1.test.tsx
@src/test/phase04-01-task2.test.tsx
@src/test/phase04-02-task1.test.tsx
@src/test/toolbar.test.tsx
@src/test/editor-shell.test.tsx

<interfaces>
<!-- Types the executor needs -->

From src/types/index.ts:
```typescript
export type SplitDirection = 'horizontal' | 'vertical';

export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
};

export type ContainerNode = {
  type: 'container';
  id: string;
  direction: SplitDirection;
  sizes: number[];
  children: GridNode[];
};

export type GridNode = ContainerNode | LeafNode;
```

From src/store/gridStore.ts (relevant selectors):
```typescript
const root = useGridStore(s => s.root);        // GridNode
const mediaRegistry = useGridStore(s => s.mediaRegistry); // Record<string, string> — mediaId -> data URI
```

From src/lib/tree.ts:
```typescript
export function getAllLeaves(root: GridNode): LeafNode[];
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite export.ts with Canvas API renderer</name>
  <files>src/lib/export.ts, src/test/canvas-export.test.ts</files>
  <behavior>
    - renderGridToCanvas(root, mediaRegistry, width=1080, height=1920) returns an OffscreenCanvas/HTMLCanvasElement with correct pixel dimensions
    - Container nodes split their bounding rect: horizontal splits width by sizes weights, vertical splits height by sizes weights
    - Leaf nodes with no media fill their rect with '#ffffff' (or leaf.backgroundColor if set)
    - Leaf nodes with media and fit='cover' draw the image cropped to fill the cell (9-arg drawImage with source crop)
    - Leaf nodes with media and fit='contain' draw the image letterboxed within the cell, filling remaining area with '#ffffff' (or leaf.backgroundColor)
    - objectPosition parsing: 'center center' (default), 'left top', '25% 75%', named positions map to 0/50/100% offsets for crop origin
    - exportGrid(root, mediaRegistry, format, quality, onStage) returns a data URL string; calls onStage('preparing') then onStage('exporting')
    - exportGrid with format='jpeg' and quality=0.8 produces a JPEG data URL with the given quality
    - downloadDataUrl(dataUrl, filename) triggers anchor download (keep existing implementation)
    - hasVideoCell(root, mediaRegistry) returns true if any leaf has video media (keep existing implementation)
    - Nested containers: a container inside a container correctly subdivides the inner bounding rect
  </behavior>
  <action>
    Rewrite `src/lib/export.ts` to replace html-to-image with Canvas API:

    1. Keep existing `downloadDataUrl` and `hasVideoCell` functions unchanged (they have no html-to-image dependency).

    2. Remove the `import { toPng, toJpeg } from 'html-to-image'` import.

    3. Add a `Rect` type: `{ x: number; y: number; w: number; h: number }`.

    4. Add `parseObjectPosition(pos: string): { x: number; y: number }` — converts CSS object-position strings to 0-1 fractions:
       - Named keywords: 'left'=0, 'center'=0.5, 'right'=1, 'top'=0, 'bottom'=1
       - Percentages: '25%' = 0.25
       - Default to { x: 0.5, y: 0.5 } for 'center center' or undefined

    5. Add `loadImage(dataUri: string): Promise<HTMLImageElement>` — creates Image, sets src, resolves on load, rejects on error.

    6. Add `drawCoverImage(ctx, img, rect, objPos)` — 9-argument drawImage for cover fit:
       - Compute source crop: compare img aspect ratio to cell aspect ratio
       - If image is wider than cell: crop horizontally, use objPos.x to shift crop origin
       - If image is taller than cell: crop vertically, use objPos.y to shift crop origin
       - Draw with `ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h)`

    7. Add `drawContainImage(ctx, img, rect, objPos, bgColor)` — letterbox fit:
       - Fill rect with bgColor first
       - Scale image to fit within rect maintaining aspect ratio
       - Use objPos to position the scaled image within the rect
       - Draw with 9-arg drawImage

    8. Add `async function renderNode(ctx, node, rect, mediaRegistry, imageCache)` — recursive renderer:
       - If node.type === 'leaf':
         - If no mediaId or no data URI: fill rect with node.backgroundColor ?? '#ffffff'
         - Else: load image (with cache), call drawCoverImage or drawContainImage based on node.fit
       - If node.type === 'container':
         - Compute total weight = sum(node.sizes)
         - For each child, compute sub-rect based on direction:
           - horizontal: split width proportionally, same height
           - vertical: split height proportionally, same width
         - Recurse into each child with its sub-rect

    9. Add `async function renderGridToCanvas(root, mediaRegistry, width=1080, height=1920): Promise<HTMLCanvasElement>`:
       - Create canvas element, set width/height
       - Get 2d context, fill with '#ffffff'
       - Call renderNode(ctx, root, {x:0, y:0, w:width, h:height}, mediaRegistry, new Map())
       - Return canvas

    10. Rewrite `exportGrid` signature to: `exportGrid(root: GridNode, mediaRegistry: Record<string, string>, format: ExportFormat, quality: number, onStage: (stage) => void): Promise<string>`
        - No longer takes HTMLElement; takes root + mediaRegistry directly
        - onStage('preparing') at start
        - Call renderGridToCanvas
        - onStage('exporting')
        - Convert canvas to data URL: `canvas.toDataURL('image/png')` or `canvas.toDataURL('image/jpeg', quality)`
        - Return the data URL
        - No double-call pattern needed (Canvas API is deterministic, no browser paint race)

    Write tests in `src/test/canvas-export.test.ts`:
    - Test parseObjectPosition with various inputs ('center center', 'left top', '25% 75%')
    - Test renderGridToCanvas produces a canvas with correct dimensions (1080x1920)
    - Test single leaf with no media produces a white-filled canvas
    - Test container with two leaves splits correctly (verify drawImage calls via spy)
    - Test nested containers subdivide correctly
    - Test exportGrid returns a data URL string starting with 'data:image/png' or 'data:image/jpeg'
    - Test exportGrid calls onStage in correct order
    - Test hasVideoCell still works (unchanged)
    - Test downloadDataUrl still works (unchanged)

    Note: In jsdom/vitest, HTMLCanvasElement.getContext returns null. Use a manual mock or `vi.spyOn` on canvas prototype to return a mock context with drawImage, fillRect, fillStyle. Alternatively, use `jest-canvas-mock` or vitest equivalent — check if the project already has canvas mocking setup. If not, create a lightweight mock: `HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx)` in test setup.

    For `canvas.toDataURL`, mock it to return a known string like `'data:image/png;base64,mock'`.
  </action>
  <verify>
    <automated>npx vitest run src/test/canvas-export.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - export.ts uses Canvas API with zero html-to-image imports
    - renderGridToCanvas walks the tree and draws onto a canvas
    - Object-fit cover/contain with objectPosition handled via drawImage crop math
    - All new tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove DOM-capture infrastructure and update consumers</name>
  <files>src/Grid/ExportSurface.tsx, src/Grid/ExportModeContext.tsx, src/Editor/ExportSplitButton.tsx, src/Editor/EditorShell.tsx, src/Editor/Toolbar.tsx, src/Grid/LeafNode.tsx, src/Grid/ContainerNode.tsx, src/test/phase04-01-task1.test.tsx, src/test/phase04-01-task2.test.tsx, src/test/phase04-02-task1.test.tsx, src/test/toolbar.test.tsx, src/test/editor-shell.test.tsx, package.json</files>
  <action>
    **Delete files:**
    - Delete `src/Grid/ExportSurface.tsx`
    - Delete `src/Grid/ExportModeContext.tsx`

    **Update src/Editor/ExportSplitButton.tsx:**
    - Remove `exportRef` prop entirely from the interface and component signature
    - Remove `import { exportGrid, ... } from '../lib/export'` old call pattern
    - In `handleExport`: instead of `exportRef.current`, read `root` and `mediaRegistry` from `useGridStore` (already subscribed) and call `exportGrid(root, mediaRegistry, exportFormat, exportQuality, onStage)` with the new signature
    - Remove `exportRef` from the useCallback dependency array
    - Keep all other behavior: video guard, toast states, download trigger, isExporting management

    **Update src/Editor/EditorShell.tsx:**
    - Remove `import { ExportSurface } from '../Grid/ExportSurface'`
    - Remove `const exportRef = useRef<HTMLDivElement>(null)`
    - Remove `<ExportSurface exportRef={exportRef} />` from JSX
    - Remove `exportRef` prop from `<Toolbar>` — just render `<Toolbar />`
    - Remove `useRef` from the React import if no longer used (keep `useEffect`)

    **Update src/Editor/Toolbar.tsx:**
    - Remove `RefObject` from imports
    - Remove `exportRef` prop from the component signature and type
    - Render `<ExportSplitButton />` with no props (instead of `<ExportSplitButton exportRef={...} />`)

    **Update src/Grid/LeafNode.tsx:**
    - Remove `import { useExportMode } from './ExportModeContext'`
    - Remove `const exportMode = useExportMode()`
    - Remove all `!exportMode &&` / `exportMode ?` conditional guards — the interactive UI (ActionBar, selection ring, hover overlay, file input) should ALWAYS render now since there is no export DOM surface
    - Specifically: always render the hidden file input, always show ring on selection, always show ActionBar on hover, always show hover overlay, always attach mouseEnter/mouseLeave handlers

    **Update src/Grid/ContainerNode.tsx:**
    - Remove `import { useExportMode } from './ExportModeContext'`
    - Remove `const exportMode = useExportMode()`
    - Remove the `!exportMode &&` guard around Divider — Dividers should ALWAYS render between children

    **Remove html-to-image dependency:**
    - Run `npm uninstall html-to-image`

    **Update tests:**

    `src/test/phase04-01-task1.test.tsx`:
    - Remove all ExportModeContext tests (context no longer exists)
    - Remove "LeafNode export mode suppression" tests (exportMode concept removed)
    - Remove "ContainerNode export mode suppression" tests (exportMode concept removed)
    - Keep the editorStore export state tests (those are still valid — isExporting, exportFormat, exportQuality)

    `src/test/phase04-01-task2.test.tsx`:
    - Remove the `exportGrid` tests that mock `html-to-image` (replaced by canvas-export.test.ts)
    - Keep `downloadDataUrl` tests (function unchanged)
    - Keep `hasVideoCell` tests (function unchanged)
    - Remove `ExportSurface` tests entirely (component deleted)
    - Update "EditorShell includes ExportSurface" test — change to verify ExportSurface is NOT present: `expect(screen.queryByTestId('export-surface')).toBeNull()`

    `src/test/phase04-02-task1.test.tsx`:
    - Remove `import * as htmlToImage from 'html-to-image'` (no longer exists)
    - Update ExportSplitButton tests:
      - Remove `exportRef` from all renders — `<ExportSplitButton />` with no props
      - Remove `React.createRef<HTMLDivElement>()` and mock div assignments
      - Update the "left segment click calls exportGrid" test: mock `src/lib/export` module's `exportGrid` to return a resolved data URL, verify it was called with `(root, mediaRegistry, 'png', 0.9, expect.any(Function))`
      - Update the "export is blocked with video-blocked toast" test similarly (no exportRef)
    - Keep all popover/format/quality tests, just remove exportRef from renders

    `src/test/toolbar.test.tsx`:
    - Remove any exportRef references from Toolbar renders (render `<Toolbar />` with no props)
    - Toolbar type no longer accepts exportRef, so existing tests that render `<Toolbar />` without props should continue to work as-is

    `src/test/editor-shell.test.tsx`:
    - Keep all existing tests (they don't reference ExportSurface directly)
    - Optionally add: `expect(screen.queryByTestId('export-surface')).toBeNull()` to verify cleanup
  </action>
  <verify>
    <automated>npx vitest run --reporter=verbose</automated>
  </verify>
  <done>
    - ExportSurface.tsx and ExportModeContext.tsx deleted
    - ExportSplitButton has no exportRef prop, reads from store, calls new exportGrid signature
    - EditorShell has no exportRef, no ExportSurface
    - Toolbar has no exportRef prop
    - LeafNode and ContainerNode have no exportMode checks
    - html-to-image removed from package.json
    - All tests pass with no references to html-to-image or ExportModeContext
    - `grep -r "html-to-image" src/` returns nothing
    - `grep -r "ExportModeContext" src/` returns nothing
    - `grep -r "ExportSurface" src/` returns nothing
    - `grep -r "exportRef" src/` returns nothing
  </done>
</task>

</tasks>

<verification>
```bash
# All tests pass
npx vitest run --reporter=verbose

# No traces of old infrastructure
grep -r "html-to-image" src/ && echo "FAIL: html-to-image still referenced" || echo "PASS"
grep -r "ExportModeContext" src/ && echo "FAIL: ExportModeContext still referenced" || echo "PASS"
grep -r "ExportSurface" src/ && echo "FAIL: ExportSurface still referenced" || echo "PASS"
grep -r "exportRef" src/ && echo "FAIL: exportRef still referenced" || echo "PASS"
grep "html-to-image" package.json && echo "FAIL: html-to-image still in deps" || echo "PASS"

# Build succeeds
npx vite build

# Bundle check
ls -la dist/assets/*.js | awk '{print $5}'
```
</verification>

<success_criteria>
- Canvas API export produces correct 1080x1920 output from grid tree data
- Object-fit cover/contain with objectPosition handled via drawImage crop math
- html-to-image completely removed (package.json, all imports, all mocks)
- ExportSurface, ExportModeContext deleted; no components reference them
- ExportSplitButton reads from store directly (no exportRef prop)
- All existing and new tests pass
- Build succeeds with no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260401-oca-replace-the-html-to-image-export-engine-/260401-oca-SUMMARY.md`
</output>
