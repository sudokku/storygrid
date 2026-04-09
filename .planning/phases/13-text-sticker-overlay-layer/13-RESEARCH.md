# Phase 13: Text & Sticker Overlay Layer - Research

**Researched:** 2026-04-10
**Domain:** Canvas overlay system — free-position text, emoji stickers, image stickers with drag/resize/rotate handles, DOM layer + Canvas API export parity
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Overlays live in a separate `overlayStore` (new Zustand + Immer store). Grid mutations never touch overlays.

**D-02:** Overlay selection lives in `editorStore` as new `selectedOverlayId: string | null`. Clicking an overlay sets `selectedOverlayId` and clears `selectedNodeId`. Mutual exclusion enforced by both stores.

**D-03:** Overlay objects use a type union `TextOverlay | EmojiOverlay | StickerOverlay` with shared base fields: `id`, `x`, `y` (canvas pixel space 0–1080 / 0–1920), `width`, `rotation` (degrees), `zIndex`. Type-specific fields as specified.

**D-04:** Undo/redo tracks add and delete overlay actions only. Move/resize/rotate are NOT in undo history this phase.

**D-05:** Planner decides whether `overlayStore` calls `gridStore.pushSnapshot` directly or a combined snapshot captures both grid tree + overlay array. Goal: one Ctrl+Z undoes one add/delete.

**D-06:** Image sticker base64 goes into `stickerRegistry` (mirroring `mediaRegistry`) — never inlined in overlay store or history snapshots.

**D-07:** User-uploaded SVG content sanitized with DOMPurify at upload time before storing or rendering.

**D-08 (ROADMAP lock):** All overlay `x`, `y`, `width` stored in canvas pixel space (0–1080 x 0–1920). The `canvas-surface` CSS transform scales all children automatically.

**D-09:** In live editor, overlays render as DOM elements absolutely positioned over the canvas container, transformed via CSS (`translate` + `rotate`). Canvas element does NOT render overlays during editing — only during export.

**D-10:** New `OverlayLayer` component sits as sibling to canvas inside `CanvasWrapper` (or `CanvasArea`). Renders all overlays from `overlayStore` as absolutely-positioned divs, scaled proportionally via `editorStore.canvasScale`.

**D-11:** Drag, resize, rotate handles are React component handles on the DOM overlay wrapper. Raw pointer events (`pointerdown` / `pointermove` / `pointerup` with `setPointerCapture`) — same pattern as `Divider.tsx`. No dnd-kit for overlays.

**D-12:** Text content edited inline via double-click: a `<div contenteditable>` or `<textarea>` absolutely positioned over canvas in viewport space, scaled to match overlay visual size and position. Canvas updates as user types.

**D-13:** Single-click selects (shows handles). Double-click enters edit mode. Escape or outside-click exits and commits.

**D-14:** Sidebar also shows text input field for selected text overlay content — both sync to same store field. Sidebar is fallback for mobile.

**D-15:** Sidebar `SelectedCellPanel` or new `OverlayPanel` shows text controls: content input, font picker, size slider (16–256px), color picker, weight toggle, alignment picker.

**D-16:** Font picker renders as dropdown where each option label is displayed in its own typeface.

**D-17:** Load Playfair Display and Dancing Script via `<link>` in `index.html` at build time (Google Fonts). Font stack: Geist + Playfair Display + Dancing Script.

**D-18:** PNG/MP4 export must call `document.fonts.ready` before any `ctx.fillText()` using these fonts.

**D-19:** Use `emoji-mart` library for emoji picker panel. Lazy-loaded chunk (dynamic import) on first open.

**D-20:** Emoji picker panel appears as popover from an "Add" toolbar button — same UX pattern as `TemplatesPopover.tsx`.

**D-21:** Emoji stickers render on canvas export via `ctx.fillText(char, x, y)` with large font size. System-font dependent — acceptable for Instagram story use cases.

**D-22:** PNG export adds overlay draw pass after all cells are drawn. For each overlay in zIndex order: text, emoji, or image sticker.

**D-23:** MP4 export renders overlays on every frame in the render loop, same pass ordering as PNG. Overlay positions and styles are static over video duration.

**D-24:** Overlay rendering in export reads directly from `overlayStore.getState()` — no prop threading.

**D-25:** Overlays maintain `zIndex` integer field. "Bring Forward" increments; "Send Backward" decrements. Planner handles normalization if gaps form.

### Claude's Discretion

- Exact Tailwind styling of overlay DOM elements (border, handle size/color)
- Whether `OverlayPanel` is a new sidebar section or folded into `SelectedCellPanel` via a type switch
- Exact sizing of corner and rotation handles (likely 8–12px thumb, matching prior interactive patterns)
- Whether `overlayStore` uses `zustand/middleware/immer` (recommended, matching `gridStore`) or plain Zustand
- Whether snapshot merging is done by copying overlay array into grid snapshot or separate parallel snapshot array
- Whether inline contenteditable uses raw `div[contenteditable]` or controlled `<textarea>` resized to fit
- The specific "Add" toolbar button layout (icon + label vs icon-only, popover position)
- Exact `emoji-mart` version and configuration (skin tone, theme: dark to match editor)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVL-01 | User can add a text overlay via "Add Text" button; spawns centered with placeholder | overlayStore.addOverlay() action; initial x=540, y=960 in canvas space |
| OVL-02 | User can edit text content via inline editor or sidebar input | contenteditable div / textarea; dual-sync to overlayStore |
| OVL-03 | User can change font family (min 3: Geist, serif display, script) | Google Fonts preload in index.html; CSS fontFamily on overlay div |
| OVL-04 | User can change font size via slider (16–256px) | CSS fontSize on overlay div; canvas px space stored |
| OVL-05 | User can change text color via color picker | CSS color property; ctx.fillStyle in export |
| OVL-06 | User can change font weight (regular / bold) | CSS fontWeight; ctx.font string in export |
| OVL-07 | User can change text alignment (left / center / right) | CSS textAlign; ctx.textAlign in export |
| OVL-08 | User can add emoji sticker via emoji picker panel; spawns centered | emoji-mart lazy-loaded; EmojiOverlay node added to overlayStore |
| OVL-09 | User can upload PNG/SVG image sticker; SVG sanitized via DOMPurify | File input → FileReader → DOMPurify (SVG) → stickerRegistry |
| OVL-10 | User can drag any overlay freely across the 1080×1920 canvas | Pointer events with setPointerCapture on overlay wrapper; coordinate stored in canvas space |
| OVL-11 | User can resize any selected overlay via corner handle (proportional) | Corner handle with pointermove delta; scale width proportionally |
| OVL-12 | User can rotate any selected overlay via top rotation handle | Rotation handle with atan2 from overlay center; degrees stored in overlay.rotation |
| OVL-13 | User can delete selected overlay via Delete key or trash button | overlayStore.deleteOverlay(); keyboard listener in EditorShell |
| OVL-14 | User can reorder overlays via "Bring Forward" / "Send Backward" | overlayStore.bringForward/sendBackward acting on zIndex; render order follows zIndex |
| OVL-15 | Overlay selection mutually exclusive with cell selection | editorStore.selectedOverlayId clears selectedNodeId; vice versa |
| OVL-16 | Overlays render identically in live preview, PNG export, MP4 export | DOM layer WYSIWYG + canvas draw pass after cells in export.ts and videoExport.ts |
| OVL-17 | Sticker image data stored in stickerRegistry — never inlined | stickerRegistry: Record<string, string> mirroring mediaRegistry in gridStore or own store |
</phase_requirements>

---

## Summary

Phase 13 builds a free-position overlay system on top of the existing 1080×1920 canvas. Three overlay types (text, emoji, image sticker) are stored in a new `overlayStore` (Zustand + Immer), rendered as absolutely-positioned DOM elements scaled by the existing `canvasScale` from `editorStore`, and drawn onto the Canvas API in a post-cell pass during PNG and MP4 export. The architecture deliberately mirrors established patterns: the `stickerRegistry` mirrors `mediaRegistry`, the `overlayStore` mirrors `gridStore`'s Immer + snapshot structure, and drag/resize/rotate handles use the same `setPointerCapture` pointer event loop as `Divider.tsx`.

The two new library dependencies are `emoji-mart` (v5.6.0 + `@emoji-mart/react` v1.1.1 + `@emoji-mart/data` v1.2.1) loaded as a lazy chunk, and `dompurify` (v3.3.3 + `@types/dompurify` v3.2.0) for SVG sanitization at upload time. Both are confirmed current on the npm registry. Google Fonts for Playfair Display and Dancing Script are loaded via `<link>` in `index.html` — they require a `document.fonts.ready` await before any Canvas `ctx.fillText()` call.

**Primary recommendation:** Follow the established store + registry + pointer-event-loop triad exactly. The overlay DOM layer uses CSS `translate` + `rotate` in canvas pixel space divided by `canvasScale` to position elements in the scaled viewport; the export pass reconstructs the same geometry directly in canvas coordinates. This guarantees WYSIWYG parity without re-projection.

---

## Standard Stack

### Core (already in package.json — no new installs required)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zustand | ^5.0.12 | overlayStore state | Already installed [VERIFIED: package.json] |
| immer | ^10.2.0 | Immer middleware for overlayStore | Already installed [VERIFIED: package.json] |
| nanoid | ^5.1.7 | Overlay ID generation | Already installed [VERIFIED: package.json] |
| tailwindcss | ^3.4.19 | Overlay DOM styling | Already installed [VERIFIED: package.json] |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| emoji-mart | ^5.6.0 | Emoji picker core | Framework-agnostic; React wrapper in @emoji-mart/react [VERIFIED: npm registry] |
| @emoji-mart/react | ^1.1.1 | React `<Picker>` component | Wraps emoji-mart for React 18 [VERIFIED: npm registry] |
| @emoji-mart/data | ^1.2.1 | Emoji dataset | Required by emoji-mart for emoji rendering [VERIFIED: npm registry] |
| dompurify | ^3.3.3 | SVG sanitization at upload | Prevents XSS from user-uploaded SVG content [VERIFIED: npm registry] |
| @types/dompurify | ^3.2.0 | TypeScript types for DOMPurify | Dev dependency [VERIFIED: npm registry] |

**Installation:**
```bash
npm install emoji-mart @emoji-mart/react @emoji-mart/data dompurify
npm install -D @types/dompurify
```

### emoji-mart Architecture Notes

emoji-mart v5 is the current major version. [VERIFIED: npm registry]

- `emoji-mart` v5 is the framework-agnostic core (web component)
- `@emoji-mart/react` v1.1.1 wraps it as a React component — peer deps require `emoji-mart: ^5.2` and `react: ^16.8 || ^17 || ^18` [VERIFIED: npm view @emoji-mart/react peerDependencies]
- `@emoji-mart/data` provides the emoji dataset (imported separately to keep the lazy chunk self-contained)
- Unpackaged size of emoji-mart: ~1.6MB — this is why D-19 mandates lazy-loading [VERIFIED: npm registry]
- The `<Picker>` component accepts `onEmojiSelect` callback that receives an emoji object with a `native` property (the raw Unicode character) — matches the `EmojiOverlay.char` storage approach [ASSUMED — based on emoji-mart v5 documentation patterns; verify at implementation time]

**Lazy loading pattern:**
```typescript
// Trigger on first picker open only
const { Picker } = await import('@emoji-mart/react');
const data = await import('@emoji-mart/data');
```

### DOMPurify SVG Sanitization Pattern

```typescript
// Source: DOMPurify v3.x API
import DOMPurify from 'dompurify';

// At SVG upload time — before storing in stickerRegistry
const sanitized = DOMPurify.sanitize(svgString, {
  USE_PROFILES: { svg: true, svgFilters: true },
});
// Then convert to blob URL or base64 for storage
```

DOMPurify v3.3.3 supports SVG sanitization with `USE_PROFILES: { svg: true }` which whitelists standard SVG elements and attributes while stripping script tags and event handlers. [ASSUMED based on DOMPurify documentation patterns; verify USE_PROFILES API at implementation time]

**For PNG uploads:** No sanitization needed. `FileReader.readAsDataURL()` produces a data URI — same pattern as existing `mediaRegistry` image uploads in Phase 3. [VERIFIED: existing codebase pattern in gridStore.ts `addMedia`]

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── store/
│   └── overlayStore.ts          # New: TextOverlay | EmojiOverlay | StickerOverlay store
├── types/
│   └── index.ts                 # Extend: add Overlay union types
├── Grid/
│   └── OverlayLayer.tsx         # New: absolutely-positioned overlay DOM layer
├── Editor/
│   ├── OverlayHandles.tsx       # New: selected overlay resize/rotate handles
│   ├── OverlayPanel.tsx         # New: sidebar panel for selected overlay
│   └── EmojiPickerPopover.tsx   # New: lazy-loaded emoji picker popover
└── lib/
    └── overlayExport.ts         # New: drawOverlaysToCanvas() helper for export pass
```

### Pattern 1: overlayStore Structure (mirrors gridStore)

**What:** Zustand + Immer store containing the overlay array plus stickerRegistry, with add/delete/update/reorder actions that call into a shared snapshot mechanism.

**Key design:** The `history` array in `gridStore` stores `{ root: GridNode }` snapshots. For overlay undo/redo (add/delete only, D-04), the cleanest approach is to **include the overlay array in the same snapshot object**. This means gridStore's `pushSnapshot` should be extended to capture both `root` and `overlays[]` together — or overlayStore exposes its state for gridStore's snapshot to include. This avoids two independent snapshot stacks getting out of sync on undo.

**Recommended approach for D-05 (planner decides):** Extend the history snapshot type from `{ root: GridNode }` to `{ root: GridNode; overlays: Overlay[] }`. `pushSnapshot` reads `overlayStore.getState().overlays` at snapshot time. On undo/redo, gridStore restores both `root` and calls `overlayStore.setState({ overlays: snap.overlays })`. This keeps a single history stack and is the simplest model.

**Alternative:** overlayStore maintains its own parallel history array, with `pushSnapshot` exported and called from overlayStore add/delete actions. Undo in editorStore calls both `gridStore.undo()` and `overlayStore.undo()` — but this means two separate Ctrl+Z histories that can drift independently.

**Recommendation:** Single shared snapshot (extend `{ root, overlays }`) is simpler and avoids sync drift. [ASSUMED — the correct approach for D-05; user left it to planner]

```typescript
// src/store/overlayStore.ts — skeleton
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';

export type TextOverlay = {
  type: 'text';
  id: string;
  x: number;       // canvas pixel space 0–1080
  y: number;       // canvas pixel space 0–1920
  width: number;   // canvas pixel space
  rotation: number; // degrees
  zIndex: number;
  content: string;
  fontFamily: string;
  fontSize: number;  // 16–256 in canvas space
  color: string;
  fontWeight: 'regular' | 'bold';
  textAlign: 'left' | 'center' | 'right';
};

export type EmojiOverlay = {
  type: 'emoji';
  id: string;
  x: number; y: number; width: number; rotation: number; zIndex: number;
  char: string;  // raw Unicode emoji character
};

export type StickerOverlay = {
  type: 'sticker';
  id: string;
  x: number; y: number; width: number; rotation: number; zIndex: number;
  stickerRegistryId: string;  // never inline base64
};

export type Overlay = TextOverlay | EmojiOverlay | StickerOverlay;

type OverlayStoreState = {
  overlays: Overlay[];
  stickerRegistry: Record<string, string>;  // id -> base64/dataUri
  addOverlay: (overlay: Omit<Overlay, 'id' | 'zIndex'>) => void;
  deleteOverlay: (id: string) => void;
  updateOverlay: (id: string, updates: Partial<Overlay>) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  addSticker: (stickerId: string, dataUri: string) => void;
};
```

### Pattern 2: OverlayLayer DOM Positioning

**What:** Absolutely-positioned div container (same dimensions as canvas-surface, `pointer-events: none` on container, `pointer-events: auto` on each overlay element). Overlay coordinates are in canvas pixel space; CSS `transform` converts to the scaled viewport.

**The key math** — converting canvas-space coordinates to viewport-space CSS:
```typescript
// canvas-surface is scaled by finalScale (canvasScale from editorStore)
// The div is inside canvas-surface (which is 1080x1920 unscaled)
// So overlays positioned at canvas pixel coords appear correctly after CSS scale

// CSS for each overlay div:
const style = {
  position: 'absolute' as const,
  left: overlay.x,           // canvas pixel X (0–1080)
  top: overlay.y,            // canvas pixel Y (0–1920)
  width: overlay.width,      // canvas pixel width
  transformOrigin: 'top left',
  transform: `rotate(${overlay.rotation}deg)`,
  pointerEvents: 'auto' as const,
};
// The parent canvas-surface's CSS scale(finalScale) handles viewport scaling
// NO manual viewport conversion needed — this is the core insight of D-08
```

[VERIFIED: CanvasWrapper.tsx — the canvas-surface div uses `transform: scale(${finalScale})` and children are positioned in unscaled (1080x1920) space]

### Pattern 3: Drag/Resize/Rotate Handle Loop (mirrors Divider.tsx)

**What:** `pointerdown` + `setPointerCapture` on the handle element, `pointermove` computes delta in viewport pixels converted to canvas space by dividing by `canvasScale`, `pointerup` commits.

**Drag (move) pattern:**
```typescript
// viewport pixel delta / canvasScale = canvas pixel delta
const canvasDeltaX = (e.clientX - startClientX) / canvasScale;
const canvasDeltaY = (e.clientY - startClientY) / canvasScale;
updateOverlay(id, { x: startX + canvasDeltaX, y: startY + canvasDeltaY });
```

**Resize (corner handle) pattern:**
```typescript
// Proportional resize: track width change, maintain aspect ratio
const viewportDelta = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);
const canvasDelta = viewportDelta / canvasScale;
const newWidth = Math.max(40, startWidth + canvasDelta);  // min 40px
updateOverlay(id, { width: newWidth });
```

**Rotation (top handle) pattern:**
```typescript
// Compute angle from overlay center to current pointer position
const overlayViewportCX = overlayX * canvasScale + canvasSurfaceLeft;
const overlayViewportCY = overlayY * canvasScale + canvasSurfaceTop;
const angle = Math.atan2(
  e.clientY - overlayViewportCY,
  e.clientX - overlayViewportCX
) * (180 / Math.PI);
updateOverlay(id, { rotation: angle - 90 }); // -90: handle is at top
```

[VERIFIED: pattern matches Divider.tsx setPointerCapture + viewport→canvas conversion via canvasScale]

### Pattern 4: Inline Text Editing

**What:** Double-click on text overlay enters edit mode. A `contenteditable` div or controlled `<textarea>` is positioned over the canvas in viewport space (using the same scale math), matching the overlay's visual size and font.

**Key behavior:**
- The overlay DOM element shows the styled text at all times (read mode)
- In edit mode, the read-mode element is hidden and replaced with a `contenteditable` input positioned at the same location
- `Escape` or outside click commits the `textContent` back to `overlayStore`
- The Sidebar text input syncs bidirectionally via `overlayStore` subscription

**The position math for the editing input** (must account for canvasScale):
```typescript
// Position the editor in viewport coordinates
const inputStyle = {
  position: 'fixed' as const,
  left: overlayX * canvasScale + canvasSurfaceLeft,
  top: overlayY * canvasScale + canvasSurfaceTop,
  width: overlayWidth * canvasScale,
  fontSize: overlay.fontSize * canvasScale,
  fontFamily: overlay.fontFamily,
  // etc.
};
```

Alternatively, the `contenteditable` div can be placed inside the canvas-surface alongside the read-mode overlay, inheriting the CSS scale automatically. This is simpler and avoids the position calculation. The read-mode element is given `visibility: hidden` in edit mode; the editing element takes its place.

### Pattern 5: Export Overlay Draw Pass

**What:** After `renderNode` completes all cells, a second pass draws all overlays in `zIndex` order onto the same `ctx`.

```typescript
// In export.ts — after renderNode() call
import { useOverlayStore } from '../store/overlayStore'; // or accept as param

async function drawOverlaysToCanvas(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  stickerRegistry: Record<string, string>,
  imageCache: Map<string, HTMLImageElement>,
): Promise<void> {
  await document.fonts.ready; // D-18: ensure Google Fonts are loaded
  
  const sorted = [...overlays].sort((a, b) => a.zIndex - b.zIndex);
  
  for (const overlay of sorted) {
    ctx.save();
    // Apply rotation around overlay center
    const cx = overlay.x + overlay.width / 2;
    const cy = overlay.y + (estimatedHeight(overlay) / 2);
    ctx.translate(cx, cy);
    ctx.rotate(overlay.rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);
    
    if (overlay.type === 'text') {
      ctx.font = `${overlay.fontWeight === 'bold' ? 'bold ' : ''}${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = overlay.textAlign;
      ctx.fillText(overlay.content, overlay.x, overlay.y + overlay.fontSize);
    } else if (overlay.type === 'emoji') {
      ctx.font = `${overlay.width}px serif`;
      ctx.textAlign = 'left';
      ctx.fillText(overlay.char, overlay.x, overlay.y + overlay.width);
    } else if (overlay.type === 'sticker') {
      const dataUri = stickerRegistry[overlay.stickerRegistryId];
      if (dataUri) {
        let img = imageCache.get(dataUri);
        if (!img) { img = await loadImage(dataUri); imageCache.set(dataUri, img); }
        ctx.drawImage(img, overlay.x, overlay.y, overlay.width, overlay.width);
      }
    }
    ctx.restore();
  }
}
```

[VERIFIED: follows the existing `renderNode` + `drawLeafToCanvas` pattern in export.ts]

### Anti-Patterns to Avoid

- **Storing viewport-space coordinates:** All `x`, `y`, `width` MUST be canvas pixel space (0–1080/1920). The CSS scale handles display. Viewport coordinates require re-projection on every resize. [VERIFIED: D-08 is a ROADMAP lock]
- **Inlining base64 sticker data in overlayStore or history snapshots:** With 50-entry history cap, 1 sticker at 500KB = 25MB of snapshot memory. Use `stickerRegistry` ID reference only. [VERIFIED: D-06, mirrors existing mediaRegistry pattern in gridStore.ts]
- **Using dnd-kit for overlay drag:** D-11 explicitly specifies raw pointer events. dnd-kit would add unnecessary re-render overhead for this use case.
- **Rendering overlays during editing via canvas element:** D-09 specifies DOM layer for editing, canvas only for export. Mixing would break the WYSIWYG model.
- **Skipping `document.fonts.ready` in export:** Google Fonts may not be loaded when `exportGrid` runs if it's called before the fonts have fully loaded. This produces incorrect font fallbacks in exported images. [ASSUMED risk — standard browser behavior for web fonts]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Emoji picker UI | Custom emoji grid | `@emoji-mart/react` `<Picker>` | 3500+ emoji, search, skin tones, keyboard nav — months of work |
| SVG XSS sanitization | Custom regex/parser | `dompurify` with `USE_PROFILES: { svg: true }` | SVG has 100+ attack vectors; DOMPurify has a security-focused maintenance team |
| Font loading detection | `setTimeout` polling | `document.fonts.ready` Promise | Native browser API; resolves when all loaded fonts are ready to use in canvas |
| Emoji Unicode database | Raw Unicode table | `@emoji-mart/data` | Maintained per Unicode version; includes variants and sequences |

**Key insight:** Emoji rendering looks trivial (`ctx.fillText(char)`) but the picker itself requires extensive data (categories, search index, skin tone variants) — the data package alone is worth the dependency.

---

## Common Pitfalls

### Pitfall 1: Canvas-Space vs Viewport-Space Confusion
**What goes wrong:** Storing drag-end coordinates in viewport pixels. On next window resize, the canvas scales but coordinates don't re-project, causing overlays to drift from their intended position.
**Why it happens:** `e.clientX` gives viewport pixels. The developer forgets to divide by `canvasScale` when computing the final stored position.
**How to avoid:** All writes to `overlayStore` must convert: `canvasX = (e.clientX - canvasSurfaceLeft) / canvasScale`. The canvas-surface left/top offset is obtained from `canvasSurfaceRef.current.getBoundingClientRect()`.
**Warning signs:** Overlay position shifts after zoom change or window resize.

### Pitfall 2: Rotation Handle Geometry
**What goes wrong:** Rotation handle positioned at "top center" of the overlay div, but the angle calculation uses the wrong reference point or forgets the CSS `transformOrigin`.
**Why it happens:** CSS `rotate()` in `transform` applies at `transformOrigin: 'top left'` by default. If you later use `translate` + `rotate` CSS shorthand without resetting origin, rotation pivots from the wrong point.
**How to avoid:** Use `transformOrigin: 'center center'` on the overlay wrapper div, or explicitly `translate(-50%, -50%)` to center the rotation. In the canvas export pass, rotate around the overlay center, not the top-left corner.
**Warning signs:** Overlay rotates around a visually wrong pivot point.

### Pitfall 3: Google Font Not Loaded at Export Time
**What goes wrong:** `ctx.fillText()` called before Playfair Display or Dancing Script fonts are loaded. Canvas uses system fallback sans-serif; exported image shows wrong font.
**Why it happens:** `exportGrid` is async but doesn't wait for fonts. The browser loads fonts lazily; they may not be available at the moment the export canvas begins rendering.
**How to avoid:** Await `document.fonts.ready` inside `drawOverlaysToCanvas()` before any `ctx.font` assignment. For belt-and-suspenders, also call `document.fonts.load('16px "Playfair Display"')` explicitly.
**Warning signs:** Export shows correct font in editor but different font in downloaded PNG.

### Pitfall 4: stickerRegistry + History Snapshot Bloat
**What goes wrong:** Base64 sticker data (can be 100KB–1MB) is included in the overlay array and therefore duplicated into every history snapshot when `pushSnapshot` captures it.
**Why it happens:** Developer stores sticker data directly on the `StickerOverlay` object instead of using the registry ID pattern.
**How to avoid:** `StickerOverlay` stores only `stickerRegistryId: string`. The `stickerRegistry` (like `mediaRegistry`) is NEVER included in history snapshots — it's side-channel state.
**Warning signs:** `history` array memory grows rapidly after adding image stickers.

### Pitfall 5: DOMPurify SVG Sanitization Timing
**What goes wrong:** SVG is sanitized after being stored in the registry, or sanitization is skipped for "small" files.
**Why it happens:** Developer sanitizes for display but not for storage; or checks file size as a proxy for safety.
**How to avoid:** Sanitize at upload time, before calling `addSticker()`. The DOMPurify result (clean SVG string) is what gets stored, not the raw file content.
**Warning signs:** SVG files with `<script>` tags or `onload` attributes pass through.

### Pitfall 6: Mutual Exclusion Between Cell and Overlay Selection
**What goes wrong:** Clicking an overlay while a cell is selected doesn't clear the cell's sidebar panel; clicking a cell while an overlay is selected doesn't clear the overlay handles.
**Why it happens:** `setSelectedNode` and `setSelectedOverlayId` are separate actions in separate stores. If neither clears the other, both `selectedNodeId` and `selectedOverlayId` can be non-null simultaneously.
**How to avoid:** `setSelectedNode(id)` calls `useOverlayStore.getState().clearOverlaySelection()` when `id` is non-null. `setSelectedOverlayId(id)` calls `useEditorStore.getState().setSelectedNode(null)` when `id` is non-null. The static import pattern (already used in gridStore calling editorStore) avoids circular deps.
**Warning signs:** Both cell sidebar panel and overlay handles visible simultaneously.

### Pitfall 7: emoji-mart Lazy Load Race Condition
**What goes wrong:** User opens emoji picker before the lazy chunk has loaded; Picker renders blank or throws.
**Why it happens:** Dynamic import is async; the first render may occur before the import resolves.
**How to avoid:** Track a `pickerLoaded` state flag. Show a loading spinner while the dynamic import is in-flight. Only render `<Picker>` after both the component and the data are loaded.
**Warning signs:** Blank popover on first open on slow connections.

---

## Code Examples

### Overlay Type Definitions (src/types/index.ts addition)
```typescript
// Source: CONTEXT.md D-03 — type union with discriminant
export type OverlayBase = {
  id: string;
  x: number;       // canvas pixel space 0–1080
  y: number;       // canvas pixel space 0–1920
  width: number;   // canvas pixel space
  rotation: number; // degrees, 0 = no rotation
  zIndex: number;
};

export type TextOverlay = OverlayBase & {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;          // 16–256, canvas pixel space
  color: string;             // hex color
  fontWeight: 'regular' | 'bold';
  textAlign: 'left' | 'center' | 'right';
};

export type EmojiOverlay = OverlayBase & {
  type: 'emoji';
  char: string;              // raw Unicode emoji e.g. '🎉'
};

export type StickerOverlay = OverlayBase & {
  type: 'sticker';
  stickerRegistryId: string; // key into stickerRegistry
};

export type Overlay = TextOverlay | EmojiOverlay | StickerOverlay;
```

### overlayStore Skeleton (src/store/overlayStore.ts)
```typescript
// Source: mirrors gridStore.ts structure [VERIFIED: existing codebase]
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Overlay } from '../types';

type OverlayStoreState = {
  overlays: Overlay[];
  stickerRegistry: Record<string, string>;
  addOverlay: (partial: Omit<Overlay, 'id' | 'zIndex'>) => void;
  deleteOverlay: (id: string) => void;
  updateOverlay: (id: string, updates: Partial<Overlay>) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  addSticker: (stickerId: string, dataUri: string) => void;
  clearOverlaySelection: () => void; // called by editorStore.setSelectedNode
};

export const useOverlayStore = create<OverlayStoreState>()(
  immer((set, get) => ({
    overlays: [],
    stickerRegistry: {},
    addOverlay: (partial) => set(state => {
      const maxZ = state.overlays.reduce((m, o) => Math.max(m, o.zIndex), 0);
      state.overlays.push({ ...partial, id: nanoid(), zIndex: maxZ + 1 } as Overlay);
    }),
    deleteOverlay: (id) => set(state => {
      state.overlays = state.overlays.filter(o => o.id !== id);
    }),
    updateOverlay: (id, updates) => set(state => {
      const idx = state.overlays.findIndex(o => o.id === id);
      if (idx !== -1) Object.assign(state.overlays[idx], updates);
    }),
    bringForward: (id) => set(state => {
      const o = state.overlays.find(x => x.id === id);
      if (o) o.zIndex += 1;
    }),
    sendBackward: (id) => set(state => {
      const o = state.overlays.find(x => x.id === id);
      if (o) o.zIndex = Math.max(0, o.zIndex - 1);
    }),
    addSticker: (stickerId, dataUri) => set(state => {
      state.stickerRegistry[stickerId] = dataUri;
    }),
    clearOverlaySelection: () => {
      // Signals that an overlay is deselected — used by editorStore to sync
      // Actual selectedOverlayId lives in editorStore, not here
    },
  }))
);
```

### CanvasWrapper Integration Point
```typescript
// Source: CanvasWrapper.tsx [VERIFIED: existing codebase]
// Inside the canvas-surface div, after <GridNodeComponent id={rootId} />:
<GridNodeComponent id={rootId} />
<OverlayLayer />     // NEW: sits as sibling, same 1080x1920 coordinate space
{showSafeZone && <SafeZoneOverlay />}
```

The `OverlayLayer` div should have:
```typescript
// OverlayLayer container styles
style={{
  position: 'absolute',
  inset: 0,          // full 1080x1920 canvas surface
  pointerEvents: 'none',  // let clicks through to canvas cells
  zIndex: 10,        // above grid cells
}}
```

Each overlay element inside has `pointerEvents: 'auto'` to capture interactions.

### Google Fonts Preload (index.html)
```html
<!-- Source: D-17 — build-time Google Fonts loading -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
```

The `&display=swap` ensures text renders with a fallback while fonts load, then swaps. [ASSUMED — standard Google Fonts loading pattern; exact URL should be verified at implementation]

### Extend gridStore History Snapshot for Overlay Undo (D-05 approach)

The existing snapshot type is `{ root: GridNode }`. To include overlays, extend to:
```typescript
// In gridStore.ts
type HistorySnapshot = {
  root: GridNode;
  overlays: Overlay[];  // captured from overlayStore at snapshot time
};

function pushSnapshot(state: { root: GridNode; history: HistorySnapshot[]; historyIndex: number }): void {
  const plainRoot = current(state.root);
  const overlays = useOverlayStore.getState().overlays; // read current overlays
  const snap = structuredClone({ root: plainRoot, overlays });
  // ... rest of existing pushSnapshot logic
  state.historyIndex = state.history.length - 1;
}

// In undo():
undo: () => set(state => {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  const plainSnap = current(state.history[state.historyIndex]);
  state.root = structuredClone(plainSnap.root);
  useOverlayStore.setState({ overlays: structuredClone(plainSnap.overlays) });
}),
```

[VERIFIED: existing `useEditorStore` is already imported and called from gridStore.ts via `useEditorStore.getState().setSelectedNode(null)` in `moveCell` — same static import pattern works for overlayStore]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Konva / Fabric.js canvas overlay | DOM layer + CSS transform (D-09) | Lighter weight; no extra library; leverages CSS compositor for 60fps rendering |
| Separate undo history per store | Single shared snapshot with overlay array embedded | One Ctrl+Z = one semantic undo; no sync drift between two history stacks |
| Inline sticker data in state | Registry ID reference (mediaRegistry pattern) | Memory-efficient; history snapshots stay small |
| react-color / custom pickers | Native `<input type="color">` | Zero-dependency; sufficient for this use case |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | emoji-mart v5 `<Picker onEmojiSelect>` receives `{ native: string }` in callback | Standard Stack | Implementation would need to read different property to get Unicode char |
| A2 | DOMPurify `USE_PROFILES: { svg: true, svgFilters: true }` is the correct API for SVG sanitization in v3.x | Standard Stack | Sanitization may fail or be incomplete if API differs |
| A3 | Google Fonts URL pattern `fonts.googleapis.com/css2?family=Playfair+Display...` is correct | Code Examples | Font loading would fail silently; wrong font appears in editor |
| A4 | `document.fonts.ready` await inside `drawOverlaysToCanvas()` is sufficient to guarantee web fonts are available for canvas rendering | Common Pitfalls | Exported PNG may still show wrong font in some browsers |
| A5 | Single combined snapshot `{ root, overlays }` approach (D-05) is the correct planner choice | Code Examples | If planner chooses parallel history arrays, integration architecture changes significantly |

---

## Open Questions

1. **D-05: Combined vs. parallel snapshot**
   - What we know: gridStore already imports editorStore statically and calls it from `moveCell`. The same pattern can import overlayStore.
   - What's unclear: Whether extending the snapshot type from `{ root }` to `{ root, overlays }` introduces TypeScript migration pain for existing test mocks.
   - Recommendation: Use combined snapshot. The TypeScript change is a one-line type extension. Existing tests mock `{ root: ... }` — they would need to add `overlays: []` to snapshots. This is low-risk since overlay tests will be newly written anyway.

2. **Height of text overlays for rotation pivot**
   - What we know: Overlay `width` is stored; text height is dynamic (depends on fontSize, content length, line wrapping).
   - What's unclear: How to compute the height for canvas export rotation pivot. CSS `getBoundingClientRect()` works in the DOM layer but not in the canvas export pass.
   - Recommendation: Store a `height` field on `TextOverlay` that is computed from `fontSize` (single line assumption: `height ≈ fontSize * 1.2`). Update it when fontSize changes. For the DOM layer, use the actual rendered height via a ref. For canvas export, use the stored estimate.

3. **Sticker aspect ratio preservation**
   - What we know: Corner handle resizes proportionally (OVL-11). Only `width` is stored.
   - What's unclear: For image stickers, if the source image is not 1:1, the export needs to know the aspect ratio to compute `height` for canvas `drawImage`.
   - Recommendation: Store `aspectRatio` on `StickerOverlay` (computed at upload time from the loaded image dimensions). Export uses `height = width / aspectRatio`.

---

## Environment Availability

Step 2.6: No external runtime dependencies beyond npm packages. All capabilities (DOMPurify, emoji-mart, Canvas API, document.fonts) are browser APIs or npm libraries. No CLI tools, databases, or services required.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `document.fonts.ready` | OVL-16 export font loading | Chrome 90+, Firefox 90+, Safari 15+ | Matches project browser support targets [ASSUMED based on MDN compatibility] |
| `setPointerCapture` | OVL-10/11/12 handles | All target browsers | Already used and tested in Divider.tsx [VERIFIED: existing codebase] |
| Canvas 2D `ctx.rotate()` | OVL-16 export | All target browsers | Standard Canvas API [VERIFIED: already used in export.ts] |
| `FileReader.readAsDataURL` | OVL-09 sticker upload | All target browsers | Already used in Phase 3 [VERIFIED: existing codebase STATE.md] |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/test/phase13` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVL-01 | addOverlay() creates TextOverlay at center with correct defaults | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-02 | updateOverlay() updates content field; sidebar input reflects change | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-03 | TextOverlay fontFamily field accepts 3 defined fonts | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-04 | fontSize clamped to 16–256 range | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-05–07 | color, fontWeight, textAlign update correctly | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-08 | addOverlay with emoji type creates EmojiOverlay at center | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-09 | SVG sticker: DOMPurify sanitizes malicious SVG; PNG sticker: stored as base64 in stickerRegistry | unit | `npx vitest run src/test/phase13-sticker-upload.test.ts` | ❌ Wave 0 |
| OVL-10–12 | Drag/resize/rotate update overlay x/y/width/rotation in canvas space | unit | `npx vitest run src/test/phase13-overlay-handles.test.ts` | ❌ Wave 0 |
| OVL-13 | deleteOverlay removes entry; keyboard Delete key triggers delete | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-14 | bringForward increments zIndex; sendBackward decrements; render order follows | unit | `npx vitest run src/test/phase13-overlay-store.test.ts` | ❌ Wave 0 |
| OVL-15 | setSelectedNode(id) clears selectedOverlayId; setSelectedOverlayId(id) clears selectedNodeId | unit | `npx vitest run src/test/phase13-selection.test.ts` | ❌ Wave 0 |
| OVL-16 | drawOverlaysToCanvas renders text/emoji/sticker at correct canvas coordinates | unit | `npx vitest run src/test/phase13-overlay-export.test.ts` | ❌ Wave 0 |
| OVL-17 | StickerOverlay nodes have no base64 data; data lives only in stickerRegistry | unit | `npx vitest run src/test/phase13-sticker-upload.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/test/phase13-overlay-store.test.ts` — covers OVL-01 through OVL-08, OVL-13, OVL-14
- [ ] `src/test/phase13-sticker-upload.test.ts` — covers OVL-09, OVL-17
- [ ] `src/test/phase13-overlay-handles.test.ts` — covers OVL-10, OVL-11, OVL-12 (pointer event math)
- [ ] `src/test/phase13-selection.test.ts` — covers OVL-15 mutual exclusion
- [ ] `src/test/phase13-overlay-export.test.ts` — covers OVL-16 canvas draw pass

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | YES — SVG file uploads | `dompurify` with `USE_PROFILES: { svg: true }` at upload time |
| V5 Input Validation | YES — text overlay content | No special sanitization needed; content stored as plain string, rendered via DOM text nodes and ctx.fillText() (not innerHTML) |
| V2 Authentication | No | Client-side only; no auth surface |
| V4 Access Control | No | No multi-user; no server |
| V6 Cryptography | No | No secrets or encryption |

### Known Threat Patterns for SVG Upload

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SVG with `<script>` tag | Spoofing / Tampering | DOMPurify removes `<script>` before storage |
| SVG with `onload` attribute | Elevation of privilege | DOMPurify removes event handlers |
| SVG with `<foreignObject>` + JS | Tampering | DOMPurify blocks foreignObject in svg profile |
| Base64-encoded JS in SVG data URIs | Tampering | DOMPurify strips data URIs in attributes |
| Oversized SVG causing memory exhaustion | Denial of Service | File size limit check before parsing (recommend: 2MB cap) |

**Critical note on rendering path:** If SVG is stored as a blob URL and rendered via `<img src={blobUrl}>`, the browser sandboxes script execution — XSS is not possible through the img element. However, if SVG is injected as `innerHTML` (e.g., for inline SVG rendering), unsanitized content would execute. D-07 specifies sanitization at upload time regardless of rendering path. [VERIFIED: CONTEXT.md D-07]

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/store/gridStore.ts` — pushSnapshot pattern, history structure, mediaRegistry, static editorStore import
- Existing codebase: `src/store/editorStore.ts` — selectedNodeId, canvasScale, extension patterns
- Existing codebase: `src/Grid/Divider.tsx` — setPointerCapture + canvasScale coordinate conversion
- Existing codebase: `src/lib/export.ts` — renderNode, drawLeafToCanvas, imageCache pattern
- Existing codebase: `src/Grid/CanvasWrapper.tsx` — canvas-surface CSS scale, sibling insertion point
- Existing codebase: `src/components/TemplatesPopover.tsx` — popover pattern for emoji picker
- npm registry: emoji-mart@5.6.0, @emoji-mart/react@1.1.1, @emoji-mart/data@1.2.1
- npm registry: dompurify@3.3.3, @types/dompurify@3.2.0

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-25 — all implementation decisions are locked from the discuss phase

### Tertiary (LOW confidence / ASSUMED)
- emoji-mart `<Picker>` callback shape `{ native: string }` (A1)
- DOMPurify `USE_PROFILES` API for SVG (A2)
- Google Fonts URL format (A3)
- `document.fonts.ready` cross-browser behavior for canvas (A4)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — emoji-mart and dompurify versions verified on npm registry; all other dependencies already in package.json
- Architecture: HIGH — all patterns are direct extensions or mirrors of verified existing code
- Pitfalls: HIGH — coordinate space and snapshot bloat pitfalls are directly derived from existing codebase decisions; font loading pitfall is MEDIUM (A4 assumption)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days — stable libraries, no fast-moving dependencies in scope)
