# Stack Research — StoryGrid

**Project:** StoryGrid (client-side Instagram Story collage editor)
**Researched:** 2026-03-31 (v1.0 initial); updated 2026-04-11 (v1.3 addendum)
**Overall confidence:** HIGH for core choices, MEDIUM for export libraries, LOW for video export stability

---

## v1.3 Addendum — New Stack Decisions for v1.3 Features

**Researched:** 2026-04-11
**Confidence:** HIGH

### Summary: No New npm Dependencies Required

All seven v1.3 features are achievable with the existing stack. Zero new npm packages are needed. The work is in browser APIs already available in Chrome 90+/Firefox 90+/Safari 15+, data model extensions, and new UI components.

---

### Feature 1: Instagram-Style Named Presets

**What changes:** Replace the 6 generic presets in `src/lib/effects.ts` with 6 Instagram-named presets. The `effectsToFilterString()` function and `ctx.filter` pipeline in `drawLeafToCanvas()` are unchanged.

**New browser APIs needed:** None. `CanvasRenderingContext2D.filter` already supports `sepia()`, `grayscale()`, and `hue-rotate()` in addition to the existing `brightness()`, `contrast()`, `saturate()`, `blur()`. [HIGH confidence — MDN, already shipping in all target browsers]

**Reference filter values** from picturepan2/instagram.css (open-source, verified from raw CSS):

| Preset Name | CSS filter string |
|-------------|-----------------|
| Clarendon | `sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)` |
| Lark | `sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)` |
| Juno | `sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)` |
| Reyes | `sepia(.75) contrast(.75) brightness(1.25) saturate(1.4)` |
| Moon | `brightness(1.4) contrast(.95) saturate(0) sepia(.35)` |
| Inkwell | `brightness(1.25) contrast(.85) grayscale(1)` |

**Implementation decision:** When `effects.preset !== null`, emit the preset's full filter string directly from `effectsToFilterString()`, bypassing slider decomposition. The 4 custom sliders compose on top (their values still get appended). This avoids needing to add `sepia`, `grayscale`, `hueRotate` as explicit slider fields on `EffectSettings`, while keeping the pipeline single-exit-point.

**Type changes required:**
- Rename `PresetName` union type to new 6 values: `'clarendon' | 'lark' | 'juno' | 'reyes' | 'moon' | 'inkwell'`
- Update `PRESET_VALUES`, `DISPLAY_NAMES` in `effects.ts` and `EffectsPanel.tsx`
- Replace the 6 preset thumbnail PNGs in `src/assets/presets/`
- Update `effects.test.ts` contract — the filter string format for named presets changes

---

### Feature 2: Boomerang Per-Cell

**Data model addition:** `boomerang: boolean` on `LeafNode`, default `false` in `createLeaf()`. New store action `toggleBoomerang(nodeId)`.

**Browser API — negative playbackRate is NOT viable:**
- `playbackRate = -1` is not supported in Chrome or Firefox. Only Safari supports it.
- Chromium bug #46939 has been open since 2009 with no implementation.
- Firefox bug #1468019: "no interest" from Mozilla contributors.
- Do NOT use `playbackRate` for boomerang. [HIGH confidence — verified via Chromium tracker, Mozilla bugzilla, caniuse]

**Required approach: frame buffer reversal via rAF loop.**

Preview path:
1. When `boomerang === true` and the video's rAF loop reaches `video.duration`, switch to drawing from a pre-captured `ImageBitmap[]` frame buffer in reverse order, then forward again in a circular loop.
2. Frames are captured into memory during the first forward pass using `createImageBitmap(video)` at each rAF tick — the same API already used in `videoExport.ts`.
3. The frame buffer lives in a `useRef` in the `LeafNode` component (not in Zustand — mutable, non-serializable).

Export path (Mediabunny):
- `VideoSampleSink.samples(startSecs, endSecs)` supports bounded iteration. For boomerang, collect all frames into an array, then concatenate `frames.slice().reverse()` before the encode loop processes them.
- The existing `buildVideoStreams` / `makeTimestampGen` approach must be extended: for boomerang cells, synthesize a doubled timestamp list (forward then backward).

**No new library needed.** `createImageBitmap()` is already imported in `videoExport.ts`. [HIGH confidence]

---

### Feature 3: Video Trimming Per-Cell

**Data model additions:**
- `trimStart: number` on `LeafNode`, default `0` (seconds)
- `trimEnd: number | null` on `LeafNode`, default `null` (means use `video.duration`)

**Browser APIs:**
- `HTMLVideoElement.currentTime` — set to `trimStart` on play, clamp on `timeupdate`. Universally supported. [HIGH confidence]
- `HTMLVideoElement.duration` — read for max trim bound. Universally supported. [HIGH confidence]
- `VideoSampleSink.samples(startSecs, endSecs)` — Mediabunny bounded frame iteration for export. Confirmed in Mediabunny docs: `sink.samples(300, 305)` iterates frames between 300s and 305s. [MEDIUM confidence — docs retrieved; exact parameter name unverified in TypeScript types]

**UI:** Sidebar mini-timeline with two drag handles, implemented with `<input type="range">` (dual-thumb requires either two overlapping ranges or pointer-event drag handlers on a custom `<div>`). The custom drag handle approach is more reliable for a dual-thumb trim control. No new library.

**Export integration:** In `buildVideoStreams()`, pass `leaf.trimStart` and `leaf.trimEnd ?? effectiveDuration` to bound `VideoSampleSink.samples()` and adjust `makeTimestampGen` accordingly.

**Export duration impact:** The export total duration is the maximum `(trimEnd - trimStart)` across all video cells, not the raw `video.duration`.

---

### Feature 4: Live Audio Preview

**What changes:** During editor playback (`isPlaying = true`), unmuted video cells produce audible output through the browser speakers, mirroring what will be exported.

**Browser APIs:**
- `AudioContext` — already used in `videoExport.ts`. [HIGH confidence]
- `AudioContext.createMediaElementSource(videoEl)` — connects an `HTMLVideoElement` to the live audio graph. Supported in Chrome 90+, Firefox 90+, Safari 15+. [HIGH confidence — MDN]
- Blob URLs are same-origin; CORS restriction on `createMediaElementSource()` does not apply. [HIGH confidence — confirmed: CORS restriction only applies to cross-origin media, not `blob:` URLs]

**One-node-per-element constraint:** Each `HTMLVideoElement` can only be connected to one `MediaElementAudioSourceNode` for its lifetime. Creating a second throws. The live preview context is distinct from the export `OfflineAudioContext` — no conflict because they are different context types and the export runs asynchronously after playback.

**Implementation pattern:**
1. One shared `AudioContext` (lazy singleton, not one per cell) — created on the first play button click to satisfy browser autoplay policy.
2. `AudioContext.resume()` must be called inside the play button click handler (user gesture required).
3. For each video cell with `audioEnabled === true`: call `ctx.createMediaElementSource(videoEl)` and connect to `ctx.destination` (or optionally a `GainNode` for per-cell volume).
4. Store `MediaElementAudioSourceNode` references in a non-Zustand module registry — same pattern as `videoElementRegistry` in `src/lib/videoRegistry.ts`. Call this `audioNodeRegistry`.
5. On `audioEnabled` toggle off: call `.disconnect()` on the node. On toggle back on: reconnect.
6. On unmount / grid clear: `ctx.close()` and clear the registry.

**No new library needed.**

---

### Feature 5: Playback UI Visual Redesign

**Stack additions:** None. Pure Tailwind CSS 3.4 + `lucide-react` icon updates in `PlaybackTimeline.tsx`. The `shadcn` package (already at `^4.1.2`) can supply primitives like `Slider` if desired.

---

### Feature 6: Auto-Mute Lock for No-Audio Videos

**Data model addition:** `hasAudioTrack: boolean` on `LeafNode`, default `true` for images, set at upload time for videos. When `false`, force `audioEnabled = false` and lock the UI toggle (grayed-out `VolumeX`, not interactive).

**Browser API selection:**

| API | Chrome 90+ | Firefox 90+ | Safari 15+ | Verdict |
|-----|-----------|-------------|------------|---------|
| `HTMLMediaElement.audioTracks` | Behind flag only | Behind flag only | YES (native) | DO NOT USE |
| `AudioContext.decodeAudioData()` | YES | YES | YES | USE THIS |
| `video.mozHasAudio` | NO | Deprecated | NO | DO NOT USE |
| `captureStream().getAudioTracks()` | YES | YES | NO | Do not use |

**Recommended approach:** After upload, fetch the blob URL, call `AudioContext.decodeAudioData(arrayBuffer)`, check `audioBuffer.numberOfChannels > 0`. This is identical to the existing pattern in `mixAudioForExport()` — reuse the same logic. A temporary `AudioContext` is created, used, and closed immediately (same one-shot pattern already in the codebase).

`HTMLMediaElement.audioTracks` is explicitly NOT usable: it requires experimental flags in Chrome and Firefox as of 2025 (confirmed via caniuse). [HIGH confidence]

---

### Feature 7: Breadth-First Multi-File Drop

**Stack addition:** None. Pure tree logic change in `src/lib/tree.ts`. No new browser API, no new library.

---

### New LeafNode Fields Summary

All additions require default values in `createLeaf()`.

| Field | Type | Default | Feature |
|-------|------|---------|---------|
| `boomerang` | `boolean` | `false` | Boomerang per-cell |
| `trimStart` | `number` | `0` | Video trimming |
| `trimEnd` | `number \| null` | `null` | Video trimming |
| `hasAudioTrack` | `boolean` | `true` | Auto-mute detection |

---

### New Module-Level Registry Additions

| Registry | Module | Pattern |
|----------|--------|---------|
| `audioNodeRegistry: Map<string, MediaElementAudioSourceNode>` | `src/lib/videoRegistry.ts` | Same pattern as `videoElementRegistry` |
| `liveAudioContext: AudioContext \| null` | `src/lib/videoRegistry.ts` | Lazy singleton |

---

### What NOT to Add (v1.3)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any LUT library (`caman.js`, `lut.js`, etc.) | Overkill; CSS filter strings are sufficient for named presets | `CanvasRenderingContext2D.filter` via `effectsToFilterString()` |
| `HTMLMediaElement.audioTracks` for audio detection | Behind experimental flags in Chrome and Firefox as of 2025 | `AudioContext.decodeAudioData()` — already in codebase |
| `playbackRate = -1` for boomerang | Not supported in Chrome or Firefox; undefined behavior | Frame buffer array reversal via `createImageBitmap()` rAF loop |
| Separate `AudioContext` per cell for live preview | Each `HTMLVideoElement` connects to one node only; context proliferation wastes resources | One shared `AudioContext` + per-cell `MediaElementAudioSourceNode` |
| Any video editing library (fluent-ffmpeg, whammy, etc.) | Mediabunny already handles all encode/decode | Mediabunny `VideoSampleSink.samples(start, end)` for trim |
| `MediaRecorder` for boomerang recording | Mediabunny pipeline owns export; adding MediaRecorder creates a parallel path | Extend existing `buildVideoStreams` encode loop with frame reversal |

---

### v1.3 Sources

- picturepan2/instagram.css (raw): https://raw.githubusercontent.com/picturepan2/instagram.css/master/dist/instagram.min.css — filter values for Clarendon, Lark, Juno, Reyes, Moon, Inkwell [HIGH confidence]
- MDN — CanvasRenderingContext2D.filter: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter [HIGH confidence]
- caniuse — HTMLMediaElement.audioTracks: https://caniuse.com/mdn-api_htmlmediaelement_audiotracks — behind flags in Chrome/Firefox [HIGH confidence]
- MDN — AudioContext.createMediaElementSource: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource [HIGH confidence]
- Mediabunny docs — VideoSampleSink: https://mediabunny.dev/guide/reading-media-files — `samples(startSecs, endSecs)` bounded iteration confirmed [MEDIUM confidence]
- Paul Kinlan — Boomerang (frame buffer approach): https://paul.kinlan.me/simple-boomerang-video/ [HIGH confidence]
- Chromium bug #46939 — negative playbackRate unsupported: https://bugs.chromium.org/p/chromium/issues/detail?id=46939 [HIGH confidence]
- Mozilla bug #1468019 — negative playbackRate, no plans: https://bugzilla.mozilla.org/show_bug.cgi?id=1468019 [HIGH confidence]

---

## Original v1.0 Stack Research (Preserved for Reference)

**Researched:** 2026-03-31

### Recommended Stack

| Layer | Library | Recommended Version | Confidence | Notes |
|-------|---------|---------------------|------------|-------|
| Build tool | Vite | ^8.0.2 | HIGH | Current stable; Rolldown-powered |
| React plugin | @vitejs/plugin-react | ^6.0.0 | HIGH | Ships with Vite 8; Babel → Oxc |
| UI framework | React | ^18.3.x | HIGH | Pin to 18 — see rationale |
| Language | TypeScript | ^5.8.x | HIGH | Current; no blockers |
| State | Zustand | ^5.0.12 | HIGH | Current stable; React 18-native |
| Immutable updates | Immer (via zustand/middleware/immer) | ^10.1.x | HIGH | Bundled via zustand; install separately |
| Styling | Tailwind CSS | **v3.4.x** | HIGH | Pin v3 — see rationale |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities | ^6.3.1 | MEDIUM | Stable API but slow maintenance |
| DOM-to-image (MVP export) | html-to-image | ^1.11.13 | MEDIUM | Stale but ~3M weekly downloads; no active drop-in replacement |
| Icons | lucide-react | ^1.7.0 | HIGH | Current; React 18 + 19 compatible |
| ID generation | nanoid | ^5.1.7 | HIGH | Current; ESM-only at v5 |
| Video export (v1 only) | @ffmpeg/ffmpeg + @ffmpeg/util | ^0.12.15 | MEDIUM | Last release ~1 year ago; no successor yet |
| Video export core | @ffmpeg/core (or @ffmpeg/core-mt) | ^0.12.x | MEDIUM | Load from CDN at runtime — not bundled |

---

### Rationale and Gotchas

### Vite 8

**Why:** Vite 8 (released March 12, 2026) is the current stable version. It replaces the dual esbuild/Rollup architecture with Rolldown, a Rust-based bundler delivering 10–30x faster builds. The `@vitejs/plugin-react` v6 replaces Babel with Oxc for React Refresh, reducing install size further. Both `.wasm?init` SSR fixes and TypeScript path alias support are built in — both relevant for this project.

**Gotchas:**
- `@vitejs/plugin-react` v5 still works with Vite 8 if a gradual migration is needed, but start fresh with v6.
- The Rolldown bundler is architecturally new; if obscure Rollup plugin edge cases arise, the workaround is to swap to the `rolldown-vite` compatibility layer first (documented in Vite 8 migration guide).
- ffmpeg.wasm WASM loading (`.wasm?url` or CDN) works correctly with Vite 8's improved WASM handling.

**Alternatives considered:** Vite 6 / Vite 7 — both still receive security patches but are not recommended for new projects started in 2026. Webpack is not worth the DX regression.

---

### React 18 (pin to 18, do not use 19)

**Why:** React 19 is the current stable release, but the PROJECT.md explicitly constrains `@dnd-kit/core` and `html-to-image` — neither of which has verified React 19 peer dependency support. More importantly, `lucide-react-native` (not relevant here, but indicative of ecosystem lag) and some UI helper libraries still declare `react@^18` as a peer. React 18 is fully supported, actively maintained, and introduces zero risk for a new project in this domain. The gains of React 19 (Server Components, Actions, automatic compiler) are irrelevant for a 100% client-side SPA with no RSC.

**Gotchas:**
- React 19 peer dependency errors will surface during `npm install` if any library in the tree declares `react@"^16 || ^17 || ^18"`. Pin React 18 to avoid this class of problem entirely.
- The React 19 compiler's automatic memoization is not a substitute for the explicit `React.memo` strategy required for the recursive GridNode tree. Do not depend on a compiler to fix re-render hot paths.

**Alternatives considered:** React 19 — not recommended yet; ecosystem compatibility risk outweighs marginal gains for this app type.

---

### TypeScript 5.8

**Why:** Current stable version. No breaking changes that affect this project. Enables all modern type narrowing patterns needed for the discriminated union `GridNode` tree type.

**Gotchas:** Some older eslint plugins may not yet parse TS 5.8 syntax. Pin `typescript@~5.8` (minor-pinned) rather than `^5` to avoid unexpected type-check behavior upgrades mid-development.

---

### Zustand 5.0.x

**Why:** Zustand 5 is the current major version. It drops React < 18 support (which aligns perfectly with this project), removes the `use-sync-external-store` package dependency, and simplifies TypeScript types. The immer middleware (`zustand/middleware/immer`) is bundled — no separate import path change required vs v4.

**Gotchas:**
- Zustand v5 removed the `create` API's custom equality function parameter. If `shallow` comparison is needed on derived selectors, use `useShallow` from `zustand/react/shallow` — not a custom equality function passed to `create`.
- TypeScript regression noted in v5.0.9: middleware types broken in some configurations (Discussion #3331). Pin to `^5.0.12` which includes the fix.
- The `persist` middleware behavior changed: initial state is no longer stored during store creation. This matters for the Phase 7 save/load feature — test persist middleware behavior explicitly.

**Alternatives considered:** Jotai (atom-based, excellent for tree node selection but higher boilerplate for history/undo), Valtio (proxy-based, problematic with serialization/undo). Zustand + Immer is the right pairing for a deeply nested mutable tree with undo history.

---

### Immer 10.x (via zustand/middleware/immer)

**Why:** Immer is a peer dependency of the Zustand immer middleware — install it separately (`npm install immer`). v10 is current stable. The `immer` middleware wrapper enables direct draft mutation on deeply nested GridNode trees without manual spreading.

**Gotchas:**
- Immer must be installed as a direct dependency even though the middleware is inside the zustand package. Omitting it causes a "Cannot find module 'immer'" runtime error.
- For the undo/redo history array, store plain serializable snapshots (not Immer drafts). Snapshots should be taken of the committed state, not inside a produce call.
- Do not use `enableMapSet()` unless Map or Set types appear in the store — it adds bundle weight unnecessarily.

**Alternatives considered:** `zustand-mutative` (uses Mutative instead of Immer, ~10x faster according to benchmarks). Worth reconsidering if profiling shows Immer as a bottleneck, but premature for MVP.

---

### Tailwind CSS v3.4.x (PIN TO v3 — do not use v4)

**Why (pin to v3):** Tailwind CSS v4 was released in 2025 and is actively developed, but it is a breaking change in several ways that directly conflict with this project:

1. **Config model change:** v4 moves all configuration to CSS `@theme` directives — no `tailwind.config.js`. The PROJECT.md specifies "Tailwind configured with canvas dimensions and safe zone as CSS variables" — this is straightforward in v3. In v4 it requires relearning the config model.
2. **Browser requirement:** Tailwind v4 requires Safari 16.4+, Chrome 111+, Firefox 128+. The project targets Safari 15+. v4 is incompatible with Safari 15.
3. **Removed utilities:** `bg-opacity-*`, `text-opacity-*`, container config options, and other v3 utilities are gone. Using v3 means zero migration tax.
4. **Ecosystem stability:** As of early 2026, many Tailwind component libraries and references still target v3. Developer productivity is higher on the known API.

**Use v3.4.x** (latest stable 3.x) — it receives security patches and will for the foreseeable future.

**Gotchas:**
- Install `tailwindcss@^3.4`, `postcss`, and `autoprefixer` explicitly.
- Vite 8 with Tailwind v3 requires the standard PostCSS plugin setup (`postcss.config.js`) — no special integration issues.
- CSS variables for canvas dimensions and safe zones (`--canvas-width`, `--safe-zone-top`) should be defined in the Tailwind config's `extend.spacing` / `extend.height` sections or directly in a global CSS `:root {}` block and referenced via Tailwind's `arbitrary value` syntax (`h-[var(--canvas-height)]`).

**Alternatives considered:** Tailwind v4 — defer until Safari 15 is out of scope and ecosystem matures. Plain CSS modules — unnecessary complexity for a UI-heavy app.

---

### @dnd-kit/core + @dnd-kit/sortable (6.3.1)

**Why:** For StoryGrid, drag-and-drop is used specifically for dragging image files onto cells (not for reordering cells — cells are split/merged, not sorted). `@dnd-kit/core` handles pointer-event-based file drag detection with custom sensors. It is the best-designed DnD library for pointer-event use cases.

**Maintenance caveat:** @dnd-kit/core's last release was ~1 year ago (v6.3.1). There is an active GitHub discussion (Issue #1830) about maintenance status. A new `@dnd-kit/react` adapter (v0.3.x) is in development but is explicitly not production-ready. Use `@dnd-kit/core` v6.3.1 — it is stable and will not receive breaking changes.

**Gotchas:**
- Performance issue (Issue #389): in large sortable lists, every item re-renders on drag. This project has at most ~20 cells in a grid, so this is irrelevant.
- Do NOT migrate to `@dnd-kit/react` for this project — it is in alpha/beta, has breaking API changes in progress, and adds migration risk without benefit.
- For file-drop-onto-cell, the native HTML5 drag API (`onDragOver` + `onDrop` on each Leaf component) may be simpler and more reliable than @dnd-kit for this specific use case. @dnd-kit handles drag-between-cells for media reordering; native drag events handle file-from-desktop drops.

**Alternatives considered:** `react-dnd` — pointer event support is worse, more boilerplate. `pragmatic-drag-and-drop` (Atlassian) — newer, actively maintained, but less community documentation for React-specific use cases. @dnd-kit remains the best documented choice for this use case.

---

### html-to-image 1.11.13

**Why:** The only actively used client-side DOM-to-image library that correctly handles modern CSS (flexbox, CSS variables, `object-fit`, custom fonts). `html2canvas` cannot handle CSS `transform: scale()` or `object-fit: cover` reliably, making it unusable for the scaled canvas preview render. `dom-to-image` is deprecated.

**Maintenance concern:** Last publish was ~1 year ago. No releases since. The library has ~3M weekly downloads suggesting it is stable-in-use rather than actively evolved. The GitHub repository (bubkoo/html-to-image) is not archived.

**Alternative worth watching:** `modern-screenshot` (v4.6.8, published 2 months ago, 575K weekly downloads) — actively maintained fork-of-a-fork with better CSS support. It is a valid drop-in alternative if `html-to-image` proves problematic. API is nearly identical (`domToCanvas`, `domToPng`, etc.).

**Gotchas (critical):**

1. **CORS / canvas taint:** Any `<img>` whose `src` is a user-provided object URL (via `URL.createObjectURL()`) is same-origin and will NOT cause CORS issues. However, if any image is loaded from an external URL (e.g., a CDN), the canvas will be tainted and `toPng()` will throw. Mitigation: always use object URLs from `File` objects — never raw external URLs.

2. **Chrome cache/CORS race:** If images are loaded without `crossOrigin="anonymous"` initially and then re-requested with it, Chrome returns a cached response without CORS headers and the export fails. Mitigation: always set `crossOrigin="anonymous"` on all `<img>` elements from the initial render, even for object URLs (it's a no-op for same-origin but prevents cache race conditions).

3. **Off-screen render div must be in DOM:** `html-to-image` requires the target element to be attached to the document. The hidden full-res 1080×1920 div (the dual-render export element) must be in the DOM with `position: absolute; left: -9999px; visibility: hidden` — not `display: none` (which breaks layout).

4. **CSS custom properties on the export div:** The export div must have all CSS variables defined in its scope or on `:root`. If canvas dimensions are CSS variables, verify they resolve correctly on the export div (they will if defined on `:root`).

5. **`requestAnimationFrame` before capture:** Call `toPng()` inside a `requestAnimationFrame` callback after triggering the off-screen render to ensure all layout/paint has settled.

6. **Font embedding:** Fonts from Google Fonts or other external sources will fail to embed unless served with CORS headers. Mitigation: self-host any fonts used in the canvas (Inter, system-ui, etc.) or use only system fonts in the export div.

---

### lucide-react 1.7.0

**Why:** Current stable (v1.7.0, published ~1 day ago as of research date). Tree-shakeable by default — only imported icons are bundled. Compatible with React 18 and 19. Comprehensive icon set covering all UI actions needed (split, merge, download, eye, etc.).

**Gotchas:** At v0.x this library had breaking icon renames every few releases. Since reaching v1.x the API is stable. No known issues.

**Alternatives considered:** `heroicons/react`, `react-icons` — both valid. `lucide-react` has better TypeScript types and the cleanest import API.

---

### nanoid 5.1.7

**Why:** Current stable (v5.1.7). Tiny, secure, URL-safe IDs for GridNode `id` fields. No external dependencies.

**Gotchas:**
- nanoid v5 is **ESM-only**. If any tooling in the project is CommonJS (Jest with CJS config, for example), importing nanoid will fail. Mitigation: use Vite's native ESM test runner (Vitest) — no CJS issue. Do not use Jest with CJS config.
- For Node.js scripts (e.g., config generation), use `import { nanoid } from 'nanoid'` in ESM context or use the `customAlphabet` export with a CJS-compatible alternative if truly needed.

**Alternatives considered:** `uuid` — larger bundle, less ergonomic API. `crypto.randomUUID()` — available in modern browsers but returns hyphenated UUID format; nanoid is more compact.

---

### @ffmpeg/ffmpeg 0.12.15 + @ffmpeg/util + @ffmpeg/core (CDN only)

**Why:** The only practical in-browser FFmpeg solution for MP4 encoding. Used exclusively for Phase 6 (video export). Must be lazy-loaded — the WASM core is ~25MB.

**Critical constraints:**

1. **SharedArrayBuffer requirement:** @ffmpeg/ffmpeg v0.12.x uses SharedArrayBuffer, which is only available in cross-origin isolated contexts. You MUST serve the app with:
   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```
   These headers must be set in Vercel/Netlify config (the PROJECT.md already flags this for Phase 6). These headers are NOT needed for the MVP (no video).

2. **Single-threaded vs multi-threaded core:**
   - `@ffmpeg/core` — single-threaded, compatible with all target browsers, no additional header requirements beyond the two above. Use this for MVP video support.
   - `@ffmpeg/core-mt` — multi-threaded, faster encoding, but requires SharedArrayBuffer AND Worker support. Use only as an opt-in performance upgrade once single-threaded is validated.

3. **Do NOT bundle the WASM core:** Load `@ffmpeg/core` from jsDelivr CDN at runtime:
   ```
   https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.x/dist/esm
   ```
   Bundle only `@ffmpeg/ffmpeg` and `@ffmpeg/util` — these are small JS wrappers.

4. **Safari video export is explicitly out of scope** (PROJECT.md) — SharedArrayBuffer support in Safari is unreliable even with COOP/COEP headers in cross-origin contexts.

5. **Maintenance status:** v0.12.15 was the last release, published ~1 year ago. The maintainer has not indicated end-of-life, but activity is low. No viable drop-in alternative exists for in-browser MP4 encoding. This is an accepted risk for Phase 6.

**Alternatives considered:** `wasm-vp9`, MediaRecorder API — MediaRecorder cannot capture a static layout at full resolution; it only records what's playing in the viewport. Not suitable for 1080×1920 export.

---

## Version Pinning Recommendations

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.12",
    "immer": "^10.1.1",
    "lucide-react": "^1.7.0",
    "nanoid": "^5.1.7",
    "html-to-image": "^1.11.13",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "vite": "^8.0.2",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~5.8.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

**Lazy-loaded at runtime (Phase 6 only — do not bundle):**
```
@ffmpeg/ffmpeg@^0.12.15
@ffmpeg/util@^0.12.1
```
Load `@ffmpeg/core` from CDN, not npm.

### Key pinning rationale

| Package | Pin style | Reason |
|---------|-----------|--------|
| `typescript` | `~5.8.0` (minor-pinned) | Avoid unexpected type-check changes in patch |
| `tailwindcss` | `^3.4.0` | Stay on v3 branch; ^ is safe within major |
| `react` | `^18.3.1` | Explicitly stay on 18; do not allow 19 upgrade |
| `vite` | `^8.0.2` | Current major; patch updates are safe |
| `html-to-image` | `^1.11.13` | Low maintenance; ^ is safe since no new releases expected |
| `@dnd-kit/core` | `^6.3.1` | Stable; no breaking changes expected on 6.x |

---

## What NOT to Use

| Library | Why Not |
|---------|---------|
| Tailwind CSS v4 | Requires Safari 16.4+ (project targets 15+); CSS-first config is a breaking change; ecosystem still maturing |
| React 19 | Peer dependency compatibility risk with dnd-kit and html-to-image; Server Components / Actions provide zero value for this app |
| dom-to-image | Deprecated, unmaintained, replaced by html-to-image |
| html2canvas | Cannot handle `object-fit: cover`, `CSS transform`, or CSS custom properties reliably — will produce incorrect exports |
| react-dnd | Worse pointer event support than @dnd-kit; more boilerplate |
| @dnd-kit/react (new adapter) | Alpha/beta, not production-ready, breaking API changes in flight |
| Vite 6 / Vite 7 | Older; start new projects on v8 |
| @ffmpeg/core-mt (multi-threaded) | Requires deeper SharedArrayBuffer/Worker browser support; use single-threaded @ffmpeg/core first |
| webpack / CRA | No DX benefit over Vite; larger config overhead |

---

## Open Questions

- **html-to-image vs modern-screenshot:** If html-to-image produces rendering artifacts in Phase 4 testing (e.g., CSS blur filters, border-radius clipping at export), swap to `modern-screenshot@^4.6.8` as a direct API-compatible replacement. This should be validated in Phase 4 before declaring the export engine stable.
- **@dnd-kit/react timeline:** Monitor GitHub Discussion #1842 for production-readiness announcement. If @dnd-kit/react reaches stable before Phase 3 is built, evaluate migration. Otherwise stick to @dnd-kit/core v6.
- **Vite 8 Rolldown edge cases:** Rolldown is architecturally new. If any dependency produces unusual bundling behavior (especially @ffmpeg WASM), check the Vite 8 migration docs and rolldown-vite compatibility layer.

---

## Sources

- Vite 8 release: https://vite.dev/blog/announcing-vite8
- Zustand v5 announcement: https://pmnd.rs/blog/announcing-zustand-v5
- Zustand v5 migration guide: https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5
- Tailwind v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- html-to-image GitHub: https://github.com/bubkoo/html-to-image
- modern-screenshot npm: https://www.npmjs.com/package/modern-screenshot
- @dnd-kit maintenance discussion: https://github.com/clauderic/dnd-kit/issues/1830
- @dnd-kit roadmap discussion: https://github.com/clauderic/dnd-kit/discussions/1842
- @ffmpeg/ffmpeg npm: https://www.npmjs.com/package/@ffmpeg/ffmpeg
- nanoid npm: https://www.npmjs.com/package/nanoid
- lucide-react React 19 issue: https://github.com/lucide-icons/lucide/issues/2951
- html-to-image CORS issue: https://github.com/bubkoo/html-to-image/issues/40
- Best HTML-to-canvas solutions 2025: https://portalzine.de/best-html-to-canvas-solutions-in-2025/
