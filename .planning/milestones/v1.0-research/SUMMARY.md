# Research Summary — StoryGrid

**Project:** StoryGrid
**Domain:** Client-side Instagram Story photo/video collage editor (browser-only, zero backend)
**Researched:** 2026-03-31
**Confidence:** HIGH (stack pre-decided; architecture patterns verified against official docs; feature landscape cross-referenced against 10+ competing tools)

---

## Executive Summary

StoryGrid is a recursive split-tree collage editor targeting the 1080×1920px Instagram Story format. The product differentiator is freeform Figma-style cell splitting — no competitor in the consumer Story space offers this. The recommended build approach is a dual-render DOM architecture: a `transform: scale()` preview canvas for editing alongside a hidden full-resolution 1080×1920px div that `html-to-image` captures at export time. State is managed by Zustand + Immer with separate stores for grid tree (undo-tracked) and editor UI (not undo-tracked). The recursive component tree mirrors the data tree, with every node memoized for surgical re-renders.

The single most important architectural constraint is media handling: all user-uploaded images must be converted to base64 data URIs at upload time, not stored as blob URLs. This one decision prevents three distinct production failures simultaneously — blank exports on first call, CORS canvas tainting, and Safari-specific blank PNG bugs. The second most important constraint is keeping the media registry (data URIs) out of the undo history array; without this separation, a 50-step undo history with 8 cells of imagery consumes ~200MB of JS heap.

The project brief's phase structure is sound but has one material gap: per-cell pan/zoom (currently in Phase 7) should be promoted to Phase 5. Competitor research confirms that drag-to-reposition within a cell is a table-stakes expectation — without it, photos with off-center subjects will look broken to users the moment they upload their first image. The brief is otherwise well-prioritized. Video (Phase 6) and advanced effects (Phase 7) are correctly deferred.

---

## Key Findings

### Stack (Key Decisions)

The full stack is pre-decided in PROJECT.md. Research confirms all choices are correct and identifies specific version pins and constraints that must be respected.

**Core technologies:**
- **Vite ^8.0.2** — build tool; Rolldown-powered, handles WASM loading correctly for Phase 6; use `@vitejs/plugin-react` v6 (Oxc-based, not Babel)
- **React ^18.3.1** — pin to 18, do not allow upgrade to 19; dnd-kit and html-to-image have unverified React 19 peer dependency support
- **TypeScript ~5.8.0** — minor-pinned to avoid mid-project type-check behavior changes
- **Zustand ^5.0.12** — pin to 5.0.12+ specifically; 5.0.9 has a middleware TypeScript regression
- **Immer ^10.1.x** — must be installed as a direct dependency even though the middleware lives inside the zustand package
- **Tailwind CSS ^3.4.x** — pin to v3; v4 requires Safari 16.4+ (project targets 15+) and uses a breaking CSS-first config model
- **html-to-image ^1.11.13** — only viable DOM-to-image library for this use case; `html2canvas` cannot handle `object-fit: cover` or `CSS transform`; `modern-screenshot` is a viable fallback if html-to-image produces rendering artifacts
- **@dnd-kit/core ^6.3.1** — stable; the new `@dnd-kit/react` adapter is alpha/beta, do not use
- **nanoid ^5.1.7** — ESM-only at v5; requires Vitest (not CJS Jest)
- **@ffmpeg/ffmpeg ^0.12.15** — Phase 6 only; lazy-load, never bundle the WASM core; load `@ffmpeg/core` from jsDelivr CDN at runtime

**What not to use:** Tailwind v4, React 19, html2canvas, dom-to-image, `@dnd-kit/react` (alpha), `@ffmpeg/core-mt` (needs deeper SharedArrayBuffer support), CRA/webpack.

See `.planning/research/STACK.md` for full version pinning JSON and detailed rationale.

---

### Features (What Users Expect)

**Table stakes — must be in MVP (Phases 0–5):**
- Fixed 9:16 canvas (1080×1920) with safe zone guides (on by default)
- Click-to-upload and drag-to-drop images onto cells
- Fit vs. fill toggle per cell (`object-fit: cover / contain`)
- Global gap/spacing slider and border radius slider
- Preset layout templates as the entry point for new users
- Undo/redo (Ctrl+Z is a reflex action; tested by Instagram themselves)
- Background color for canvas (visible through gaps)
- Export to PNG at full 1080×1920 resolution
- Export progress indicator (exports take 1–4s; users click again without it)
- **Pan/zoom within cell — promoted from Phase 7** (see Roadmap Adjustments below)

**Differentiators — the reasons to choose StoryGrid over competitors:**
- Recursive arbitrary-depth splitting (no competitor consumer tool offers this)
- Resizable dividers via drag (exact proportion control)
- Zero accounts, zero watermarks, no paywall — make this prominent in any landing copy
- Keyboard shortcuts for all actions (professional tools have this; Story web tools do not)
- Save/load as portable JSON (no web-based Story tool currently offers this)

**Should add to Phase 5 — low complexity, high user value:**
- Swap images between cells by dragging (PicCollage, BeFunky, Fotor all have this; @dnd-kit infrastructure is already in place; not in current brief)

**Defer without regret:**
- Video cells + export (Phase 6) — correct deferral; high browser compatibility surface
- Per-cell CSS filters (Phase 7) — nice-to-have post-MVP
- Multi-slide stories (Phase 7) — correct deferral; most users are single-frame

**Anti-features — do not build:**
- AI layout suggestions, sticker/emoji overlays, direct Instagram publish API, cloud storage, real-time collaboration, AI background removal, animated GIF export

**JSON schema note:** The tree data shape for Phase 1 must be designed with Phase 7 save/load in mind from day one. `File` objects and blob URLs cannot be serialized to JSON — the `mediaId` → `dataUri` registry pattern handles this correctly.

See `.planning/research/FEATURES.md` for full feature table with complexity and brief-alignment status.

---

### Architecture (How to Build It)

The component hierarchy mirrors the data tree. Two `<GridNode root>` instances share the same Zustand store: one inside a `transform: scale()` preview wrapper for editing, one in a `position: absolute; left: -9999px` export surface at native 1080×1920px resolution. This dual-render approach avoids the complexity of a manual canvas drawing fallback while producing pixel-perfect exports.

**Major components:**
1. **GridNode** — thin type dispatcher; renders `ContainerNode` or `LeafNode` based on node type; must be `React.memo`
2. **ContainerNode** — `display: flex` with weighted `flex` sizing via `sizes: number[]` array; renders `Divider` between siblings; must be `React.memo` with shallow `childrenIds` comparison
3. **LeafNode** — media display (`object-fit`), empty state, hover actions; must be `React.memo` comparing `mediaUrl + isSelected + fitMode`
4. **Divider** — pointer events drag handler; buffers delta in `useRef`, dispatches `resizeSiblings` on `pointerup` (or rAF-throttled); uses `setPointerCapture` for capture on fast drags
5. **CanvasWrapper** — applies `transform: scale()` fitted to viewport; `will-change: transform` promotes to compositing layer
6. **ExportSurface** — always mounted, `visibility: hidden`; targeted by `html-to-image.toPng()`; must never inherit the preview's scale transform
7. **gridStore** — Zustand + Immer; owns tree + undo/redo history; snapshots use `structuredClone`, capped at 50 entries; stores `mediaId` references, not data URIs
8. **editorStore** — Zustand; owns `selectedNodeId`, `zoom`, `showSafeZone`, `tool`, `isExporting`; no undo history

**Key patterns:**
- Every node subscribes to its own slice only (`useGridStore(s => findNode(s.root, nodeId))`), never the whole tree
- All mutations via Zustand actions directly from event handlers; no drilled callbacks (prevents stale closure corruption)
- Pure tree functions (`splitNodePure`, `removeNodePure`, etc.) are side-effect free and return new values; Zustand action handler applies to Immer draft
- Node keys always by ID, never array index

See `.planning/research/ARCHITECTURE.md` for full component code patterns, memoization strategy, and build order dependencies.

---

### Critical Pitfalls (Must-Read Before Building)

1. **html-to-image blank PNG on first call** — The library races resource fetching against SVG serialization. Images stored as blob URLs are particularly vulnerable. Prevention: convert all images to base64 data URIs at upload time; call `toPng()` twice and discard the first result; cache `getFontEmbedCSS()` at app load. Applies: Phase 3 (upload) and Phase 4 (export).

2. **Media stored in undo history snapshots = 200MB heap** — Every history snapshot is a `structuredClone` of the full tree. If base64 image data is in the tree, each 8-cell canvas with ~500KB images per cell produces ~4MB snapshots, hitting ~200MB at 50 steps. Prevention: store only a `mediaId` string in tree nodes; keep `mediaRegistry: Record<id, dataUri>` in a separate store slice excluded from undo history. Design this in Phase 1 — retrofitting is painful. Applies: Phase 1 (store design).

3. **Video elements always render blank in html-to-image** — The SVG serialization path cannot capture `<video>` frames. Prevention: never call `toPng()` on a container with live `<video>` children; Phase 6 video export must use the ffmpeg.wasm `xstack` path exclusively; branch the export function on whether any cells contain video. Applies: Phase 4 (confirm image-only) and Phase 6 (ffmpeg-only).

4. **ffmpeg.wasm COOP/COEP headers break third-party resources in MVP** — `SharedArrayBuffer` requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp/credentialless`. COEP blocks any sub-resource (Google Fonts, external CDN images, analytics) that does not serve `CORP` headers. Prevention: do NOT add COOP/COEP headers until Phase 6; use `credentialless` mode (not `require-corp`) when enabling; self-host all fonts before Phase 6; lazy-load the 25MB WASM behind user interaction. Applies: Phase 6 only.

5. **Safari `overflow: hidden` + `border-radius` breaks with CSS transforms** — Safari does not clip children when a transform is on a descendant, causing cell images to overflow their borders visually. Prevention: add `isolation: isolate` to every LeafNode container that combines `overflow: hidden` with `border-radius`. Also: the export div must use `position: absolute; left: -9999px` (not `transform: translateX`) and must never inherit the preview's `scale()` transform. Applies: Phase 2 (rendering) and Phase 4 (export surface).

6. **@dnd-kit DndContext re-renders entire tree on every pointer move** — `DndContext` context value change triggers re-renders on all consumers regardless of `React.memo`. Prevention: dividers use raw pointer events only (completely bypasses dnd-kit); `DndContext` scope is kept as narrow as possible (wrapping only active drop zones, not the full canvas). Applies: Phase 2 and Phase 3.

See `.planning/research/PITFALLS.md` for full pitfall list including moderate and minor issues.

---

## Roadmap Adjustments Recommended

### Adjustment 1: Promote pan/zoom from Phase 7 to Phase 5

**Brief:** Phase 7 includes "Cell zoom & pan: drag to reposition, scroll to scale within cell."
**Finding:** Every grid collage tool reviewed (TurboCollage, BeFunky, Canva, PhotoJoiner) treats drag-to-reposition as table stakes. Without it, uploaded portrait photos in landscape cells — or vice versa — will have the subject cropped to a corner. Users encounter this on their first upload.

**Recommendation:** Move core pan/zoom (drag to update `object-position`, scroll to adjust scale) to Phase 5 or treat as a late Phase 3 addition. The full UX convention is: click a selected cell again to enter pan mode; drag to reposition; Escape or click outside to exit.

---

### Adjustment 2: Add cell-swap-by-drag to Phase 5

**Brief:** Not mentioned.
**Finding:** BeFunky, PicCollage, Fotor, and others support dragging a filled image from one cell to another to swap. Users discover it by trying it. The @dnd-kit infrastructure is already in place.

**Recommendation:** Add "swap cells by dragging" as a Phase 5 addition. Low implementation effort given existing DnD infrastructure; high user value.

---

### Adjustment 3: Design mediaId registry in Phase 1, not Phase 7

**Brief:** Save/load is Phase 7. No mention of registry pattern in Phase 1.
**Finding:** The undo history memory explosion (Pitfall 8) and JSON serialization requirement for save/load (Pitfall 7 note) both demand that `MediaItem` in the tree stores a `mediaId` string, not a data URI. The actual URI lives in a separate registry outside undo history.

**Recommendation:** Introduce the `mediaId` / `mediaRegistry` split in Phase 1 type definitions and store design, even though save/load ships in Phase 7. The tree JSON schema must be clean from the first commit.

---

### Phase Structure Assessment

The original 8-phase structure (0–7) is well-ordered with one exception (pan/zoom placement). Dependencies research confirms the ordering:

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Scaffolding | Correct | Standard patterns; no research needed |
| Phase 1 — Grid Tree Engine | Correct + needs amendment | Add mediaId/registry split to type design |
| Phase 2 — Grid Rendering | Correct | Add `isolation: isolate` Safari fix, Divider pointer capture |
| Phase 3 — Media Upload | Correct | Must convert to data URI at upload; never store blob URLs |
| Phase 4 — Export Engine | Correct | Double-call toPng; pre-convert images; export surface isolation |
| Phase 5 — Polish & UX | Correct + additions | Add pan/zoom (from Phase 7) + cell swap (new) |
| Phase 6 — Video Support | Correct | Enable COOP/COEP here only; ffmpeg lazy-load |
| Phase 7 — Effects & Advanced | Correct | Pan/zoom removed (moved to Phase 5) |

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 6 (Video Support):** Complex integration — SharedArrayBuffer + COOP/COEP header configuration for Vercel/Netlify, ffmpeg.wasm `xstack` filter usage, playback sync across multiple `<video>` elements. Warrants `/gsd:research-phase` before building.
- **Phase 7 (Save/Load):** The `persist` middleware behavior changed in Zustand v5 (initial state no longer stored at creation). localStorage quota with base64 registry needs validation. Warrants investigation during Phase 7 planning.

**Phases with standard patterns (skip research-phase):**

- **Phase 0 (Scaffolding):** Vite + React + TypeScript + Tailwind setup is fully documented; no surprises.
- **Phase 1 (Grid Tree Engine):** Pure TypeScript tree types and Zustand + Immer store — well-documented, no novel patterns.
- **Phase 2 (Grid Rendering):** Recursive React component tree with `React.memo` — established pattern; architecture file provides code-level guidance.
- **Phase 3 (Media Upload):** File API, `FileReader.readAsDataURL`, native drag events — standard browser APIs.
- **Phase 4 (Export Engine):** html-to-image integration patterns thoroughly documented in PITFALLS.md and ARCHITECTURE.md.
- **Phase 5 (Polish & UX):** CSS variables, slider controls, template presets — no research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All choices verified against official docs; version pins confirmed against changelogs and peer dependency matrices |
| Features | HIGH | Cross-referenced against 10+ live tools (BeFunky, Canva, TurboCollage, Unfold, PicCollage, Fotor, PhotoJoiner, Adobe Express) |
| Architecture | HIGH | Patterns verified against official React, Zustand, and html-to-image documentation; code patterns confirmed against FlexLayout reference implementation |
| Pitfalls | HIGH | Sourced from specific GitHub issues with issue numbers; all critical pitfalls have documented community workarounds |

**Overall confidence:** HIGH

### Gaps to Address

- **html-to-image vs modern-screenshot decision:** If html-to-image produces rendering artifacts in Phase 4 testing (CSS blur filters, complex border-radius clipping), swap to `modern-screenshot@^4.6.8`. Validate in Phase 4 before declaring the export engine stable. API is nearly identical.
- **Divider drag-to-store commit strategy:** Two valid patterns exist — (a) commit on every rAF tick for live preview, (b) commit only on `pointerup` for cleaner undo history. Decide in Phase 2 based on perceived responsiveness. Option (a) is more expected by users; option (b) means each resize is a single undo step.
- **Pan/zoom UX mode-entry interaction:** Brief says "drag to reposition, scroll to scale" but does not specify how the user enters pan mode. Research-confirmed convention is: click already-selected cell → enter pan mode (visual indicator); Escape or click outside → exit. Implement this exact model to prevent accidental repositioning during selection.
- **Export double-call performance:** The documented font-embedding workaround calls `toPng()` twice, doubling export time. On a complex 8-cell canvas this could mean 2–4s total. Validate in Phase 4; show "Preparing…" → "Exporting…" in the progress indicator to mask the delay.

---

## Sources

### Primary (HIGH confidence)
- Vite 8 release: https://vite.dev/blog/announcing-vite8
- Zustand v5 migration guide: https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5
- Tailwind v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- React.memo — https://react.dev/reference/react/memo
- Zustand Immer middleware — https://zustand.docs.pmnd.rs/reference/integrations/immer-middleware
- html-to-image GitHub — https://github.com/bubkoo/html-to-image
- FlexLayout reference implementation — https://github.com/caplin/FlexLayout
- React Compiler 1.0 stable (React 19) — https://www.infoq.com/news/2025/12/react-compiler-meta/

### Secondary (MEDIUM confidence)
- modern-screenshot npm (drop-in html-to-image alternative) — https://www.npmjs.com/package/modern-screenshot
- @dnd-kit maintenance discussion — https://github.com/clauderic/dnd-kit/issues/1830
- @dnd-kit unnecessary re-renders — https://github.com/clauderic/dnd-kit/issues/389
- Zustand re-render optimization — https://dev.to/eraywebdev/optimizing-zustand-how-to-prevent-unnecessary-re-renders-in-your-react-app-59do
- TurboCollage pan/zoom UX — https://www.turbocollage.com/6-photo-collage.html
- BeFunky collage features — https://www.befunky.com/features/collage-maker/
- Canva Instagram Stories guide — https://www.canva.com/learn/instagram-stories/
- Icecream Apps best collage makers 2025 — https://icecreamapps.com/learn/best-free-collage-makers.html
- COEP credentialless — https://blog.tomayac.com/2025/03/08/setting-coop-coep-headers-on-static-hosting-like-github-pages/
- Zundo undo middleware — https://github.com/charkour/zundo

### Tertiary (LOW confidence)
- Font double-render workaround — community pattern from html-to-image GitHub issues; not officially documented; validated by multiple independent reporters
- Zustand v5.0.9 middleware TypeScript regression — GitHub Discussion #3331; fix confirmed in 5.0.12

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
