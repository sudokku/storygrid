# Milestones

## v1.3 Filters, Video Tools & Playback (Shipped: 2026-04-14)

**Phases completed:** 5 phases (17–21), 10 plans
**Timeline:** 2026-04-11 → 2026-04-14 (4 days)
**Git range:** `v1.2..HEAD` (98 commits, 156 files changed, +11,012 / −219)

**Key accomplishments:**

1. **hasAudioTrack data model foundation** — required `hasAudioTrack: boolean` on LeafNode with `true` default; undo/redo via `structuredClone` in `pushSnapshot` — no store changes needed; defensive `?? false` reads for display correctness with legacy persisted state
2. **Instagram-aesthetic named presets with live CSS-filter chip previews** — Clarendon, Lark, Juno, Reyes, Moon, Inkwell; each chip applies `effectsToFilterString()` live to bundled `sample.jpg`; toggle-off resets all 7 effect fields to neutral defaults
3. **Auto-mute detection + BFS multi-file drop** — `HTMLVideoElement` + `loadedmetadata` + `AudioTrackList`/`mozHasAudio` for audio detection; `overflowCount` alternation for reliable H/V splits; locked non-interactive VolumeX icon in ActionBar + Sidebar; fail-open with 5s timeout
4. **Dark PlaybackTimeline restyle** — `bg-black/80 backdrop-blur-sm`, white controls, 3px scrubber track, `active:scale-150` thumb animation; zero TypeScript changes (Tailwind-class-only)
5. **Live audio preview via Web Audio API** — `useAudioMix` hook; synchronous `AudioContext` creation in click handler (autoplay-safe); gain-gated `MediaElementAudioSourceNode` reuse prevents `InvalidStateError`; mute toggle reactive during playback

**Deferred:** detectAudioTrack `video.load()` fix (quick task), PERS-01..PERS-12 (still deferred), boomerang/trim/timeline scrub (out of scope for v1.3)

**Archived:** `.planning/milestones/v1.3-ROADMAP.md`, `.planning/milestones/v1.3-phases/`

---

## v1.2 Effects, Overlays & Persistence (Shipped: 2026-04-11)

**Phases completed:** 6 phases (11–16), 17 plans
**Timeline:** 2026-04-09 → 2026-04-11 (3 days)
**Git range:** `v1.1..HEAD` (144 commits, 181 files changed, +28,101 / −1,094)

**Key accomplishments:**

1. **Per-cell visual effects layer** — 6 preset filters (B&W, Sepia, Vivid, Fade, Warm, Cool) + 4 sliders (brightness/contrast/saturation/blur); single-hook `drawLeafToCanvas` path guarantees preview ≡ PNG ≡ MP4 parity with drag-to-one-undo semantics
2. **Per-cell audio toggle with Web Audio mixing** — `audioEnabled` on LeafNode; ActionBar + Sidebar toggle surfaces; full `AudioContext` → `MediaElementAudioSourceNode` → `MediaStreamAudioDestinationNode` graph; AUD-06 zero-audio MP4 skip path
3. **Text/emoji/sticker overlay system** — Global overlay layer with free-position drag, corner-handle resize, rotation; `overlayStore` with 8 actions; `stickerRegistry` side-channel; undo integration; export in PNG and MP4
4. **ffmpeg.wasm eliminated — Mediabunny direct MP4 pipeline** — Removed `@ffmpeg/ffmpeg`; no COOP/COEP headers; Mediabunny CanvasSource + AudioBufferSource + OfflineAudioContext; VP9/AVC codec selection; non-fatal AAC fallback toast
5. **Decode-then-encode via Mediabunny VideoSampleSink** — Replaced frame-by-frame seeking (99.4% of export time) with upfront decode via Mediabunny's higher-level API; sequential decode bounds peak GPU memory; `findSampleForTime()` O(log n) lookup
6. **Export Metrics Panel** — 17-field `ExportMetrics` interface; ref-based 250ms polling; Shift+M toggle; `VITE_ENABLE_EXPORT_METRICS` feature flag for zero production cost

**Deferred to v1.3:** PERS-01..PERS-12 (Project Persistence), AUD-08 (persist audio state) — Phase 14 slot was repurposed for Mediabunny migration.

**Archived:** `.planning/milestones/v1.2-ROADMAP.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`

---

## v1.1 UI Polish & Bug Fixes (Shipped: 2026-04-08)

**Phases completed:** 4 phases (7–10), 11 plans
**Timeline:** 2026-04-07 → 2026-04-08 (2 days)
**Git range:** `f7357a4` → `184ef29` (70 files changed, +10,273 / −171)

**Key accomplishments:**

1. **Cell controls always accessible at any size** — Portal-based ActionBar (`createPortal` to `document.body`) escapes per-cell stacking contexts; fixed 64px (`w-16 h-16`) button targets in viewport space. Phase 10 course-corrected from the v1.1 audit's faulty assumption that clamp() was the right mechanism — the portal architecture eliminates the need for scale compensation entirely.
2. **Safe zone visually obvious** — New `SafeZoneOverlay` component with striped/dimmed unsafe-area display replacing the toggle-only button indicator (Phase 8).
3. **Friction-free template apply** — Templates apply silently; confirmation dialog removed (Phase 8).
4. **Full-workspace drop zone** — Drop accepted anywhere outside navbar/sidebar with clear visual feedback overlay (Phase 8).
5. **Atomic cell MOVE semantics** — `moveLeafToEdge` primitive + `moveCell` store action + 5-zone LeafNode overlay enables edge-insertion alongside the existing center-drop swap; single-undo correctness for n-ary trees; EC-06 empty-cell moves supported (Phase 9).
6. **Sidebar video upload path** — Replace input accepts `video/*` with proper blob-URL + `mediaType='video'` routing matching `autoFillCells`. Closes the v1.1 audit MEDIA-01 sidebar upload-input gap (Phase 10).
7. **LeafNode stacking context fix** — `isolate` removed from LeafNode root; stale `no isolate` comment corrected and reinforced with CELL-01 warning; regression test in `grid-rendering.test.tsx` locks the invariant (Phase 10).
8. **Empty cell empty state scales** — Placeholder icon and label use `clamp()` sizing with `ResizeObserver`-driven label hiding below 80px (Phase 7, CELL-03).

**Course-correction lesson:** The v1.1 audit flagged `1967219` (portal architecture) as a CELL-02 regression because it removed clamp() sizing. Phase 10's first execution attempted to re-land clamp() and produced unusably small buttons at typical viewports. Root cause: **diff-only audits cannot distinguish a regression from a deliberate architectural pivot.** Future gap-closure plans must verify the prior commit's rationale before reverting it.

**Archived:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`, `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.0 MVP (Shipped: 2026-04-07)

**Phases completed:** 8 phases (0–6 + 5.1 INSERTED), 23 plans, 29 tasks
**Timeline:** 2026-03-31 → 2026-04-07 (7 days)
**Codebase:** ~10,683 lines TypeScript/TSX, 216 files changed

**Key accomplishments:**

1. Full-stack Vite 8 + React 18 + TypeScript scaffold with Tailwind v3 PostCSS, Zustand + Immer, Vitest jsdom TDD setup, and three-region editor shell — all 22 baseline tests passing
2. Recursive split-tree engine with 10 pure functions, Zustand gridStore/editorStore with Immer middleware, undo/redo history (50-entry cap, mediaRegistry excluded from snapshots)
3. Grid rendering with draggable pointer-event dividers, React.memo per-node Zustand subscriptions, canvas CSS scale, selection/hover action bar, Safari isolation fix
4. FileReader-based base64 image upload pipeline, auto-fill cells, full ActionBar/Toolbar/Sidebar controls, Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts
5. Canvas API export pipeline replacing html-to-image — pixel-perfect 1080×1920px PNG/JPEG download with progress toast and JPEG quality control
6. Templates, gap/radius/background controls, pan/zoom, cell-swap via dnd-kit, dark theme (#0a0a0a), keyboard shortcuts, first-time onboarding overlay
7. Mobile-first responsive UI (INSERTED phase 5.1): 768px layout swap, bottom sheet with snap states, touch-adapted dividers, pinch-to-zoom in pan mode, mobile welcome card
8. Video cells with canvas rAF preview loop, timeline play/pause/scrub sync, MediaRecorder-based MP4 export (replaced ffmpeg.wasm), COOP/COEP headers for Vercel/Netlify

**Archived:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
