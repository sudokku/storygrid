# Research Summary — StoryGrid v1.5 Unified Drag-and-Drop UX

**Milestone:** v1.5 Unified Drag-and-Drop UX
**Researched:** 2026-04-17
**Confidence:** HIGH (library choice + features + pitfalls all triangulated against official docs, GitHub issues, reference apps, and the Phase 25 in-repo post-mortem). MEDIUM on specific bundle-size kB figures.

> **Note on scope:** This document supersedes the prior v1.0 SUMMARY.md (2026-03-31). It synthesizes the four v1.5 research artifacts in `.planning/research/` — `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` — and resolves the library-choice conflict between STACK and ARCHITECTURE.

---

## Executive Summary

StoryGrid's Phase 25 cell drag-and-drop is flaky: the swap gesture fires ~1-in-10 times, the 5-zone hit detection jitters at zone boundaries, and the `transform: scale(1.08)` lift overflows parent clipping. Root cause (per the `260416-vgk` post-mortem): a JSX prop-order collision between `{...dragListeners}` and an explicit `onPointerDown`, compounded by two independent pointer sources (`useDndMonitor` + a document-level listener) derived zone coordinates out-of-sync by one frame. v1.5 replaces this with a single-sensor, single-event-source engine and the polished UX the user has specified (grab cursor, press-and-hold, drag-start animation, semi-opaque ghost, 5-icon overlay with bright/dim active states, ESC-to-cancel).

The chosen library is **`@dnd-kit/core@^6.3.1` rebuilt around a single `PointerSensor`** — with `@dnd-kit/sortable`, `@dnd-kit/utilities`, and a new `@dnd-kit/modifiers` install for scale compensation. `@atlaskit/pragmatic-drag-and-drop` was seriously evaluated and rejected over three hard blockers specific to StoryGrid: (1) open PDND issue #203 — native HTML5 DnD misbehaves inside `transform: scale()` containers with no documented workaround; (2) PDND issue #165 — ESC cancel is platform-gated because the browser takes input-ownership during native drag, so mid-drag ESC feedback is impossible; (3) iOS Safari 15 native touch DnD is flaky, which matters because Safari 15 is our browser floor. `@dnd-kit/react@0.4.0` was also rejected — it is still pre-1.0, has had no releases in 12 months, and the roadmap discussion (#1842) has zero maintainer replies; adopting it would trade the problem we have (flaky touch) for a worse one (pre-1.0 API churn).

Architecturally, the new engine lives in a new `src/dnd/` module: a thin adapter file, two hooks (`useCellDraggable` / `useCellDropTarget`), a pure `computeDropZone` function, a separate vanilla-Zustand `dragStore` (NOT gridStore — pointer-tick state must not pollute undo history), and a `DragPreviewPortal` that renders outside the scaled canvas. File-drop, overlay drag, and divider resize stay on their current native-pointer implementations per user decision. Press-and-hold drops from the current 500ms to **250ms + 5px tolerance** to match the dnd-kit default and undercut iOS 17.2+'s image-action menu collision window. Minimum viable completion is four phases (Foundation → Cell-to-Cell → ESC + Visual Polish → Mobile handle/tray polish); the user has signaled they will add more iteratively.

---

## Key Findings

### Stack — Library Choice

Full detail in `STACK.md`. Summary:

**Recommended:**

| Package | Version | Why | Status |
|---------|---------|-----|--------|
| `@dnd-kit/core` | `^6.3.1` | Already in tree; stable 6.x API; single `PointerSensor` with `activationConstraint: { delay: 250, tolerance: 5 }`; built-in `onDragCancel` for ESC; `DragOverlay` portal renders outside the scaled canvas | Already installed |
| `@dnd-kit/sortable` | `^10.0.0` | `useSortable` primitive; Phase 9's `moveLeafToEdge`/`moveCell` tree callees stay unchanged | Already installed |
| `@dnd-kit/utilities` | `^3.2.2` | `CSS.Translate.toString()` for transform strings | Already installed |
| `@dnd-kit/modifiers` | `^9.0.0` | `snapCenterToCursor` + custom scale-compensation modifier — solves drag-preview-in-scaled-canvas via `transform.x/y / canvasScale` | **New install** |

Total footprint: ~16 kB gzip (<4% of the 500 kB MVP budget). No other new dependencies.

**Rejected options** (full rationale in STACK.md §69–162):

| Option | Rejection Reason |
|--------|------------------|
| `@atlaskit/pragmatic-drag-and-drop` | 3 hard blockers: scaled-canvas (#203), ESC cancel (#165), Safari 15 touch flaky |
| `@dnd-kit/react@^0.4.0` | Pre-1.0; no releases in 12 months; breaking changes between points; roadmap unclear |
| `framer-motion` / `motion` drag | 60–80 kB gzip (5–8× dnd-kit); no drop-zone API; would reinvent hit-testing |
| `react-dnd` | Touch backend semi-maintained; monadic API; confirmed non-starter in v1.0 research |
| Custom pointer-events engine | 800–1500 LOC net-new + 40–60 tests; reinvents accessibility, sensor lifecycle, autoscroll |
| `neodrag` / `@formkit/drag-and-drop` / `hello-pangea` | None match the tree-grid + 5-zone-per-cell + scaled-canvas + ESC profile |

**Anti-patterns to stop doing immediately** (per STACK.md §176 and PITFALLS.md §30):

- `TouchSensor + MouseSensor` simultaneously — dnd-kit docs explicitly forbid this; it is the hypothesized primary cause of Phase 25's flaky activation
- Custom `useDndMonitor` + `DragZoneRefContext` parallel pointer tracking — fights dnd-kit's own state machine; causes the frame-stale zone calculation
- Spreading `{...dragListeners}` before explicit `onPointerDown` — JSX order = write order; explicit handler overwrites the library spread

---

### Features — What the UX Has to Feel Like

Full detail in `FEATURES.md`. Structured into **6 behavioral categories A–F** for REQUIREMENTS.md scoping:

| Category | Concern | Proposed REQ prefix |
|----------|---------|---------------------|
| **A — Drag Start Affordance** | `cursor: grab` / `grabbing`, press-and-hold activation on touch, distance activation on mouse, visual lift on drag start | `DRAG-*` |
| **B — Drag Preview / Ghost** | Preview follows pointer, semi-opaque clone of cell content, source cell dims to 40%, preview offset matches grab point, preview size cap | `GHOST-*` |
| **C — Drop Target Feedback** | 5-zone icon overlay, active bright / inactive dim, live recompute on pointermove, target cell outline/tint, optional insertion line | `DROP-*` |
| **D — Cancel / Abort** | ESC-to-cancel, drop-on-origin no-op, drop-outside-canvas no-op, snap-back animation | `CANCEL-*` |
| **E — Cross-device Unification** | Identical 5-zone behavior on touch + mouse, haptic on touch drag-start, text-select/context-menu suppression, prevent page scroll | `CROSS-*` |
| **F — Differentiators / Polish** | Drag-start wobble micro-animation, spring-ease drop-settle, bottom-sheet auto-collapse, preview finger-offset on touch, word labels on wide zones | `DRAG-*` / `GHOST-*` spillover |

**P1 (ship in v1.5 phase 1):** A1, A2, A3 (250ms + 5px), A4 (8px), A5, B1, B2, B3 (40% dim), B4, C1, C2, C3, C4, D1 (ESC), D2, D3, D4 (200ms snap-back), E1 (unified pointer events), E3, E4, F8 (drag-start wobble), F5 (preview magnetism to zone).

**P2 (later v1.5 phases, user hinted iterative):** E2 haptic, F1 drop-settle spring, F6 touch preview finger-offset (`-40px Y`), F7 bottom-sheet auto-collapse during drag, C5 insertion line on edges (if icons alone feel insufficient), F9 word labels on zones (if icons feel ambiguous).

**P3 / Reject:** F2 handle hover pulse (low value), F3 rotation tilt (anti-value — preview IS the artwork, rotation misrepresents), F4 make-room animation (HIGH complexity for split-tree), C5+icon double-indicator (redundant).

**Out of scope for v1.5 (user-confirmed anti-features):**
Multi-select drag, keyboard-only DnD (Space + arrows), autoscroll near viewport edges (N/A — canvas fit-to-viewport), native `setDragImage`, snap-to-grid, drag-between-panels, drag-to-trash.

**Numeric spec values** (for REQUIREMENTS.md thresholds; full table in FEATURES.md §329):

| Spec | Value | Source |
|------|-------|--------|
| Mouse activation distance | 8 px | dnd-kit PointerSensor default |
| Touch activation delay | 250 ms | dnd-kit default / Linear / modern convention |
| Touch activation tolerance | 5 px | dnd-kit default |
| Source cell opacity during drag | 0.4 | Atlassian Design System |
| Drag preview opacity | 0.8 | User brief ("semi-opaque") |
| Preview max size | 280 × 280 px | Atlassian |
| Cancel snap-back duration | 200 ms | Atlassian easeInOut |
| Cancel snap-back easing | `cubic-bezier(0.15, 1.0, 0.3, 1.0)` | Atlassian |
| Drag-start wobble duration | 120–200 ms | Apple HIG spring (damping 15, stiffness 170) |
| Drag-start wobble easing | `cubic-bezier(0.34, 1.56, 0.64, 1.0)` (back-out) | Derived from Apple spring |
| Haptic on drag start | `navigator.vibrate(10)` | MDN |
| Active icon brightness | 100% white | User brief |
| Inactive icon brightness | 30% white (`text-white/30`) | User brief |

---

### Architecture — How the New Engine Slots In

Full detail in `ARCHITECTURE.md`. **⚠ Note:** ARCHITECTURE.md was drafted assuming the library would be Pragmatic DnD. The STACK research subsequently selected `@dnd-kit/core`. The module layout, store strategy, coordinate math, and coexistence analysis all still apply — only the adapter file and one hook change. See **"Adapter Reconciliation"** below.

**New module:** `src/dnd/`

```
src/dnd/
├── index.ts                          # Public API barrel
├── adapter/
│   └── dndkit.ts                     # @dnd-kit glue (DndContext/PointerSensor/DragOverlay/useDraggable/useDroppable)
├── dragStore.ts                      # Vanilla Zustand — ephemeral, NOT in undo history
├── computeDropZone.ts                # Pure: (rect, pointer, scale) → 'center'|'top'|'bottom'|'left'|'right'
├── computeDropZone.test.ts
├── useCellDraggable.ts               # Hook: cell as drag source
├── useCellDropTarget.ts              # Hook: cell as drop target
├── DragPreviewPortal.tsx             # Renders semi-opaque ghost outside scaled canvas (uses DragOverlay)
├── DropZoneIndicators.tsx            # 5-icon overlay component
└── __tests__/
    ├── useCellDraggable.test.tsx
    ├── useCellDropTarget.test.tsx
    └── integration.test.tsx
```

**Adapter Reconciliation (STACK vs ARCHITECTURE delta):**

| Aspect | ARCHITECTURE.md said | STACK.md overrides with |
|--------|----------------------|--------------------------|
| Adapter file | `src/dnd/adapter/pragmatic.ts` | `src/dnd/adapter/dndkit.ts` |
| Drag ghost API | `setCustomNativeDragPreview` + portal render | `<DragOverlay>` portal component |
| File drop unification | `useFileDropTarget.ts` via `dropTargetForExternal` | **Drop this file.** @dnd-kit has no external adapter; file drop stays on current native HTML5 handlers (user-confirmed) |
| ESC cancel | Custom keydown → dispatch `dragend` | Built-in: `onDragCancel` callback in `DndContext` |
| Long-press on touch | Browser-native (iOS) | `PointerSensor activationConstraint: { delay: 250, tolerance: 5 }` |
| StrictMode | Event-based, safe by design | dnd-kit v6 verified StrictMode-safe |

Everything else in ARCHITECTURE.md — store design, coordinate math, coexistence with overlay/divider/mobile sheet, undo semantics, z-index map, data-flow diagrams, build-order dependency chain — stands unchanged.

**Store integration — the load-bearing decision:**

Drag state lives in a **separate vanilla Zustand `dragStore`**, NOT `gridStore`. Three hard requirements drive this:
1. Drag state updates 60 Hz. If it enters gridStore, every Immer `pushSnapshot` carries ephemeral pointer-tick data; a 50-entry undo history would bloat massively.
2. Only the single LeafNode whose zone changed should re-render. gridStore selectors + memo'd recursive tree cannot give this granularity without fighting the existing architecture.
3. Adapter code is non-React — it must be able to write drag state from plain callbacks.

`gridStore.moveCell` (lines 473-494, verified) already has no-op early-return guards for `fromId === toId`, missing nodes, and non-leaf targets. These guards mean: **aborted drag = no store call = 0 undo entries. Committed drag = one `moveCell` call = 1 undo entry.** No gridStore changes needed for v1.5.

**Coexistence with existing systems (verified):**

| System | Conflict Risk | Mitigation |
|--------|---------------|------------|
| Divider resize (raw pointer + `setPointerCapture`) | Pointer capture pre-empts any dragstart from bubbling | `data-dnd-ignore="true"` marker + `canDrag` guard — belt-and-braces |
| OverlayLayer (selected overlays `pointer-events: auto`) | Selected overlay could intercept cell-drag `pointermove` | Subscribe to `dragStore.status`; flip `pointer-events: none` on selected overlay while status === 'dragging' |
| MobileCellTray | Visual clutter during drag | `opacity: 0` on `dragStore.status === 'dragging'`; tray fades naturally on drop commit |
| MobileSheet | Sheet is not a cell drop target | No registration; drag-over-sheet → no `overId` → drop = 0 undo entries |
| Native HTML5 file drop | Would fight the new engine | STAYS on current Phase 8 DROP-01/02 handlers; `dataTransfer.types.includes('Files')` discriminator preserved |

**Build order (minimum viable completion: Phases A + B + C):**

| Phase | Scope | Depends on |
|-------|-------|------------|
| **A — Foundation** | `src/dnd/` scaffolding, pure `computeDropZone`, `dragStore`, unit tests. No integration. | nothing |
| **B — Cell-to-Cell Drag** | `useCellDraggable`, `useCellDropTarget`, `DragPreviewPortal`, `DropZoneIndicators`. Rewire LeafNode; remove old `@dnd-kit` wiring **in the same phase** (Pitfall 10 — never run parallel engines). | A |
| **C — ESC Cancel + Visual Polish** | ESC via `onDragCancel`, grab cursor, semi-opaque ghost, 5-icon bright/dim, drag-start wobble. | B |
| **D — Mobile Handle + Tray Polish** | Add dedicated drag-handle button (e.g. `GripVertical`) to MobileCellTray; hide tray during drag. | B |
| **E — (Optional) ffmpeg uninstall sweep / cleanup** | Confirm zero `@dnd-kit/*` stray imports, audit test files. | B |

The user has indicated more phases may be added iteratively; P2 features (haptics, drop-settle spring, finger-offset, bottom-sheet auto-collapse) will become their own phases as desired.

---

### Critical Pitfalls — Top 5 with Phase Mapping

Full list (15 pitfalls + 4 migration-specific + traps/recovery tables) in `PITFALLS.md`. The five that MUST be acknowledged before any code is written:

| # | Pitfall | Root Cause | Prevention | Phase Where Enforced |
|---|---------|------------|------------|----------------------|
| **1** | JSX attribute order collision between `{...dragListeners}` spread and explicit `onPointerDown` | React writes props in order; later `onPointerDown` overwrites library's | Spreads go LAST on the element, after all explicit handlers | Phase B (first wiring) |
| **2** | Derived-from-ref pointer position stale by one frame | Two independent event sources (document `pointermove` + library `onDragOver`) dispatched out-of-order | All pointer data comes from dnd-kit callbacks; delete the custom document `pointermove` listener entirely | Phase A (zone detection) |
| **4** | 500ms press-hold collides with iOS 17.2+ image-action menu | iOS Save/Copy/Share context menu fires at ~500–700ms over images/canvases | Drop delay to 250ms + 5px tolerance; `-webkit-touch-callout: none` + `-webkit-user-select: none` on draggable | Phase B (mobile validation) |
| **10** | Two DnD engines running in parallel during migration fight over `dragstart`/`preventDefault` | Both register document-level pointer listeners; outcomes become non-deterministic | Remove old `@dnd-kit` wiring **in the same phase** that adds new wiring; never incremental | Phase B (migration) |
| **11** | Drag state in gridStore causes re-render storms + polluted undo history | 60 Hz pointer ticks × Immer structural clone × full-tree memo invalidation | Separate vanilla `dragStore`; `moveCell` called ONCE on drop commit; NOTHING on drag cancel | Phase A (state architecture) |

Advisory (important but not ship-blocking):

- **Pitfall 6** — `touch-action: none` scope creep. Apply ONLY on draggable element, never ancestors (Phase 5.1 pinch-to-zoom depends on `touchmove` propagating).
- **Pitfall 9** — `<canvas>` drag ghost blank/wrong-frame. Use `canvas.toDataURL()` → `<img>` inside `DragOverlay`, OR re-render via `drawLeafToCanvas` into a fresh canvas. `cloneNode(true)` does NOT copy canvas pixels (Angular CDK #15685).
- **Pitfall 12** — 5-zone threshold scales with cell size. Use fixed screen-space threshold (`40 / canvasScale`) instead of `Math.max(20, Math.min(w,h) * 0.2)`.
- **Pitfall 15** — File drop and cell drag must remain separate engines. Preserve `dataTransfer.types.includes('Files')` guard in the new engine's dragstart.

---

## Roadmap Implications

### 4-Phase Minimum Shape (per ARCHITECTURE.md §490 adjusted for @dnd-kit)

Proposed phases for `gsd-roadmapper` to refine (Sonnet, runs after 3am Bucharest rate-limit reset):

| # | Working Title | Purpose | Key Exit Criteria |
|---|---------------|---------|-------------------|
| **Phase 27** | Foundation — DnD module scaffolding | Create `src/dnd/` with `computeDropZone`, `dragStore`, adapter skeleton. Pure-function unit tests. No integration yet. | `computeDropZone` tests green at scales 0.2 / 0.5 / 1.0; `dragStore` state transitions green |
| **Phase 28** | Cell-to-Cell Drag — swap wholesale | Implement `useCellDraggable`/`useCellDropTarget`; wire LeafNode; **REMOVE old `@dnd-kit` wiring in same phase**; add `DragOverlay`-based ghost + 5-zone indicators | Cell swap + edge insert work identically on mouse + touch; `grep '@dnd-kit/core' src/` shows zero stray imports outside new adapter |
| **Phase 29** | Visual Polish + ESC Cancel | `cursor: grab`/`grabbing`; semi-opaque ghost via `canvas.toDataURL()`; 5-icon bright/dim active states; ESC via `onDragCancel`; snap-back animation; drag-start wobble | All P1 UX items ship; ESC-in-focus-text-overlay doesn't steal focus |
| **Phase 30** | Mobile Handle + Tray Polish | Dedicated `GripVertical` drag handle on `MobileCellTray`; hide tray during drag; real-device iOS UAT for long-press + address-bar + image-action-menu | 250ms long-press clean on real iOS; address-bar collapse during drag doesn't cancel |

Future (P2) phases user may add iteratively: haptics wiring, drop-settle spring, touch preview `-40px Y` finger-offset, bottom-sheet auto-collapse, insertion-line option, word labels.

### REQUIREMENTS.md Approach

Use FEATURES.md's six categories as the AskUserQuestion framing. Target ~25–35 total REQ items for v1.5:

- **A — Drag Start Affordance** (~4–5 items): cursor states, press-hold activation, mouse distance, visual lift
- **B — Drag Preview / Ghost** (~4–5 items): follow pointer, semi-opaque clone, source dim, grab-point offset, size cap
- **C — Drop Target Feedback** (~4–6 items): 5-zone overlay polish, active bright / inactive dim, live recompute, target outline, (optional) insertion line, (optional) word labels
- **D — Cancel / Abort** (~4 items): ESC, drop-on-origin, drop-outside-canvas, snap-back
- **E — Cross-device Unification** (~4–5 items): unified engine, haptic on touch, context-menu suppression, page-scroll prevention
- **F — Differentiators / Polish** (~3–5 items): wobble, zone magnetism, drop-settle spring, touch preview offset, bottom-sheet auto-collapse

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Library choice | HIGH | @dnd-kit/core vs Pragmatic DnD triangulated via official docs + open issues (#203, #165) + Phase 25 in-repo post-mortem |
| Features | HIGH | Atlassian Design System + dnd-kit docs + Apple HIG + NN/g + 8-app reference survey (Notion, Figma, Linear, Trello, Canva, Google Slides, Apple Pages/Photos, Miro) |
| Architecture | HIGH for codebase integration (file paths, coordinate math, coexistence), MEDIUM for @dnd-kit-specific internals (document was drafted for Pragmatic; adapter-file delta reconciled above) |
| Pitfalls | HIGH | Root causes verified against `260416-vgk` commit `95b94ca`; library pitfalls sourced from specific GitHub issue numbers |
| Bundle-size figures | MEDIUM | Bundlephobia was unreadable during research; sizes quoted from library authors + PKG pulse secondary sources |

**Overall confidence:** HIGH for the decision to rebuild on @dnd-kit/core; HIGH for the four-phase roadmap shape; HIGH for the anti-patterns to avoid.

### Gaps to Address During Planning

- **Drag ghost content strategy** — two viable approaches: (a) `canvas.toDataURL()` → `<img>` inside `DragOverlay` (5 lines), (b) re-render `LeafPreview` via `drawLeafToCanvas()` (higher fidelity, reuses render pipeline). Prototype both in Phase 29; performance difference negligible at 20-leaf cap.
- **5-zone threshold formula** — current `Math.max(20, Math.min(w,h) * 0.2)` scales with cell size. Proposed replacement: fixed screen-space `40 / canvasScale`. Needs user A/B before locking in (30–50px range).
- **Mobile drag-handle icon choice** — `GripVertical` is a reasonable default; UI-intelligence concern, not architecture. Decide during Phase 30.
- **Test-harness migration** — existing 600+ tests import from `@dnd-kit/core` directly. Pre-migration audit (Pitfall M1): `grep -r "@dnd-kit" src/` → decide per file whether to rewrite against new engine, delete if engine-specific, or convert to behavioral `fireEvent.pointer*`.
- **iOS address-bar drag-cancel** (Pitfall 7) — verify dnd-kit v6 does not re-measure + cancel on window `resize`. If it does, lock `body.overflow: hidden` during drag. Real-device test required.

---

## Sources

### Primary (HIGH confidence)

**Codebase (direct read 2026-04-17):**
- `src/Grid/LeafNode.tsx` (786 lines) — current Phase 25 DnD wiring
- `src/Grid/CanvasWrapper.tsx` — DndContext + dual-sensor + DragZoneRefContext
- `src/Grid/Divider.tsx`, `OverlayLayer.tsx`, `ActionBar.tsx`
- `src/Editor/CanvasArea.tsx`, `MobileCellTray.tsx`, `MobileSheet.tsx`
- `src/store/gridStore.ts` (lines 473-494 `moveCell` no-op guards verified)
- `src/lib/tree.ts` — `moveLeafToEdge`, `swapLeafContent`
- `.planning/quick/260416-vgk-fix-phase25-touch-dnd-pointer-event-coll/` — Phase 25 post-mortem (commit `95b94ca`)

**Library documentation:**
- @dnd-kit PointerSensor — https://docs.dndkit.com/api-documentation/sensors/pointer
- @dnd-kit Touch sensor (delay + tolerance) — https://docs.dndkit.com/api-documentation/sensors/touch
- @dnd-kit Collision detection algorithms — https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms
- @dnd-kit/modifiers — https://github.com/clauderic/dnd-kit/pull/334 (`activatorEvent` for scale compensation)
- Atlassian Design System — Pragmatic DnD design guidelines — https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/
- MDN `DataTransfer.setDragImage` — https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage
- MDN `Navigator.vibrate()` — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate

**Critical GitHub issues (direct read):**
- PDND #203 — scaled-container calculations broken (open, unresolved)
- PDND #165 — ESC cancel platform-gated (open, unresolved)
- PDND #13 — iOS 17.2+ image-action menu collision
- PDND #66 — Safari drag preview empty for images
- dnd-kit #50, #205, #250, #393 — scaled-container DragOverlay workarounds
- dnd-kit #686 — iOS Safari 15 address-bar resize cancels drag
- Angular CDK #15685 — canvas `cloneNode` loses content
- Shopify Draggable #139 — drag offset in `transform: scale`

### Secondary (MEDIUM confidence)

- Reference-app patterns: Notion, Figma, Linear, Trello, Canva, Google Slides, Apple Pages, Material Design
- Nielsen Norman Group — Drag-and-drop UX best practices — https://www.nngroup.com/articles/drag-drop/
- Atlassian blog — "The journey of Pragmatic DnD"
- Apple HIG — Playing haptics, long-press gestures, spring animation (WWDC23)
- Puck editor 2026 DnD comparison — https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react
- pkgpulse 2026 DnD library survey

### Tertiary (LOW confidence — flagged inline where used)

- Bundle-size figures (kB gzip) quoted from library author claims + secondary sources (Bundlephobia unreachable during research)
- Haptic "tick" 10ms value — MDN range is 50–200ms; 10ms derived from web vibration API best-practice blogs

---

*Research completed: 2026-04-17*
*Milestone: v1.5 Unified Drag-and-Drop UX*
*Next: REQUIREMENTS.md (Opus, immediate) → ROADMAP.md via gsd-roadmapper (Sonnet, after rate-limit reset)*
