# Architecture Research — v1.5 Unified Drag-and-Drop UX

**Domain:** StoryGrid cell drag-and-drop engine replacement (desktop + mobile unified)
**Researched:** 2026-04-17
**Confidence:** HIGH for integration points (codebase verified). MEDIUM on specific library-internal details (Context7 verified for pragmatic-drag-and-drop; `@dnd-kit/core` derived from in-tree usage).

> **Note on scope:** This document answers *how* the new engine integrates with the existing StoryGrid architecture. It intentionally does not re-research library choice (covered by the v1.5 STACK research). The recommendations assume the selected library is **`pragmatic-drag-and-drop`** (Atlassian) — the only library in scope that cleanly unifies cell-to-cell drag + external file drag into one event bus. If the STACK research selects a different library the coordinate-math, store-side channel, and layering recommendations still apply; only the adapter file (`src/dnd/adapter/*`) changes.

---

## 1. System Overview — Where the New Engine Sits

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Browser viewport (fixed pixel space)                                      │
│                                                                            │
│  ┌─ document.body portals ──────────────────────────────────────────────┐ │
│  │  [ActionBar portal]  [DragPreviewPortal NEW]                         │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  <main workspace-main>                        (file-drop zone — NATIVE)    │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  canvas-container (flex, overflow-hidden)                          │   │
│  │  ┌─ canvas-surface (transform: scale(finalScale)) ───────────────┐ │   │
│  │  │                                                                │ │   │
│  │  │     ┌─ Grid (recursive tree) ───┐   ┌─ OverlayLayer (z=30) ─┐ │ │   │
│  │  │     │ Container → GridNode      │   │ text/emoji/sticker    │ │   │
│  │  │     │   ├─ LeafNode  (dnd src)  │   │ custom pointer events │ │   │
│  │  │     │   ├─ LeafNode  (dnd tgt)  │   │ pointer-events:none   │ │   │
│  │  │     │   └─ Divider (raw ptr)    │   │ on non-selected       │ │   │
│  │  │     └───────────────────────────┘   └───────────────────────┘ │ │   │
│  │  │                                                                │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  MobileCellTray (fixed, z=45, md:hidden, always mounted)                   │
│  MobileSheet (fixed bottom, z=40)                                          │
└────────────────────────────────────────────────────────────────────────────┘

                         ┌───────── DnD Engine Module (NEW) ─────────┐
                         │                                            │
     LeafNode  ──uses──▶ │   src/dnd/                                 │
     MobileCellTray      │   ├─ adapter/pragmatic.ts  (library glue)  │
     CanvasArea   ──────▶│   ├─ useCellDraggable(leafId)              │
                         │   ├─ useCellDropTarget(leafId)             │
                         │   ├─ useFileDropTarget(element)            │
                         │   ├─ dragStore.ts  (vanilla, non-undo)     │
                         │   ├─ computeDropZone(rect, point, scale)   │
                         │   ├─ DragPreviewPortal.tsx                 │
                         │   └─ index.ts (public API)                 │
                         │                                            │
                         │   External dependency:                     │
                         │   @atlaskit/pragmatic-drag-and-drop        │
                         └────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `src/dnd/adapter/pragmatic.ts` | Wraps `draggable({...})` + `dropTargetForElements({...})` + `dropTargetForExternal({...})` from pragmatic-drag-and-drop. Sole place the library is imported. | If STACK research picks something else, this file is the only thing to rewrite. |
| `src/dnd/useCellDraggable.ts` | Hook — given a cell `id`, returns a `ref` callback + `isSource` flag. Wires `onGenerateDragPreview`, writes to `dragStore`. | Called by `LeafNode` + `MobileCellTray` (for mobile handle). |
| `src/dnd/useCellDropTarget.ts` | Hook — given a cell `id`, returns a `ref` callback + `{ activeZone, isOver }`. Runs zone detection via `onDrag`. | Called by `LeafNode`. |
| `src/dnd/useFileDropTarget.ts` | Hook — given an element ref, registers as `dropTargetForExternal`, accepts files only. | Called by `CanvasArea` (workspace) and `LeafNode` (cell). |
| `src/dnd/dragStore.ts` | Vanilla Zustand store (NOT the gridStore). Holds ephemeral `{ status, sourceId, overId, activeZone, dragKind }`. | Side-channel pattern — same as `mediaRegistry`, explicitly outside undo history. |
| `src/dnd/computeDropZone.ts` | Pure function `(rect, clientPoint, canvasScale) → 'center'\|'top'\|'bottom'\|'left'\|'right'`. | Unit-tested in isolation. Transform-aware math lives here. |
| `src/dnd/DragPreviewPortal.tsx` | Renders the semi-opaque cell-content ghost into `document.body` during drag. | Mounted once by `EditorShell`. |

---

## 2. Module / File Layout

### New files

```
src/dnd/
├── index.ts                          # Public API barrel
├── adapter/
│   ├── pragmatic.ts                  # @atlaskit/pragmatic-drag-and-drop wrapper
│   └── __tests__/
│       └── pragmatic.test.ts
├── dragStore.ts                      # Ephemeral state (NOT in undo history)
├── computeDropZone.ts                # Pure coord math
├── computeDropZone.test.ts           # 5-zone unit tests
├── useCellDraggable.ts               # Hook: cell as drag source
├── useCellDropTarget.ts              # Hook: cell as drop target
├── useFileDropTarget.ts              # Hook: external file drop target
├── DragPreviewPortal.tsx             # Ghost renderer
├── DropZoneIndicators.tsx            # 5-icon overlay component (top/right/bot/left/center)
└── __tests__/
    ├── useCellDraggable.test.tsx
    ├── useCellDropTarget.test.tsx
    └── integration.test.tsx
```

### Files to modify

| File | Change |
|------|--------|
| `src/Grid/LeafNode.tsx` | Remove `useDraggable`/`useDroppable`/`useDndMonitor` imports. Replace with `useCellDraggable(id)` + `useCellDropTarget(id)` + `useFileDropTarget`. Remove `DragZoneRefContext`, `activeZone` local state, 5 inline overlay JSX blocks, `isPendingDrag` + hold-pulse animation, `pointerPosRef`, document-level pointermove listener. Delete cell-level `onDragOver/onDragLeave/onDrop` file handlers — centralise into `useFileDropTarget`. |
| `src/Grid/CanvasWrapper.tsx` | Remove `DndContext` wrapper, `MouseSensor`/`TouchSensor`/`KeyboardSensor` config, `activeZoneRef`, `handleDragEnd`. Remove `DragZoneRefContext.Provider`. Drop the `@dnd-kit/core` import entirely. Wrapper becomes a pure layout/render component. |
| `src/Editor/CanvasArea.tsx` | Replace native `onDragEnter/Over/Leave/Drop` handlers with `useFileDropTarget(mainRef)`. Keep workspace-level file drop pill UI (`isFileDragOver`) — source `isFileDragOver` from `dragStore` instead of local state. |
| `src/Editor/EditorShell.tsx` | Mount `<DragPreviewPortal />` once at top level (above canvas). |
| `src/Editor/MobileCellTray.tsx` | Add a dedicated "drag handle" button (e.g. `GripVertical` icon) that calls `useCellDraggable(selectedNodeId)` — this replaces the long-press-anywhere model with an explicit handle (much clearer UX, addresses v1.4 phase 25 flakiness). |
| `src/Grid/Divider.tsx` | Add `data-dnd-ignore="true"` + guard in `onPointerDown` to `e.stopPropagation()` so pragmatic's element adapter (which relies on native `dragstart`) never starts from within a divider hit area. |
| `src/Grid/OverlayLayer.tsx` | Add `data-dnd-ignore="true"` on root wrapper. Selected overlays set `pointer-events: auto` already — no conflict because pragmatic uses `dragstart`, not pointer capture; overlay pointer handlers still win. |
| `src/store/gridStore.ts` | **No changes to actions.** `moveCell` already handles no-op guards (`fromId === toId`, source/target not found, not a leaf) *without* pushing a snapshot. Drag abort = no store call = no undo entry. Drag commit = one `moveCell` call = one undo entry. Explicitly verified against lines 473-494. |
| `package.json` | Remove `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Add `@atlaskit/pragmatic-drag-and-drop` + `@atlaskit/pragmatic-drag-and-drop-auto-scroll`. |

### Files to delete

| File | Why |
|------|-----|
| (none standalone) — `DragZoneRefContext` is defined inline in `CanvasWrapper.tsx`. Its removal is a line-level edit, not a file delete. |
| `src/hooks/useDndMonitor.ts` does NOT exist in-tree — the `useDndMonitor` imported in `LeafNode.tsx` is the `@dnd-kit/core` export. No local file to delete; only the import goes. |

**Caveat:** The orchestrator's prompt references `src/context/DragZoneRefContext.tsx` and `src/hooks/useDndMonitor.ts` as local files; neither exists. The ref context is inline in `CanvasWrapper.tsx` (line 20); `useDndMonitor` is re-exported from `@dnd-kit/core`. Removing `@dnd-kit` from `package.json` removes both.

---

## 3. Store Integration — Where Drag State Lives

### Decision: **Separate vanilla Zustand store** (`src/dnd/dragStore.ts`)

Drag state has three hard requirements:

1. **MUST NOT enter undo history snapshots.** Same reason `mediaRegistry` and `mediaTypeMap` are excluded from `pushSnapshot` in `gridStore.ts` — snapshots are serialised via `structuredClone`, and ephemeral pointer-tick state pollutes every undo entry.
2. **Multiple components need read-access** (LeafNode's zone overlay, CanvasArea's file-drop pill, DragPreviewPortal, MobileCellTray's lift cue). React context would cause a re-render cascade on every pointer tick.
3. **State must be writable from non-React adapter code** (pragmatic's `onDrag` callbacks are plain functions).

### Store shape

```typescript
// src/dnd/dragStore.ts
import { create } from 'zustand';

export type DragKind = 'cell' | 'file' | null;
export type DropZone = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type DragStatus = 'idle' | 'dragging';

type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;      // leaf id when kind='cell', null for 'file'
  overId: string | null;        // leaf id currently being hovered, or '__workspace__'
  activeZone: DropZone | null;  // null when over workspace background
  // Actions
  beginCellDrag: (sourceId: string) => void;
  beginFileDrag: () => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
};

export const useDragStore = create<DragState>((set) => ({
  status: 'idle',
  kind: null,
  sourceId: null,
  overId: null,
  activeZone: null,
  beginCellDrag: (sourceId) => set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null }),
  beginFileDrag: () => set({ status: 'dragging', kind: 'file', sourceId: null, overId: null, activeZone: null }),
  setOver: (overId, activeZone) => set({ overId, activeZone }),
  end: () => set({ status: 'idle', kind: null, sourceId: null, overId: null, activeZone: null }),
}));
```

### Why not Zustand gridStore?

- `gridStore` writes flow through Immer middleware + `pushSnapshot`. Pointer tick rate (up to 60 Hz) would produce 60 history entries per second.
- Even excluding drag fields from snapshots (like `mediaRegistry` is excluded) would mean carrying a branch condition in every store mutation. Separate store is cleaner.

### Why not React context / ref?

- **Context:** every pointer tick would re-render every subscribed descendant of the provider — unacceptable for a recursive tree with up to ~20 leaves.
- **Raw ref:** works for reads but cannot drive React state-derived JSX (e.g., conditionally mounting the drop-zone indicators). Current Phase 25 code does exactly this (`DragZoneRefContext`) and the result is the hybrid "useDndMonitor writes ref, writes React state, writes ref again" mess.

### Why not library-provided state?

- Pragmatic does not expose a reactive store. It is callback-based. Consumers must subscribe via `monitorForElements` (a plain JS subscription API) or wrap callbacks themselves. Wrapping into a Zustand store gives React-native selectors + ability to use `useShallow`.

### Selector discipline (prevents re-render cascades)

LeafNode `A` only re-renders when drag hover actually changes to/from `A`:

```typescript
// In LeafNode
const isOver = useDragStore(s => s.overId === id);
const activeZone = useDragStore(s => s.overId === id ? s.activeZone : null);
const isDragSource = useDragStore(s => s.sourceId === id);
```

Because these selectors return primitives/null, Zustand's default Object.is comparison prevents re-render unless the value for *this* leaf changes.

---

## 4. Hover + Drop Zone Computation — Pointer-Move Strategy

### Decision: Zone detection runs inside the pragmatic `onDrag` adapter callback, NOT in a React effect.

Pragmatic's `dropTargetForElements({ element, onDrag })` fires per pointer-move while `element` is the current drop target. Inside `onDrag` we have:

- `location.current.input.clientX` / `clientY` (viewport coords)
- `element` (the target DOM node)

### Algorithm (pure, unit-testable)

```typescript
// src/dnd/computeDropZone.ts
export function computeDropZone(
  rect: DOMRect,        // element.getBoundingClientRect() — already in viewport pixels
  pointer: { x: number; y: number },
  _canvasScale: number, // not needed: getBoundingClientRect already accounts for transform:scale
): DropZone {
  const x = pointer.x - rect.left;
  const y = pointer.y - rect.top;
  const w = rect.width;
  const h = rect.height;
  // threshold = 20% of the shorter side, clamped to >= 20px (preserves Phase 9 semantics)
  const threshold = Math.max(20, Math.min(w, h) * 0.2);
  if (y < threshold) return 'top';
  if (y > h - threshold) return 'bottom';
  if (x < threshold) return 'left';
  if (x > w - threshold) return 'right';
  return 'center';
}
```

### Transform-aware coordinate handling (CRITICAL)

The canvas uses `transform: scale(finalScale)` on `canvas-surface` (see `CanvasWrapper.tsx:127`). Two specific properties of `getBoundingClientRect()` make the math simple:

- **`rect.width`, `rect.height`** → already reflect the *rendered* (scaled) size. A 540px-tall leaf at scale 0.5 reports `rect.height = 270`.
- **`rect.left`, `rect.top`** → already in viewport coords.
- **`pointer.clientX` / `clientY`** → also viewport coords.

Therefore the pointer-relative math `pointer.x - rect.left` is already scale-correct. **No division by `canvasScale` is needed for zone detection.** (Compare: the `Divider` component at line 74-76 *does* divide by canvasScale because it converts a delta into a logical 1080×1920 coordinate for weight computation — a different problem.)

### Re-render avoidance

- Zone detection writes to `dragStore` via `setOver(id, zone)`.
- `dragStore.setOver` uses strict equality — Zustand skips the set if the zone hasn't changed. No React re-render when pointer moves *within* the same zone.
- Only the single LeafNode whose zone changed re-renders (scoped selectors), plus the `DropZoneIndicators` child of that leaf.
- Non-drop-target leaves NEVER re-render — their selectors return `{ isOver: false, activeZone: null }` and that tuple is stable.

### What about the full tree re-rendering?

- `React.memo` on `GridNodeComponent`, `ContainerNodeComponent`, `LeafNodeComponent` (verified in all three files) already prevents structural re-render unless tree shape or props change.
- Drag state is not in gridStore → no structural re-render trigger.

---

## 5. Drag Ghost Rendering

### Decision: **Custom native drag preview via `setCustomNativeDragPreview`, rendered into a portal under `document.body`.**

This is pragmatic-drag-and-drop's `onGenerateDragPreview` hook. The library creates a hidden container element inside `document.body`, calls our `render({ container })` callback, and hands it to the browser as the drag image.

### Why this wins over the alternatives

| Option | Verdict | Why |
|--------|---------|-----|
| (a) Portal into `document.body` + manual pointer tracking | Rejected | Re-implements what pragmatic already ships. Extra code, extra bugs. |
| (b) Library-provided `DragOverlay` (@dnd-kit style) | N/A | Pragmatic has no equivalent — it uses native HTML5 drag, which hands preview control to the OS compositor. The compositor renders at viewport DPR with no React overhead. |
| **(c) Custom native preview via `setCustomNativeDragPreview`** | **Chosen** | OS-compositor quality, no re-renders during drag, built-in. |

### Scale-context concern — resolved

The cell lives inside `canvas-surface` with `transform: scale(finalScale)`. If we copy the cell's DOM into the preview *without* counter-scaling, the preview is already the correct rendered size because `getBoundingClientRect()` on the source element gives us the post-scale dimensions directly. The preview mounts under `document.body` at an un-scaled parent, so we set its width/height in CSS pixels to `rect.width` × `rect.height` exactly. No double-scaling.

### Implementation sketch

```tsx
// src/dnd/DragPreviewPortal.tsx — React portal pattern per pragmatic docs
import { createPortal } from 'react-dom';
// ...
draggable({
  element: leafEl,
  onGenerateDragPreview({ nativeSetDragImage, source, location }) {
    const rect = source.element.getBoundingClientRect();
    setCustomNativeDragPreview({
      nativeSetDragImage,
      getOffset: preserveOffsetOnSource({ element: source.element, input: location.current.input }),
      render({ container }) {
        // Render a simplified cell (canvas snapshot OR cloneNode(true)) into `container`
        // Size: width = rect.width, height = rect.height; opacity: 0.75
        setPreviewContainer(container);  // triggers a React portal render
        return () => setPreviewContainer(null);
      },
    });
  },
});
```

### Content strategy — two viable approaches

1. **DOM clone.** `source.element.cloneNode(true)` copies the LeafNode including its `<canvas>` (cloneNode does NOT copy canvas pixels — the cloned canvas renders blank). Not sufficient.
2. **Re-render a LeafPreview component** with the same leaf data (reads `mediaRegistry[leaf.mediaId]`, redraws via `drawLeafToCanvas` into a fresh canvas). This matches what the main `<canvas>` shows. Recommended.

Safari gotcha verified via Context7: **do NOT apply CSS `transform` (e.g. scale, rotate) to the preview in Safari** — transforms on drag previews are not rendered by WebKit. Apply only `opacity` + `box-shadow`.

### Mobile caveat

Pragmatic-drag-and-drop explicitly advertises iOS/Android support. It uses the native HTML5 `dragstart` event on touch — available in iOS Safari 11+ and Android Chrome. (`@dnd-kit/core` had to ship its own `TouchSensor` because it avoids native drag; pragmatic uses native.) The 500ms long-press threshold is *also* handled natively by the browser on iOS; no custom hold timer needed.

---

## 6. Portal ActionBar + MobileCellTray Coexistence

### ActionBar (desktop, portal)

- Currently rendered conditionally: `{isHovered && !isPanMode && ...}` (LeafNode.tsx:770).
- During drag we want it hidden on the *source* leaf (otherwise tooltip pops under the drag preview). We keep the current `isHovered` gate — when the cell becomes drag source, the hover state clears naturally because pointer has moved off for drag-start.
- To be safe, add: `{isHovered && !isPanMode && !isDragSource && ...}` where `isDragSource = useDragStore(s => s.sourceId === id && s.status === 'dragging')`.
- ActionBar stays mounted during drag over *other* cells (hover state might not clear). This is fine — tooltips are scoped to their own trigger.

### MobileCellTray (mobile, fixed bottom)

- Currently visible iff a cell is selected (always mounted, CSS-driven visibility at lines 100-111).
- During drag we want it hidden to avoid visual clutter. Add `opacity: dragStatus === 'dragging' ? 0 : 1` to the existing `style` object. Already uses a transition so the fade is free.
- On drag commit (structural move), `moveCell` clears `selectedNodeId` (gridStore line 492) → tray fades out naturally post-drop anyway.

### Z-index map (verified against current code)

| Layer | z-index | Pointer events | Notes |
|-------|---------|----------------|-------|
| Canvas background | default | auto | Catches deselect clicks |
| GridNode tree | default | auto | Leaf drop targets |
| LeafNode ActionBar (desktop) | 50 | auto | Portal-style, inside cell |
| Drop-zone indicators (NEW) | 20 | **none** | `pointer-events-none` — must not intercept drop events |
| OverlayLayer | 30 | none on non-selected, auto on selected | Verified line 51 |
| Drag preview (OS compositor) | above everything | n/a | Not part of DOM z-stack |
| MobileCellTray | 45 | auto when visible | Fixed bottom |
| MobileSheet | 40 | auto | Fixed bottom |
| Workspace drop pill | 50 | none | Verified CanvasArea line 104 |

**Critical:** `DropZoneIndicators` MUST keep `pointer-events: none`. Verified Phase 9 pitfall (current LeafNode:724-755 — all five zones have `pointer-events-none`). If the indicator elements consume pointer events, pragmatic's drop target detection fires on *the indicator*, not the cell — and since indicators aren't registered drop targets, drops are silently dropped on the floor.

---

## 7. File Drop Unification — Cell File Drop + Workspace File Drop + Cell Move

### Current state (three distinct pipelines)

1. **Cell-to-cell move** → `@dnd-kit/core` via LeafNode `useDraggable`/`useDroppable` + `DndContext` in CanvasWrapper → `moveCell` action.
2. **Cell file drop** → React synthetic `onDragOver/onDrop` on LeafNode div → `handleFileDrop` → direct `addMedia` + `setMedia` calls.
3. **Workspace file drop** → React synthetic `onDragEnter/Over/Leave/Drop` on `<main>` in CanvasArea → `autoFillCells`.

### Decision: **Unify into pragmatic's single adapter tree.**

Pragmatic's three adapters combine via `combine()`:

- `draggable` + `dropTargetForElements` (cell-to-cell, typed data `{type: 'cell', leafId}`)
- `dropTargetForExternal` (file-from-desktop, filters via `containsFiles({source})`)

All three pipelines route through the same event bus (`monitorForElements`, `monitorForExternal`). This is the single biggest architectural win of pragmatic over @dnd-kit.

### Unified boundary — what "dragging a cell" vs "dragging a file" looks like

```typescript
// In useCellDropTarget(leafId):
dropTargetForElements({
  element,
  canDrop: ({ source }) => source.data.type === 'cell' && source.data.leafId !== leafId,
  getData: () => ({ type: 'cellTarget', leafId }),
  onDrag: ({ location }) => updateZoneFromPointer(leafId, location.current.input),
  onDrop: ({ source, self }) => {
    const zone = useDragStore.getState().activeZone ?? 'center';
    useGridStore.getState().moveCell(source.data.leafId, leafId, zone);
  },
});

// In useFileDropTarget(element, { cellId }):  // cellId null = workspace
dropTargetForExternal({
  element,
  canDrop: ({ source }) => containsFiles({ source }),
  onDragEnter: () => useDragStore.getState().beginFileDrag(),
  onDrop: async ({ source }) => {
    const files = getFiles({ source });
    if (cellId) {
      await handleCellFileDrop(cellId, files);  // existing autoFillCells / direct single-file path
    } else {
      await autoFillCells(files, {...});
    }
    useDragStore.getState().end();
  },
});
```

### Pros of unification

1. **Single mental model** — one `dragStore.status`, one drag preview system, one ESC-to-cancel handler.
2. **The workspace file-drop pill** already looks at "is a file being dragged?". Today that's a local `useState` + `dragCounter` dance to work around the `dragenter`/`dragleave` quirks (verified CanvasArea lines 18-56). Pragmatic handles dragenter/leave correctly across nested elements by design — the counter becomes unnecessary.
3. **Cell file drop can coexist with workspace file drop** by calling `combine()` — both targets receive `onDragEnter`, the more-specific (cell) wins. No more "stopPropagation vs capture-phase reset" workaround in CanvasArea.

### Cons / risks

1. **Behavioural drift risk.** Phase 8 (DROP-01/02) and Phase 9 (D-15/D-18) wrote specific counter/capture-phase logic against React synthetic events. Refactoring means re-validating both phases' acceptance tests.
2. **Not all file-drop paths are equivalent.** LeafNode's single-file path does inline `addMedia` + `detectAudioTrack` + `setHasAudioTrack`, while `autoFillCells` handles the multi-file BFS case (LeafNode:513-542). The unified `handleCellFileDrop(cellId, files)` helper must preserve both branches.

### Recommendation

**Yes, unify** — the debugging/maintenance gain is substantial (one DnD surface to reason about) and pragmatic's `combine()` is specifically designed for this. But ship in two waves:

- Phase A: Replace cell-to-cell move (swap out `@dnd-kit`). Keep existing React synthetic file-drop handlers untouched. Guarantees parity on the current DnD flow.
- Phase B: Migrate cell file drop + workspace file drop to `dropTargetForExternal`. Delete the native React handlers.

If Phase B runs into drift against existing tests, it can be rolled back without touching Phase A.

---

## 8. Overlay Layer Coexistence — Conflict Analysis

### Facts verified against `src/Grid/OverlayLayer.tsx`

- OverlayLayer is `position: absolute; inset: 0; z-index: 30; pointer-events: none` (line 51).
- Individual overlays set `pointer-events: auto` so they catch their own pointer events (line 68).
- Overlay drag uses **React synthetic `onPointerDown`** + `e.stopPropagation()` (line 70-73) to capture selection. The actual overlay drag logic lives in `OverlayHandles.tsx`.

### Why there is no conflict with pragmatic

- Pragmatic's element adapter subscribes to the **native `dragstart` event**, not `pointerdown`. These are distinct events.
- For `dragstart` to fire, the element must have `draggable="true"`. Pragmatic sets this automatically on elements registered via `draggable({ element })`. LeafNode cells get `draggable=true`; overlay elements do NOT (because OverlayLayer is not registered as draggable).
- A user pointerdown on a selected overlay fires `onPointerDown` → `stopPropagation()` → the event doesn't bubble to the cell below. Even if it did, `pointerdown` ≠ `dragstart`, so pragmatic wouldn't trigger.
- A user pointerdown-drag on an **unselected** overlay: `pointer-events: none` on the overlay → event passes through to the cell underneath → cell drag starts. This is the expected behaviour.

### Small defensive addition

Add `data-dnd-ignore="true"` on the OverlayLayer root. Not strictly needed, but a defence-in-depth marker if future refactors accidentally wire overlays as draggable.

### One real edge case: selected overlay over cell-drag hover

If a cell drag is in progress and the pointer crosses over a *selected* overlay (which has `pointer-events: auto`), the native `dragover` event fires on the overlay, not the cell beneath. Solutions:

- Option A: add `pointer-events: none` to the selected overlay **during cell drag only** — subscribe OverlayLayer to `useDragStore(s => s.status)` and flip PE off when status === 'dragging'.
- Option B: register overlays as pass-through drop targets (no-op) so the drag event still flows.

Option A is simpler and has zero surface area. Recommended.

---

## 9. Divider Resize Coexistence — Preventing Accidental Drag-Start on Handle

### Facts verified against `src/Grid/Divider.tsx`

- Divider hit area uses `onPointerDown` (line 112), NOT `dragstart`.
- `e.currentTarget.setPointerCapture(e.pointerId)` on pointerdown (line 56).
- Hit area is 22px wide/tall — overlaps the cell boundary.

### Why there is no hard conflict

- Pragmatic binds `dragstart`, divider binds `pointerdown`. They are independent events.
- But: native HTML5 drag fires `dragstart` after pointerdown if the element is `draggable=true`. If the divider hit area sits on top of a `draggable=true` cell, a slow drag-out-from-divider could trigger cell drag.

### Recommended guards (layered)

1. **DOM layering.** Divider hit areas have `z-index: 10` (line 105). Keep this — it means pragmatic's `dragstart` on the cell fires from the cell's own surface, not the divider overlap zone.
2. **Pointer capture blocks drag.** Once divider calls `setPointerCapture(e.pointerId)` on pointerdown, subsequent events go to the divider even if the pointer moves onto a cell. Pragmatic's `dragstart` listener is on the cell element; it never receives the events. Verified behaviour of Pointer Events spec.
3. **`user-select: none` on divider.** Already implicit via the surrounding `select-none` on LeafNode (line 637). Prevents text-selection drag from being mistaken for pointer capture.
4. **Explicit marker.** Add `data-dnd-ignore="true"` on divider hit area + have `useCellDraggable` check `event.target.closest('[data-dnd-ignore]')` inside `canDrag`.

### Guard implementation

```typescript
// src/dnd/useCellDraggable.ts
draggable({
  element: leafEl,
  canDrag: ({ input }) => {
    // Don't start a cell drag if pointer is on a divider handle, overlay, or action bar
    const target = document.elementFromPoint(input.clientX, input.clientY);
    return !target?.closest('[data-dnd-ignore]');
  },
  // ...
});
```

This is belt-and-braces. Pointer capture on the divider will already prevent the dragstart from reaching the cell; `canDrag` is a second safety.

### Event propagation strategy (summary)

| Interaction | Fires first | Outcome |
|-------------|-------------|---------|
| Pointerdown on divider handle | Divider `onPointerDown` + `setPointerCapture` | Captures subsequent moves; cell drag never starts |
| Pointerdown on cell media (desktop) | Native `mousedown` → pragmatic `dragstart` (after tiny movement threshold) | Cell drag starts |
| Pointerdown on selected overlay | Overlay `onPointerDown` + `stopPropagation()` | Overlay drag starts; cell drag never fires |
| Long-press on cell (mobile) | Native iOS/Android `dragstart` after ~500ms hold | Cell drag starts |
| Long-press on divider (mobile) | Divider `onPointerDown` + capture | Divider resize starts; cell drag never fires |

---

## 10. Build Order — Dependency Chain

### Phase layout (for roadmapper to refine)

```
Phase A: Foundation ───────────────────┐
  Create src/dnd/ module scaffolding.  │
  Install pragmatic + auto-scroll.     │
  Implement computeDropZone (pure).    │
  Implement dragStore.                 │
  Write unit tests.                    │
  No integration yet — isolated.       │
                                       │
                    dependency: none   │
                                       ▼
Phase B: Cell-to-Cell Drag  ───────────┐
  Implement useCellDraggable           │
    + useCellDropTarget.               │
  Implement DragPreviewPortal.         │
  Implement DropZoneIndicators.        │
  Wire LeafNode to new hooks.          │
  Remove @dnd-kit cell drag from       │
    LeafNode + CanvasWrapper.          │
  Keep native HTML5 file drop untouched.
  Acceptance: cell-to-cell MOVE and    │
    SWAP work identically on desktop   │
    and mobile.                        │
                                       │
                 dependency: Phase A   │
                                       ▼
Phase C: ESC-Cancel + Visual Polish ───┐
  Implement ESC-to-cancel via          │
    window keydown subscribed to       │
    dragStore.                         │
  Implement drag-hover cursor          │
    (static CSS — no state).           │
  Implement semi-opaque ghost          │
    rendering logic.                   │
  Implement 5-icon indicator           │
    (active bright, inactive dim).     │
                                       │
                 dependency: Phase B   │
                                       ▼
Phase D: File Drop Unification (optional — can defer)
  Replace CanvasArea native handlers   │
    with useFileDropTarget.            │
  Replace LeafNode native handlers     │
    with useFileDropTarget(cellId).    │
  Remove dragCounter pattern.          │
                                       │
                 dependency: Phase B   │
                                       ▼
Phase E: Mobile Handle + Tray Polish ──┐
  Add drag handle button to            │
    MobileCellTray.                    │
  Wire useCellDraggable(selectedNodeId)│
    to the handle.                     │
  Hide tray during drag.               │
                                       │
                 dependency: Phase B   │
                                       ▼
Phase F: @dnd-kit uninstall + cleanup
  Confirm zero imports remain.         │
  Uninstall packages.                  │
  Remove this architecture's fallback  │
    paths.                             │
```

Minimum viable completion = Phases A + B + C. Phases D/E/F are incremental improvements.

---

## 11. Testing Strategy

### Test layers

| Layer | Tool | Scope |
|-------|------|-------|
| Pure logic | Vitest | `computeDropZone` — table of (rect, pointer, expected zone) cases |
| Store | Vitest | `dragStore` state transitions — beginCellDrag → setOver → end |
| Adapter contract | Vitest + mocks | Wrap `draggable` + `dropTargetForElements` behind interfaces; test the wrapper calls the right store actions |
| Hook integration | Vitest + React Testing Library | `useCellDraggable(id)` attached to a test component; fire synthetic events; assert store state |
| End-to-end DnD | Manual UAT | Actual drag gestures on real browsers |

### What's hard to test in jsdom

- **Native `dragstart` event.** jsdom implements the event but does NOT simulate the full drag lifecycle (no `dragover` fires on hover-target elements, no OS drag preview). @testing-library does not ship a drag helper.
- **`@testing-library/user-event`** v14+ has `userEvent.dragAndDrop(source, target)` — this was the @dnd-kit escape valve. It dispatches `dragstart` → `dragover` → `drop` → `dragend` synchronously on the target elements. Pragmatic's drag lifecycle is compatible with this sequence because pragmatic is built on native HTML5 DnD.
- **Drop zone detection inside `onDrag`.** We test `computeDropZone` in isolation; for the glue we can fire `dragover` events with `clientX`/`clientY` set via `Object.defineProperty` and assert the store updates.
- **Drag preview rendering.** `setCustomNativeDragPreview` mounts into a hidden container; jsdom can verify the container exists but cannot render the preview visually. Visual verification is manual UAT.

### Testing patterns from codebase to reuse

- `src/Grid/__tests__/LeafNode.test.tsx` — existing pattern for mounting a single leaf inside `<DndContext>`. Replace with `<TestDndHarness>` that sets up pragmatic's monitors.
- `src/lib/__tests__/tree.test.ts` — `moveLeafToEdge` has 18 pure-function tests. These stay unchanged; they're tree invariants independent of DnD.

### Must-fall-to-manual-UAT

- Visual correctness of drag preview (opacity, positioning under cursor, scale fidelity).
- 500ms long-press-to-drag on real iOS Safari.
- ESC-to-cancel during an in-flight drag on macOS (cancel key is captured by the OS compositor during native drag).
- Autoscroll near viewport edges when canvas is zoomed in.
- Divider-vs-cell-drag discrimination at the 22px overlap zone.

### Suggested test file layout

```
src/dnd/
├── computeDropZone.test.ts            # pure — ~30 assertions
├── dragStore.test.ts                  # state transitions
├── adapter/pragmatic.test.ts          # contract (mocked library)
├── useCellDraggable.test.tsx          # hook + minimal harness
├── useCellDropTarget.test.tsx         # hook + harness
└── __tests__/integration.test.tsx     # full LeafNode-to-LeafNode drag via userEvent
```

---

## 12. Undo Semantics — Store Changes Needed?

### Answer: **No store changes required.**

Verified against `src/store/gridStore.ts:473-494`:

```typescript
moveCell: (fromId, toId, edge) =>
  set(state => {
    // No-op guards (D-04 / EC-05). These do NOT push a snapshot.
    if (fromId === toId) return;                         // ← early return, no snapshot
    const src = findNode(current(state.root), fromId);
    if (!src || src.type !== 'leaf') return;             // ← early return, no snapshot
    const tgt = findNode(current(state.root), toId);
    if (!tgt || tgt.type !== 'leaf') return;             // ← early return, no snapshot

    pushSnapshot(state);                                  // ← only when move commits
    if (edge === 'center') { ... } else { ... }
  }),
```

### Drag lifecycle → store interaction mapping

| Drag event | Condition | Store call | Undo entries |
|------------|-----------|------------|--------------|
| Drag start | — | none | 0 |
| Drag over target | — | none (writes to dragStore only) | 0 |
| Drop on self (source === target) | `fromId === toId` | `moveCell` early-returns | 0 |
| ESC cancel | onDragCancel | none — never call moveCell | 0 |
| Drop outside any drop target | pragmatic `onDrop` with `location.current.dropTargets === []` | none — the hook skips `moveCell` | 0 |
| Successful drop | valid source + target, different ids | `moveCell(fromId, toId, zone)` | 1 |

### Caveat: the "center drop on self" existing behaviour

Current `useDndMonitor`-based implementation in CanvasWrapper:77:
```typescript
if (!over || active.id === over.id) return;
```
The ESC-cancel path is currently undocumented in the existing code but works *because* `@dnd-kit/core` does not fire `onDragEnd` with a valid `over` when the user presses ESC; it fires `onDragCancel`. The new implementation needs explicit ESC wiring:

```typescript
// src/dnd/adapter/pragmatic.ts
monitorForElements({
  onDragStart: () => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Pragmatic exposes cancelDrag() — or simulate via dragend
        document.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  },
  onDropTargetChange: (args) => {
    // Update dragStore.overId + activeZone here
  },
  onDrop: ({ source, location }) => {
    // Commit or no-op
    useDragStore.getState().end();
  },
});
```

### No new store actions needed

- `moveCell` already handles 100% of the drag-commit cases correctly.
- `swapCells` (gridStore:463) handles the center-drop case via `moveCell(..., 'center')` which internally delegates to `swapLeafContent`. No change needed.
- The new `dragStore` is the only state addition, and it's deliberately outside the undo system.

---

## 13. Mobile Bottom Sheet Coexistence

### Facts verified

- `MobileSheet` is fixed to the bottom of the viewport, `z-index: 40` (per `sheetSnapState`).
- Sheet takes `collapsed` (visible tab strip, ~60px) or `full` (full height) — no half-snap (Phase 23 decision, PROJECT.md line 264).
- `CanvasArea` has `overscroll-behavior: contain` and adds `touch-action: none` when `sheetOpen === true` (CanvasArea:88).
- `MobileCellTray` is at `bottom: 60px` (MobileCellTray:103), so it sits directly above the collapsed sheet.

### The four coexistence questions

#### Q1: Drag over sheet — cancel, autoscroll, or ignore?

**Recommendation: Ignore (sheet is a drop-dead zone).**

The sheet's purpose is to host sidebar controls. It's not a semantic drop target for cells. Pragmatic's `canDrop: ({ source }) => source.data.type === 'cell'` on the sheet returns false (because the sheet never registers as a cell drop target). A drag over the sheet simply has no `overId` in dragStore → no zone indicator shown → on drop, `moveCell` isn't called → drag aborts. Exactly the "drop outside any target" case → 0 undo entries.

#### Q2: Drag-start from within sheet — allowed?

No — sheet controls aren't cells. No `draggable` registration on anything inside the sheet except the dedicated tray drag handle (Phase E).

#### Q3: Autoscroll when drag near sheet boundary?

**Out of scope for v1.5 MVP.** Canvas is already auto-fit to viewport — the grid doesn't scroll internally. Pragmatic's `autoScrollForElements` package could later handle "drag near bottom of visible canvas when sheet is full-expanded" but this is a polish-later concern. The sheet in full state covers the canvas anyway; there's no cell to drag toward.

#### Q4: Sheet intercepts touch during full state?

The current `touch-action: none` on `<main>` while sheet is open (CanvasArea:88) was added to prevent scroll gestures interfering with the sheet. Pragmatic uses native HTML5 DnD (`dragstart`/`dragover`/`drop`), not pointer/touch events, so `touch-action: none` is orthogonal. The 500ms long-press-to-drag on iOS uses the native "press and hold for context menu"-adjacent gesture which is NOT blocked by `touch-action: none`. Verified behaviour: `touch-action: none` disables panning/scrolling but does not disable native drag.

### Drop strategy summary

| User action | Outcome |
|-------------|---------|
| Drag cell + release over canvas background | No target → no-op, 0 undo entries |
| Drag cell + release over another cell | `moveCell` commits, 1 undo entry |
| Drag cell + release over sheet | No target (sheet has no cell drop target registered) → no-op, 0 undo entries |
| Drag cell + release over MobileCellTray | MobileCellTray fades out on drag-start → cannot be a target |
| Press ESC while dragging | `onDragCancel` → 0 undo entries |

---

## 14. Data Flow — One-Page Reference

### Cell-to-Cell Drag

```
┌─ User presses and holds on LeafNode A (500ms) ───────────┐
│  Native dragstart on A's element                          │
│    ↓                                                      │
│  pragmatic.draggable onDragStart                          │
│    → onGenerateDragPreview → setCustomNativeDragPreview   │
│    → dragStore.beginCellDrag(A.id)                        │
│    → DragPreviewPortal renders LeafPreview(A)             │
│                                                           │
│  User drags over LeafNode B                               │
│    ↓                                                      │
│  Native dragover on B's element                           │
│    ↓                                                      │
│  pragmatic.dropTargetForElements on B → onDrag            │
│    → computeDropZone(B.rect, pointer, canvasScale)        │
│    → dragStore.setOver(B.id, zone)                        │
│    → LeafNode B selector fires, renders DropZoneIndicators│
│                                                           │
│  User releases mouse/finger                               │
│    ↓                                                      │
│  Native drop on B's element                               │
│    ↓                                                      │
│  pragmatic onDrop                                         │
│    → read dragStore.activeZone (last-known zone)          │
│    → gridStore.moveCell(A.id, B.id, zone)                 │
│      → pushSnapshot (1 undo entry)                        │
│      → if zone==='center': swapLeafContent                │
│      → else: moveLeafToEdge                               │
│    → dragStore.end()                                      │
│    → DragPreviewPortal unmounts                           │
└───────────────────────────────────────────────────────────┘
```

### File Drop (workspace or cell)

```
┌─ User drags file from OS into viewport ──────────────────┐
│  Native dragenter on <main>                               │
│    ↓                                                      │
│  pragmatic.dropTargetForExternal on <main> → onDragEnter  │
│    → containsFiles? yes → dragStore.beginFileDrag()       │
│    → CanvasArea selector fires, renders drop pill         │
│                                                           │
│  User drags over cell B                                   │
│    ↓                                                      │
│  dropTargetForExternal on B (more specific target wins)   │
│    → dragStore.setOver(B.id, null)  // no zone for files  │
│    → LeafNode B shows file drop-target ring               │
│                                                           │
│  User releases                                            │
│    ↓                                                      │
│  pragmatic onDrop → getFiles({source})                    │
│    → if target=cell: handleCellFileDrop(cellId, files)    │
│      → addMedia + setMedia + setHasAudioTrack             │
│    → else: autoFillCells(files, ...)                      │
│    → dragStore.end()                                      │
└───────────────────────────────────────────────────────────┘
```

---

## 15. Anti-Patterns to Avoid

### Anti-Pattern 1: Re-introducing local `activeZone` state in LeafNode

**Why it's wrong:** every pointer tick triggers a React re-render on every leaf. This was the exact source of Phase 25 jankiness. The new design keeps zone computation in the adapter's plain-JS `onDrag` callback, writes to Zustand via reference equality, and relies on scoped selectors to re-render exactly one leaf when the zone changes.

### Anti-Pattern 2: Storing the drag preview in React state

**Why it's wrong:** pragmatic's `render({ container })` is called synchronously by the adapter BEFORE `dragstart` returns to the browser. If we defer the render via `setState` → React commit, the browser snapshots the container too early and the preview is blank. Use a synchronous portal pattern with a non-React ref OR use the `setState` pattern from pragmatic's docs which batches the container-render synchronously via `createRoot(container).render(...)`.

### Anti-Pattern 3: Dividing pointer coords by `canvasScale` inside `computeDropZone`

**Why it's wrong:** `getBoundingClientRect()` already accounts for `transform: scale()`. Dividing again produces ~4x distorted zones. This is the opposite mistake of Divider.tsx (where the division IS correct because the math is in a different coordinate system — logical 1080×1920 space). `computeDropZone` works in viewport space throughout.

### Anti-Pattern 4: Registering OverlayLayer as a drop target

**Why it's wrong:** overlays and cells are different interaction domains. Making overlays cell-drop targets would mean "drop cell onto text overlay → ???" — no sensible operation. Keep overlays explicitly NOT registered and solve the "cell drag passes under a selected overlay" case via `pointer-events: none on selected overlay when dragStore.status === 'dragging'`.

### Anti-Pattern 5: Keeping `DragZoneRefContext` "just in case"

**Why it's wrong:** the whole point of this refactor is to eliminate the ref-plus-context-plus-local-state triangulation in Phase 25. Ripping it out forces the new implementation to live entirely in dragStore + adapter callbacks. If a new use case emerges that seems to "need" a ref, it almost certainly wants a Zustand selector instead.

### Anti-Pattern 6: Using `useSyncExternalStore` directly

**Why it's wrong:** Zustand v5 already wraps `useSyncExternalStore`. Rolling our own subscription for `dragStore` skips the tear-detection and shallow-equality machinery. Use the store's `create` output.

---

## 16. Open Questions for the Roadmapper

1. **Phase D (file-drop unification) vs Phase B scope boundary.** Recommend Phase D as a separately shippable phase so Phase B can land without touching the existing file-drop acceptance tests from Phase 8 and Phase 9. Roadmapper decides whether to schedule D inside v1.5 or defer.

2. **MobileCellTray drag handle visual design.** Research does not prescribe the icon choice — `GripVertical` is suggestive. This is a UI-intelligence concern, not an architecture concern.

3. **Drag preview content strategy — clone-DOM vs re-render-from-state.** Recommend the re-render approach (section 5) but acknowledge the DOM-clone + screenshot-of-canvas approach (via `canvas.toDataURL`) is 5 lines shorter. Prototype both in Phase C and measure; performance difference is negligible for the ~20-leaf cap.

4. **Autoscroll scope.** Out of scope for v1.5 MVP. Revisit if users report difficulty dragging across scrolled states.

5. **`@dnd-kit/core` keep-or-remove decision** if the STACK research chooses `@dnd-kit/core` over pragmatic. In that case, this doc's Section 7 (file-drop unification) and Section 5 (drag preview) change — @dnd-kit provides `DragOverlay` (portal-rendered React component) but has no native-file-drop adapter, so file drop stays on React synthetic events.

---

## 17. Integration Points — One-Table Summary

| Integration point | New file(s) | Modified file(s) | Deleted file(s) | Data flow |
|-------------------|-------------|------------------|-----------------|-----------|
| Cell-to-cell drag | `src/dnd/adapter/pragmatic.ts`, `useCellDraggable.ts`, `useCellDropTarget.ts`, `dragStore.ts`, `computeDropZone.ts` | `LeafNode.tsx`, `CanvasWrapper.tsx` | (none — `DragZoneRefContext` is inline) | LeafNode → dnd hook → adapter → dragStore → LeafNode re-selector → indicator |
| Drag preview | `DragPreviewPortal.tsx` | `EditorShell.tsx` (mount point) | — | adapter `onGenerateDragPreview` → `setCustomNativeDragPreview` → portal container → React render |
| Drop zone computation | `computeDropZone.ts` | — | — | `onDrag` callback → `computeDropZone(rect, input, scale)` → `dragStore.setOver` |
| 5-icon indicator | `DropZoneIndicators.tsx` | `LeafNode.tsx` (inlines 5 blocks removed, one component added) | — | `LeafNode` reads `activeZone` from dragStore → passes to indicator |
| File drop (cell) | `useFileDropTarget.ts` | `LeafNode.tsx` (Phase D) | — | external adapter → `getFiles` → `autoFillCells` or single-file branch |
| File drop (workspace) | (reuses `useFileDropTarget.ts`) | `CanvasArea.tsx` (Phase D) | — | external adapter → `autoFillCells` |
| Undo semantics | — | none (gridStore unchanged) | — | `moveCell` early-returns on no-op; `pushSnapshot` only on commit |
| Divider coexistence | — | `Divider.tsx` (add `data-dnd-ignore`) | — | `canDrag` checks `data-dnd-ignore`; pointer capture on divider pre-empts dragstart |
| Overlay coexistence | — | `OverlayLayer.tsx` (PE:none during drag) | — | OverlayLayer selector on `dragStore.status` toggles PE |
| Mobile tray coexistence | — | `MobileCellTray.tsx` (fade during drag; add handle button) | — | MobileCellTray selector on `dragStore.status` |
| ESC cancel | — | — (handled inside adapter) | — | keydown → dispatch dragend → `onDragCancel` → `dragStore.end()` |

---

## 18. Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| ≤20 leaves (current cap) | No optimisation needed. Selector scoping already ensures O(1) re-renders per pointer tick. |
| 20-100 leaves (theoretical) | Still fine. Zone computation is O(1). Selectors fire only for the single hovered leaf. |
| >100 leaves | Structural re-render cost of the recursive tree dwarfs DnD overhead. Not a DnD concern. |

**First bottleneck:** repeated `getBoundingClientRect()` calls on deep nested transforms. Mitigation: cache rect per-target inside the adapter's closure; invalidate on ResizeObserver. Ship without caching first; add only if instrumentation shows it.

---

## Sources

### Codebase (primary, HIGH confidence — direct read of files at researched date)

- `src/Grid/LeafNode.tsx` (786 lines) — current DnD implementation
- `src/Grid/CanvasWrapper.tsx` — DndContext + sensors + DragZoneRefContext
- `src/Grid/ContainerNode.tsx`, `GridNode.tsx`, `Divider.tsx`, `ActionBar.tsx`, `OverlayLayer.tsx`
- `src/Editor/CanvasArea.tsx` — workspace file-drop pipeline
- `src/Editor/MobileCellTray.tsx` — mobile tray
- `src/store/gridStore.ts`, `editorStore.ts`
- `src/lib/tree.ts` — `moveLeafToEdge`, `swapLeafContent`, pure primitives
- `.planning/PROJECT.md` — v1.5 milestone context, current state, key decisions
- `.planning/milestones/v1.4-phases/25-touch-drag-and-drop/25-RESEARCH.md` — Phase 25 constraints (file enumeration)

### External (MEDIUM-HIGH confidence — Context7 verified 2026-04-17)

- Pragmatic Drag and Drop — Atlassian — `/atlassian/pragmatic-drag-and-drop`
  - External drop target + `getFiles` API: https://github.com/atlassian/pragmatic-drag-and-drop/blob/main/packages/documentation/constellation/05-core-package/03-drop-targets/index.mdx
  - `setCustomNativeDragPreview` + `preserveOffsetOnSource`: https://github.com/atlassian/pragmatic-drag-and-drop/blob/main/packages/documentation/constellation/05-core-package/00-adapters/00-element/drag-previews.mdx
  - `combine()` for multi-target elements: same source
  - `autoScrollForElements`: https://atlassian.design/components/pragmatic-drag-and-drop/core-package/
  - Safari CSS-transform caveat on previews: same drag-previews source
  - "Works everywhere: Firefox, Safari, Chrome, iOS, Android": project README
- @dnd-kit/core v6.3.1 — derived from in-tree usage; no direct doc lookup performed because the goal is removal, not study.

### Implications-of-sources confidence

- Everything labelled HIGH above is traceable to actual code read during this session.
- MEDIUM labelled items are Context7 snippets from pragmatic-drag-and-drop docs (current as of 2026-04-17 per Context7 index).
- LOW confidence items flagged inline.

---

*Architecture research for: StoryGrid v1.5 Unified Drag-and-Drop UX*
*Researched: 2026-04-17*
