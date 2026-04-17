# Stack Research — v1.5 Unified Drag-and-Drop UX

**Domain:** Cross-device cell DnD engine (mouse + touch) inside a CSS `transform: scale()` canvas editor
**Researched:** 2026-04-17
**Confidence:** HIGH (for recommendation), MEDIUM (for exact bundle-size numbers — Bundlephobia was unreadable, sizes are reported from library authors and secondary sources)

> **Scope note:** This document supersedes only the DnD-related portions of the v1.0 STACK research. All other locked stack choices (Vite 8, React 18.3.1, TypeScript 5.9.3, Zustand 5.0.12, Immer 10.2.0, Tailwind 3.4.19, Canvas-API export, Mediabunny video export) remain unchanged. Prior v1.0 STACK findings for those layers are preserved in git history.

---

## TL;DR — Recommendation

**Rebuild on `@dnd-kit/core@^6.3.1` with a single `PointerSensor`** (replace `TouchSensor + MouseSensor`). Keep `@dnd-kit/sortable` and `@dnd-kit/utilities`. Add `@dnd-kit/modifiers` for `snapCenterToCursor` and a custom scale-aware modifier. Delete the custom `useDndMonitor` + `DragZoneRefContext` pointer tracking — let dnd-kit own pointer state via `onDragStart`/`onDragMove`/`onDragOver`/`onDragEnd`/`onDragCancel`.

**Reject Pragmatic DnD.** It is built on the native HTML5 Drag-and-Drop API, which has three hard blockers for StoryGrid:

1. **CSS `transform: scale()` incompatibility** — documented open issue #203; PDND uses viewport coordinates, and native HTML5 drag ignores CSS transforms at the platform level. No workaround from maintainers.
2. **ESC cancel is platform-gated** — the browser takes over input during native drag; you cannot listen for `keydown`. PDND can only infer cancellation after `dragend` via `dropEffect === 'none'` — no mid-drag ESC animation or feedback.
3. **Mobile touch is a polyfill story** — iOS 15+ and Android Chrome 96+ have varying native HTML5 DnD support, but touch-to-drag remains flaky across Safari 15 (our floor). The "unified" claim is marketing; in practice you'd add `drag-drop-touch-js` polyfill.

**Reject `@dnd-kit/react@^0.4.0`.** Still pre-1.0 (v0.4.0 published April 2025 — a year before the current date with no further releases visible). Breaking changes between point releases. Issue #1842 asking for roadmap clarity has zero maintainer replies. Production risk is unjustifiable for a milestone whose entire point is fixing flaky DnD.

**Reject custom pointer-events engine from scratch.** The tree primitives (`moveLeafToEdge`, `moveCell`) and 5-zone geometry are the easy part. Keyboard-accessibility, autoscroll, pointer capture, sensor lifecycle on pointercancel, and the event-delegation work dnd-kit already ships would be 2–4 weeks of net-new code and regression surface. Not worth it.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@dnd-kit/core** | `^6.3.1` (already installed) | DnD orchestration, sensor abstraction, DragOverlay | Stable 6.x line, React 18.3.1-native, handles CSS transforms via documented `scaleX`/`scaleY` output in the `transform` object on `useDraggable` and `DragOverlay.adjustScale`. Battle-tested in this project through v1.4. |
| **@dnd-kit/sortable** | `^10.0.0` (already installed) | `useSortable` hook for cell reordering primitives | Keeps cell-move semantics identical to v1.1–v1.4 — no net-new tree code required; `moveLeafToEdge`/`moveCell` already exist and remain the callees. |
| **@dnd-kit/utilities** | `^3.2.2` (already installed) | `CSS.Translate.toString()` for transform strings | Paired with `useDraggable.transform` for scaled-container math. |
| **@dnd-kit/modifiers** | `^9.0.0` (new install) | `snapCenterToCursor` + custom scale-compensation modifier | Solves the drag-preview-in-scaled-canvas problem without forking dnd-kit. Modifiers receive `activatorEvent` + `transform` and can divide by the canvas scale factor, recentering the preview at the pointer. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — keep the stack minimal)* | — | — | No new non-dnd-kit library needed. Existing `lucide-react` icons cover the 5-zone overlay; custom React cursor/animation elements handle drag-start feedback. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest + `@testing-library/user-event` (already installed) | Exercise `pointerDown`/`pointerMove`/`pointerUp` | `user-event` v14 has first-class `pointer()` API for keyboard + touch + mouse simulation. No new test tooling. |
| `PointerEvent` polyfill check | Verify Safari 15 / iOS 15 | PointerEvents are supported in Safari 13+ and iOS Safari 13+ — no polyfill needed for our floor. |

---

## Installation

```bash
# Add modifiers to the existing dnd-kit install
npm install @dnd-kit/modifiers

# (Already installed — do NOT reinstall or bump major)
# @dnd-kit/core@^6.3.1
# @dnd-kit/sortable@^10.0.0
# @dnd-kit/utilities@^3.2.2
```

**No React, TypeScript, Vite, or Tailwind changes.** The entire DnD rewrite is additive to what's in `package.json` today, except for adding `@dnd-kit/modifiers`.

---

## Evaluation of Considered Options

### Option 1 — `@dnd-kit/core` rebuild with a single PointerSensor ✅ RECOMMENDED

| Criterion | Assessment |
|-----------|------------|
| npm + version | `@dnd-kit/core@^6.3.1` — published Dec 2024, no 6.4 or 7.0 in sight; library is in maintenance mode but stable, not abandoned |
| Bundle size | ~6 kB gzip (@dnd-kit/core) + ~5 kB gzip (sortable) + ~2 kB gzip (utilities) + ~3 kB gzip (modifiers) ≈ **~16 kB gzip total** — under 4% of the 500 kB MVP budget |
| Unified desktop+mobile | **Single `PointerSensor`** with `activationConstraint: { delay: 500, tolerance: 5 }`. Docs explicitly state "You should not be using both PointerSensor and TouchSensor or MouseSensor at the same time" — StoryGrid's current code violates this, which is a likely root cause of the "1-in-10 swap fires" bug |
| CSS transform scale | **Partial native support**: `useDraggable` returns `transform: { x, y, scaleX, scaleY }` — scale values reflect source/target scale delta. For full canvas-scale compensation (cursor-to-cell mapping), write one custom modifier that divides `transform.x`/`transform.y` by the editor zoom. Issue #50 (closed) and #398 document this pattern with community workarounds. `DragOverlay` has an `adjustScale` prop specifically for this case. |
| Drag preview | `DragOverlay` portal — full React control, renders outside the scaled canvas in viewport space (same trick StoryGrid's ActionBar uses in Phase 10). Apply the semi-opaque cell-content preview as normal JSX inside `DragOverlay`. |
| Drop zone model | 5 `useDroppable` instances per leaf (center + 4 edges). Use `collisionDetection={pointerWithin}` (or custom) so only the zone directly under the pointer fires `onDragOver`. `active.id` + `over.id` in the context drive the bright/dim icon toggle — idiomatic, no hack. |
| ESC cancel | **Built-in**: `onDragCancel` callback fires on ESC (dnd-kit installs a document `keydown` listener during drag since it runs its own pointer state machine, not native HTML5 drag). No workaround required. |
| File-drop-from-desktop | **Not unified** — native HTML5 `onDragOver`/`onDrop` remains the right tool. dnd-kit does not intercept file drops. Keep the two paths separate as today (Key Decision "dnd-kit for D&D, native HTML5 events for file drop" ✓ Good). |
| TypeScript | Full first-class types; no `@types/*` needed. |
| Maintenance | Last `@dnd-kit/core` release 6.3.1 was Dec 2024 — ~16 months stale as of 2026-04. Maintainer focus has shifted to `@dnd-kit/react`. However, the 6.x API is feature-complete for StoryGrid's needs and there are no React 18 compat issues filed. |
| React 18.3.1 / Vite 8 / Oxc | No known issues. dnd-kit ships ESM + CJS; Vite 8 ESM consumption works. No JSX-runtime conflicts with Oxc. |
| Migration cost from current code | **Low** — same library, removal of `TouchSensor + MouseSensor` + `useDndMonitor` + `DragZoneRefContext`, addition of one modifier. `DndContext` stays. Phase 9 `moveLeafToEdge`/`moveCell` callees unchanged. Estimated 2–3 phases, heavily test-covered paths stay green. |
| What NOT to pair with | Do **not** install `@dnd-kit/react` alongside — different package namespace, different API, would duplicate state. Do **not** re-enable `TouchSensor + MouseSensor` simultaneously — violates dnd-kit docs and causes exactly the inconsistent activation we're trying to eliminate. |

### Option 2 — `@atlaskit/pragmatic-drag-and-drop` ❌ REJECT

| Criterion | Assessment |
|-----------|------------|
| npm + version | `@atlaskit/pragmatic-drag-and-drop@1.7.7` — last published ~Nov 2025, actively maintained |
| Bundle size | ~4.7 kB gzip core + per-adapter packages (pragmatic-drag-and-drop-hitbox, pragmatic-drag-and-drop-flourish, pragmatic-drag-and-drop-auto-scroll, pragmatic-drag-and-drop-react-drop-indicator…). Realistic total for StoryGrid's needs: ~15–20 kB gzip, not the marketed "tiny" |
| Unified desktop+mobile | **FALSE CLAIM for our targets**. PDND is a thin abstraction over the native HTML5 Drag-and-Drop API. Native HTML5 DnD on touch: unreliable on iOS Safari 15 (our floor), inconsistent on Android WebView. The "Full feature support in Firefox, Safari, and Chrome, iOS and Android" phrasing refers to desktop platforms + modern iOS 15+/Chrome Android 96+; real behavior on Safari 15.0–15.3 is inconsistent. |
| CSS transform scale | **BLOCKER**: Open issue #203, no maintainer response, no workaround documented. "PDND uses viewport coordinates, and transform:scale doesn't actually change the layout, so there are inaccuracies in the calculations when not at a scale of 100%." Autoscroll and overflow scroll break inside scaled parents. StoryGrid's canvas is *always* scaled. |
| Drag preview | Native HTML5 `setDragImage` — browser strips opacity to ~0.8, adds a drop shadow, 280px max size on Windows, completely non-stylable. The "semi-opaque cell-content preview" requirement would force a custom workaround (positioned offscreen element referenced via `setDragImage`) — doable but awkward. |
| Drop zone model | `dropTargetForElements` API is clean, supports nesting, and per-zone `onDrag`/`onDragEnter`/`onDragLeave`. Five-per-cell would work idiomatically. But this is the *only* area where PDND would be ergonomic. |
| ESC cancel | **BLOCKER**: "While a drag operation is occurring, the browser enters a kind of takeover mode where it overrides handling of input events. More specifically, you cannot even listen for the `esc` keydown." (issue #165, unresolved). You get `dragend` *after* the browser's built-in fly-back animation, with `dataTransfer.dropEffect === 'none'`. No mid-drag ESC UX is possible. |
| File-drop-from-desktop | **Unified** — the `external` adapter handles desktop file drops natively. This is PDND's one genuine advantage, but StoryGrid already has a stable file-drop implementation (Phase 8 DROP-01/DROP-02) — no incentive to rewrite it. |
| TypeScript | First-class; authored in TS. |
| Maintenance | Active (Atlassian-funded, powers Jira/Trello/Confluence). |
| React 18 / Vite 8 / Oxc | Works; no known issues with our stack. |
| Migration cost | **High** — entire DnD layer rewritten in a different paradigm (imperative register/unregister vs React hooks), plus workarounds for the three blockers above. |
| What NOT to pair with | — (not recommending it in the first place) |

**Verdict:** The three simultaneous blockers (scaled canvas, ESC cancel, touch consistency on Safari 15) disqualify PDND for this specific app. It would be the right choice for a kanban board at 1:1 scale with 1,000+ items. StoryGrid has at most ~20 cells on a scaled canvas — the opposite profile.

### Option 3 — `@dnd-kit/react@^0.4.0` ❌ REJECT

| Criterion | Assessment |
|-----------|------------|
| npm + version | `@dnd-kit/react@0.4.0`, published April 13, 2025. **No releases between 0.4.0 and today (2026-04-17)** — ~12 months without a point release on a pre-1.0 library |
| Stability signal | Version 0.x with recurring breaking changes across point releases (event type system redesign, feedback config migration, plugin consolidation). Discussion #1842 requesting roadmap clarity has zero maintainer replies as of ~5 months ago. |
| API | Cleaner than 6.x (plugin-based architecture, better touch story via `@dnd-kit/dom` abstraction), but the migration guide flags multiple "manual implementation required" gotchas. |
| Migration cost | **Very high** — entire public API differs from 6.x; not a drop-in. Would invalidate 600+ existing tests that reference dnd-kit 6.x internals. |
| Production fit | For a milestone whose stated purpose is fixing flaky DnD, adopting a pre-1.0 library with breaking-change history is the opposite of risk reduction. |

**Verdict:** Monitor for 1.0 release. Revisit in v1.6+ if stable.

### Option 4 — Framer Motion / `motion` `drag` API ❌ REJECT

| Criterion | Assessment |
|-----------|------------|
| npm + version | `motion@^12.x` (Motion for React, formerly framer-motion) |
| Bundle size | ~60–80 kB gzip (Motion's full bundle). `LazyMotion` + `m` components reduce, but still >25 kB. This is **5–8× the dnd-kit footprint** for a single feature. |
| Drop zone model | No native drop-zone API — must roll your own via `onDragEnd` + manual hit-test against `getBoundingClientRect()` of all 5 zones per cell. Reinvents what dnd-kit already solves. |
| Drag preview | `motion.div drag` animates the element itself, not a portal overlay. Works but requires extra `AnimatePresence` choreography to keep the canvas layout stable during drag. |
| ESC cancel | No built-in support; must listen manually and call `dragControls.stop()` — doable. |
| CSS transform scale | Partial — Motion handles nested transforms better than native HTML5, but you still multiply-by-scale manually for coordinate math. |
| Fit for use case | Motion shines for animated UI gestures on a single element; it's not a DnD framework. Using it here means we still write hit-test logic and lose dnd-kit's accessibility + keyboard support. |

**Verdict:** Bundle cost alone rules it out. Also, it does not solve the 5-zone drop-target problem — you'd effectively be writing the custom pointer engine (Option 6) on top of Motion.

### Option 5 — `react-dnd` ❌ REJECT (confirmed prior)

| Criterion | Assessment |
|-----------|------------|
| Touch support | HTML5 backend does not support touch; requires `react-dnd-touch-backend` or `react-dnd-multi-backend`. Both are semi-maintained at best. |
| Maintenance | `react-dnd@16.0.1` published ~3 years ago; repo low-activity. |
| API fit | Monads-style API (`connectDragSource`/`connectDropTarget`) is more boilerplate than dnd-kit for equivalent outcomes. |

**Verdict:** Confirmed non-starter, same as v1.0 stack research.

### Option 6 — Custom pointer-events engine (no library) ❌ REJECT

| Criterion | Assessment |
|-----------|------------|
| What we'd build | `onPointerDown`/`onPointerMove`/`onPointerUp` with `setPointerCapture`, a state machine for `idle | pressing | dragging | cancelled`, hit-test against `data-zone` attrs via `document.elementFromPoint()`, portal-rendered drag preview, ESC `keydown` listener, autoscroll at viewport edges, keyboard accessibility (Tab + Space + arrows), touch-action CSS management, pointer-cancel cleanup on visibility change / touchcancel |
| Scope | ~800–1,500 lines of net-new code, 40–60 unit tests, 2–4 weeks of phase work before first feature-parity build |
| Risk | Every bug we fix in dnd-kit 6.x reappears in our code; no community bug reports; no issue tracker for our implementation |
| Precedent | StoryGrid already has two custom pointer-event engines: divider resize (`pointerdown`/`setPointerCapture`/`pointerup`) and overlay drag (`OverlayLayer`). Both are small, local, and surgical — not cross-cutting like cell DnD. The cell DnD layer has five distinct concerns (sensor activation, pointer tracking, overlay rendering, drop-zone hit-test, and undo integration) that dnd-kit already separates cleanly. |

**Verdict:** Only worth the cost if dnd-kit proves infeasible. It hasn't.

### Option 7 — `neodrag`, `@formkit/drag-and-drop`, `hello-pangea/dnd`, etc. ❌ REJECT

- **neodrag** is a single-element draggable/resizable library (pointer-event based, good for windowing UIs). No drop-target API — does not model "drag A onto B" as a primitive. Wrong abstraction.
- **@formkit/drag-and-drop** is ~5 kB and API-ergonomic but targets simple list reorder, lacks keyboard nav, and is pre-1.0 (v0.3). Touch story is minimal.
- **hello-pangea/dnd** is the maintained fork of the deprecated `react-beautiful-dnd`. API is list-oriented — wrong fit for a recursive tree grid with nested drop zones per cell.

**Verdict:** None of these match StoryGrid's tree-grid + 5-zone-per-cell + scaled-canvas + ESC-cancel profile as well as dnd-kit 6.x.

---

## Alternatives Considered Summary

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@dnd-kit/core@^6.3.1` + PointerSensor | `@atlaskit/pragmatic-drag-and-drop` | Never, for this app. Reconsider if StoryGrid ever (a) removes the scaled canvas, (b) drops Safari 15, and (c) can accept platform-owned drag visuals. |
| `@dnd-kit/core@^6.3.1` | `@dnd-kit/react@^0.4.0` | Reconsider in v1.6+ after 1.0 stable release + ≥3 months of releases without breaking changes |
| `@dnd-kit/core@^6.3.1` | Custom pointer engine | Only if dnd-kit 6.x is deprecated and no 1.0 `@dnd-kit/react` exists. Unlikely before v2.0 of StoryGrid. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `TouchSensor` + `MouseSensor` together | dnd-kit docs: "You should not be using both PointerSensor and TouchSensor or MouseSensor at the same time." This is the likely root cause of the flaky Phase 25 activation (current `TouchSensor + MouseSensor` at delay:500 per Key Decision). | `PointerSensor` alone with `{ delay: 500, tolerance: 5 }` activation constraint |
| `@atlaskit/pragmatic-drag-and-drop` | Native-HTML5-based: scaled canvas broken (issue #203), ESC cancel impossible mid-drag (issue #165), iOS Safari 15 touch flaky | `@dnd-kit/core` |
| `@dnd-kit/react` (0.x) | Pre-1.0, no releases in 12 months, breaking changes between points, no roadmap response | `@dnd-kit/core@6.3.1` |
| `react-dnd` + `react-dnd-touch-backend` | Unmaintained touch backend, boilerplate, no DragOverlay equivalent | `@dnd-kit/core` |
| `framer-motion` / `motion` for DnD | 60+ kB gzip, no drop-zone API, no accessibility story | `@dnd-kit/core` |
| Custom `useDndMonitor` + `DragZoneRefContext` (current code) | Parallel pointer tracking that fights dnd-kit's own state machine; likely cause of the "1-in-10 swap" regression | Use `DndContext`'s `onDragStart`/`onDragMove`/`onDragOver`/`onDragEnd`/`onDragCancel` exclusively |
| `@dnd-kit/react` (new package, v0) migration in this milestone | Migration risk trades the problem we have (flaky touch) for a worse problem (pre-1.0 API churn) | Stay on 6.3.1 and revisit in v1.6+ |

---

## Stack Patterns by Variant

**If future milestone needs desktop-file-drop unified with cell-DnD:**
- Re-evaluate Pragmatic DnD's `external` adapter. Only if we also remove the scaled canvas first (or add canvas-scale compensation to PDND, which no maintainer has shipped). Not this milestone.

**If future milestone needs touch-only mobile app with no desktop surface:**
- Drop dnd-kit, use `framer-motion` `drag` or raw pointer events — simpler when desktop accessibility is not a requirement. Not this milestone.

**If scaled-canvas drag preview has sub-pixel jitter after the custom modifier:**
- Fall back to rendering the preview at 1.0 scale in a viewport-space portal (same pattern as the ActionBar), not inside the transformed canvas. `DragOverlay` already does this by default.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@dnd-kit/core@^6.3.1` | `react@^18.3.1`, `react-dom@^18.3.1` | No React 19 peer-dep issues on 6.x; we pin React 18 anyway |
| `@dnd-kit/core@^6.3.1` | `@dnd-kit/sortable@^10.0.0` | Matched in current package.json; both 6.x-era |
| `@dnd-kit/core@^6.3.1` | `@dnd-kit/utilities@^3.2.2` | Matched in current package.json |
| `@dnd-kit/modifiers@^9.0.0` | `@dnd-kit/core@^6.x` | 9.x is the 6.x-compatible modifier line; do not install `@dnd-kit/modifiers@10.x` (that targets `@dnd-kit/react`) |
| `@dnd-kit/core@^6.3.1` | `vite@^8.0.1` | No bundler issues reported; ESM build works with Rolldown |
| `@dnd-kit/core@^6.3.1` | `@vitejs/plugin-react@^6.0.1` (Oxc) | No JSX-runtime compatibility issues |
| `@dnd-kit/core@^6.3.1` | `typescript@~5.9.3` | Types compile cleanly |

**Do NOT mix:**
- `@dnd-kit/core@6.x` with `@dnd-kit/react@0.x` — different state machines, would install two DndContext providers
- `@dnd-kit/modifiers@10.x` with `@dnd-kit/core@6.3.1` — modifier major versions are paired to core generation

---

## Integration Notes — Concrete Migration Plan

The roadmapper should plan ~3 phases:

1. **Phase A — Sensor consolidation** (small, high-value)
   - Replace `TouchSensor + MouseSensor` with a single `PointerSensor` configured `{ activationConstraint: { delay: 500, tolerance: 5 } }`.
   - Delete `useDndMonitor` hook and `DragZoneRefContext` — consume `active`/`over` from `useDndContext` instead.
   - Apply `touch-action: none` to the `LeafNode` drag handle (per dnd-kit docs; critical for Safari).
   - Expected outcome: eliminates the "1-in-10 swap" flakiness without changing visual UX.

2. **Phase B — Scaled-canvas drag preview**
   - Write `scaleCompensation` modifier that divides `transform.x`/`transform.y` by the current canvas zoom factor (read from `editorStore.zoom`).
   - Compose with `snapCenterToCursor` from `@dnd-kit/modifiers`.
   - Render semi-opaque cell-content preview inside `<DragOverlay>` — portal ensures it lives in viewport space (outside the scaled canvas transform).
   - Verify drag preview tracks finger/cursor at 50%, 75%, 100%, 125% zoom.

3. **Phase C — 5-zone visual overhaul + ESC**
   - Replace custom zone geometry with 5 `useDroppable` instances per leaf (IDs: `{leafId}:center`, `{leafId}:top`, etc.).
   - Use `collisionDetection={pointerWithin}` so exactly one zone is "over" at any time.
   - Bind icon bright/dim state to `over?.id === zoneId`.
   - Wire `onDragCancel` for ESC feedback (built-in in dnd-kit — no extra listener).
   - Add press-and-hold start animation in `onDragStart`.

**Code that stays untouched:** `moveLeafToEdge`, `moveCell`, `swapCells`, all tree tests, Phase 25's `MobileCellTray` shell (only its DnD wiring changes), divider resize (different code path entirely), overlay drag (different code path entirely), file-drop (different code path entirely).

---

## Sources

| Source | URL | What verified | Confidence |
|--------|-----|---------------|------------|
| @dnd-kit/core PointerSensor docs | https://dndkit.com/api-documentation/sensors/pointer | Single-sensor rule, activation constraints, touch-action requirement | HIGH |
| @dnd-kit/modifiers `snapCenterToCursor` PR | https://github.com/clauderic/dnd-kit/pull/334 | `activatorEvent` passed to modifiers — enables scale compensation | HIGH |
| @dnd-kit DragOverlay scale issue (closed) | https://github.com/clauderic/dnd-kit/issues/50 | Workaround for scaled-container DragOverlay via modifier + `getBoundingClientRect` | MEDIUM |
| @dnd-kit DragOverlay drop-animation scale issue | https://github.com/clauderic/dnd-kit/issues/398 | Additional scale-related workaround reference | MEDIUM |
| @dnd-kit roadmap discussion (no reply) | https://github.com/clauderic/dnd-kit/discussions/1842 | @dnd-kit/react stability unclear; 0 maintainer responses | HIGH |
| PDND scaled-container issue (open, unresolved) | https://github.com/atlassian/pragmatic-drag-and-drop/issues/203 | "PDND uses viewport coordinates, transform:scale breaks calculations" — direct quote | HIGH |
| PDND ESC cancel limitation (open) | https://github.com/atlassian/pragmatic-drag-and-drop/issues/165 | Cannot detect ESC mid-drag | HIGH |
| PDND web platform constraints | https://atlassian.design/components/pragmatic-drag-and-drop/web-platform-design-constraints | Native preview opacity ~0.8, 280px Windows cap, cursor constraints | HIGH |
| @atlaskit/pragmatic-drag-and-drop npm | https://www.npmjs.com/package/@atlaskit/pragmatic-drag-and-drop | v1.7.7, published ~Nov 2025 | HIGH |
| Pragmatic DnD GitHub README | https://github.com/atlassian/pragmatic-drag-and-drop | ~4.7 kB core claim, adapter architecture | HIGH |
| @dnd-kit/react 0.4.0 release | https://github.com/clauderic/dnd-kit/releases | Latest release April 2025, breaking changes noted | HIGH |
| Puck editor 2026 DnD comparison | https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react | Confirms dnd-kit as default 2026 choice; ~6 kB gzip; recommends for fine-grained control | MEDIUM |
| dnd-kit vs PDND vs react-beautiful-dnd 2026 | https://www.pkgpulse.com/blog/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026 | @dnd-kit: 6 kB, 2.8M weekly downloads; PDND: 3.5 kB, 180K weekly | MEDIUM |
| LogRocket PDND guide | https://blog.logrocket.com/implement-pragmatic-drag-drop-library-guide/ | API ergonomics, adapter list | MEDIUM |
| Native HTML5 DnD on touch devices | https://medium.com/@deepakkadarivel/drag-and-drop-dnd-for-mobile-browsers-fc9bcd1ad3c5 | iOS 15+ / Android Chrome 96+ native support; Safari 15.0–15.3 inconsistent | MEDIUM |
| Mobile drag-drop polyfill (evidence, not recommending) | https://github.com/drag-drop-touch-js/dragdroptouch | Existence of polyfill confirms native HTML5 DnD does not "just work" on touch | MEDIUM |
| Pointer events for DnD (custom engine reference) | https://medium.com/@aswathyraj/how-i-built-drag-and-drop-in-react-without-libraries-using-pointer-events-a0f96843edb7 | Scope estimate for custom implementation | LOW |

---

*Stack research for: v1.5 Unified DnD UX (cell drag only)*
*Researched: 2026-04-17*
*Confidence: HIGH for recommendation; MEDIUM for exact bundle-size kB figures (Bundlephobia blocked at fetch time)*
