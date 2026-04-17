# Domain Pitfalls — v1.5 Unified DnD Replacement

**Domain:** Replacement of an existing buggy cell-drag implementation in a React + Zustand + CSS-transform-scaled canvas editor (StoryGrid)
**Scope:** Library migration, unified desktop + mobile DnD, custom drag ghost, 5-zone hit detection, coexistence with existing pointer handlers
**Researched:** 2026-04-17
**Confidence:** HIGH (root causes for Phase 25 failures verified in-repo; library pitfalls verified via GitHub issues, official docs)

---

## Root-Cause Hypothesis for Phase 25 Failures

Before enumerating new-milestone pitfalls, it is worth surfacing what actually went wrong in Phase 25 — evidence is in quick-task `260416-vgk` (`.planning/quick/260416-vgk-...`, commit `95b94ca`). Confidence: HIGH — this is the repo's own post-mortem.

**Failure 1 — "drag fires once in 10 times":** `handlePointerDown` was declared on the same element as `{...dragListeners}` from `useDraggable`. In JSX, attribute order is write-order on the DOM element — `onPointerDown={handlePointerDown}` was placed AFTER `{...dragListeners}`, so React overwrote @dnd-kit's pointerdown with the pan handler, which returned early in non-pan mode and ate the event. @dnd-kit's sensor never saw the pointerdown. The fix moved the spread to after all explicit handlers.

**Failure 2 — "5-zone never works properly":** `useDndMonitor.onDragOver` reads pointer position from a document-level `pointermove` listener (line 304-310 of `LeafNode.tsx`) and subtracts `divRef.current?.getBoundingClientRect()`. This is correct math, but the ref that wrote the pointer position (`pointerPosRef`) was updated by a separate document listener that was not synchronized with dnd-kit's own drag events, so by the time `onDragOver` fired, `pointerPosRef` was often stale by one paint (the mousemove and @dnd-kit's move are dispatched out-of-order in some event loop orderings). Net effect: zone calculation used pointer position from the previous frame, producing wrong zones near zone boundaries. Compounded by `threshold = Math.max(20, Math.min(w,h) * 0.2)` meaning the zone transitions are at cell-relative 20% — very sensitive to small position errors.

**Failure 3 — "scale(1.08) overflows":** visual lift was implemented via CSS `transform: scale(1.08)` on the dragged cell. Parent container clipped to the layout box, so the scaled element bled outside with no visual container to bound it. Fixed to `box-shadow: inset` instead of transform.

**Implication for v1.5:** Do not reach for `transform` for visual drag affordances. Do not use two independent event sources to derive drag-relative coordinates. Do not spread drag listeners on an element that also has pointer handlers without understanding JSX prop-order semantics.

---

## Critical Pitfalls

Mistakes that cause rewrites, undetectable flaky behavior, or ship-blocking regressions.

---

### Pitfall 1: JSX attribute order collision between custom pointer handlers and library-provided listeners

**What goes wrong:**
When a component uses a drag library that returns a `listeners` or `attributes` object to spread onto the DOM element (both `@dnd-kit/core`'s `useDraggable` and Framer Motion's drag variants do this), and that element also has explicit `onPointerDown` / `onTouchStart` handlers for coexisting concerns (pan mode, resize, tap-to-select), the JSX order determines which handler wins. A later explicit `onPointerDown` silently overwrites the spread `onPointerDown` from the library.

**How it manifests:**
Drag "fires once in 10 times" or never fires at all. Works in tests (jsdom fires all listeners synchronously from `dispatchEvent`) but fails in browser. Symptom is indistinguishable from a broken activation constraint.

**Prevention:**
1. Spread library listeners LAST on the element, after all explicit handlers:
   ```tsx
   <div onPointerDown={handlePan} {...(!isPanMode ? dragListeners : {})} />
   ```
2. If both must coexist in all modes, use a single composed handler that forwards to both paths, rather than relying on JSX order.
3. Use `pointerdown` on a wrapper element for library listeners and keep custom handlers on an inner element with `stopPropagation` as an explicit contract, not as an accident.
4. Add a lint rule or a codemod check that flags a component with BOTH `{...someListeners}` and explicit `on<Pointer|Touch|Mouse>*` props on the same element.

**Severity:** CRITICAL — this is exactly what broke Phase 25.
**Phase:** Early (foundation / library wiring).

---

### Pitfall 2: Derived-from-ref pointer position is stale by one frame during drag

**What goes wrong:**
Code derives the in-cell pointer coordinates by subscribing to a document `pointermove` listener that writes to a ref, then reads that ref inside a drag-library callback (`onDragOver`, `monitor.subscribe`). The document listener and the library's event are dispatched from two different event sources with no ordering guarantee. When the library callback fires, the ref may hold the position from the PREVIOUS event loop tick — off by 8–16px at typical touch velocities.

**How it manifests:**
Zone detection glitches right at zone boundaries. Dropping "just on the edge" of the center zone snaps to a different zone than what the overlay showed a frame earlier. User reports "it swapped when I wanted to insert."

**Prevention:**
1. Use the drag library's own pointer position inside its callback — never derive from a parallel document listener. Pragmatic DnD's `onDrag`/`onDrop` events include `location.current.input.clientX/clientY`. @dnd-kit's `onDragMove` gives a synthetic pointer via `delta` + initial rect. Framer Motion's `onDrag` gives `point`.
2. If the library does not expose pointer position in the relevant callback, compute zones once at `onDragEnter` from a snapshot rect + current library-provided position, and do not update them on every pointer move unless absolutely required.
3. Never mix two event sources as coordinate inputs for the same computation.

**Severity:** CRITICAL — this is the other half of Phase 25's flakiness.
**Phase:** Mid (zone-detection implementation).

---

### Pitfall 3: `getBoundingClientRect` returns pre-transform coords when the ancestor has `transform: scale()`

**What goes wrong:**
StoryGrid's canvas surface is wrapped in `transform: scale(finalScale)` (ranging roughly 0.2–0.5 in typical viewports). `getBoundingClientRect()` on a child cell RETURNS the visual, post-transform rect — this is actually correct. The bug is the OPPOSITE direction: if code does naive pointer-to-cell math by subtracting `rect.left` but then compares against `rect.width` expecting "1080 canvas units," the math is off by the scale factor. Conversely, if the drag library measures cells via some custom path that uses `offsetLeft/offsetWidth` or `element.getBBox()`, those are pre-transform and mismatch the post-transform pointer.

**How it manifests:**
Hit regions are displaced by a scale-dependent amount. Works at 100% zoom in dev but fails when the canvas auto-fits to a narrow viewport. Edge zones start triggering 40px before the visual edge.

**Prevention:**
1. Always use `element.getBoundingClientRect()` for any pointer-vs-element math; never use `offset*` properties in scaled containers.
2. Verify coordinate math at multiple `canvasScale` values (0.2, 0.5, 1.0) during development — a single zoom level hides the bug.
3. When choosing a library, verify it uses `getBoundingClientRect` internally for drop-target measurement. @dnd-kit does (after v6), Pragmatic DnD does (it uses native browser drop-target resolution), Framer Motion does.
4. Do not apply `transform: scale` to the draggable element itself during drag (see Pitfall 9) — scale on the container is fine, scale on the dragged element compounds.

**Severity:** HIGH — correctness-affecting, scale-dependent, common to miss in testing.
**Phase:** Mid (zone-detection).

---

### Pitfall 4: Press-hold delay conflicts with iOS long-press image action menu

**What goes wrong:**
iOS 17.2+ fires the native "image action" context menu (Save, Copy, Share) on long-press over `<img>` elements unless the user starts moving within a small window. A 500ms hold threshold sits RIGHT in the danger zone — the menu appears at ~500–700ms. A user who holds a cell to drag but does not move for 500ms gets the iOS menu, and the drag is cancelled.

**How it manifests:**
On iOS Safari, long-press over a cell that has an `<img>` or `<canvas>` child triggers the Save-Image sheet. User has to dismiss and try again. Works fine on Android and desktop.

**Prevention:**
1. Apply CSS `-webkit-touch-callout: none` and `-webkit-user-select: none` to draggable cells.
2. Apply `touch-action: none` to the draggable element (already done in LeafNode — keep it).
3. The cell currently contains a `<canvas>`, not an `<img>` — this lowers but does not eliminate risk because Safari also offers image actions on images-inside-elements.
4. Use a SHORTER hold threshold (150–250ms) combined with a movement tolerance (5–8px) — users prefer shorter holds anyway, and the interaction undercuts the iOS menu window.
5. Test on a real iOS device with a photo cell — simulator does not reproduce image-action behavior.

**Severity:** HIGH (iOS-only but iOS is half the target audience for a Stories app).
**Phase:** Mid (mobile validation).

**Sources:** pragmatic-drag-and-drop Issue #13 — iOS 17.2+ press-and-hold triggers image action state.

---

### Pitfall 5: React 18 StrictMode double-invokes effects, breaking drag library registration

**What goes wrong:**
StrictMode's dev-only double-invocation of effects (`mount → unmount → mount`) makes any effect that REGISTERS a draggable with the library twice with the same ID. Libraries that assume idempotent registration are fine; libraries that maintain an internal `Map<id, element>` and throw / warn on duplicate IDs fail. This has been observed in react-beautiful-dnd (Issue #2350), kendo-react DnD (Issue #1353), and can manifest in any library that does not defensively clean up on unmount.

**How it manifests:**
Dev-only console warning "Unable to find draggable with id" or silent drag failure when the second mount attaches to a stale reference. Production build works fine (no double invocation), masking the bug until someone else develops in the app.

**Prevention:**
1. Verify the chosen library explicitly supports React 18 Strict Mode in its docs. Pragmatic DnD is event-based (no registry) and is StrictMode-safe by design. @dnd-kit v6 is StrictMode-safe. Framer Motion is StrictMode-safe.
2. Test in `<React.StrictMode>` (confirm `src/main.tsx` wraps App in StrictMode — it does) and verify no console warnings or double-registration errors.
3. If writing custom DnD, ensure `useEffect` cleanup functions fully reverse their setup work — no half-state left in module-level registries.

**Severity:** MEDIUM (StrictMode is dev-only, but a broken dev experience guarantees more bugs ship).
**Phase:** Early (library selection gate).

---

### Pitfall 6: `touch-action: none` scope creep steals page-level gestures

**What goes wrong:**
`touch-action: none` prevents the browser from handling ANY default touch gesture on the element — scroll, zoom, pan, double-tap-to-zoom. Applied too broadly (to the canvas container, to a parent of draggable cells), it breaks pinch-to-zoom in pan mode (`src/Grid/LeafNode.tsx` line 429-472 is a hand-written pinch gesture that depends on page scroll being blocked), accidental page scroll during long list scrolling, and two-finger swipe to go back in Safari.

**How it manifests:**
Users complain mobile feels "stuck" — cannot scroll the bottom sheet, cannot pinch-zoom outside pan mode. Existing Phase 5.1 pinch-to-zoom feature silently stops working because a parent `touch-action: none` blocks `touchmove` events.

**Prevention:**
1. Apply `touch-action: none` ONLY to the exact draggable element, never to ancestors.
2. Audit existing `touch-action` CSS across all mobile views after the new DnD lands.
3. Keep the current `touch-action: manipulation` app-wide default (from Phase 22) and layer `touch-action: none` surgically on the drag handle.
4. If a library requests `touch-action: none` on a wide region, reject that library — it cannot coexist with bottom sheet scrolling and pan-mode pinch.

**Severity:** HIGH (mobile UX regression risk).
**Phase:** Mid (mobile integration).

**Sources:** @dnd-kit docs on `touch-action`, Pointer Events spec Issue #360.

---

### Pitfall 7: iOS 15+ address bar resize cancels in-flight drag

**What goes wrong:**
On iOS 15+ Safari, the address bar auto-hides on scroll and fires a `window.resize` event. Several DnD libraries (notably react-beautiful-dnd, and some @dnd-kit configurations) listen to `resize` to re-measure drop targets and cancel the drag to avoid inconsistent state. Users scrolling lightly with a finger during a drag trigger the resize and lose the drag mid-gesture.

**How it manifests:**
User starts dragging on iOS Safari. Address bar collapses. Drag silently cancels. No visual feedback. User restarts.

**Prevention:**
1. Pick a library that does NOT cancel on resize. Pragmatic DnD does not (native drag API). @dnd-kit v6 does not cancel on resize by default but does re-measure — verify behavior with a real device before shipping.
2. Prevent the address bar from collapsing during drag: on `dragstart`, set `document.body.style.overflow = 'hidden'` and restore on `dragend` — this prevents the scroll that triggers the bar.
3. Use `100dvh` for the viewport container (already done in Phase 23 mobile sheet) so the layout does not reflow when the bar animates.
4. Test on a real iOS device. Safari Technology Preview's responsive simulator does NOT reproduce this.

**Severity:** HIGH on iOS; not reproducible on simulator.
**Phase:** Mid (mobile validation).

**Sources:** dnd-kit Issue #686, react-beautiful-dnd Issue #2367.

---

### Pitfall 8: ESC-to-cancel is stolen by focused input, modal layer, or React portal

**What goes wrong:**
The v1.5 spec includes ESC-to-cancel drag. If ESC is bound via a window-level listener, any focused text input that has its own ESC handler (e.g., the text-overlay edit input, the color-picker modal) can steal the event. Conversely, if ESC is bound via a React portal, a child portal-sibling (like the overlay editor, which is an `OverlayLayer` portal child) may register a conflicting listener.

**How it manifests:**
User starts dragging while a text overlay is focused. Presses ESC. Text overlay's edit mode exits but drag continues. Or the opposite: drag cancels but the focused input is left in a half-committed state.

**Prevention:**
1. Bind ESC to `window` with `capture: true` ONLY while a drag is in flight (`addEventListener` in `dragStart`, `removeEventListener` in `dragEnd/dragCancel`). Capture phase ensures the drag's ESC runs before any bubble-phase inputs.
2. Inside the ESC handler, call `e.stopImmediatePropagation()` after cancelling the drag so no other handler runs.
3. Do NOT rely on React synthetic event keydown — portal siblings get their own React event tree; window listener is the single point of truth.
4. Before starting the drag, `document.activeElement?.blur()` to remove focus from any text input.

**Severity:** MEDIUM (edge case but will be hit by users mid-edit).
**Phase:** Mid (ESC-to-cancel feature).

---

### Pitfall 9: Custom drag ghost renders blank/white when source element has CSS `filter`, `object-fit`, `transform`, or `<canvas>` contents

**What goes wrong:**
Native HTML5 drag API's `setDragImage(element)` snapshots the element via the browser's drag-image renderer, which is NOT the same as `html-to-image` or `html2canvas`. The browser's renderer is stricter:
- CSS `filter` (blur, saturate, etc.) — may rasterize as unfiltered.
- `object-fit: cover` — respected but with sub-pixel snapping artifacts.
- `transform` — fully respected, but compounds with any parent transform.
- `<canvas>` content — WORKS in Chrome if `canvas` is rendered, but the snapshot races the drawing — a canvas that is mid-rAF loop may snapshot the previous frame or a partial frame.

StoryGrid's cells are `<canvas>` elements rendering via rAF. Snapshotting during a rAF tick is a race — the drag ghost flashes the wrong content or appears blank.

**How it manifests:**
Drag preview shows a blank white rectangle, a flickery canvas, or the PREVIOUS video frame, not the visual "cell as it looks right now." On Safari, sometimes the default "copy of tag-tree-including-canvas-with-no-content" is shown instead.

**Prevention:**
1. Do not use native `setDragImage` on a live canvas. Instead, take a single `canvas.toDataURL()` or `canvas.captureStream().getTracks()[0]` snapshot at drag start, render it to a hidden offscreen `<img>` and pass that image to `setDragImage`.
2. Alternatively (simpler): implement a "synthetic ghost" — a React-rendered floating element at pointer position, bypassing the native drag preview entirely. Pragmatic DnD's `setCustomNativeDragPreview` does this via an off-DOM portal; Framer Motion does it via `<motion.div drag>` with `dragConstraints`.
3. At dragstart, freeze the rAF loop for dragged cell(s) (pause the shared video timeline if any cell is a video, or skip the rAF draw while `isDragging` is true) to avoid the mid-frame race.
4. If the library uses native drag API (Pragmatic DnD does), test with a video-cell drag in playback — not just a static image.

**Severity:** HIGH — an ugly drag preview undermines the "delightful" UX goal of this milestone.
**Phase:** Mid (drag ghost implementation).

**Sources:** MDN `DataTransfer.setDragImage`, react-dnd Issue #452 (Chrome ghost inconsistency), Pragmatic DnD `setCustomNativeDragPreview` API.

---

### Pitfall 10: Two drag libraries in the same React tree fight over `dragstart` / `preventDefault`

**What goes wrong:**
Pragmatic DnD and `react-dnd` cannot coexist: react-dnd calls `event.preventDefault()` on `dragstart` events at the document level, which STOPS pragmatic-dnd's drags from initiating (Pragmatic DnD Issue #106). The same class of problem exists between @dnd-kit and HTML5 native drag: @dnd-kit's sensor registration intercepts pointerdown, preventing native `dragstart` from firing on elements marked `draggable="true"`.

StoryGrid currently has BOTH: @dnd-kit for cell swap, AND native HTML5 drag handlers on LeafNode for file-drop (`onDragOver={handleFileDragOver}` / `onDrop={handleFileDrop}`). The `dataTransfer.types` "Files" guard is the only thing keeping these from colliding.

**How it manifests:**
During library migration, if both old and new engines run simultaneously in a shared tree, drags either don't start or start with the wrong engine. Desktop file-drop from the OS starts showing the cell-drag 5-zone overlay instead of the file-drop highlight.

**Prevention:**
1. NEVER run two engines in parallel during migration. Replace @dnd-kit wholesale in a single phase, not incrementally.
2. Preserve the existing `dataTransfer.types.includes('Files')` discriminator in the file-drop path so the new engine does not claim OS file drags.
3. If the new engine uses native HTML5 `draggable="true"`, ensure the root cell element does not compete with the file-drop handler at the same DOM level. Use a child `.drag-handle` for cell drag, keep file drop on the root.
4. During the migration phase, temporarily disable ONE path (feature-flag the old @dnd-kit code or the new engine) so you can diff behavior cleanly.

**Severity:** CRITICAL during migration window.
**Phase:** Early (migration).

**Sources:** Pragmatic DnD Issue #106 (react-dnd collision), Phase 25 existing dual-path architecture.

---

### Pitfall 11: Drag state placed in Zustand store causes re-render storms + polluted undo history

**What goes wrong:**
Instinct says: "drag is state, put it in Zustand." Wrong. Drag state updates 60 times per second. Each update triggers Immer's structural-clone of the committed tree, React re-subscribes, and every cell re-renders. On a 20-cell grid with a canvas rAF loop, this drops frame rate from 60fps to ~20fps. Worse: if `moveCell` is called during a drag-cancel or an aborted drag, an undo-history entry is pushed for what was never a real mutation.

**How it manifests:**
Drag is visibly laggy on mobile. CPU profile shows Zustand-provoked React re-renders dominating. User hits Ctrl+Z after an aborted drag and the state "jumps" to an intermediate drag position (spurious history).

**Prevention:**
1. Drag state (active-zone, drag-over target, pointer position, ghost position) lives in React refs or local component state ONLY. Never put per-frame drag state in Zustand.
2. Commit to Zustand ONCE on drag-end, inside a single action that pushes a single history entry: `moveCell(sourceId, targetId, zone)`. Existing pattern is correct — preserve it.
3. On drag CANCEL (ESC, drop outside, touch-cancel, resize): do NOTHING to the store. No history push, no state mutation.
4. If drag needs to read store state (e.g., to know current layout), use `useGridStore.getState()` imperatively inside the drag callback — bypasses React subscription.
5. Zustand transient updates (subscribe-without-selector) are acceptable for drag visualization IF you need cross-component drag state, but prefer context + ref over store.

**Severity:** HIGH (performance + undo correctness).
**Phase:** Early (state architecture).

**Sources:** Zustand Discussion #2886 (non-reactive state), Graphite Issue #1943 (aborted drag destroys redo history).

---

### Pitfall 12: 5-zone hit threshold too sensitive in small cells, too coarse in large cells

**What goes wrong:**
The current Phase 25 formula `threshold = Math.max(20, Math.min(w,h) * 0.2)` means zones scale with cell size. In a tiny cell (200×200 unscaled → ~50px on screen after canvasScale), the 20% threshold is 40 unscaled px = 10 screen px — drop anywhere on the edge pixel-row and you get an edge zone. In a large cell (800×1600 → ~400×800 screen px), 20% is 160 unscaled px = the edge zones occupy nearly half the cell. Users cannot predict where the center zone ends.

**How it manifests:**
On a wide cell, trying to swap (center drop) often triggers top/bottom edge insert instead. On a narrow cell, center is hard to hit. Zone-to-visual mismatch breaks the "icon shows what will happen" contract.

**Prevention:**
1. Use a FIXED screen-space threshold: `threshold = 40 / canvasScale` (converts to cell-space pixels) — zones are always 40 screen px from the edge regardless of cell size or zoom level.
2. Ensure `threshold * 2 < min(cellWidth, cellHeight)` — if not (extreme tiny cells), disable edge zones and only allow center drop.
3. Visualize the zone during dev with a translucent overlay toggle — makes the boundary obvious in manual testing.
4. A/B test zone sizes with a real user; 40px is a guess. Aim for 30–50px.

**Severity:** MEDIUM (correctness + UX).
**Phase:** Mid (zone calibration).

---

### Pitfall 13: `pointerup` misses when the pointer leaves the window during drag

**What goes wrong:**
On desktop, if a user drags a cell and releases the mouse OUTSIDE the browser window, the element may never receive `pointerup` — the OS captures it. Without `setPointerCapture`, subsequent pointer events go to the wrong element and the drag visual state sticks ("ghost cursor"). Same applies to touch: lifting a finger on the iOS address bar area can miss the `touchend`.

**How it manifests:**
After dragging outside the window, the dragged cell remains in "lifted" state. Cursor shows grabbing. Every mouseenter on another cell tries to drop. Only a full page reload clears it.

**Prevention:**
1. Call `setPointerCapture(e.pointerId)` on the draggable element at dragstart. All subsequent pointer events route there regardless of DOM position.
2. Listen for `pointercancel` in addition to `pointerup`. The browser fires `pointercancel` when the OS takes over the pointer (e.g., drag leaves window).
3. Listen for `visibilitychange` on document — if the page goes hidden mid-drag (alt-tab, notification), treat as a cancel.
4. Verify with real desktop test: drag a cell, move cursor off the browser window, release mouse outside, return cursor.
5. Framer Motion and Pragmatic DnD handle this internally. @dnd-kit has historically needed `setPointerCapture` in app code (see `LeafNode.tsx` line 563 — already used for pan, needs to extend to drag).

**Severity:** MEDIUM (escape-hatch correctness).
**Phase:** Mid (drag end handling).

---

### Pitfall 14: Drag cancel during animation leaves React state desynced from DOM

**What goes wrong:**
If a drag is cancelled mid-animation (ESC, pointercancel, drop-outside), but the visual ghost is mid-flight animation back to origin, React's `isDragging=false` but the DOM still shows the ghost at some interpolated position. If a new drag starts before the animation completes, the ghost appears from a random position. Framer Motion has this class of bug when `layout` and `drag` interact.

**How it manifests:**
Rapid drag sequences (user drags, aborts, drags again in <100ms) show ghost teleporting or starting from wrong origin.

**Prevention:**
1. Cancel any in-flight ghost animation immediately on drag-start of a new drag. Do not wait for the previous animation to complete.
2. Use `layout={false}` or explicit `animate` props rather than Framer Motion's `layout` when drag + layout coexist on the same component (Framer Motion Issue #663).
3. Debounce drag-start only in pathological cases — normal users do not start drags <50ms apart; if your code tests reveal double-starts, the previous drag-end was not cleaned up.
4. Always restore source cell's visual state on drag-end, even if the drop was a no-op: `setIsDragging(false)` must run in a `finally` path or inside `onDragEnd AND onDragCancel` handlers, not just one.

**Severity:** MEDIUM (corner case but surfaces with impatient users).
**Phase:** Late (polish animation).

**Sources:** Framer Motion Issue #663 (layout vs drag conflict), Issue #698 (position-change flicker).

---

### Pitfall 15: File-drop path and cell-drag path accidentally merged

**What goes wrong:**
The spec mentions "research decides whether file-from-desktop drops, text/emoji/sticker overlay drag, and divider resize fold into the same engine." The temptation is to unify for "maintenance wins." This is a trap — file drop originates from the OS drag-protocol (`dataTransfer.files`, `dataTransfer.types`), which no JS library can simulate. If you try to unify, you end up with the new engine intercepting OS file drags, swallowing them, and losing the image.

**How it manifests:**
After migration, users cannot drop a file from desktop onto a cell. The new engine treats the OS drag as an empty cell-drag-of-nothing.

**Prevention:**
1. Keep file-drop on native HTML5 `onDragOver`/`onDrop` handlers. Native is the only way to receive `dataTransfer.files`.
2. The new engine handles CELL DRAG ONLY. Test: `dataTransfer.types.includes('Files')` inside the new engine's dragstart — if true, abort engine-level handling.
3. Divider resize is a pointermove drag, not a drop-target drag. Do not unify — the data model is `resize siblings by delta`, not `move node A to position B`. Leave divider code alone.
4. Text/emoji/sticker overlay drag is already in its own system (`OverlayLayer`, commit `src/Grid/OverlayLayer.tsx`) and uses free-position pointer math, not drop targets. Do not unify.
5. Accept that the maintenance wins from unification are illusory — the three systems have fundamentally different data models.

**Severity:** HIGH (file-drop is the primary content-input path; losing it breaks the app).
**Phase:** Early (scope decision).

---

## Migration-Specific Pitfalls

Risks that only exist during the library-swap window.

---

### Pitfall M1: `@dnd-kit/core` and `@dnd-kit/sortable` imports scattered across test files

**What goes wrong:**
Removing the @dnd-kit dependency from `package.json` leaves orphaned imports in test files that never ran in a merged build. Example: `src/test/phase05-p02-cell-swap.test.ts`, `src/test/phase09-p03-leafnode-zones.test.ts`, `src/test/phase25-touch-dnd.test.tsx` all import from `@dnd-kit/core`. If tests are retained but library is removed, `npm test` breaks. If tests are deleted to match, regression coverage is lost.

**How it manifests:**
Either `vitest run` fails with `Cannot find module '@dnd-kit/core'`, or the test suite passes with tests silently skipped (imports resolve to mocks that don't exercise real code).

**Prevention:**
1. Before removing @dnd-kit, grep-audit:
   ```bash
   grep -r "@dnd-kit" src/
   grep -r "useDndMonitor\|useDraggable\|useDroppable\|DndContext\|TouchSensor\|MouseSensor\|KeyboardSensor\|DragZoneRefContext" src/
   ```
2. For each test file importing @dnd-kit: decide (a) rewrite for new engine, (b) delete if test is engine-specific rather than behavior-specific, (c) convert to behavior-level test using `fireEvent.pointer*` against the real component.
3. Preserve Phase 9 tests that verify `moveLeafToEdge` / `moveCell` tree semantics — those test the pure tree functions, not the DnD engine. Do not delete.
4. `DragZoneRefContext` (exported from `CanvasWrapper.tsx`) is app-level, not library-level — it can stay or go depending on the new engine's API.

**Severity:** HIGH (test coverage gap).
**Phase:** Early (migration).

**Files confirmed to import @dnd-kit (from current grep):**
- `src/Grid/LeafNode.tsx`
- `src/Grid/CanvasWrapper.tsx`
- `src/test/phase25-touch-dnd.test.tsx`
- `src/test/phase09-p03-leafnode-zones.test.ts`
- `src/test/phase05-p02-pan-zoom.test.tsx`
- `src/test/phase05-p02-cell-swap.test.ts`
- `src/test/grid-rendering.test.tsx`
- `src/test/imports.test.ts`
- `src/Grid/__tests__/LeafNode.test.tsx`

---

### Pitfall M2: Regression coverage gap during engine swap

**What goes wrong:**
During the swap phase, existing DnD tests are rewritten for the new engine. Rewrites are a common site for bugs — the new tests don't verify what the old tests verified, just the happy path. Phase 25 tests in particular only verify DRAG-01 through DRAG-04 contracts (long-press initiates, visual lift, 5-zone renders, center = swap / edge = insert). They do not test e.g. "aborted drag produces no undo entry" (Pitfall 11) or "cell drag preserves file-drop path" (Pitfall 15).

**How it manifests:**
Migration lands with green tests. Users report regressions the tests don't cover.

**Prevention:**
1. Before starting migration, write a BEHAVIORAL test suite that does not depend on the library API. Tests drive events on the root DOM element (`fireEvent.pointerDown`, `pointerMove`, `pointerUp`) and assert end-state (`expect(grid.root).toMatchSnapshot()`). These tests survive the migration.
2. Explicit regression tests for the milestone's invariants:
   - "Aborted drag produces no undo entry."
   - "File drop still works on a cell when cell drag engine is active."
   - "Divider resize still works during cell drag."
   - "ESC cancels drag without affecting focused text overlay."
3. Maintain a manual-UAT checklist for device-specific behaviors that tests cannot cover (iOS long-press, address-bar resize, out-of-window pointerup).

**Severity:** HIGH.
**Phase:** Early (pre-migration test scaffolding).

---

### Pitfall M3: Dependency tree side-effects — peer deps on @dnd-kit

**What goes wrong:**
Removing `@dnd-kit/core` and `@dnd-kit/sortable` from `package.json` may leave dependencies that `peerDependency` on @dnd-kit. Common offenders: some component libraries (e.g., `@hello-pangea/dnd` forks), some form builders.

**How it manifests:**
`npm install` warns `peer dependency @dnd-kit/core not installed`. Build succeeds but runtime fails in a rarely-touched code path.

**Prevention:**
1. Before removal, `npm ls @dnd-kit/core` — lists all dependents. StoryGrid's deps are minimal, so this is unlikely to find anything unexpected, but verify.
2. Run `npm install` with no warnings after removal.
3. Build production bundle and check bundle-analyzer output for unexpected @dnd-kit residue.

**Severity:** LOW (unlikely to bite this repo but cheap to check).
**Phase:** Early (migration cleanup).

---

### Pitfall M4: Parallel-engine coexistence is a TRAP

**What goes wrong:**
Tempting migration plan: "Run old @dnd-kit + new engine side by side, migrate cell-by-cell, then remove old." This explodes: both libraries attach document-level pointer listeners, both call `preventDefault()` on dragstart, both maintain their own drop-target registries. Phase 25 already had two drag paths (cell drag + file drop) and those collided in the 260416-vgk fix.

**How it manifests:**
Drag starts in one engine but completes in the other, or neither. Pointer handler order determines outcome non-deterministically.

**Prevention:**
1. Replace wholesale in a single phase — no partial migration.
2. The replacement phase removes the old engine entirely in commit 1, integrates the new engine in commits 2–N.
3. If wholesale replacement feels too large, split by FEATURE, not by component: phase 1 replaces cell-drag entirely, phase 2 adds ghost, phase 3 adds ESC. But never phase 1 "half of the cells use new engine, half use old."

**Severity:** HIGH.
**Phase:** Early (migration strategy).

**Sources:** Pragmatic DnD Issue #106 (react-dnd collision pattern — generalizes).

---

## Library-Specific Pitfalls

### If choosing Pragmatic Drag and Drop (Atlassian)

- **No official sensor/activationConstraint abstraction.** Long-press / tolerance is custom code you write. The native `dragstart` event does not have a press-hold delay — you must implement it. Users have requested configurable long-press and the library authors have deferred (Discussion #93).
- **Low-level API.** Implementing the drag ghost, zone overlay, and hold-pulse animation is 3–5× the code of @dnd-kit for the same feature surface (LogRocket blog estimates "from 10 lines to 100 lines" vs react-beautiful-dnd).
- **iOS requires manual setup.** Touch drag requires `touch-action: none` + manual delay — the library does not handle this out of box (Issue #124 — "manually trigger iOS touch drag start").
- **Native drag-start means iOS image-action-menu risk** (Pitfall 4) is higher than with synthetic pointer-based engines.
- **`setCustomNativeDragPreview`** is the right API for custom ghost. Uses a portaled off-DOM element; bypasses the canvas-snapshot race (Pitfall 9).
- **Excellent for sortable lists, limited examples for n-ary trees.** StoryGrid's recursive grid is NOT a list; most Pragmatic DnD examples assume a flat list.
- **StrictMode-safe** (event-based, no registry).

### If choosing @dnd-kit/core rebuild (staying in @dnd-kit)

- **Phase 25's failures were NOT @dnd-kit's fault.** Root causes are app-level (JSX order, parallel event sources). A rebuild that fixes those issues without switching libraries is viable.
- **@dnd-kit v6 is unmaintained-ish.** Last meaningful release >1 year ago. @dnd-kit/react is in alpha (see existing research STACK.md — do not migrate to @dnd-kit/react).
- **`rectIntersection` + `pointerWithin`** collision strategies cover the 5-zone use case natively — no need for a custom `useDndMonitor` ref-based hack. Use these and drop the `DragZoneRefContext` pattern.
- **`DragOverlay`** handles ghost rendering in viewport space outside the scaled canvas — avoids the `transform: scale(1.08)` overflow bug by construction.
- **StrictMode-safe** (verified in Phase 25 existing tests — StrictMode wraps App in `main.tsx`).
- **Known issue with scaled containers** (Issues #50, #205, #250, #393) — affects `DragOverlay` position at non-1x scale. Mitigation: override `measuring.droppable.strategy` with `MeasuringStrategy.Always` + `getBoundingClientRect`.

### If choosing Framer Motion `drag`

- **Not a drop-target system.** Framer Motion provides drag GESTURES, not drop target registration. You would build the 5-zone detection yourself on top of `onDrag` pointer position. Result: you get animation for free but still write the domain logic.
- **Layout animation + drag conflicts** (Issues #663, #698, #711). Don't use `layout` prop on dragging cells.
- **Gesture priority with other pointer handlers.** Framer's `drag` uses pointer events internally; coexistence with `setPointerCapture`-based pan mode needs careful ordering.
- **Bundle cost.** Framer Motion is ~40KB gzipped — significant for a project with a 500KB gzipped budget. @dnd-kit/core is ~12KB. Pragmatic DnD is ~8KB.
- **Not typically recommended for multi-cell drag-to-reorder** — strong for single-element drag gestures.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Put drag state in Zustand | "Single source of truth" | 60fps → 20fps, polluted undo history | Never |
| Derive pointer coordinates from document-level listener | Decouples from library | Frame-stale coordinates, flaky zones | Never |
| Use `transform: scale()` for drag visual lift | One-line CSS | Overflows layout box, clips in parents | Never — use `box-shadow` or `filter: drop-shadow` |
| Parallel old + new DnD engine during migration | Gradual rollout | Pointer event collisions, non-deterministic drag | Never — swap wholesale |
| Unify file-drop into new engine | "Single drag system" | OS file drags swallowed | Never — keep file drop native |
| Use `offsetLeft/offsetWidth` for hit regions | Slightly faster than `getBoundingClientRect` | Wrong in scaled containers | Never in scaled canvases |
| Use React synthetic events for ESC-to-cancel | Matches React patterns | Portal siblings steal the event | Only if no portal layers exist |
| Skip real-device iOS testing | Simulator is fine | Ship broken iOS drag, Phase 25 redux | Never |
| Spread `{...dragListeners}` before other handlers | Looks neutral | Silent handler override | Never — spread last |

---

## Integration Gotchas

Coexistence with existing StoryGrid systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Overlay layer (text/emoji/sticker) | New DnD intercepts overlay drag | `OverlayLayer` has its own free-position drag; gate new DnD to `data-testid="leaf-*"` elements only |
| Divider resize | Drag initiates on divider pointer-down | Divider has `pointer-events` on its own element; new DnD draggable scope excludes dividers |
| Pan mode (double-click a cell) | Drag initiates when user wants to pan | Gate new DnD: `if (panModeNodeId !== null) disable drag` — preserved from current LeafNode line 662 pattern |
| File drop from desktop | New engine claims OS drag | `dataTransfer.types.includes('Files')` → native path wins; new engine only handles synthetic cell drags |
| Bottom sheet scroll on mobile | `touch-action: none` on canvas blocks sheet scroll | Apply `touch-action: none` ONLY on the cell element, not a wrapper |
| Canvas scale (0.2–0.5) | Drag coordinate math off by scale factor | Use `getBoundingClientRect` universally; normalize to canvas-space via `canvasScale` from editorStore |
| Portal-based ActionBar | Drag handle inside ActionBar duplicates cell drag | Remove the drag-handle button pattern from Phase 25 (ActionBar should trigger Split/Remove only; drag is the cell body) |
| Undo/redo | Drag writes to store every frame | Drag writes to store ONCE on drop-end via `moveCell(source, target, zone)` — existing pattern, preserve it |
| Video playback rAF loop | Drag ghost snapshots mid-frame | Pause rAF during drag (or freeze source cell's timeline) |
| React StrictMode | Library double-registers | Verify library docs claim StrictMode safety; test in `<StrictMode>` wrapper |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Zustand store update per pointer move | CPU spike during drag, 20fps | Drag state in refs, not store | >5 cells in tree |
| Re-render all cells on `activeZone` change | Scroll/drag jank | `activeZone` in local state of hovered cell only | >10 cells |
| `getBoundingClientRect` called per pointer move | Layout-thrashing warnings | Measure once at drag start, cache in ref | Always (hot path) |
| Ghost rendered in DOM as child of scaled container | Paint cost, flicker | Render ghost via portal to `document.body` in viewport space | Any non-1.0 canvasScale |
| rAF video loop continues during drag | Canvas-snapshot race, ghost flicker | Pause playback on drag start | When any cell is playing video |
| `pointermove` listener on document always active | Unnecessary wakeups | Attach only during active drag | Always |
| Framer Motion `layout={true}` on dragging cells | Flicker, jitter | `layout={false}` during drag | Always with Framer Motion |

---

## Security Mistakes

Domain does not have meaningful drag-specific security surface (no cross-origin drag, no data drop from external sources beyond files). Skip.

The only relevant concern: custom drag image rendering must not leak cross-origin canvas content. StoryGrid's canvases draw local blob-URL videos and base64 images, so canvas is never tainted — `toDataURL()` / `setDragImage` are safe.

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Press-hold delay too long (500ms on current Phase 25) | Users perceive "app is slow" | 150–250ms delay with 5–8px movement tolerance; snappier, undercuts iOS menu |
| No visual feedback during hold wait | User doesn't know drag is pending | `hold-pulse` animation (already implemented in Phase 25 — keep) |
| Drag ghost follows pointer exactly (occluded by finger on touch) | Cannot see what's being dragged on mobile | Offset ghost above pointer: `translate(-50%, -120%)` on touch, centered on mouse |
| Zone overlays appear on ALL cells simultaneously | Visual noise during drag | Show overlays only on the currently-hovered target, fade out within 100ms of leaving |
| Abrupt drag-cancel animation | Feels broken | Ghost flies back to origin in 200ms ease-out |
| Icon feedback identical across 5 zones | User cannot predict result | Distinct icon per zone: swap ⇄ arrows for center, directional arrows for edges |
| No cursor change on desktop | User doesn't know cell is draggable | `cursor: grab` on hover, `cursor: grabbing` during drag (already implemented — keep) |
| ESC hint not shown | User doesn't know they can cancel | Show tooltip "Press ESC to cancel" on drag start, 2s auto-hide |

---

## "Looks Done But Isn't" Checklist

Verifications before declaring v1.5 phases complete.

- [ ] **Drag engine:** Works after React StrictMode unmount/remount (dev mode) — no console warnings, drag still initiates.
- [ ] **Hold-pulse animation:** Fires on `pointerdown` in non-pan mode, clears on `pointerup`/`pointercancel`, never sticks.
- [ ] **5-zone detection:** Zones are fixed screen-space size (not cell-relative), verified at canvasScale 0.2, 0.5, 1.0.
- [ ] **Drag ghost:** Does not show blank or previous-frame for video cells — verify with a playing video cell.
- [ ] **File drop:** OS file drop onto cells still works after cell-drag engine is replaced.
- [ ] **Divider resize:** Still works when cell-drag engine is active.
- [ ] **Pan mode:** Double-click-then-drag still pans, does not initiate cell drag.
- [ ] **Overlay drag:** Text/emoji/sticker overlay drag independent of cell drag.
- [ ] **Bottom sheet scroll:** Mobile bottom sheet still scrolls while cell drag engine is mounted.
- [ ] **Pinch-to-zoom in pan mode:** Still works on mobile — no `touch-action: none` ancestor blocks `touchmove`.
- [ ] **ESC cancel:** Aborts drag without affecting focused text overlay edit or any modal.
- [ ] **Aborted drag:** `Ctrl+Z` after cancelled drag does not revert to a mid-drag state — no spurious undo entry.
- [ ] **Out-of-window pointer-up:** Desktop drag released outside browser window cleans up state (no stuck ghost).
- [ ] **iOS address bar collapse during drag:** Drag does not cancel. Verify on real iOS device.
- [ ] **iOS long-press over image content:** Does NOT trigger Save-Image menu. Verify on real iOS device with a loaded photo cell.
- [ ] **Zone icon updates:** Active zone icon bright, others dim — matches spec; verify each zone transition.
- [ ] **Rapid re-drag:** Drag → abort → drag again within 100ms — ghost starts from correct origin.
- [ ] **60fps during drag:** Chrome DevTools performance recording shows no frame >20ms during drag on 20-cell grid.
- [ ] **Bundle size:** New library added without exceeding 500KB gzipped production bundle.
- [ ] **Test suite:** All existing Phase 9 `moveLeafToEdge` tree tests still pass. DnD-engine-level tests rewritten for new engine.
- [ ] **@dnd-kit fully removed:** `grep -r "@dnd-kit" src/` returns zero hits. `npm ls @dnd-kit/core` returns empty.

---

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Handler order collision (Pitfall 1) | LOW | Move `{...listeners}` spread to last position, re-test |
| Stale pointer ref (Pitfall 2) | LOW | Use library's callback pointer position, delete document-level listener |
| Scale hit-region math off (Pitfall 3) | LOW | Replace `offset*` with `getBoundingClientRect` |
| iOS image-action menu interferes (Pitfall 4) | MEDIUM | Add `-webkit-touch-callout: none`, shorten hold delay to 200ms |
| StrictMode breaks library (Pitfall 5) | HIGH | Switch libraries (Pragmatic DnD or v6 @dnd-kit) — do not remove StrictMode |
| `touch-action: none` scope creep (Pitfall 6) | LOW | Audit CSS, restrict to drag element only |
| iOS resize cancels drag (Pitfall 7) | MEDIUM | Lock `body.overflow=hidden` during drag; switch library if internal resize-cancel behavior |
| ESC stolen (Pitfall 8) | LOW | Move ESC listener to window with `capture: true` |
| Drag ghost blank (Pitfall 9) | MEDIUM | Switch to synthetic ghost (portal-rendered React element) |
| Engines fight (Pitfall 10) | HIGH | Remove one engine entirely; do not ship parallel state |
| Drag state in store (Pitfall 11) | MEDIUM | Move drag state to refs/context, keep only `moveCell` in store |
| Wrong zone thresholds (Pitfall 12) | LOW | Change formula to fixed screen-space size |
| Stuck ghost (Pitfall 13) | LOW | Add `setPointerCapture` + `pointercancel` + `visibilitychange` listeners |
| Animation desync (Pitfall 14) | LOW | Force-cancel ghost animation on new drag start |
| File drop broken (Pitfall 15) | MEDIUM | Add `dataTransfer.types.includes('Files')` guard in new engine |

---

## Warning Signs During Build

Indicators that you're going the wrong direction.

- **"I need a global document pointermove listener to know where the pointer is."** Stop. The drag library exposes this. Using a separate listener guarantees frame-skew bugs (Pitfall 2).
- **"Let me just put `activeZone` in Zustand."** Stop. Drag state is transient — refs or context (Pitfall 11).
- **"I'll add `transform: scale(1.1)` to the dragged cell for a lifted effect."** Stop. Box-shadow or filter only (Pitfall 9).
- **"Parallel old and new engines for one phase."** Stop. Swap wholesale (Pitfall M4).
- **"The new engine also handles file drops."** Stop. Keep file drop native (Pitfall 15).
- **"`offsetLeft + offsetWidth / 2` gives center."** Stop. `getBoundingClientRect` (Pitfall 3).
- **"I'll test on Safari Tech Preview's responsive simulator."** Stop. Real iOS device required for address bar and image-action-menu bugs (Pitfalls 4, 7).
- **"500ms hold — good enough."** Question this. iOS Save-Image menu starts ~500–700ms; collision likely (Pitfall 4). Prefer 200–250ms.
- **"Just ignore the React StrictMode console warning; it's dev-only."** Stop. Warning indicates real double-registration risk; library must be StrictMode-safe (Pitfall 5).
- **"I'll handle ESC with a React `onKeyDown` on the cell."** Stop. Portals + focused inputs break this (Pitfall 8). Window listener with capture.
- **"Aborting a drag needs to clean up store state."** Question this. If drag state is in the store, you have Pitfall 11. Clean up refs, not store.

---

## Pitfall-to-Phase Mapping

Proposed mapping for roadmap authoring. Phases are hypothetical — roadmapper will finalize.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. JSX handler order collision | Phase 1 (library selection + first wiring) | Manual test: drag initiates on first pointerdown every time |
| 2. Stale pointer ref | Phase 2 (zone detection) | No document `pointermove` listener in new code; all pointer data comes from library callbacks |
| 3. Scale-invariant hit regions | Phase 2 (zone detection) | Tested at canvasScale 0.2, 0.5, 1.0 |
| 4. iOS image-action menu | Phase 3 (mobile validation) | Real iOS device test with photo cell |
| 5. StrictMode double-register | Phase 1 (library selection gate) | No console warnings in dev, StrictMode wrapped |
| 6. `touch-action: none` scope creep | Phase 1 (CSS setup) | Mobile bottom sheet still scrolls; pinch still works |
| 7. iOS address bar cancels drag | Phase 3 (mobile validation) | Real iOS device, scroll-during-drag test |
| 8. ESC handler conflict | Phase 4 (ESC feature) | Drag cancels while text-overlay edit focused without committing overlay |
| 9. Drag ghost blank | Phase 5 (ghost rendering) | Video cell + pause rAF, snapshot matches live content |
| 10. Engine collision | Phase 1 (migration — remove old) | `grep @dnd-kit src/` empty |
| 11. Drag state in store | Phase 1 (state architecture) | Chrome DevTools — no Zustand update during pointer move |
| 12. Zone thresholds | Phase 2 (zone calibration) | Zone sizes are consistent screen-space at any scale |
| 13. Stuck ghost out-of-window | Phase 4 (robustness) | `setPointerCapture` + `pointercancel` + `visibilitychange` hooks |
| 14. Animation desync | Phase 6 (polish) | Rapid re-drag test |
| 15. File-drop preservation | Phase 1 (migration) | OS file drop onto cell still works |
| M1. Orphaned imports | Phase 1 (migration) | `grep @dnd-kit src/` returns zero |
| M2. Regression coverage | Phase 0 (pre-migration tests) | Behavioral test suite written before engine swap |
| M3. Peer dep residue | Phase 1 (cleanup) | `npm ls @dnd-kit/core` empty |
| M4. Parallel engines | Phase 1 (migration) | Single engine in codebase at any commit |

---

## Sources

- Phase 25 quick fix `260416-vgk` — root cause post-mortem for current implementation (`.planning/quick/260416-vgk-fix-phase25-touch-dnd-pointer-event-coll/PLAN.md`, commit `95b94ca`)
- [pragmatic-drag-and-drop Issue #13 — iOS 17.2+ press-and-hold image action state](https://github.com/atlassian/pragmatic-drag-and-drop/issues/13)
- [pragmatic-drag-and-drop Issue #106 — react-dnd collision](https://github.com/atlassian/pragmatic-drag-and-drop/issues/106)
- [pragmatic-drag-and-drop Issue #124 — Manually trigger iOS touch drag start](https://github.com/atlassian/pragmatic-drag-and-drop/issues/124)
- [pragmatic-drag-and-drop Issue #129 — CSS transform on dragged element](https://github.com/atlassian/pragmatic-drag-and-drop/issues/129)
- [pragmatic-drag-and-drop Discussion #93 — Mobile/Touch Support](https://github.com/atlassian/pragmatic-drag-and-drop/discussions/93)
- [pragmatic-drag-and-drop Issue #169 — droppable.placeholder style error](https://github.com/atlassian/pragmatic-drag-and-drop/issues/169)
- [dnd-kit Issue #50 — DragOverlay with scaled container](https://github.com/clauderic/dnd-kit/issues/50)
- [dnd-kit Issue #205 — Wrong Droppable area with transform style](https://github.com/clauderic/dnd-kit/issues/205)
- [dnd-kit Issue #250 — CSS transforms not considered on droppables](https://github.com/clauderic/dnd-kit/issues/250)
- [dnd-kit Issue #393 — Drag overlay doesn't consider scale/translate3d](https://github.com/clauderic/dnd-kit/issues/393)
- [dnd-kit Issue #686 — Window resize events interrupt iOS 15 Safari dragging](https://github.com/clauderic/dnd-kit/issues/686)
- [dnd-kit Issue #794 — active.data.current gets lost on drag end](https://github.com/clauderic/dnd-kit/issues/794)
- [dnd-kit Issue #1353 — Drag and drop broken in React 18 StrictMode (kendo-react)](https://github.com/telerik/kendo-react/issues/1353)
- [react-beautiful-dnd Issue #2350 — React 18 RC 0 StrictMode breaks draggable id](https://github.com/atlassian/react-beautiful-dnd/issues/2350)
- [react-beautiful-dnd Issue #2367 — iOS Safari 15 address bar kills dragging](https://github.com/atlassian/react-beautiful-dnd/issues/2367)
- [Framer Motion Issue #663 — Layout transform breaks dragging of children](https://github.com/framer/motion/issues/663)
- [Framer Motion Issue #698 — Flickering when switching position during drag](https://github.com/framer/motion/issues/698)
- [Framer Motion Issue #711 — Animation Flickering/Jumping](https://github.com/framer/motion/issues/711)
- [Zustand Discussion #2886 — Best Practices for Non-Reactive State](https://github.com/pmndrs/zustand/discussions/2886)
- [Graphite Issue #1943 — Aborting a drag destroys redo history](https://github.com/GraphiteEditor/Graphite/issues/1943)
- [MDN DataTransfer.setDragImage](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage)
- [MDN pointer-events CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)
- [Pointer Events spec Issue #360 — Pointer event passive defaults](https://github.com/w3c/pointerevents/issues/360)
- [w3c Pointer Events spec](https://w3c.github.io/pointerevents/)
- [Atlassian Design — Pragmatic drag and drop events docs](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/events/)
- [Atlassian Design — Pragmatic drop targets docs](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/drop-targets/)
- [dnd-kit Collision detection algorithms docs](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms)
- [dnd-kit Pointer sensor docs](https://docs.dndkit.com/api-documentation/sensors/pointer)
- [dnd-kit useDndMonitor docs](https://docs.dndkit.com/api-documentation/context-provider/use-dnd-monitor)
- [LogRocket — Implement Pragmatic drag and drop](https://blog.logrocket.com/implement-pragmatic-drag-drop-library-guide/)
- [React docs — Strict Mode](https://react.dev/reference/react/StrictMode)

---

*Pitfalls research for: v1.5 Unified Drag-and-Drop UX replacement in StoryGrid*
*Researched: 2026-04-17*
*Scope: DnD library migration + unified desktop+mobile drag + custom ghost + 5-zone hit detection + coexistence with pan/overlay/divider/scale/file-drop*
