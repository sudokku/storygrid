# Feature Research — v1.5 Unified Drag-and-Drop UX

**Domain:** Visual grid/canvas editor DnD UX, unified across desktop and touch
**Researched:** 2026-04-17
**Confidence:** HIGH (Atlassian Pragmatic DnD design guidelines, dnd-kit docs, MDN, Apple HIG, NN/g are all authoritative and current)

---

## Scope Frame

This research focuses ONLY on the v1.5 milestone: the NEW drag-and-drop UX for cell reordering. Existing tree primitives (`moveLeafToEdge`, `splitNode`, `mergeNode`) and existing 5-zone overlay concept are treated as givens — research asks "what polished, unified behavior surrounds those gestures?"

**Reference apps surveyed:** Figma, Canva, Notion, Google Slides, Miro, Apple Pages/Photos, Linear, Trello (Atlassian Pragmatic DnD), Material Design.

**User-fixed scope for v1.5 (explicit, per brief):**
- Visual/unified-engine rewrite
- ESC-to-cancel only (no other keyboard DnD)
- Multi-select drag, a11y keyboard reorder, autoscroll → explicitly future-phase

---

## Feature Landscape

### Table Stakes (Universal across reference apps — missing = product feels broken)

Grouped by behavioral category for REQUIREMENTS.md AskUserQuestion scoping.

#### Category A: Drag Start Affordance

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **A1. Grab cursor on hover** (`cursor: grab`) | Universal web convention — Figma, Notion, Linear, Atlassian all do this. Signals "this is draggable." | LOW | CSS-only; applied to every draggable LeafNode. Atlassian recommends `grab` always-on for primary drag targets. |
| **A2. Grabbing cursor while dragging** (`cursor: grabbing`) | Reinforces active-drag state. Universal. | LOW | CSS-only; toggled on body during drag. |
| **A3. Press-and-hold activation on touch** | iOS/Android convention; prevents accidental drags when scrolling. | LOW | dnd-kit `TouchSensor activationConstraint: { delay: 250, tolerance: 5 }` is the documented idiom. Current Phase 25 used 500ms — survey says 250ms with 5px tolerance is the modern sweet spot (dnd-kit default, matches iOS/Material conventions). |
| **A4. Distance-based activation on mouse** | Prevents a click being interpreted as drag. Universal. | LOW | dnd-kit `MouseSensor activationConstraint: { distance: 8 }` typical. 5–10px range. |
| **A5. Visual lift on drag start** (scale + shadow + slight opacity drop on source) | Signals "picked up." Table stakes — Trello, Notion, Linear, Material all do this. | LOW | Source cell dims to ~40% opacity (Atlassian spec: `opacity: 0.4`); preview scales ~1.02–1.05. |

#### Category B: Drag Preview / Ghost

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **B1. Preview follows pointer/finger** | Obviously expected. | LOW–MEDIUM | `position: fixed` + `transform: translate()` driven by pointermove. Avoid browser-native `setDragImage` — it cannot be styled and doesn't animate on scaled canvases. |
| **B2. Semi-opaque clone of cell content** | User explicitly requested this. Matches Notion block, Figma layer, Linear card behavior. | MEDIUM | `cloneNode(true)` of the cell's DOM + CSS `opacity: 0.8`. **Gotcha:** `<canvas>` does NOT copy content via cloneNode — must either snapshot to dataURL OR redraw into preview canvas. Angular CDK hit this bug (#15685). StoryGrid leaves are `<canvas>` so this is load-bearing. |
| **B3. Source cell dims during drag** | Shows "this is what's being moved." Atlassian spec: 40% opacity on source. | LOW | CSS class toggled during drag. |
| **B4. Preview offset matches grab point** | Preview should not jump to cursor center — user expects it to stay under finger/cursor. | LOW | Record `(pointerX - rect.left, pointerY - rect.top)` on drag start; subtract on every move. Atlassian spec: cards use "no offset, drag from grab point"; list items get `x: 16px, y: 8px` offset. **For StoryGrid cells = cards → use grab-point offset.** |
| **B5. Preview size capped** (prevents huge cells obscuring canvas) | Atlassian caps preview at 280×280px. | LOW | Scale preview down proportionally if source > 280px. StoryGrid cells at 1080×1920 scaled canvas often are <280px; may not need for most cases but worth gating. |

#### Category C: Drop Target Feedback

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **C1. 5-zone icon overlay on hover target** | User explicitly requested. Unique to split-tree editors (StoryGrid already prototyped this in Phase 9). | MEDIUM | Already exists at tree level; needs UX polish + icon redesign. See Category I below for the discoverability side. |
| **C2. Active zone brightly highlighted, inactive dim** | User explicitly requested. Matches Figma/Miro active-drop-target conventions. | LOW | Active: `text-white` + scale 1.1 + subtle glow; inactive: `text-white/30`. |
| **C3. Live re-compute on pointer move** | Active zone must update as pointer crosses zone boundaries WITHIN the target cell. Universal. | MEDIUM | Single `pointermove` handler computes which 5th the pointer is in (center circle + 4 quadrants). See Architecture for algorithm. |
| **C4. Target cell visual response** (outline/tint) | Shows which cell is the drop target. Universal (Notion, Figma, Linear). | LOW | Apply target-cell class when pointer is over any of its zones: `outline` or `background-color: color.background.selected.hovered` per Atlassian. |
| **C5. Insertion line on edge drops** | Atlassian spec for relative-placement drops: 2px line, 8px terminal dot, bleeds 4px outward. | MEDIUM | Orthogonal to icon overlay — the icon shows intent; a drawn line on the shared edge could reinforce placement. Decide: icons alone OR icons + line. Reference-app precedent mixed (Notion: line only; Trello: icons only). |

#### Category D: Cancel / Abort

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **D1. ESC-to-cancel** | User explicitly requested. Universal web convention (Google Drive, Figma, react-beautiful-dnd). | LOW | `keydown` listener during drag; snap preview back with animation. |
| **D2. Drop on origin = no-op** | Universal. Prevents accidental undo-history pollution. | LOW | Compare drop target to source; skip store action if identical. |
| **D3. Drop outside canvas = cancel** | Universal. User expects "drag off = abort." | LOW | Check `e.target` containment; treat as no-op. |
| **D4. Snap-back animation on cancel** | Polished feel — without it, drag just disappears. Atlassian, Notion, Linear all animate. | LOW–MEDIUM | `transition: transform 200ms cubic-bezier(0.15, 1.0, 0.3, 1.0)` on preview; translate from drop point → origin rect. |

#### Category E: Cross-device unification

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **E1. Identical 5-zone behavior on touch + mouse** | User explicitly requested — one engine, one experience. | MEDIUM | Use pointer events (not separate mouse/touch handlers). `@dnd-kit/core` `PointerSensor` OR custom pointer-events implementation. |
| **E2. Haptic feedback on drag start (touch)** | Apple HIG — "long-press confirmation" is the canonical moment for `.impact(medium)`. On web: `navigator.vibrate(10)` approximates. | LOW | Fire once on successful activation. |
| **E3. Disable text selection / context menu during drag** | Universal — prevents iOS loupe, Android selection handles, right-click menu appearing. | LOW | `user-select: none` on body; `touch-action: none` on drag source; preventDefault on contextmenu during drag. |
| **E4. Prevent page scroll while dragging on touch** | iOS/Android hijack drag if not handled. | LOW | `touch-action: none` on draggable + `e.preventDefault()` on touchmove. |

---

### Differentiators (Best-in-class apps have these — real polish lives here)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **F1. Spring-ease drop-settle animation** | The "thunk" of a Notion block landing. Makes successful drops feel alive. | LOW | Atlassian's on-drop flash: `cubic-bezier(0.25, 0.1, 0.25, 1.0)`, 700ms color flash. Cheaper alternative: `transition: transform 200ms ease-out` on settled cell. |
| **F2. Subtle pulse/breathing on drag handle hover (desktop)** | Increases discoverability on cells that don't have obvious action bars. | LOW | CSS keyframes `animation-delay: 800ms` (Atlassian pattern for secondary actions — only appears after hover sustained). User did NOT request this — propose as optional polish. |
| **F3. Rotation tilt on drag preview** (e.g., 2–4°) | Trello's signature feel. Makes the preview feel "lifted" in 3D. | LOW | **Divisive** — Atlassian design system says "do not rotate drag preview" (Trello is an explicit exception). For a collage editor where the preview IS the artwork, rotation would distort and mislead. RECOMMEND OMIT. |
| **F4. Target cell "make room" animation** | Other cells animate out of the way before drop commits — Material Design + Notion pattern. | HIGH | For a split-tree where drop can split/swap/insert, pre-visualizing the final tree is non-trivial. Out of v1.5 scope; revisit in later milestone. |
| **F5. Drop zone "magnetism" with short transition** | NN/g pattern — snap into place with ~100ms ease. Differentiates from janky drop. | LOW | Separate from settle animation: this is the preview snapping to zone center on hover. |
| **F6. Scale reduction of preview under pointer on touch** | Avoid finger obscuring the preview — iOS Photos reduces preview to ~80% of source size + offsets above finger. | LOW | For touch, offset preview `-40px Y` so it's visible above the finger. |
| **F7. Bottom-sheet auto-collapse during drag (mobile)** | Bottom sheet obscures lower canvas cells. iOS Photos Full-Screen picker AUTO-COLLAPSES sheets during drag. Material spec: STATE_DRAGGING can trigger settle. | MEDIUM | StoryGrid `MobileCellTray` + bottom sheet both compete for drop-target space. Proposal: on drag start, collapse sheet to tab-strip; restore on drag end. |
| **F8. Drag-start "wobble" micro-animation** | 120–200ms `scale: 1.00 → 1.05 → 1.02`. Apple/SwiftUI spring feel. | LOW | User explicitly requested "subtle drag-start animation." Spring: damping 15, stiffness 170 (Apple HIG default). Web equivalent: `cubic-bezier(0.34, 1.56, 0.64, 1.0)` (back-out). |
| **F9. Icon word-labels on drop zones** (e.g., "Swap" / "Insert above") | Discoverability for first-time users. | LOW | Canva, Google Slides show tooltip-style labels. Risks: text clipping on small cells. RECOMMEND: icons-only by default, labels on zones >120px wide. |

---

### Anti-Features (Requested / common but problematic for a collage editor)

| Feature | Why Requested | Why Problematic for StoryGrid | Alternative |
|---------|---------------|-------------------------------|-------------|
| **Native HTML5 drag (`setDragImage`)** | Built-in, "free" preview. | Preview cannot be styled on-the-fly, cannot animate. Broken on Safari for `<img>` elements (pragmatic-dnd issue #66). Doesn't fire on touch without polyfill. iOS has half-broken native drag. | Custom pointer-events preview (position:fixed + transform). |
| **Snap-to-grid alignment** | Users ask for "Figma-grid" snapping. | Recursive split-tree has no fixed grid. Every cell boundary is arbitrary. Snapping makes no sense. | Edge-based 5-zone already IS the snap model. |
| **Multi-select drag (shift-click multiple cells)** | Figma/Linear have this. | Collage has ≤~20 cells. Multi-select + recursive-tree mutation is genuinely hard (intersecting subtrees, partial moves). User marked OUT OF SCOPE for v1.5. | Future milestone after v1.5 ships. |
| **Auto-scroll at viewport edges** | Reference apps with long lists do this. | StoryGrid canvas FITS viewport (scaled 9:16). Scroll doesn't help — whole canvas is always visible. User marked OUT OF SCOPE. | None needed for this domain. |
| **Keyboard-only drag equivalent (Space + arrows)** | A11y best practice. Salesforce/Atlassian formalize this. | Requires focus management, ARIA live regions, tree-navigation keyboard model — genuinely big work. User marked OUT OF SCOPE for v1.5. | Future a11y milestone. |
| **Rotation tilt on preview** | Trello signature look. | Collage previews ARE the artwork — rotating them misrepresents final composition. | No rotation. Opacity + scale only. |
| **Native context menu on long-press (mobile)** | iOS/Android default. | Long-press is now the drag trigger. Must suppress context menu during drag engagement. | `oncontextmenu = preventDefault` while drag-active; CSS `-webkit-touch-callout: none`. |
| **Drag-between-panels** | Some reference apps move items between sidebar/canvas. | StoryGrid has ONE canvas. Sidebar doesn't host cells. Not applicable. | N/A. |
| **"Drag to trash" delete gesture** | Mobile file managers, Linear. | Redundant — Remove button already in MobileCellTray + ActionBar. Adds drop-target ambiguity (now cells AND trash compete for drop). | Keep explicit Remove button. |
| **Browser-native `draggable="true"` attribute** | Simplest implementation. | Fires `dragstart` on mouse-down (no delay, no threshold, no touch). Loses touch entirely without polyfill. Cannot ESC-cancel reliably (Firefox/Chrome disagree). | Pointer events driven custom impl (or dnd-kit). |
| **Press-and-hold > 400ms on touch** | Phase 25 used 500ms. | Long delay makes drag feel sluggish — users think "is it broken?" Modern convention (dnd-kit, Material) is 250ms with 5px tolerance. | 250ms delay + 5px tolerance. |

---

## Cross-Device Unification Patterns (how reference apps actually do it)

Key research finding: **all modern reference apps have converged on pointer events** (not separate mouse/touch branches). The differentiation is entirely in activation constraints.

| App | Mouse activation | Touch activation | Engine |
|-----|------------------|------------------|--------|
| Notion | Click-and-drag on handle (drag handle is visible; no distance constraint) | Long-press ~500ms (historically; reportedly reduced) | Internal; pointer events |
| Figma | Immediate drag on mouse-down inside layer | Long-press ~400ms on touch tablet | Internal |
| Linear | ~5px distance on mouse | Long-press 250ms on touch | Pragmatic DnD |
| Trello | Immediate on handle | 150–250ms long-press on touch | Pragmatic DnD |
| Material apps | Distance: 10px on mouse | Delay: 500ms + tolerance: ~5px | Material DnD / platform |
| dnd-kit default | `PointerSensor distance: 8` | `TouchSensor delay: 250, tolerance: 5` | dnd-kit |

**Convergent pattern:** 5–10px mouse distance; 200–300ms touch delay + 5px tolerance. StoryGrid's current 500ms (Phase 25) is on the slow end and should be reduced.

**Hover on touch** — reference apps handle this three ways:
1. **Show drop affordances only during drag** (what StoryGrid should do — already mostly the case)
2. Show handle on single tap, drag on second interaction (Notion pre-2024 — now deprecated)
3. Persistent drag handle (Linear, Trello)

StoryGrid's MobileCellTray already provides the tap-affordance; drag activation is a SEPARATE gesture (long-press on cell body). This is the right model — keep it.

---

## Feature Dependencies

```
[C3 Live-recompute on pointer move] ─requires─► [B1 Preview follows pointer]
                                                    │
                                                    ▼
                                          [E1 Identical touch+mouse] ─uses─► pointer events

[C1 5-zone icon overlay] ─already built at─► tree primitive moveLeafToEdge (Phase 9)
        │
        ├─enhanced by─► [C2 Active zone bright/dim]
        ├─enhanced by─► [C5 Insertion line on edge]
        └─enhanced by─► [F9 Word labels on wide zones]

[D1 ESC cancel] ─requires─► [D4 Snap-back animation] (for polish)
     │
     └─requires─► drag-state tracking (engine-level)

[B2 Semi-opaque clone] ─blocked by─► <canvas> cloneNode doesn't copy content
                           │
                           └─resolved by─► canvas.toDataURL OR redraw into preview canvas

[F7 Bottom-sheet collapse on drag] ─requires─► drag-start event ─and─► drag-end event
                                         from engine to sheetStore

[E2 Haptic on drag start] ─requires─► navigator.vibrate exists ─and─► user activation

[A3/A4 Activation constraints] ─requires─► engine sensor model (dnd-kit has this; custom impl must build)
```

### Dependency Notes

- **B2 requires canvas workaround:** LeafNode renders via `<canvas>`. `cloneNode` on a canvas produces an empty canvas (Angular CDK #15685). Options: (a) `canvas.toDataURL()` → `<img>` preview, (b) clone structure + redraw via `drawLeafToCanvas()`, (c) CSS `background-image` from toDataURL on a `<div>` preview. Option (a) is simplest; option (b) guarantees parity.
- **E1 blocks F7:** Bottom-sheet collapse needs drag-start/end events fired by the engine. Must be wired before F7 is implementable.
- **C5 coexists with C1 but is optional:** Icon + insertion line is redundant. Choose one as primary affordance.

---

## MVP Definition — v1.5 Initial Phase

### Launch With (v1.5 Phase 1 — "Unified Engine Rewrite")

Scoped to user's explicit ask plus the minimum table stakes to make it feel modern.

**Drag Start (Category A):**
- [ ] A1 Grab cursor on hover
- [ ] A2 Grabbing cursor during drag
- [ ] A3 Press-and-hold 250ms + 5px tolerance on touch (reduce from Phase 25's 500ms)
- [ ] A4 Distance 8px on mouse
- [ ] A5 Visual lift on drag start (opacity + scale)

**Ghost / Preview (Category B):**
- [ ] B1 Preview follows pointer
- [ ] B2 Semi-opaque clone of cell content (user requested)
- [ ] B3 Source cell dims to 40%
- [ ] B4 Preview offset matches grab point (no re-center jump)

**Drop Target (Category C):**
- [ ] C1 5-zone icon overlay (already exists; POLISH pass)
- [ ] C2 Active icon bright white, inactive dim (user requested)
- [ ] C3 Live re-compute on pointer move
- [ ] C4 Target cell outline/tint on hover

**Cancel (Category D):**
- [ ] D1 ESC-to-cancel (user requested)
- [ ] D2 Drop on origin = no-op
- [ ] D3 Drop outside canvas = cancel
- [ ] D4 Snap-back animation on cancel (200ms cubic-bezier)

**Cross-device (Category E):**
- [ ] E1 Pointer-events unified engine
- [ ] E3 Disable text select / context menu during drag
- [ ] E4 touch-action: none during drag

**Polish (Category F — subset):**
- [ ] F8 Drag-start wobble animation (user requested "subtle drag-start animation")
- [ ] F5 Preview snaps to active zone center on hover (~100ms)

### Add in Later v1.5 Phases (user hinted at iterative phases)

- [ ] E2 Haptic feedback on drag start (touch) — trivial once engine is wired
- [ ] F1 Spring-ease drop-settle animation on committed placement
- [ ] F6 Touch preview offset above finger (`-40px Y`)
- [ ] F7 Bottom-sheet auto-collapse during drag
- [ ] C5 Insertion line on edge drops (if user feels icons alone are insufficient)
- [ ] F9 Word labels on drop zones (if user finds icons ambiguous)
- [ ] Drag overlay/divider resize folded into same engine (if debugging convergence adds value)
- [ ] File-drop-onto-cell folded into same engine

### Future Consideration (v2+ / post-v1.5)

- [ ] Multi-select drag (user marked OUT for v1.5)
- [ ] Keyboard-only drag (Space + arrows) — a11y milestone
- [ ] Auto-scroll — N/A for 9:16 fit-viewport canvas
- [ ] F4 Target-cell "make room" animation (HIGH complexity for split-tree)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| B2 Semi-opaque clone preview | HIGH (user requested) | MEDIUM (canvas cloneNode quirk) | **P1** |
| C2 Active zone bright/dim | HIGH (user requested) | LOW | **P1** |
| D1 ESC-to-cancel | HIGH (user requested) | LOW | **P1** |
| E1 Unified pointer-events engine | HIGH (milestone goal) | MEDIUM | **P1** |
| A3 Reduce long-press to 250ms | HIGH (feel upgrade) | LOW | **P1** |
| F8 Subtle drag-start animation | HIGH (user requested) | LOW | **P1** |
| A1/A2 Grab cursors | MEDIUM (discoverability) | LOW | **P1** |
| B1 Preview follows pointer | HIGH (universal expectation) | LOW | **P1** |
| D4 Snap-back on cancel | MEDIUM (polish) | LOW | **P1** |
| C3 Live re-compute active zone | HIGH (correctness) | MEDIUM | **P1** |
| A5 Visual lift on drag start | MEDIUM (polish) | LOW | **P1** |
| F5 Preview magnetism to zone | MEDIUM | LOW | P2 |
| F7 Bottom-sheet auto-collapse | MEDIUM (mobile usability) | MEDIUM | P2 |
| E2 Haptic on touch drag start | LOW–MEDIUM | LOW | P2 |
| F1 Drop-settle spring animation | MEDIUM | LOW | P2 |
| F6 Touch preview finger offset | MEDIUM (iOS Photos pattern) | LOW | P2 |
| C5 Edge insertion line | LOW (redundant with icons) | MEDIUM | P3 |
| F9 Word labels on zones | LOW (risk clipping) | LOW | P3 |
| F2 Handle hover pulse | LOW | LOW | P3 |
| F3 Rotation tilt | ANTI-VALUE | — | **Reject** |

---

## Competitor Feature Analysis

| Feature | Notion | Figma | Linear | Trello (Pragmatic) | StoryGrid Proposed |
|---------|--------|-------|--------|--------------------|--------------------|
| Drag activation (mouse) | Click on handle | Click on layer | 5px distance | Click on card | 8px distance |
| Drag activation (touch) | ~500ms long-press | ~400ms long-press | 250ms long-press | 250ms | **250ms + 5px tolerance** |
| Cursor states | grab / grabbing | — (canvas-driven) | grab / grabbing | grab / grabbing | grab / grabbing |
| Preview style | Semi-opaque block clone | Layer outline | Card clone w/ shadow | Card clone w/ 4° tilt | **Semi-opaque canvas clone, no tilt** |
| Source cell during drag | Dimmed 40% | Placeholder outline | Dimmed placeholder | Original disappears | **Dimmed 40%** (per Atlassian spec) |
| Drop indicator | Blue line (2px) | Pink circles + blue lines | Blue line | Column highlight | **5 icons in cell (unique)** |
| Active drop target | Parent highlighted | Target frame outline | Column color tint | Column background tint | **Cell outline + active icon bright** |
| ESC cancel | Yes | Yes | Yes | Yes | **Yes** |
| Snap-back animation | Yes (~200ms) | Yes | Yes | Yes (fly-back) | **Yes 200ms** |
| Haptic on touch | Yes | Yes | Yes | Yes | **Yes (navigator.vibrate(10))** |
| Auto-scroll near edges | Yes | Yes | Yes | Yes | **N/A** (fit-viewport canvas) |
| Multi-select drag | Yes | Yes | Yes | Limited | **Out of scope** |

**Key insight:** StoryGrid's 5-zone icon overlay is genuinely unique in this reference set. No reference app does "5 discrete drop zones inside a single target cell." The closest analogs are Figma's Grid swap (Config 2025, but limited to same-span items) and Notion's column-creation via horizontal drag. The v1.5 UX is innovative — research should inform but not constrain.

---

## StoryGrid-Specific Context Notes

### Canvas transform: scale() compatibility

The canvas uses CSS `transform: scale()` to fit viewport. This is a known pain point for DnD libraries:
- jQuery UI bug #7865, Shopify Draggable #139, Angular CDK #28864 all document scale-transform drag offset bugs
- Calibration requires dividing pointer delta by scale factor
- **Preview must render OUTSIDE the transformed canvas** (in viewport space, via `createPortal(document.body)`) to avoid double-scaling — same pattern StoryGrid's ActionBar already uses (Phase 7, Phase 10)
- Hit-testing must translate pointer coordinates from viewport space → canvas space by dividing by scale

This is a MUST-GET-RIGHT architectural decision. See ARCHITECTURE.md for recommended approach.

### Canvas cloneNode gotcha

`<canvas>` elements produce empty canvases when cloned via `node.cloneNode(true)`. StoryGrid LeafNodes render via `<canvas>` for WYSIWYG export parity. The drag preview MUST handle this:

- Cheapest: `canvas.toDataURL()` → `<img>` element as preview
- Highest fidelity: clone DOM structure + call `drawLeafToCanvas()` into the preview canvas (reuses existing render pipeline)
- Simplest CSS-only: preview is a `<div>` with `background-image: url(toDataURL)` — also handles aspect-ratio + object-fit naturally

### Mobile bottom-sheet obstruction

MobileCellTray and bottom sheet occupy ~40% of bottom viewport on mobile. During drag:
- Cells below the sheet line are partially obscured
- Drop targets in that region cannot show 5-zone overlay clearly
- iOS Photos handles this by auto-dismissing sheets during drag operations
- Material Design spec explicitly allows STATE_DRAGGING → auto-settle

**Recommend F7 Bottom-sheet auto-collapse as P2 feature in a follow-up v1.5 phase.**

---

## Explicit User Rule-Outs (re-confirmed per brief)

| Feature | Status | Rationale from user |
|---------|--------|---------------------|
| Multi-select drag | OUT (v1.5) | Explicit: "multi-select drag, a11y keyboard reorder, autoscroll are explicitly future-phase" |
| Keyboard-only drag (a11y) | OUT (v1.5) | Same |
| Auto-scroll near viewport edges | OUT (v1.5) | Same — also N/A domain-wise |
| File-from-desktop drop unification | CONDITIONAL | "Include only if unification yields debugging/maintenance gains" — defer to ARCHITECTURE.md |
| Overlay-layer drag unification | CONDITIONAL | Same |
| Divider resize unification | CONDITIONAL | Same |
| Phase 25 touch DnD code | REPLACED | "Complete replacement of Phase 25 touch DnD code" |

---

## Key Numeric References (for REQUIREMENTS.md specifying)

| Spec | Value | Source |
|------|-------|--------|
| Mouse drag activation distance | 5–10px (propose 8px) | dnd-kit PointerSensor default |
| Touch drag activation delay | 250ms | dnd-kit TouchSensor default, Linear, modern convention |
| Touch drag activation tolerance | 5px movement during delay | dnd-kit TouchSensor default |
| Source cell opacity during drag | 0.4 (40%) | Atlassian Design System |
| Drag preview opacity | 0.8 (80%) — user-specified "semi-opaque" | User brief |
| Preview max size | 280×280px | Atlassian Design System |
| Cancel snap-back duration | 200ms | NN/g, Atlassian (350ms medium) |
| Cancel snap-back easing | `cubic-bezier(0.15, 1.0, 0.3, 1.0)` | Atlassian easeInOut |
| Drop-settle flash duration | 700ms | Atlassian largeDurationMs |
| Drop-settle easing | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` | Atlassian |
| Drag-start wobble duration | 120–200ms | Apple HIG spring recommendations |
| Drag-start wobble easing | `cubic-bezier(0.34, 1.56, 0.64, 1.0)` (back-out) | Derived from Apple spring d:15/s:170 |
| Preview offset from finger (touch) | -40px Y | iOS Photos pattern |
| Haptic on drag start | `navigator.vibrate(10)` | MDN, web vibration API best practice (50–200ms range; 10ms is "tick") |
| Insertion line thickness (if used) | 2px | Atlassian Design System |
| Insertion line terminal dot | 8px diameter | Atlassian Design System |
| Target cell outline color | `color.border.selected` / theme accent | Atlassian |
| Active icon brightness | 100% white | User brief ("bright white") |
| Inactive icon brightness | 30% white (`text-white/30`) | User brief ("dim") |

---

## Sources

**Primary (authoritative, HIGH confidence):**
- [Atlassian Design System — Pragmatic DnD design guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/) — exact specs for opacity, offsets, animation timings, drop indicators, touch targets
- [dnd-kit Pointer sensor docs](https://docs.dndkit.com/api-documentation/sensors/pointer) — activation constraint specification
- [dnd-kit Touch sensor docs](https://docs.dndkit.com/api-documentation/sensors/touch) — delay 250ms + tolerance 5px pattern
- [dnd-kit Collision detection algorithms](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms) — closest-edge vs closest-center hit testing
- [MDN — Navigator.vibrate() method](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) — haptic web API
- [MDN — HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — native behavior, limitations
- [MDN — DataTransfer.setDragImage()](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage) — native preview API limitations

**Secondary (reference-app patterns, MEDIUM confidence):**
- [Nielsen Norman Group — Drag-and-drop: How to design for ease of use](https://www.nngroup.com/articles/drag-drop/) — UX best practices
- [Smart Interface Design Patterns — Drag-and-Drop UX](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/) — cursor/affordance conventions, 100ms snap
- [Cloudscape Design System — Drag-and-drop pattern](https://cloudscape.design/patterns/general/drag-and-drop/) — AWS design patterns
- [Atlassian blog — The journey of Pragmatic DnD](https://www.atlassian.com/blog/design/designed-for-delight-built-for-performance) — design rationale
- [Pencil & Paper — Drag-and-Drop UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop) — reference-app survey
- [LogRocket — Designing drag-and-drop UIs](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/) — 2024 patterns

**Apple HIG (iOS conventions):**
- [Apple Developer — Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Apple Developer — Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) — when to use `.impact(medium)`
- [Apple Developer — Handling long-press gestures](https://developer.apple.com/documentation/uikit/handling-long-press-gestures) — 500ms Android, 300ms/double-tap iOS conventions
- [Animate with springs — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/) — damping 15 / stiffness 170 defaults

**Reference apps (pattern observation):**
- [Notion — Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) — block drag, blue insertion line
- [Figma — Grid auto-layout flow (Config 2025)](https://help.figma.com/hc/en-us/articles/31289469907863-Use-the-grid-auto-layout-flow) — grid item swapping pattern
- [Canva Apps SDK — Drag and drop](https://www.canva.dev/docs/apps/supporting-drag-drop/) — element drag model
- [Linear Changelog — Editor improvements April 2024](https://linear.app/changelog/2024-04-24-editor-improvements) — checklist reorder, drag images from outside
- [Material Design — Bottom sheets (gestures)](https://m2.material.io/components/sheets-bottom) — STATE_DRAGGING auto-settle

**Technical gotchas (MEDIUM confidence, issue-tracker sourced):**
- [Angular CDK #15685 — canvas cloneNode loses content](https://github.com/angular/components/issues/15685)
- [Shopify Draggable #139 — drag offset in transform:scale](https://github.com/Shopify/draggable/issues/139)
- [Angular CDK #28864 — preview breaks in transformed parent](https://github.com/angular/components/issues/28864)
- [Pragmatic DnD #66 — Safari drag preview empty for images](https://github.com/atlassian/pragmatic-drag-and-drop/issues/66)
- [Pragmatic DnD Discussion #93 — Mobile/touch support status](https://github.com/atlassian/pragmatic-drag-and-drop/discussions/93)

---

*Research scope: new DnD UX for StoryGrid v1.5 milestone — cell reordering via 5-zone overlay, unified desktop + touch, polished visual affordances, ESC-cancel. Explicitly excludes multi-select, keyboard DnD, auto-scroll per user direction.*
*Researched: 2026-04-17*
