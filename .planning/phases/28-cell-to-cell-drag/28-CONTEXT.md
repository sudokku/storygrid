# Phase 28: Cell-to-Cell Drag - Context

**Gathered:** 2026-04-17 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Desktop and touch users drag any cell and drop it onto any other cell using a single `PointerSensor` engine — REMOVING ALL Phase 25 `@dnd-kit` wiring in this same phase, with no parallel engines mounted simultaneously.

Requirements: DND-04, DRAG-01, DRAG-02, DRAG-03, DRAG-04, DRAG-07, GHOST-01, GHOST-02, GHOST-04, GHOST-05, GHOST-06, GHOST-07, DROP-01, DROP-04, DROP-05, DROP-07, CANCEL-03, CANCEL-04, CROSS-01 (19 total).

**Explicitly out of Phase 28 scope** — deferred to Phase 29 (ESC-Cancel + Visual Polish): DRAG-05 wobble, DRAG-06 ghost lift, GHOST-03 80% ghost opacity, DROP-02/03 active/inactive zone styling, DROP-08 drop flash, CANCEL-01/02 ESC + snap-back. Deferred to Phase 30 (Mobile Handle + Tray Polish): CROSS-02/03/04/05/06/07/08 (touch-action, haptics, user-select, tray auto-collapse).

</domain>

<decisions>
## Implementation Decisions

### A1 — DndContext mount + sensor configuration

- **D-01:** `DndContext` mounts in `src/Grid/CanvasWrapper.tsx`, replacing the existing Phase 25 `DndContext` block at current `CanvasWrapper.tsx:121`. Scope stays at CanvasWrapper (not EditorShell) to keep DnD activators off Toolbar/Sidebar.
- **D-02:** Register **two `PointerSensor` subclasses** via `useSensors`, one per pointerType: `PointerSensorMouse` with `activationConstraint: { distance: 8 }` whose activator returns `false` for non-mouse `pointerType`; `PointerSensorTouch` with `activationConstraint: { delay: 250, tolerance: 5 }` whose activator returns `false` for non-touch `pointerType`. `useCombineActivators` will let the first matching sensor win.
- **D-03:** Do NOT use a combined `{delay, distance}` constraint on a single PointerSensor — `AbstractPointerSensor.attach()` checks `isDelayConstraint` first, collapsing behavior to delay-only for all pointer types.
- **D-04:** `onDragStart` / `onDragOver` / `onDragEnd` / `onDragCancel` callbacks write imperatively via `useDragStore.getState().beginCellDrag | setOver | end` — no React re-subscription inside the context.
- **D-05:** Entire cell body is the drag-activation region. No drag-handle icon on the cell. The Phase 25 drag-handle button is removed (DRAG-07).

### A2 — Ghost rendering pipeline

- **D-06:** On `onDragStart`, synchronously call `sourceLeafCanvasRef.current.toDataURL()` and write the result into `dragStore.ghostDataUrl: string | null` (new field — extend the existing vanilla Zustand store). Source-cell dimensions also captured from `getBoundingClientRect()` into `dragStore` (e.g. `sourceRect`).
- **D-07:** `DragPreviewPortal` subscribes to `ghostDataUrl` + `sourceRect` and renders `<DragOverlay><img src={ghostDataUrl} style={{ width, height, opacity: 0.8 }} /></DragOverlay>` — portal lives in `document.body` (DragOverlay default) outside the scaled canvas (GHOST-06).
- **D-08:** Author a **custom `Modifier`** in `src/dnd/adapter/dndkit.ts` that divides `transform.x`/`transform.y` by `useEditorStore.getState().canvasScale` to keep the ghost under the exact grab point. `@dnd-kit/modifiers` supplies only the `Modifier` type + snap/restrict helpers — scale compensation is not a prebuilt modifier.
- **D-09:** `DragOverlay`'s `adjustScale` prop stays `false` (default). It compensates scaled drop-targets, not the dragged element.
- **D-10:** Empty-cell fallback (no `mediaUrl`): render a plain `<div>` with the same `bg-[#1c1c1c]` class at source dims rather than an empty `<img>`.
- **D-11:** Ghost opacity in Phase 28 is **`opacity: 0.8`** (matches the final GHOST-03 spec even though GHOST-03 belongs to Phase 29 — using 0.8 now avoids a cosmetic change in Phase 29).

### A3 — Drop-zone overlay rendering

- **D-12:** Each `LeafNode` conditionally renders `<DropZoneIndicators zone={activeZone} />` ONLY when `useDragStore(s => s.overId === id && s.status === 'dragging')` is true. Scoped selector to avoid re-renders on unrelated cells.
- **D-13:** `DropZoneIndicators` renders one absolutely-positioned root `<div>` with `position: absolute; inset: 0; pointer-events: none; z-index: 20` containing 5 children (center ~60%, top/bottom/left/right as bands) that visually tile the cell.
- **D-14:** Icons: lucide `ArrowLeftRight` (center=swap), `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`. Icon size scales as `32 / canvasScale` for screen-constant visual.
- **D-15:** Zone styling in Phase 28 = single base state (all icons visible, baseline styling). Active/inactive differentiation (100% vs 30% white, scale 1.1, glow) is **Phase 29 scope (DROP-02/03)** — do not implement yet.
- **D-16:** `computeDropZone` continues to use the LeafNode root's `getBoundingClientRect()`. `pointer-events: none` on all indicator elements guarantees pointer events pass through to the LeafNode root where `useDroppable` lives.
- **D-17:** Hovered cell gets a **2px accent-color outline** via a ring class driven by `overId === id` (DROP-04).

### A4 — Phase 25 teardown

- **D-18:** Source file edits: `src/Grid/CanvasWrapper.tsx`, `src/Grid/LeafNode.tsx`, `src/Editor/EditorShell.tsx` (mount `<DragPreviewPortal />` once), `src/Grid/Divider.tsx` + `src/Grid/OverlayLayer.tsx` (add `data-dnd-ignore="true"`).
- **D-19:** **Deletes from `CanvasWrapper.tsx`:** imports of `MouseSensor`, `TouchSensor`, `KeyboardSensor` (lines 11-16); the inline `DragZoneRefContext` export at line 20; its provider wrapper.
- **D-20:** **Deletes from `LeafNode.tsx`:** imports of `useDraggable`, `useDroppable`, `useDndMonitor` from `@dnd-kit/core`, `DragZoneRefContext` import; the `ActiveZone`/`activeZone` local state; the `pointerPosRef` document `pointermove` listener (lines 300-310); `isPendingDrag` state + hold-pulse animation; the `useDndMonitor` block (lines 331-357); all 5 inline zone JSX blocks (lines 720-756).
- **D-21:** **Tests deleted wholesale:** `src/test/phase25-touch-dnd.test.tsx` (mocks `MouseSensor`/`TouchSensor`/`KeyboardSensor` with 500ms delay semantics). The 3 drag-handle tests in `src/test/phase05-p02-cell-swap.test.ts` that assert the drag-handle button (DRAG-07 removes it).
- **D-22:** **Tests rewritten:** `src/test/phase09-p03-leafnode-zones.test.ts` and `src/Grid/__tests__/LeafNode.test.tsx` — drop `useDndMonitor` mock refs; keep inner behavior assertions updated to the new `DropZoneIndicators` render pattern.
- **D-23:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` stay in `package.json` — the new engine imports `DndContext`, `PointerSensor`, `useDraggable`, `useDroppable`, `DragOverlay` from `@dnd-kit/core`.
- **D-24:** SC-3 grep assertion must pass: `grep -r 'TouchSensor\|MouseSensor\|DragZoneRefContext\|useDndMonitor' src/` returns zero.

### A5 — `data-dnd-ignore` + overlay/file-drop interop

- **D-25:** Add `data-dnd-ignore="true"` to Divider hit-area (inside `Divider.tsx:103`'s `group/hit` div) and OverlayLayer root (`OverlayLayer.tsx:51`). `ActionBar` portal is implicitly ignored (rendered via `createPortal(document.body)` outside the canvas).
- **D-26:** The ignore-check lives inside the custom `PointerSensor` subclasses' activator handler: `if (event.target.closest('[data-dnd-ignore]')) return false` BEFORE `onActivation`. Do not rely on `useDraggable`'s `disabled` prop (no per-event canDrag).
- **D-27:** `OverlayLayer` selected overlays flip `pointerEvents: 'none'` when `useDragStore(s => s.status === 'dragging')` is true (existing pattern at `OverlayLayer.tsx:67` extended with the drag selector). Prevents selected overlays from intercepting cell-drag `pointermove`.
- **D-28:** **File-drop paths preserved unchanged.** Native HTML5 `onDragOver`/`onDrop` on LeafNode (`LeafNode.tsx:656-658`) and CanvasArea (`CanvasArea.tsx:89-94`) with their `dataTransfer.types.includes('Files')` guards stay intact. Dnd-kit's `PointerSensor` uses `pointermove`/`pointerup` — never `dragstart`/`dragover`/`drop` — so there is no collision with native file drops.
- **D-29:** `Divider.tsx:55-56`'s existing `setPointerCapture(e.pointerId)` call remains — it naturally redirects all pointer events to the divider during resize, blocking dnd-kit sensor takeover without extra guards. `data-dnd-ignore` is belt-and-braces for future refactors.

### A6 — Testing strategy

- **D-30:** Add three new Vitest files under `src/dnd/__tests__/`:
  - `useCellDraggable.test.tsx` — render harness inside `<DndContext sensors={…}>`, simulate `pointerDown` + `pointerMove ≥8px` via `fireEvent` or `userEvent.pointer()`, assert `dragStore.status === 'dragging'` and `sourceId === id`.
  - `useCellDropTarget.test.tsx` — source+target pair, simulate drag-over, assert `dragStore.overId` and `activeZone` update per zone.
  - `integration.test.tsx` — full move scenario mounted with real `CanvasWrapper`, asserts `gridStore.moveCell` invoked on commit.
- **D-31:** SC-1 / SC-2 activation **timing** (250ms touch hold, 8px mouse distance) verified by config-value assertions on the registered sensors, NOT by pointer-sequence fake-timer simulations (jsdom's timer lifecycle is unreliable per PITFALLS §11). Real-device UAT is the authoritative check for SC-1 / SC-2.
- **D-32:** SC-4 (file drop still works) regression-covered by existing `src/test/phase08-p02-workspace-drop.test.tsx` and the rewritten `phase09-p03-leafnode-zones.test.ts`.
- **D-33:** SC-5 (ghost + zone visuals) documented as **manual UAT** — jsdom can only assert `DragPreviewPortal` renders an `<img>` with a data-URL `src` and `opacity: 0.8`. Add a UAT checklist entry in the phase SUMMARY.

### Claude's Discretion

- Choice between `fireEvent.pointerDown/Move` vs `@testing-library/user-event`'s `userEvent.pointer()` API in the new test files — either works; pick whichever reads cleaner.
- Exact CSS ring utility class for the 2px accent outline (DROP-04) — whatever matches the existing Tailwind accent token already used in ActionBar.
- Whether to pause the rAF video draw loop on the source cell during drag (freeze `LeafNode.tsx:245-266` when `dragStore.sourceId === id`) — a belt-and-braces fix for Pitfall 9 `toDataURL` race on video cells. Recommended but not load-bearing.
- Order of plan splits (e.g. one plan per Area vs one monolithic plan vs TDD cycles per hook) — planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §§ DND-*, DRAG-*, GHOST-*, DROP-*, CANCEL-*, CROSS-* — the 42 v1.5 requirements; Phase 28 owns the 19 IDs listed in Phase Boundary.
- `.planning/milestones/v1.5-ROADMAP.md` §Phase 28 — full detail list (lines 61-95) including the 5 Success Criteria and the integration-point call-outs.
- `.planning/milestones/v1.5-ROADMAP.md` §Traceability (lines 173-226) — REQ → phase mapping.

### Blocking anti-patterns + architecture
- `.planning/research/PITFALLS.md` Pitfalls 1, 2, 4, 9, 10, 11, 15 — JSX spread order, parallel pointer sources, 250ms touch threshold, toDataURL race, parallel engines, undo pollution, testing limits.
- `.planning/research/ARCHITECTURE.md` §§ 2, 4-6, 8, 9, 11-12, 17 — module structure, re-render avoidance, z-index map, overlay pointer-events strategy, pointer capture interaction.
- `.planning/research/SUMMARY.md` — research synthesis + adapter reconciliation.

### Phase 27 foundation (lock-in)
- `.planning/phases/27-dnd-foundation/27-VERIFICATION.md` — 17/17 truths verified; lists exactly what the Phase 28 wiring builds on.
- `.planning/phases/27-dnd-foundation/deferred-items.md` — 9 pre-existing failing tests; Phase 28 deletes or rewrites each as noted there.
- `src/dnd/adapter/dndkit.ts` (header block) — DND-01 single-sensor rule, Pitfall 4, Pitfall 10 — do not violate.
- `src/dnd/dragStore.ts` — locked vanilla Zustand shape; Phase 28 extends with `ghostDataUrl` and `sourceRect`.
- `src/dnd/useCellDraggable.ts` (header block) — Pitfall 1 "SPREAD LISTENERS LAST" reminder.
- `src/dnd/useCellDropTarget.ts` (header block) — Pitfall 2 single-event-source reminder.
- `src/dnd/computeDropZone.ts` — locked pure 5-zone resolver; Phase 28 must NOT alter.

### dnd-kit type references (for writing the PointerSensor subclasses + Modifier)
- `node_modules/@dnd-kit/core/dist/sensors/pointer/AbstractPointerSensor.d.ts` — `PointerActivationConstraint` union, attach lifecycle.
- `node_modules/@dnd-kit/core/dist/sensors/pointer/PointerSensor.d.ts` — activators shape, pointerType access.
- `node_modules/@dnd-kit/core/dist/components/DragOverlay/DragOverlay.d.ts` — modifiers prop, adjustScale semantics.
- `node_modules/@dnd-kit/modifiers/dist/` — scan the shipped modifiers + `Modifier` type export.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/dnd/adapter/dndkit.ts` (skeleton) — DndContext host target; Phase 28 fills `export {}` body.
- `src/dnd/dragStore.ts` — vanilla Zustand store; Phase 28 extends with `ghostDataUrl`, `sourceRect`, `setGhost(ghost, rect)` action (or inline in `beginCellDrag`).
- `src/dnd/computeDropZone.ts` — locked pure function; drop-target hook calls this each pointermove.
- `src/dnd/useCellDraggable.ts` / `useCellDropTarget.ts` — skeleton hooks with header documentation; Phase 28 fills bodies using `useDraggable`/`useDroppable`.
- `src/dnd/DragPreviewPortal.tsx` / `DropZoneIndicators.tsx` — skeleton components returning `null`; Phase 28 implements.
- `src/store/gridStore.ts` — `moveCell` (lines 473-494) locked by Phase 27 regression tests; invoked on drop commit only.
- `src/store/editorStore.ts` — `canvasScale` read in the custom Modifier for scale compensation.
- lucide-react icons (`ArrowLeftRight`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) — zone iconography.

### Established Patterns
- Vanilla Zustand stores for ephemeral state (`dragStore` precedent set in Phase 27) — do not pollute `gridStore`.
- `createPortal(document.body)` for viewport-space UI above the scaled canvas (ActionBar precedent in v1.1).
- `getBoundingClientRect()` for viewport-space math (computeDropZone locked to this contract).
- `setPointerCapture` on Divider redirects pointer events — naturally blocks dnd-kit takeover during resize.
- Native HTML5 file-drop with `dataTransfer.types.includes('Files')` guard (Phase 8 pattern) — coexists with pointer-engine DnD.

### Integration Points
- `CanvasWrapper.tsx` — DndContext host; replaces Phase 25 wiring at line 121.
- `LeafNode.tsx` — calls `useCellDraggable(id)` + `useCellDropTarget(id)`; renders `<DropZoneIndicators />` conditionally; adds `cursor: grab` class; preserves existing file-drop handlers.
- `EditorShell.tsx` — mounts `<DragPreviewPortal />` once above the canvas in the return tree.
- `Divider.tsx` (line 103 hit-area) + `OverlayLayer.tsx` (line 51 root) — receive `data-dnd-ignore="true"`.
- `OverlayLayer.tsx` (line 67) — selected overlay extends `pointerEvents: 'none'` during `dragStore.status === 'dragging'`.
- `CanvasArea.tsx` (lines 89-94 file-drop handlers) — preserved unchanged.
- `index.ts` barrel exports — extend with the new types/functions (`ghostDataUrl`, `setGhost` if promoted).

</code_context>

<specifics>
## Specific Ideas

- **Single source of pointer truth** (principle from Pitfall 2 post-mortem): every zone/position read derives from dnd-kit's `onDragOver`/`onDragMove` event payload. No parallel `document.addEventListener('pointermove')`, no secondary `useDndMonitor` inside `LeafNode`. The root-cause of Phase 25 failure was frame-stale zone coordinates from two independent pointer sources.
- **Spread listeners last** (Pitfall 1): `useCellDraggable` returns `{attributes, listeners, setNodeRef, isDragging}` — the LeafNode JSX must spread `{...listeners}` AFTER any explicit `onPointerDown` (or merge into a single handler). The header doc in `src/dnd/useCellDraggable.ts` already documents this.
- **Remove same-phase** (Pitfall 10): no feature flag, no gradual migration. Phase 25 wiring is deleted in the same commits that add the new wiring. Two engines never coexist, not even for one commit.
- **`gridStore.moveCell` stays untouched** (DND-05 regression lock from Phase 27-04): tree primitives + no-op guards are immutable. Phase 28 invokes `moveCell` on commit and nothing else.

</specifics>

<deferred>
## Deferred Ideas

Belong to Phase 29 (ESC-Cancel + Visual Polish):
- ESC-to-cancel keydown listener + `onDragCancel` wiring (CANCEL-01)
- 200ms snap-back animation on cancel + release-on-origin (CANCEL-02, CANCEL-04 animation)
- Drag-start wobble (DRAG-05) — scale 1.00→1.05→1.02 over 150ms
- Ghost lift scale 1.04 + drop shadow (DRAG-06)
- Active zone 100% white + scale 1.1 + glow (DROP-02)
- Inactive zones 30% white (DROP-03)
- 700ms accent flash on drop commit (DROP-08)

Belong to Phase 30 (Mobile Handle + Tray Polish):
- `touch-action: none` on draggable cells (CROSS-02)
- `-webkit-touch-callout: none` (CROSS-03)
- Body `user-select: none` during drag (CROSS-04)
- `contextmenu` preventDefault during drag (CROSS-05)
- `navigator.vibrate(10)` on activation, `navigator.vibrate(15)` on commit (CROSS-06/07)
- MobileCellTray + bottom-sheet auto-collapse on drag-start (CROSS-08)

Needs external research during planning/research phase:
- Canvas `toDataURL()` timing vs rAF draw loop for VIDEO cells under dnd-kit's synchronous `onDragStart` callback — Pitfall 9 race. Recommendation: pause video rAF on source cell during drag as belt-and-braces.
- Exact `Modifier` signature + property mutation for scale compensation under an ancestor `transform: scale()`. See dnd-kit issues #50, #205, #250, #393 referenced in PITFALLS.md sources.

</deferred>

---

*Phase: 28-cell-to-cell-drag*
*Context gathered: 2026-04-17 (assumptions mode)*
