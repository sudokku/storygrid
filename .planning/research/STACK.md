# Stack Research — StoryGrid

**Project:** StoryGrid (client-side Instagram Story collage editor)
**Researched:** 2026-03-31
**Overall confidence:** HIGH for core choices, MEDIUM for export libraries, LOW for video export stability

---

## Recommended Stack

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

## Rationale and Gotchas

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
