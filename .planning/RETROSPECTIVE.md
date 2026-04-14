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

## Milestone: v1.2 — Effects, Overlays & Persistence

**Shipped:** 2026-04-11
**Phases:** 6 (11–16) | **Plans:** 17 | **Timeline:** 3 days (2026-04-09 → 2026-04-11)

### What Was Built
- Per-cell visual effects layer — `effectsToFilterString()` single draw path through `drawLeafToCanvas()`, guaranteeing preview ≡ PNG ≡ MP4 parity; drag-to-one-undo via `beginEffectsDrag`
- Per-cell audio toggle with Web Audio mixing — `audioEnabled` on LeafNode; `buildAudioGraph` (→ deleted) + `mixAudioForExport()` OfflineAudioContext pipeline; zero-audio MP4 skip path when all cells muted
- Text/emoji/sticker overlay system — `overlayStore` with 8 actions; `stickerRegistry` side-channel; `contenteditable` inline editor; `OverlayLayer` drag/resize/rotate; export in PNG and MP4
- Mediabunny direct MP4 pipeline — removed `@ffmpeg/ffmpeg`; no COOP/COEP; CanvasSource + AudioBufferSource + OfflineAudioContext; VP9/AVC codec selection; non-fatal AAC fallback toast
- VideoSampleSink decode-then-encode — all video frames decoded upfront via Mediabunny's higher-level API; `findSampleForTime()` O(log n) lookup; sequential decode bounds peak GPU memory; eliminated 99.4% of export seek time
- Export Metrics Panel — 17-field `ExportMetrics` interface; ref-based 250ms polling (no React re-renders); Shift+M toggle; `VITE_ENABLE_EXPORT_METRICS` feature flag; zero production cost via Vite tree-shaking

### What Worked
- **Single draw path discipline** — `effectsToFilterString()` called only inside `drawLeafToCanvas()`; no inline filter string construction anywhere in the codebase meant preview and export were always in sync without testing every code path
- **Decision-helper extraction for testability** — `hasAudioEnabledVideoLeaf()` and `buildExportVideoElements()` as exported pure helpers gave unit test points for the most complex export logic without driving the full MediaRecorder/Mediabunny pipeline in jsdom
- **OfflineAudioContext over real-time audio mixing** — rendering offline (not real-time) was fast and eliminated timing hazards with the video encode loop; audio mixed *after* the video loop, cleanly separable
- **ref-based polling for metrics panel** — `metricsRef.current` written by the export callback, read by 250ms `setInterval` into state; zero React re-renders per frame during export (correct architectural choice for a high-throughput overlay)
- **Sequential decode for GPU memory bounding** — one video decoded at a time; peak GPU footprint bounded to one video's frames, not all videos simultaneously; `disposeAllSamples` in `finally` ensures cleanup on success and error paths

### What Was Inefficient
- **Audio pipeline was rewritten twice** — Phase 12 built a `buildAudioGraph()` using `MediaElementAudioSourceNode` (compatible with MediaRecorder). Phase 14 switched to Mediabunny, making `MediaElementAudioSourceNode` unusable in that context (Pitfall 1: incompatible with OfflineAudioContext). `buildAudioGraph` was deleted; `mixAudioForExport()` with `AudioBufferSource` was built from scratch. The Mediabunny migration decision should have come before the audio mixing design, not after.
- **Persistence (PERS-01..PERS-12) planned but then dropped** — Phase 14 slot was repurposed for the Mediabunny migration mid-milestone. Late scope changes of this magnitude create planning artifacts that are out of date before they're used.
- **Retrospective not written in the same session** — v1.2 was declared shipped on 2026-04-11 but the retrospective entry was missing at the time `/gsd-complete-milestone v1.2` was first called in the following session.

### Patterns Established
- **`beginEffectsDrag` + `setEffects(no snapshot)` = drag-to-one-undo** — `pointerdown` opens the undo slot; every `onChange` event updates without pushing to history; releases collapse to a single undo entry. Generalizable to any slider that produces many intermediate values.
- **Decision-helper extraction for hot-path export code** — pure functions like `hasAudioEnabledVideoLeaf()` and `findSampleForTime()` enable unit testing of complex boolean logic without running the full export pipeline in jsdom.
- **`VITE_ENABLE_EXPORT_METRICS` + `.env.development`** — dev-only `.env.development` file, never loaded by `npm run build`; Vite tree-shakes the entire metrics code path out of production bundles. Use this pattern for any developer diagnostic tool.
- **OfflineAudioContext looped scheduling** — `while(offset < totalDuration) { create AudioBufferSourceNode; start(offset); stop(min(offset+duration, total)); offset += duration }` — standard pattern for looping audio at export time.
- **Sequential decode-then-encode** — decode all video frames into memory, then encode with zero seeking. Any GPU-heavy decode step should be separated from the encode loop and done sequentially to bound peak memory.

### Key Lessons
1. **Sequence technology decisions before designing the pipeline around them.** The Mediabunny migration decision (Phase 14) invalidated the Web Audio mixing approach from Phase 12. Locking in the export transport layer first would have prevented the double implementation.
2. **Late scope drops create ghost artifacts.** When PERS-01..PERS-12 were dropped, the Phase 14 roadmap entry and some AUD-08 references had already been written referencing persistence. A clean scope drop at the start of the milestone (not mid-way through) avoids this drift.
3. **GPU memory at export time is a first-class concern.** Sequential decode was the right call, but it wasn't obvious until the VideoSampleSink API was explored. For future video-heavy phases, treat GPU peak memory as an explicit success criterion, not an afterthought.

### Cost Observations
- Model mix: primarily Sonnet 4.6 (balanced profile)
- Sessions: ~5-6 estimated
- Notable: Phase 13 (overlays) was the most complex — 5 plans across distinct subsystems (data model, rendering, editing UX, emoji/sticker, export). Breaking it into 5 atomic plans kept each plan's test scope manageable.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 23 | Baseline — first milestone |
| v1.1 | 4 | 11 | Audit-driven gap closure introduced (Phase 10); human verification caught a plan-level mistake |
| v1.2 | 6 | 17 | Technology sequencing lesson: Mediabunny migration should have preceded audio pipeline design; drag-to-one-undo pattern established |

### Cumulative Quality

| Milestone | Est. Tests | Zero-Dep Additions |
|-----------|------------|-------------------|
| v1.0 | 60+ passing | Canvas API export, MediaRecorder video export |
| v1.1 | 489 passing (43 files) | `SafeZoneOverlay`, `moveLeafToEdge` primitive, portal-based ActionBar |
| v1.2 | 628 passing (54 files) | Per-cell effects, overlays, Mediabunny pipeline, VideoSampleSink decode-then-encode, Export Metrics Panel |

### Top Lessons (Verified Across Milestones)

1. Prototype risky integrations (export, video) before committing them to phase plans (v1.0)
2. Mobile-first design is easier than desktop-first retrofit (v1.0)
3. **Audit gap-closure plans must read the commit message, not just the diff** (v1.1) — a revert may be deliberate
4. **Portal in viewport space beats scale-compensation math** when a UI element must overflow a transformed container (v1.1)
5. **Human verification is load-bearing even for "all automated checks pass" phases** (v1.1)
6. **Sequence technology decisions before designing the pipeline around them** (v1.2) — Mediabunny migration invalidated the Phase 12 audio mixing approach; decide transport layer first
7. **GPU peak memory is a first-class export success criterion** (v1.2) — sequential decode (one video at a time) was right; make it explicit in phase success criteria

### Recurring Anti-Patterns (Not Yet Fixed)

- **SUMMARY.md one-liner drift** — gsd-tools extracts accomplishments from SUMMARY files but the format is not enforced; noise polluted v1.0, v1.1, and v1.2 milestone entries at archive time
- **ROADMAP progress table drift** — phase completion status in the Progress table is not auto-updated on plan completion; stale rows recurred in v1.0, v1.1, and v1.2
- **Late scope drops create ghost artifacts** (v1.2 new) — PERS-01..PERS-12 dropped mid-milestone left dangling references in roadmap entries and AUD-08 dependency chains; scope changes should be decided at milestone start, not mid-way through
