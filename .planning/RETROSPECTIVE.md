# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-07
**Phases:** 8 (0–6 + 5.1 INSERTED) | **Plans:** 23 | **Timeline:** 7 days

### What Was Built
- Recursive split-tree grid editor with Zustand + Immer stores and 50-entry undo/redo history
- Canvas API export pipeline producing pixel-perfect 1080×1920px PNG/JPEG (replaced html-to-image)
- Video cell support with canvas rAF preview + MediaRecorder MP4 export (replaced ffmpeg.wasm)
- Mobile-first responsive UI with bottom sheet, pinch-to-zoom, and mobile welcome card (INSERTED phase)
- Full UX polish: templates, gap/radius/background, pan/zoom, cell-swap, dark theme, keyboard shortcuts

### What Worked
- **TDD discipline held** throughout — pure tree functions, stores, and UI components all tested before wiring
- **Quick tasks for unplanned work** — 11 quick tasks caught and fixed real regressions without derailing phase plans
- **Canvas element for LeafNode** (replacing `<img>`) eliminated the entire class of rendering divergence between preview and export
- **Inserting Phase 5.1 before Phase 6** was the right call — shipping mobile UI first avoided a costly retrofit

### What Was Inefficient
- **ROADMAP progress table drifted** — completion statuses in the table weren't updated as phases completed, creating misleading noise at milestone close
- **html-to-image and ffmpeg.wasm were both replaced mid-flight** via quick tasks — earlier prototyping of the export pipeline would have caught these failures before they became phase-scoped decisions
- **Phase 05.1 SUMMARY had noise** — gsd-tools picked up mid-summary content as accomplishments; SUMMARY format needs a clear `## One-liner` at the top

### Patterns Established
- `drawLeafToCanvas()` as the single shared rendering primitive for both `<canvas>` display and export — guarantees WYSIWYG
- Blob URLs for video + base64 for images (different lifecycle requirements, different storage strategy)
- CSS-driven responsive breakpoints (`hidden md:flex`) over JS conditional rendering — avoids FOUC
- Quick tasks for unplanned fixes — keeps phase plans clean while maintaining traceability
- `useGridStore.getState()` / `useEditorStore.getState()` in event handlers — avoids stale closures without extra `useEffect` deps

### Key Lessons
1. **Prototype the export path early.** Both html-to-image and ffmpeg.wasm were replaced after phase execution began. A 2-hour spike before Phase 4 and Phase 6 would have revealed the canvas + MediaRecorder path immediately.
2. **Insert mobile phases early, not late.** Phase 5.1 was INSERTED after Phase 5 — by then, the layout was already desktop-centric and required responsive retrofitting. Mobile should be designed in from Phase 2.
3. **Keep SUMMARY `## One-liner` at the very top** — gsd-tools extracts accomplishments from SUMMARY files; any content before the one-liner pollutes milestone entries.
4. **ROADMAP progress table needs updating at each plan completion** — stale status rows create confusion at milestone review.

### Cost Observations
- Model mix: primarily Sonnet 4.6 (balanced profile)
- Sessions: ~15 estimated
- Notable: Quick tasks were low-overhead (avg ~10 min each); phase plans averaged 20–60 min

---

## Milestone: v1.1 — UI Polish & Bug Fixes

**Shipped:** 2026-04-08
**Phases:** 4 (7–10) | **Plans:** 11 | **Timeline:** 2 days

### What Was Built
- Portal-based ActionBar via `createPortal(document.body)` — escapes per-cell stacking contexts, stable 64px targets at any cell size (Phases 7, 10)
- `SafeZoneOverlay` component replacing toggle-only safe-zone button with striped/dimmed unsafe-area indicator (Phase 8)
- Friction-free template apply (no confirmation dialog) and full-workspace drop zone with clear drag-over feedback (Phase 8)
- Atomic cell MOVE semantics via `moveLeafToEdge` primitive + `moveCell` store action + 5-zone LeafNode drop overlay, with single-undo correctness for n-ary trees (Phase 9)
- Sidebar Replace input widened to accept `video/*` with proper blob-URL + `mediaType='video'` routing (Phase 10, MEDIA-01 upload gap)

### What Worked
- **Gap-closure phase pattern** — `/gsd:audit-milestone` → `/gsd:plan-milestone-gaps` → Phase 10 caught the CELL-01/CELL-02/MEDIA-01 gaps that slipped past Phase 7 verification and closed them in a focused 2-plan phase
- **Parallel wave execution in Phase 10** — 10-01 and 10-02 touched disjoint files (ActionBar vs LeafNode/Sidebar) and ran in parallel, completing the phase in a single wave
- **Course-correction during human verification** — user caught the "minuscule buttons" regression during the human-verification step before phase completion was finalized, saving a full re-audit cycle
- **Pure primitive + store action + UI layer separation** (Phase 9) — `moveLeafToEdge` was fully unit-tested before `moveCell` was built, which was fully tested before the LeafNode overlay was wired. Classic TDD bottom-up.

### What Was Inefficient
- **Diff-only audit mis-classified a deliberate architectural pivot as a regression** — the v1.1 audit saw clamp() removed in `1967219` and flagged it as CELL-02 failure, without reading the commit message that explained the portal pivot made clamp() obsolete. Phase 10's initial execution wasted an entire plan re-landing clamp() before course-correcting.
- **SUMMARY.md one-liner extraction still produced noise** at milestone archive time — Phase 9 summaries had `One-liner:` with empty content; Phase 10 summaries had structured intros before the one-liner. The v1.0 lesson about SUMMARY format hasn't fully propagated.
- **ROADMAP progress table drifted again** — Phase 8 and Phase 9 showed `0/3 Planned` and `0/4 Planned` in the progress table even after completion. Same issue as v1.0.

### Patterns Established
- **Portal-based UI for stacking-context escape** — when a UI element must visually overflow a container that has its own stacking context, `createPortal(document.body)` is cleaner than trying to hoist the element up the DOM tree
- **Audit gap-closure phases as a first-class workflow** — `/gsd:audit-milestone` → `/gsd:plan-milestone-gaps` → dedicated phase with `gap_closure: true` frontmatter → `/gsd:execute-phase --gaps-only`
- **Human verification as a correction gate, not just a sign-off** — the human-verification step in execute-phase caught a real issue that automated tests couldn't (clamp() math was correct; the problem was the math itself was wrong for the portal architecture)
- **Course-correction commits on top of revert commits** — when a plan goes sideways, revert the plan's commit and layer the correction on top rather than amending. Preserves history and makes the lesson visible.

### Key Lessons
1. **Audit gap-closure plans must read the prior commit message, not just the diff.** A `git log -1 <commit>` step in the audit workflow would have caught that `1967219` was a deliberate portal pivot, not a regression. Candidate tooling improvement: `gsd-tools audit` should surface commit messages alongside diffs when flagging "regressions".
2. **Portal architecture eliminates scale-compensation problems.** When a UI element sits inside a transformed container but must visually overflow, rendering via portal in viewport space is structurally simpler than computing scale-compensating sizes.
3. **Human verification is load-bearing.** The Phase 10 clamp() mistake would have shipped if execute-phase had auto-completed on `passed` verification. Keeping a human gate — even for "automated checks pass" phases — caught a real bug.
4. **SUMMARY format still isn't enforced.** Restate the v1.0 lesson: SUMMARY files need a strict `## One-liner` as the first content after frontmatter, and gsd-tools should reject SUMMARY commits that don't match.
5. **ROADMAP progress table needs automated updating.** Restate the v1.0 lesson — the same drift recurred in v1.1. Candidate: `gsd-tools roadmap update-plan-progress` should be called on every plan completion via a hook, not manually.

### Cost Observations
- Model mix: primarily Sonnet 4.6 (balanced profile); Phase 10 orchestration on Opus 4.6 (1M)
- Sessions: ~3-4 estimated (much tighter than v1.0's 15 — smaller scope, tighter feedback loop)
- Notable: Parallel wave execution in Phase 10 saved ~4 min vs sequential; gap-closure phase pattern was cost-effective compared to re-opening Phase 7

---

## Milestone: v1.4 — Mobile-First Overhaul & Instagram Fonts

**Shipped:** 2026-04-17
**Phases:** 5 (22–26) | **Plans:** 6 | **Timeline:** 2 days

### What Was Built
- Mobile header rebuilt from Export-only to 5-button toolbar with 44×44px targets; global CSS eliminating pull-to-refresh and 300ms tap delay
- Bottom sheet drag-pill gesture replaced by chevron toggle; `SheetSnapState` narrowed to `collapsed|full`; auto-expand on cell select
- `MobileCellTray` component — persistent action strip above sheet with Upload/Split H/V/Fit/Clear at 44×44px; always-mounted CSS-driven visibility
- Touch drag-and-drop via `@dnd-kit` `TouchSensor` (500ms hold); `DragZoneRefContext` for pointer tracking; `hold-pulse` animation; file-drop preserved
- `FontPickerList` with 8 Instagram-style Google Fonts; each name rendered in its own typeface; wired to `OverlayPanel` and `MobileSheet` overlay branch

### What Worked
- **SheetSnapState narrowing** — removing the half-snap state eliminated an entire class of "cut-off controls" bugs and simplified all sheet logic in one PR
- **Always-mounted CSS-driven visibility pattern** — `MobileCellTray` using `pointerEvents: none` + opacity transition is reusable and avoids mount/unmount flicker; Phase 25 picked it up immediately
- **Single consolidated Google Fonts `<link>`** — all 8 families in one request with `display=swap` required zero JS font loading code; clean and fast
- **Tight 2-day milestone** — 5 phases at 1–2 plans each, sequentially dependent, moved quickly without coordination overhead

### What Was Inefficient
- **Touch DnD needed a post-phase quick fix** — `260416-vgk` was required immediately after Phase 25 shipped, suggesting the verification gate was too shallow for interaction-heavy code; a real device test during the plan would have caught pointer event collision earlier
- **Requirements traceability not updated during execution** — all 18 requirements stayed `Pending` in REQUIREMENTS.md through the entire milestone; only updated at archive time; this is the third milestone with the same drift
- **No milestone audit** — skipped because touch DnD UX was known to need overhaul; the right call but creates a gap in coverage data for future reference

### Patterns Established
- **MobileCellTray as a separate component from ActionBar** — desktop portal ActionBar stays unchanged; mobile gets dedicated tray; no cross-contamination between form factors
- **`SheetSnapState` as a 2-state machine** — collapsed and full; anything in between adds complexity without UX benefit for a 9:16 story canvas
- **Font picker as self-contained `FontPickerList`** — `aria-pressed` for state, responsive min-height via Tailwind breakpoints (no mobile prop), context-agnostic; reusable pattern for any picker list

### Key Lessons
1. **Real-device interaction testing before plan completion is load-bearing for gesture-heavy code.** Touch DnD passing unit tests and Playwright snapshots is not the same as passing a real finger test. Quick task `260416-vgk` was the evidence.
2. **Narrowing a state machine is a feature, not a constraint.** Removing `half` from `SheetSnapState` resolved multiple open bugs simultaneously. When a state exists mainly to cause edge cases, delete it.
3. **Requirements traceability drift is now a confirmed recurring anti-pattern** (v1.0, v1.1, v1.4 all had it). The fix is a hook that updates traceability on plan completion, not discipline.
4. **Deferred UX debt should be named at archive time.** Touch DnD "needs an overhaul" is captured in the milestone archive and KEY DECISIONS — if it's not named, it won't appear in v1.5 planning.

### Cost Observations
- Model mix: primarily Sonnet 4.6 (balanced profile)
- Sessions: ~4–5 estimated
- Notable: Phase 26 (fonts) was the fastest — zero data model changes, pure UI wiring; phases with clear UI-only scope execute fastest

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 23 | Baseline — first milestone |
| v1.1 | 4 | 11 | Audit-driven gap closure introduced (Phase 10); human verification caught a plan-level mistake |
| v1.2 | 6 | 17 | Mediabunny pipeline replaced ffmpeg.wasm; overlay system shipped; effects layer added |
| v1.3 | 5 | 9 | Named filter presets; auto-mute detection; breadth-first drop; live audio preview |
| v1.4 | 5 | 6 | Mobile UX overhaul (header/sheet/tray/DnD); Instagram fonts; touch polish |

### Cumulative Quality

| Milestone | Est. Tests | Zero-Dep Additions |
|-----------|------------|-------------------|
| v1.0 | 60+ passing | Canvas API export, MediaRecorder video export |
| v1.1 | 489 passing (43 files) | `SafeZoneOverlay`, `moveLeafToEdge` primitive, portal-based ActionBar |
| v1.2 | 628 passing | Mediabunny pipeline, overlay system, effects layer |
| v1.3 | 700+ passing | Named filter presets, auto-mute, breadth-first drop |
| v1.4 | 729 passing (2 skipped) | `MobileCellTray`, `FontPickerList`, touch DnD via @dnd-kit |

### Top Lessons (Verified Across Milestones)

1. Prototype risky integrations (export, video) before committing them to phase plans (v1.0)
2. Mobile-first design is easier than desktop-first retrofit (v1.0)
3. **Audit gap-closure plans must read the commit message, not just the diff** (v1.1) — a revert may be deliberate
4. **Portal in viewport space beats scale-compensation math** when a UI element must overflow a transformed container (v1.1)
5. **Human verification is load-bearing even for "all automated checks pass" phases** (v1.1)
6. **Narrowing a state machine is a feature** — removing `half` from `SheetSnapState` resolved multiple bugs simultaneously; when a state exists mainly to cause edge cases, delete it (v1.4)
7. **Real-device gesture testing is load-bearing for touch-heavy code** — unit tests and Playwright snapshots don't catch pointer event collisions; a real finger test before phase close would have prevented the post-phase quick fix (v1.4)
8. **Name deferred UX debt at archive time** — "touch DnD needs overhaul" captured in KEY DECISIONS ensures it surfaces in v1.5 planning rather than being silently carried forward

### Recurring Anti-Patterns (Not Yet Fixed)

- **SUMMARY.md one-liner drift** — gsd-tools extracts accomplishments from SUMMARY files but the format is not enforced; noise polluted v1.0, v1.1, and later milestone entries
- **ROADMAP progress table drift** — phase completion status not auto-updated on plan completion; recurred in v1.0, v1.1, v1.4
- **Requirements traceability drift** — all requirements stayed `Pending` through v1.0, v1.1, and v1.4 execution; only updated at archive time; a hook on plan completion is the fix
