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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 23 | Baseline — first milestone |

### Cumulative Quality

| Milestone | Est. Tests | Zero-Dep Additions |
|-----------|------------|-------------------|
| v1.0 | 60+ passing | Canvas API export, MediaRecorder video export |

### Top Lessons (Verified Across Milestones)

1. Prototype risky integrations (export, video) before committing them to phase plans
2. Mobile-first design is easier than desktop-first retrofit
