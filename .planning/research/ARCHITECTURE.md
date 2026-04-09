# Architecture Research

**Domain:** Client-side browser image/video collage editor — v1.2 feature integration
**Researched:** 2026-04-08
**Confidence:** HIGH (based on direct codebase reading, no external sources required)

---

## v1.2 Integration Analysis

This document answers exactly how each v1.2 feature integrates with the existing StoryGrid architecture. All analysis is derived from reading the actual source files, not assumptions.

---

## 1. Effects / Filters Data Model

### Where effects live

**Put effects on `LeafNode` directly** — not in a parallel map.

`LeafNode` in `src/types/index.ts` already holds per-cell render state (`panX`, `panY`, `panScale`, `fit`, `objectPosition`, `backgroundColor`). Effects follow the same pattern: they are part of the cell's visual description and travel with the tree through undo/redo snapshots. A parallel map (keyed by nodeId) would create a synchronization problem: when a cell is removed via `removeNode`, the effects map entry would require a separate cleanup path that doesn't exist today. Tree-local state avoids this entirely.

Proposed addition to `LeafNode`:

```typescript
effects?: {
  brightness: number;   // 0–200, default 100 (CSS filter uses 0–2 float, store as 0–200 int)
  contrast: number;     // 0–200, default 100
  saturation: number;   // 0–200, default 100 (CSS: saturate())
  blur: number;         // 0–20px, default 0
  preset: string | null; // 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool' | null
};
```

The `effects` field is optional so that tree snapshots created before v1.2 remain valid — callers treat `undefined` as default (no effect). A `resetEffects` action on gridStore calls `updateCell(id, { effects: undefined })`.

### Undo/redo history impact

Effects live in the tree → they are included in every `pushSnapshot` call automatically. `structuredClone` handles the nested object. A single slider adjustment pushes one snapshot (same cadence as fit toggle or pan). The 50-entry cap is unchanged; a typical slider drag that fires on every `input` event would flood history. **Debounce slider commits**: accumulate slider position in local React state, call `updateCell` only on `pointerup` / `blur` (one snapshot per drag gesture, not one per pixel). This matches how Figma and most design tools handle continuous sliders.

### Applying effects in `drawLeafToCanvas()` — `src/lib/export.ts`

Use `ctx.filter` before `drawImage`. The Canvas 2D filter string is composed from the effects struct:

```typescript
function buildFilterString(effects: LeafNode['effects']): string {
  if (!effects) return 'none';
  const parts: string[] = [];
  if (effects.brightness !== 100) parts.push(`brightness(${effects.brightness / 100})`);
  if (effects.contrast !== 100) parts.push(`contrast(${effects.contrast / 100})`);
  if (effects.saturation !== 100) parts.push(`saturate(${effects.saturation / 100})`);
  if (effects.blur > 0) parts.push(`blur(${effects.blur}px)`);
  return parts.length ? parts.join(' ') : 'none';
}
```

Presets expand to fixed filter strings (e.g., `bw` → `grayscale(1)`, `sepia` → `sepia(0.8) brightness(1.05)`, `warm` → `sepia(0.2) saturate(1.4) brightness(1.05)`). When a preset is active, its filter string replaces — not combines with — the slider values. Preset + manual sliders are mutually exclusive in the UI; selecting a preset resets sliders to their defaults and vice versa. Both resolve to the same `buildFilterString` output path.

`drawLeafToCanvas()` signature gains `effects` from the leaf node and applies the filter before drawing:

```typescript
ctx.save();
ctx.filter = buildFilterString(leaf.effects);
// existing drawCoverImage / drawContainImage / drawPanned... call
ctx.restore(); // restores ctx.filter = 'none'
```

The filter is reset in `ctx.restore()` so it does not leak to subsequent draws (critical for the rAF loop where multiple cells share the same flush).

**CSS filter on the DOM canvas (for preview) vs Canvas API filter (for export):** Do NOT use CSS `filter:` on the `<canvas>` element itself. CSS filters on the `<canvas>` DOM node would work visually in the preview but are impossible to replicate in the export path (the export uses an offscreen canvas that has no CSS context). Using `ctx.filter` consistently in `drawLeafToCanvas()` guarantees WYSIWYG parity between preview and export — the same code runs both paths. This is the same design decision that drove replacing html-to-image with the Canvas API renderer.

**Browser support:** `ctx.filter` is supported in Chrome 52+, Firefox 49+, Safari 18. The project targets Safari 15+. Safari 15 does NOT support `ctx.filter`. For Safari 15–17 fallback: either (a) silently skip filter application (effects appear unfiltered in Safari 15 preview and export), or (b) apply CSS filter to the DOM canvas for preview-only and document the export gap. Option (a) is simpler and honest. The blur effect could fall back to a manual convolution pass but that is out of scope for v1.2.

### Effects in the video export (MediaRecorder / `renderGridIntoContext`)

`renderNode` in `src/lib/export.ts` calls `drawLeafToCanvas(ctx, video, rect, leaf)`. Because `drawLeafToCanvas` now applies `ctx.filter` from `leaf.effects`, the video export gets effects for free with zero changes to `videoExport.ts` or `renderGridIntoContext`. The filter is applied per-frame automatically in the `setInterval` loop.

### Files touched for effects data model

- `src/types/index.ts` — add `effects?` field to `LeafNode`
- `src/lib/export.ts` — add `buildFilterString()`, apply in `drawLeafToCanvas()`
- `src/store/gridStore.ts` — add `setEffects(nodeId, effects)` action (thin wrapper around `updateCell`)
- `src/lib/tree.ts` — ensure `createLeaf()` initialises `effects: undefined` (no change needed if optional)

### New files for effects UI

- `src/Grid/EffectsPanel.tsx` — slider + preset picker, shown in sidebar when cell selected
- `src/Editor/Sidebar.tsx` — mount `<EffectsPanel>` in the selected cell panel section

---

## 2. Overlay Layer Data Model

### Store placement

Create a **new `overlayStore`** — do NOT extend `gridStore` or `editorStore`.

Rationale: overlays are a distinct data domain from the grid tree. Mixing them into `gridStore` would contaminate the `history` snapshots with overlay data (overlays need their own undo stack or should not be undoable at all — see below). `editorStore` is for ephemeral UI state, not persistent document data. A dedicated store follows the existing `gridStore` / `editorStore` separation pattern.

Overlay type definition (new file `src/types/overlay.ts`):

```typescript
export type OverlayType = 'text' | 'emoji' | 'image-sticker';

export type BaseOverlay = {
  id: string;           // nanoid
  type: OverlayType;
  x: number;            // 0–1080 px in canvas coordinate space
  y: number;            // 0–1920 px in canvas coordinate space
  width: number;        // px in canvas coordinate space
  height: number;       // px in canvas coordinate space
  rotation: number;     // degrees, default 0
  zIndex: number;       // integer, stacking order
};

export type TextOverlay = BaseOverlay & {
  type: 'text';
  content: string;
  fontFamily: string;   // e.g. 'Inter', 'Serif'
  fontSize: number;     // px in canvas coordinate space
  fontWeight: number;   // 400 | 700
  color: string;        // hex
  align: 'left' | 'center' | 'right';
};

export type EmojiOverlay = BaseOverlay & {
  type: 'emoji';
  emoji: string;        // single emoji character
};

export type ImageStickerOverlay = BaseOverlay & {
  type: 'image-sticker';
  mediaId: string;      // references mediaRegistry (PNG/SVG uploaded by user)
};

export type Overlay = TextOverlay | EmojiOverlay | ImageStickerOverlay;
```

`overlayStore` state:

```typescript
type OverlayStoreState = {
  overlays: Overlay[];
  selectedOverlayId: string | null;
  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, updates: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;
  reorderOverlay: (id: string, direction: 'up' | 'down') => void;
  clearOverlays: () => void;
};
```

### Rendering overlays in the preview

Render overlays as **DOM elements (divs) positioned absolutely in canvas coordinate space**, NOT as a second `<canvas>` layer.

Placement: a sibling `<div>` inside `canvas-surface` (the 1080×1920 div in `CanvasWrapper.tsx`), rendered after `<GridNodeComponent>` and `<SafeZoneOverlay>`. It fills the full 1080×1920 canvas-space area with `position: absolute; inset: 0; pointer-events: none` (pointer-events re-enabled only on individual overlay items). The canvas CSS `transform: scale(finalScale)` on `canvas-surface` scales all children including this layer — no separate coordinate translation needed.

```
canvas-surface (1080×1920, scale(finalScale))
  ├── GridNodeComponent          (grid tree, canvas elements)
  ├── SafeZoneOverlay            (striped dim overlay)
  └── OverlayLayer               (NEW — absolute, inset-0, pointer-events-none)
        ├── OverlayItem (text)   (absolute, pointer-events-auto)
        ├── OverlayItem (emoji)  (absolute, pointer-events-auto)
        └── OverlayItem (image)  (absolute, pointer-events-auto)
```

Each `OverlayItem` is positioned with `style={{ left: x, top: y, width, height, transform: `rotate(${rotation}deg)` }}` in canvas pixels. Because `canvas-surface` is 1080×1920 CSS pixels (then scaled down), the overlay coordinate system is directly in canvas pixels — no scaling math needed in the overlay component.

Drag/resize interaction on overlays: native pointer events on each `OverlayItem` div (`onPointerDown`, `onPointerMove`, `onPointerUp`). This is simpler than integrating @dnd-kit for free-position overlays. Resize handles are small corner/edge div handles that dispatch `updateOverlay` on pointer move.

### Selection: `selectedOverlayId` vs `selectedNodeId`

Keep both independently. They are mutually exclusive at the interaction level: clicking an overlay sets `selectedOverlayId` and clears `selectedNodeId` (via `editorStore.setSelectedNode(null)`). Clicking a cell clears `selectedOverlayId` via `overlayStore.selectOverlay(null)`. This is two separate store writes on click events — no shared coordination mechanism needed, just explicit calls in each click handler.

The active `panModeNodeId` in `editorStore` should also clear when an overlay is selected. Add: `overlayStore.selectOverlay(id)` calls `editorStore.getState().setPanModeNodeId(null)`.

### Hit-testing

DOM overlays use native browser hit-testing automatically — no custom hit detection needed. The `pointer-events-none` on `OverlayLayer` plus `pointer-events-auto` on individual `OverlayItem` elements lets events fall through to `canvas-surface` (background click) or be captured by the specific overlay div. This is far simpler than canvas-based hit testing (which would require manual AABB or pixel-reading logic).

### Undo/redo for overlays

Two options:

**Option A (recommended):** Overlay mutations do NOT go into gridStore history. Overlays have their own lightweight history array in `overlayStore` (same pattern: array of `Overlay[]` snapshots, 50-entry cap, index pointer). Undo/redo key bindings (`Ctrl+Z`, `Ctrl+Shift+Z`) need to be aware of which domain is "active" (cell selected → undo grid action; overlay selected → undo overlay action). Implement by checking `selectedOverlayId` in the keyboard shortcut handler.

**Option B (simpler initially):** No undo for overlays in v1.2. The overlay panel has "delete" as the only destructive action. This matches the v1.0 approach of deferring undo to a later phase. Acceptable for v1.2 if time is constrained.

Option A is architecturally cleaner; Option B ships faster. Document the choice in PROJECT.md Key Decisions.

### Exporting overlays

`renderGridIntoContext` receives an `overlays` parameter and renders them as a post-pass after all grid cells are drawn. Text overlays use `ctx.fillText` / `ctx.font`. Emoji overlays use `ctx.fillText` with the emoji character. Image sticker overlays use `drawImage` (loading from `mediaRegistry` by `mediaId`).

The overlay coordinate space (1080×1920 canvas pixels) is identical to the export canvas coordinate space — no transform needed. The post-pass renders overlays in zIndex order.

```typescript
// In renderGridIntoContext, after renderNode():
if (overlays?.length) {
  await renderOverlaysToContext(ctx, overlays, mediaRegistry, imageCache);
}
```

New function `renderOverlaysToContext()` in `src/lib/export.ts`.

For video export (`videoExport.ts`), the same `renderGridIntoContext` call gains the `overlays` parameter — overlays are burned into every frame (they are static in v1.2; animated overlays are deferred).

### Files touched for overlay layer

- `src/types/overlay.ts` — new file, overlay type definitions
- `src/store/overlayStore.ts` — new file, overlayStore
- `src/Grid/OverlayLayer.tsx` — new file, renders overlay DOM layer
- `src/Grid/OverlayItem.tsx` — new file, individual overlay with drag/resize handles
- `src/Grid/CanvasWrapper.tsx` — mount `<OverlayLayer>` as child of `canvas-surface`
- `src/lib/export.ts` — add `renderOverlaysToContext()`, add `overlays` param to `renderGridIntoContext` and `renderGridToCanvas`
- `src/lib/videoExport.ts` — pass `overlays` through to `renderGridIntoContext`
- `src/Editor/Sidebar.tsx` — overlay controls panel when overlay is selected
- `src/Editor/Toolbar.tsx` — "Add Text" / "Add Sticker" toolbar buttons

---

## 3. Persistence Data Model

### `.storygrid` JSON file structure

```typescript
type StorygridFile = {
  version: 2;                                    // bump on breaking schema change
  name: string;
  createdAt: string;                             // ISO 8601
  updatedAt: string;
  tree: GridNode;                                // full tree (ContainerNode | LeafNode)
  mediaRegistry: Record<string, string>;         // mediaId → base64 data URI (images only)
  mediaTypeMap: Record<string, 'image' | 'video'>;
  overlays: Overlay[];
  canvasSettings: {
    gap: number;
    borderRadius: number;
    backgroundMode: string;
    backgroundColor: string;
    backgroundGradientFrom: string;
    backgroundGradientTo: string;
    backgroundGradientDir: string;
  };
};
```

### Video blob URL strategy

**Strategy B: omit video blob URLs from the saved file, show "missing media" placeholders on import.**

Rationale:
- Strategy A (base64-encode videos) is untenable: a 30-second 1080p video is ~50MB+ as raw bytes → ~67MB base64. localStorage quota is ~5–10MB. Even a `.storygrid` download would be unusably large.
- Strategy C (file references by name/size) requires a FileSystemAccessAPI picker on import, which Safari 15 does not support.
- Strategy B is the most pragmatic: on `.storygrid` import, cells whose `mediaId` references a video show the "Drop image or use Upload button" empty state. The user re-uploads the video. Image media (base64) restores fully.

Implementation: on export to `.storygrid`, filter `mediaRegistry` to only include entries where `mediaTypeMap[mediaId] === 'image'`. On import, set `mediaTypeMap` entries for any missing registry entries to `'video'` so the cell shows "video missing" styling (extend the empty-state placeholder to distinguish "no media" from "video not restored").

The `cleanupStaleBlobMedia` function already handles the case of blob URLs that don't survive page reload. The persistence import path follows the same cleanup pattern.

### Auto-save to localStorage

Subscribe to `gridStore` changes with a debounced writer (300ms debounce). Write the serialized current project to a localStorage key. On mount, check for an auto-save entry and offer "Restore unsaved changes?".

Storage key scheme:
- `sg_autosave` — current session's auto-save (always a single entry)
- `sg_projects` — JSON array of `{ id, name, updatedAt }` (the projects index)
- `sg_project_${id}` — full `StorygridFile` for each named project

The auto-save does not belong to the named project list unless the user explicitly saves. Conceptually: auto-save is "your last session's state"; named projects are "intentional saves".

**localStorage size concern:** A project with 10 high-res images at 1080px could be 3–8MB of base64. localStorage quota is browser-specific (~5MB on many browsers, ~10MB on Chrome). Warn on save if serialized size exceeds 3MB. For v1.2 the warning is sufficient; compression (LZString or CompressionStream API) is a potential v1.3 feature.

**Subscribe pattern** (not inside the store, in a React hook or a standalone module):

```typescript
// src/lib/persistence.ts
export function startAutoSave(): () => void {
  const flush = debounce(() => {
    const state = useGridStore.getState();
    const editorState = useEditorStore.getState();
    const overlayState = useOverlayStore.getState();
    const serialized = serializeProject('Untitled', state, editorState, overlayState);
    try {
      localStorage.setItem('sg_autosave', JSON.stringify(serialized));
    } catch {
      // Storage quota exceeded — silent fail or toast warning
    }
  }, 300);
  
  const unsub1 = useGridStore.subscribe(flush);
  const unsub2 = useEditorStore.subscribe(flush);
  const unsub3 = useOverlayStore.subscribe(flush);
  return () => { unsub1(); unsub2(); unsub3(); };
}
```

Called in `EditorShell.tsx` on mount, alongside `cleanupStaleBlobMedia`.

### Migration

Version field in `StorygridFile`. A `migrate(raw: unknown): StorygridFile` function in `src/lib/persistence.ts` switches on `raw.version` and applies transforms. Version 1 (pre-v1.2) has no `overlays` field — migration adds `overlays: []`.

### Files touched for persistence

- `src/types/overlay.ts` — already exists after overlay feature
- `src/lib/persistence.ts` — new file: `serializeProject`, `deserializeProject`, `startAutoSave`, `migrate`, `loadNamedProjects`, `saveNamedProject`, `deleteNamedProject`
- `src/Editor/EditorShell.tsx` — call `startAutoSave()` on mount; handle auto-save restore prompt
- `src/Editor/Toolbar.tsx` — "Save Project", "Load Project", "Export .storygrid", "Import .storygrid" buttons (or a Projects menu)
- `src/Editor/ProjectsPanel.tsx` — new file: named project list UI (save/load/rename/delete)

---

## 4. Per-Cell Audio Toggle

### Data model

Add `audioEnabled: boolean` to `LeafNode`, defaulting to `true`.

```typescript
// src/types/index.ts
export type LeafNode = {
  // ... existing fields ...
  audioEnabled: boolean; // default true; only meaningful when mediaType === 'video'
};
```

The field is always present (not optional) to avoid null-checks throughout. For image cells the value is irrelevant but harmless. `createLeaf()` in `src/lib/tree.ts` sets `audioEnabled: true`.

This field is part of the tree → undo/redo snapshots include it automatically. Toggling audio for a cell pushes one snapshot via `updateCell(id, { audioEnabled: false })`.

### ActionBar and Sidebar UI

ActionBar gains a `Volume2` / `VolumeX` icon button (from lucide-react, both are available). The button is shown only when `isVideo` is true (the `ActionBar` component already receives `hasMedia` and knows `fit`; it needs to additionally receive `isVideo` and `audioEnabled`). Alternatively, `ActionBar` reads `mediaType` from the store directly (consistent with how it reads `mediaId` today).

Sidebar `SelectedCellPanel` gets a toggle row: "Cell audio: On / Off" (speaker icon, click to toggle). This mirrors the existing "Fit: Cover / Contain" toggle row pattern.

### Video export audio integration

**Current state:** `exportVideoGrid` in `src/lib/videoExport.ts` creates dedicated export video elements with `video.muted = true` — the MediaRecorder pipeline is **video-only**. The canvas `captureStream(FPS)` captures no audio track.

**What needs to change:** For cells where `audioEnabled === true`, the video element's audio must be routed to the MediaRecorder stream. For cells where `audioEnabled === false`, audio is muted.

Architecture for audio mixing:

1. Remove `video.muted = true` from export video elements for cells that have `audioEnabled: true`.
2. Create a `AudioContext` and a `MediaStreamAudioDestinationNode`.
3. For each export video element with `audioEnabled: true`, create a `MediaElementAudioSourceNode` from the video element, connect it to a `GainNode` (gain = 1), connect the gain node to the `AudioDestinationNode`.
4. Get the audio track from `audioDestination.stream`.
5. Add the audio track to the canvas `captureStream` by calling `stream.addTrack(audioTrack)`.
6. The `MediaRecorder` now receives both video and audio tracks.

```typescript
// Conceptual — inside buildExportVideoElements or a new buildExportAudio()
const audioCtx = new AudioContext();
const audioDest = audioCtx.createMediaStreamDestination();

for (const [mediaId, video] of exportVideoElements) {
  const leaf = findLeafByMediaId(root, mediaId); // need helper
  if (leaf?.audioEnabled) {
    video.muted = false;
    const src = audioCtx.createMediaElementSource(video);
    src.connect(audioDest);
  }
  // else: video.muted remains true (default in buildExportVideoElements)
}

// After: stream.addTrack(audioDest.stream.getAudioTracks()[0])
```

Caveat: `MediaElementAudioSourceNode` requires the video to not be CORS-restricted. Blob URLs created from user-uploaded files are same-origin and are not restricted. No issue here.

Caveat: `AudioContext` must be created after a user gesture (browser autoplay policy). Export is always triggered by an explicit button click — this is satisfied.

Caveat: if NO cells have `audioEnabled: true`, do not add an audio track at all (the current behavior — video-only). Guard with `if (audioDest.stream.getAudioTracks().length > 0)`.

**Helper needed:** `findLeafByMediaId(root: GridNode, mediaId: string): LeafNode | null`. Walk the tree, return the leaf whose `mediaId` matches. Add to `src/lib/tree.ts`.

### Files touched for audio toggle

- `src/types/index.ts` — add `audioEnabled: boolean` to `LeafNode`
- `src/lib/tree.ts` — add `audioEnabled: true` in `createLeaf()`, add `findLeafByMediaId()` helper
- `src/Grid/ActionBar.tsx` — add audio toggle button (shown for video cells only)
- `src/Editor/Sidebar.tsx` — add audio toggle row in selected cell panel
- `src/lib/videoExport.ts` — add `buildExportAudio()` function; modify `exportVideoGrid` to assemble audio stream and add track to `captureStream`; pass `root` and `mediaTypeMap` through to audio builder (already available in `exportVideoGrid` signature)

---

## System Overview After v1.2

```
┌────────────────────────────────────────────────────────────────┐
│  React Component Layer                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │CanvasWrapper│ │OverlayLayer│ │  Sidebar   │ │  Toolbar   │  │
│  │(scale host) │ │(DOM divs)  │ │(cell+ovly) │ │(projects)  │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘  │
│        │              │              │              │           │
│  ┌─────▼──────────────▼──────────────▼──────────────▼──────┐   │
│  │  LeafNodeComponent (canvas rAF, drawLeafToCanvas+filter)  │   │
│  └─────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│  State Layer                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ gridStore  │  │ editorStore│  │overlayStore│  (NEW)         │
│  │tree+history│  │UI ephemeral│  │overlays+sel│               │
│  │mediaRegistry│  │zoom,tool.. │  │+history    │               │
│  └────────────┘  └────────────┘  └────────────┘               │
├────────────────────────────────────────────────────────────────┤
│  Lib / Pure Functions                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  export.ts │  │videoExport │  │persistence │  (NEW)         │
│  │drawLeafTo  │  │+audio mix  │  │serialize/  │               │
│  │Canvas      │  │(NEW)       │  │autosave    │               │
│  │+ctx.filter │  │            │  │            │               │
│  │+overlays   │  │            │  │            │               │
│  │(NEW)       │  │            │  │            │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└────────────────────────────────────────────────────────────────┘
```

---

## Recommended Build Order

Dependencies drive the order: data model must precede render, render must precede export.

### Phase A: Effects (no new stores, low risk, high visual payoff)

1. Extend `LeafNode` type with `effects?` field (`src/types/index.ts`)
2. Update `createLeaf()` in `src/lib/tree.ts` (no-op: field is optional)
3. Add `buildFilterString()` and apply `ctx.filter` in `drawLeafToCanvas()` (`src/lib/export.ts`)
4. Add `setEffects` action to `gridStore` (trivial wrapper around `updateCell`)
5. Build `EffectsPanel.tsx` — preset buttons + debounced sliders
6. Wire into Sidebar selected cell panel
7. Validate export parity: apply effects, export PNG, verify filter is applied in output

### Phase B: Per-cell audio toggle (minimal surface, isolated to videoExport.ts)

1. Add `audioEnabled: boolean` to `LeafNode` type, `createLeaf()`, and existing tree snapshot consumers
2. Add `findLeafByMediaId()` helper to `tree.ts`
3. Add ActionBar audio toggle button (video cells only)
4. Add Sidebar audio toggle row
5. Build `buildExportAudio()` in `videoExport.ts`, wire into `exportVideoGrid`
6. Test: two video cells, one muted, export and verify audio track presence

### Phase C: Overlay layer (new store + new render layer + export integration)

1. Define overlay types (`src/types/overlay.ts`)
2. Create `overlayStore.ts`
3. Build `OverlayLayer.tsx` and `OverlayItem.tsx` (render only, no interaction yet)
4. Mount `OverlayLayer` in `CanvasWrapper.tsx`, verify it scales correctly with canvas transform
5. Add drag/resize interaction to `OverlayItem`
6. Add `renderOverlaysToContext()` to `export.ts`, wire into PNG export
7. Wire into video export
8. Build Sidebar overlay controls panel
9. Add "Add Text" / "Add Sticker" toolbar buttons

### Phase D: Persistence (depends on overlays being done, since file format includes overlays)

1. Write `serializeProject()` / `deserializeProject()` / `migrate()` in `persistence.ts`
2. Wire auto-save subscription in `EditorShell.tsx`
3. Build auto-save restore prompt on mount
4. Build `ProjectsPanel.tsx` — named project list
5. Wire "Export .storygrid" and "Import .storygrid" to toolbar
6. Test round-trip: create, name, export file, import file, verify fidelity

---

## Component Boundaries

| Component / Module | Responsibility | Communicates With |
|--------------------|---------------|-------------------|
| `src/types/index.ts` | `LeafNode` shape (add `effects`, `audioEnabled`) | All consumers |
| `src/types/overlay.ts` | Overlay type definitions | `overlayStore`, `OverlayLayer`, `export.ts` |
| `src/store/overlayStore.ts` | Overlay CRUD + selection state | `OverlayLayer`, `OverlayItem`, Sidebar |
| `src/lib/export.ts` | `drawLeafToCanvas` (+ filters) + `renderOverlaysToContext` | `LeafNode.tsx`, `videoExport.ts`, export actions |
| `src/lib/videoExport.ts` | MediaRecorder pipeline + audio mixing | `exportVideoGrid`, `EditorShell` |
| `src/lib/persistence.ts` | Serialize/deserialize/autosave/migrate | `EditorShell`, `ProjectsPanel`, Toolbar |
| `src/Grid/OverlayLayer.tsx` | Render overlay DOM layer inside canvas-surface | `overlayStore`, `CanvasWrapper` |
| `src/Grid/OverlayItem.tsx` | Individual overlay with drag/resize | `overlayStore`, pointer events |
| `src/Grid/EffectsPanel.tsx` | Preset + slider UI for per-cell effects | `gridStore.updateCell` |
| `src/Editor/ProjectsPanel.tsx` | Named project list | `persistence.ts` |

---

## Key Integration Seams

### `drawLeafToCanvas()` in `src/lib/export.ts`

This single function is the WYSIWYG guarantee. It is called from:
- `LeafNode.tsx` `drawRef.current()` — preview rAF loop
- `renderNode()` in `export.ts` — PNG export
- `renderFrame()` in `videoExport.ts` via `renderGridIntoContext` — video export

Any change here propagates to all three paths automatically. Adding `ctx.filter` here is the lowest-risk, highest-leverage change in v1.2.

### `renderGridIntoContext()` in `src/lib/export.ts`

Gains an `overlays` parameter. All callers must be updated:
- `renderGridToCanvas()` — pass through
- `exportGrid()` — pass through
- `exportVideoGrid()` — pass through (overlays are burned into every frame)

The parameter should be optional (`overlays?: Overlay[]`) so no callers break without the overlay feature enabled.

### History snapshot shape in `gridStore.ts`

`pushSnapshot` calls `structuredClone({ root: plainRoot })`. The snapshot shape is `{ root: GridNode }`. Adding `effects` and `audioEnabled` to `LeafNode` is transparent — they are plain serializable values that `structuredClone` handles. No change to `pushSnapshot`. The `history` array type stays `Array<{ root: GridNode }>`.

### `cleanupStaleBlobMedia` in `gridStore.ts`

Blob URL stale cleanup on startup already handles video blob URLs disappearing after page reload. The persistence import path reuses this: after loading a `.storygrid` file, blob URL entries are absent (because they were omitted from the file). If any leaf `mediaId` maps to nothing in `mediaRegistry`, the cell renders as empty. No special cleanup code needed — the existing startup cleanup covers it.

### `videoElementRegistry` in `src/lib/videoRegistry.ts`

The audio toggle does not affect this registry. Export uses dedicated video elements (not the live registry elements) — `buildExportVideoElements` creates fresh elements. The `muted` property on export elements is controlled in `buildExportVideoElements` based on `audioEnabled`. The live UI elements remain `muted: true` always (they drive the preview rAF loop; the user hears preview audio via playback controls if desired — but that is a separate feature not in v1.2 scope).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: CSS filter on the DOM `<canvas>` element

**What:** Apply `style={{ filter: 'brightness(1.2)' }}` to the `<canvas>` element in `LeafNode.tsx` for fast preview.
**Why wrong:** CSS filters on the canvas DOM node are invisible to the offscreen export canvas. The result is a preview that looks different from the export — breaking the WYSIWYG guarantee that is a load-bearing architectural invariant.
**Instead:** Use `ctx.filter` inside `drawLeafToCanvas()` — one code path, consistent output.

### Anti-Pattern 2: Storing overlay coordinates in viewport / CSS pixels

**What:** Store overlay `x, y, width, height` in the viewport pixel space (post-scale).
**Why wrong:** `canvasScale` changes as the window resizes. Stored viewport-space coordinates would need to be re-projected on every resize. The export canvas is always 1080×1920 regardless of viewport.
**Instead:** Store coordinates in canvas pixel space (1080×1920). Render overlays inside `canvas-surface` (which is scaled by `canvasScale` via CSS transform) — the browser handles the scale automatically.

### Anti-Pattern 3: Mixing overlay history into `gridStore` history

**What:** Push overlay snapshots alongside grid tree snapshots into `gridStore.history`.
**Why wrong:** The history array entries are typed as `Array<{ root: GridNode }>`. Adding overlay state would require changing the snapshot shape, touching `pushSnapshot`, `undo`, and `redo`. It also couples two independent document domains.
**Instead:** `overlayStore` manages its own history array with the same push/cap/index pattern. Keyboard shortcut handler checks which domain is active before dispatching undo.

### Anti-Pattern 4: Using ffmpeg.wasm for audio mixing

**What:** Reach for ffmpeg.wasm to mix audio tracks from multiple video cells.
**Why wrong:** ffmpeg.wasm is 25MB+, requires COOP/COEP headers, and was explicitly replaced. The Web Audio API (`AudioContext`, `MediaElementAudioSourceNode`, `MediaStreamAudioDestinationNode`) handles the same mixing task in-browser with zero payload cost.
**Instead:** Web Audio API mixing with `AudioContext`, as described in the audio toggle section above.

### Anti-Pattern 5: Blocking the rAF loop with effects calculations

**What:** Compute filter strings inside `drawRef.current()` on every animation frame.
**Why wrong:** `buildFilterString()` is pure and cheap, so this is not a performance problem. However, regenerating the string every frame is unnecessary.
**Instead:** `buildFilterString` is called once per draw, which is already acceptable. If profiling shows it as a hot path, memoize the string on `LeafNode` mount when `effects` changes (via `useEffect`).

---

## Sources

All findings derived directly from reading:
- `/Users/radu/Developer/storygrid/src/types/index.ts`
- `/Users/radu/Developer/storygrid/src/store/gridStore.ts`
- `/Users/radu/Developer/storygrid/src/store/editorStore.ts`
- `/Users/radu/Developer/storygrid/src/lib/export.ts`
- `/Users/radu/Developer/storygrid/src/lib/videoExport.ts`
- `/Users/radu/Developer/storygrid/src/lib/videoRegistry.ts`
- `/Users/radu/Developer/storygrid/src/Grid/LeafNode.tsx`
- `/Users/radu/Developer/storygrid/src/Grid/ActionBar.tsx`
- `/Users/radu/Developer/storygrid/src/Grid/CanvasWrapper.tsx`
- `/Users/radu/Developer/storygrid/src/Editor/CanvasArea.tsx`
- `/Users/radu/Developer/storygrid/.planning/PROJECT.md`

MDN Web Docs (training data, HIGH confidence):
- `ctx.filter`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
- `AudioContext` / `MediaElementAudioSourceNode`: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- `MediaStreamAudioDestinationNode`: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode

---
*Architecture research for: StoryGrid v1.2 Effects, Overlays & Persistence*
*Researched: 2026-04-08*
