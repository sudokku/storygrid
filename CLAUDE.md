<!-- GSD:project-start source:PROJECT.md -->
## Project

**StoryGrid**

StoryGrid is a client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image (MVP) or video (v1). Zero backend — fully static, deploys to Vercel/Netlify.

**Core Value:** A user can build a multi-cell photo collage from scratch, fill it with images, and download a pixel-perfect 1080×1920px PNG — entirely in the browser, no account or server required.

### Constraints

- **Tech Stack**: Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — pre-decided, do not substitute
- **State Library**: Zustand with Immer middleware — immutable updates on nested tree, undo/redo via history array
- **Export (MVP)**: html-to-image `toPng()` — fallback to Canvas API if CSS fidelity issues arise
- **Video Export (v1)**: @ffmpeg/ffmpeg + @ffmpeg/util — lazy-loaded, ~25MB WASM core
- **Bundle Size**: MVP bundle under 500KB gzipped; ffmpeg.wasm excluded from initial bundle
- **Browser Support**: Chrome 90+, Firefox 90+, Safari 15+ (MVP). Video export Chrome/Firefox only.
- **Deployment**: Vite static build → dist/ → Vercel or Netlify
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
## Rationale and Gotchas
### Vite 8
- `@vitejs/plugin-react` v5 still works with Vite 8 if a gradual migration is needed, but start fresh with v6.
- The Rolldown bundler is architecturally new; if obscure Rollup plugin edge cases arise, the workaround is to swap to the `rolldown-vite` compatibility layer first (documented in Vite 8 migration guide).
- ffmpeg.wasm WASM loading (`.wasm?url` or CDN) works correctly with Vite 8's improved WASM handling.
### React 18 (pin to 18, do not use 19)
- React 19 peer dependency errors will surface during `npm install` if any library in the tree declares `react@"^16 || ^17 || ^18"`. Pin React 18 to avoid this class of problem entirely.
- The React 19 compiler's automatic memoization is not a substitute for the explicit `React.memo` strategy required for the recursive GridNode tree. Do not depend on a compiler to fix re-render hot paths.
### TypeScript 5.8
### Zustand 5.0.x
- Zustand v5 removed the `create` API's custom equality function parameter. If `shallow` comparison is needed on derived selectors, use `useShallow` from `zustand/react/shallow` — not a custom equality function passed to `create`.
- TypeScript regression noted in v5.0.9: middleware types broken in some configurations (Discussion #3331). Pin to `^5.0.12` which includes the fix.
- The `persist` middleware behavior changed: initial state is no longer stored during store creation. This matters for the Phase 7 save/load feature — test persist middleware behavior explicitly.
### Immer 10.x (via zustand/middleware/immer)
- Immer must be installed as a direct dependency even though the middleware is inside the zustand package. Omitting it causes a "Cannot find module 'immer'" runtime error.
- For the undo/redo history array, store plain serializable snapshots (not Immer drafts). Snapshots should be taken of the committed state, not inside a produce call.
- Do not use `enableMapSet()` unless Map or Set types appear in the store — it adds bundle weight unnecessarily.
### Tailwind CSS v3.4.x (PIN TO v3 — do not use v4)
- Install `tailwindcss@^3.4`, `postcss`, and `autoprefixer` explicitly.
- Vite 8 with Tailwind v3 requires the standard PostCSS plugin setup (`postcss.config.js`) — no special integration issues.
- CSS variables for canvas dimensions and safe zones (`--canvas-width`, `--safe-zone-top`) should be defined in the Tailwind config's `extend.spacing` / `extend.height` sections or directly in a global CSS `:root {}` block and referenced via Tailwind's `arbitrary value` syntax (`h-[var(--canvas-height)]`).
### @dnd-kit/core + @dnd-kit/sortable (6.3.1)
- Performance issue (Issue #389): in large sortable lists, every item re-renders on drag. This project has at most ~20 cells in a grid, so this is irrelevant.
- Do NOT migrate to `@dnd-kit/react` for this project — it is in alpha/beta, has breaking API changes in progress, and adds migration risk without benefit.
- For file-drop-onto-cell, the native HTML5 drag API (`onDragOver` + `onDrop` on each Leaf component) may be simpler and more reliable than @dnd-kit for this specific use case. @dnd-kit handles drag-between-cells for media reordering; native drag events handle file-from-desktop drops.
### html-to-image 1.11.13
### lucide-react 1.7.0
### nanoid 5.1.7
- nanoid v5 is **ESM-only**. If any tooling in the project is CommonJS (Jest with CJS config, for example), importing nanoid will fail. Mitigation: use Vite's native ESM test runner (Vitest) — no CJS issue. Do not use Jest with CJS config.
- For Node.js scripts (e.g., config generation), use `import { nanoid } from 'nanoid'` in ESM context or use the `customAlphabet` export with a CJS-compatible alternative if truly needed.
### @ffmpeg/ffmpeg 0.12.15 + @ffmpeg/util + @ffmpeg/core (CDN only)
## Version Pinning Recommendations
### Key pinning rationale
| Package | Pin style | Reason |
|---------|-----------|--------|
| `typescript` | `~5.8.0` (minor-pinned) | Avoid unexpected type-check changes in patch |
| `tailwindcss` | `^3.4.0` | Stay on v3 branch; ^ is safe within major |
| `react` | `^18.3.1` | Explicitly stay on 18; do not allow 19 upgrade |
| `vite` | `^8.0.2` | Current major; patch updates are safe |
| `html-to-image` | `^1.11.13` | Low maintenance; ^ is safe since no new releases expected |
| `@dnd-kit/core` | `^6.3.1` | Stable; no breaking changes expected on 6.x |
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
## Open Questions
- **html-to-image vs modern-screenshot:** If html-to-image produces rendering artifacts in Phase 4 testing (e.g., CSS blur filters, border-radius clipping at export), swap to `modern-screenshot@^4.6.8` as a direct API-compatible replacement. This should be validated in Phase 4 before declaring the export engine stable.
- **@dnd-kit/react timeline:** Monitor GitHub Discussion #1842 for production-readiness announcement. If @dnd-kit/react reaches stable before Phase 3 is built, evaluate migration. Otherwise stick to @dnd-kit/core v6.
- **Vite 8 Rolldown edge cases:** Rolldown is architecturally new. If any dependency produces unusual bundling behavior (especially @ffmpeg WASM), check the Vite 8 migration docs and rolldown-vite compatibility layer.
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
