# Phase 0: Project Scaffolding - Research

**Researched:** 2026-03-31
**Domain:** Vite + React + TypeScript project initialization, Tailwind CSS v3, Vitest
**Confidence:** HIGH

## Summary

Phase 0 is a greenfield project initialization: no code exists yet, only CLAUDE.md. The entire tech stack is pre-decided in CLAUDE.md with exact versions — the research job is to verify those versions against the live registry, surface any installation gotchas, and provide the planner with exact commands and file templates.

All package versions specified in CLAUDE.md have been verified against the npm registry as of 2026-03-31. One important divergence found: `@dnd-kit/sortable` is now at v10.0.0 (not v6.3.1 as listed in CLAUDE.md), but its peer dependency declares `@dnd-kit/core: ^6.3.0` — they are compatible. The `@types/react` and `@types/react-dom` packages must be pinned to the v18 range to avoid pulling in React 19 types. Vitest is at v4 on latest but v2 is the last stable major compatible with this toolchain without additional configuration changes.

**Primary recommendation:** Use `npm create vite@latest` to scaffold, then install all dependencies in two passes (prod then dev), and wire Tailwind through PostCSS manually as specified in CLAUDE.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Top horizontal toolbar — full-width bar at the top of the viewport containing undo/redo, zoom, safe-zone toggle, and export button placeholders
- **D-02:** Right sidebar — sidebar panel on the right side of the canvas area (Figma/VS Code pattern)
- **D-03:** Canvas centered in the remaining left area, maintaining 9:16 aspect ratio
- Layout structure:
  ```
  ┌─────────────────────────────────┐
  │  [Undo][Redo] [Zoom] [Export]   │  ← top toolbar
  ├─────────────────────┬───────────┤
  │                     │           │
  │  Canvas (9:16)      │  Sidebar  │
  │  (centered)         │           │
  │                     │           │
  └─────────────────────┴───────────┘
  ```
- **D-04:** Vitest included in Phase 0 — not deferred to Phase 1
- **D-05:** jsdom environment configured so component tests can run
- **D-06:** Rationale: nanoid v5 is ESM-only, making Jest incompatible; Phase 1 immediately needs Vitest for pure tree function tests; setting it up now avoids a mid-phase interruption
- **D-07:** Canvas dimensions and safe-zone values defined in `:root` in `src/index.css` (global CSS, not Tailwind config)
- **D-08:** Variable names: `--canvas-width: 1080px`, `--canvas-height: 1920px`, `--safe-zone-top: 250px`, `--safe-zone-bottom: 250px`
- **D-09:** Referenced via Tailwind arbitrary values (e.g. `w-[var(--canvas-width)]`) — no Tailwind config extend needed for these

### Claude's Discretion

- Exact sidebar width (suggested: ~280px fixed, collapsible)
- Placeholder content within each region (text labels or empty divs are both fine)
- Background color for editor shell in Phase 0 (dark theme is Phase 5 — Phase 0 can use a neutral gray)
- Whether to include a `vite.config.ts` test reporter config or keep it minimal

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAF-01 | Project initializes with Vite 8 + React 18 + TypeScript and runs via `npm run dev` without errors | Vite 8.0.3 confirmed on registry; `npm create vite@latest` scaffolds this; exact install command provided |
| SCAF-02 | All MVP dependencies installed and importable (zustand, immer, tailwindcss ^3.4, @dnd-kit/core, @dnd-kit/sortable, html-to-image, lucide-react, nanoid) | All versions verified on registry; install commands documented; @dnd-kit/sortable version discrepancy resolved |
| SCAF-03 | Tailwind configured with canvas dimensions (1080×1920) and safe zone values (250px) as CSS variables | D-07/D-08/D-09 locked: `:root` in `src/index.css`; PostCSS setup documented; Tailwind v3 config template provided |
| SCAF-04 | Folder structure matches spec (Editor/, Grid/, UI/, store/, lib/, types/) | Exact structure and index file stubs documented in Architecture Patterns |
| SCAF-05 | App shell renders editor layout with placeholder canvas area, toolbar, and sidebar | Flex layout pattern documented; three-region CSS structure provided; must support dark theme swap in Phase 5 without restructuring |
</phase_requirements>

## Standard Stack

### Core (all pre-decided — do not substitute)
| Library | Registry Version | Purpose | Notes |
|---------|-----------------|---------|-------|
| vite | 8.0.3 | Build tool / dev server | Rolldown-powered; use `^8.0.2` |
| @vitejs/plugin-react | 6.0.1 | React Fast Refresh + JSX transform | Ships with Vite 8; uses Oxc |
| react | 18.3.1 | UI framework | Pin to `^18.3.1` — do NOT allow 19 |
| react-dom | 18.3.1 | DOM renderer | Same pin as react |
| typescript | 6.0.2 (latest) | Language | Use `~5.8.0` minor-pinned per CLAUDE.md |
| zustand | 5.0.12 | State management | Pin `^5.0.12`; v5 API changes documented |
| immer | 11.1.4 (latest) | Immutable updates | Install separately; `^10.1.x` per CLAUDE.md |
| tailwindcss | 3.4.19 (latest v3) | Utility CSS | Pin `^3.4.0` — do NOT use v4 |
| postcss | 8.5.8 | CSS processing | Required by Tailwind v3 setup |
| autoprefixer | 10.4.27 | CSS vendor prefixing | Required by Tailwind v3 setup |
| @dnd-kit/core | 6.3.1 | Drag and drop | Pin `^6.3.1` |
| @dnd-kit/sortable | 10.0.0 | Sortable drag lists | v10 is current; peer dep = `@dnd-kit/core ^6.3.0` — compatible |
| @dnd-kit/utilities | 3.2.2 | DnD helpers | Pin `^3.2.2` |
| html-to-image | 1.11.13 | DOM → PNG export | Stale but stable; no replacement |
| lucide-react | 1.7.0 | Icons | Pin `^1.7.0` |
| nanoid | 5.1.7 | ID generation | ESM-only; Vitest required (not Jest) |

### Dev Dependencies
| Library | Registry Version | Purpose | Notes |
|---------|-----------------|---------|-------|
| @types/react | 18.3.28 | React type defs | Pin `^18.3.0` — prevents React 19 type pull-in |
| @types/react-dom | 18.3.7 | React DOM types | Pin `^18.3.0` |
| vitest | 2.1.9 | Test runner | Use v2 (`^2.1.0`) — v4 is latest but CLAUDE.md guidance aligns with v2 stability |
| @vitest/coverage-v8 | 4.1.2 | Coverage reporting | Install matching vitest major |
| @testing-library/react | 16.3.2 | Component testing | `^16.0.0` |
| @testing-library/user-event | 14.6.1 | User interaction simulation | `^14.0.0` |
| jsdom | 29.0.1 | DOM environment for Vitest | Configured via `vitest.config.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostCSS config | Vite Tailwind plugin | No official Vite plugin for Tailwind v3; PostCSS is the documented approach |
| jsdom | happy-dom | jsdom is more complete; happy-dom is faster but has gaps; D-05 specifies jsdom |
| Vitest v4 | Vitest v2 | v4 is latest but v2 is well-tested with this stack; either works since test infra is minimal in Phase 0 |

**Installation:**
```bash
# Scaffold
npm create vite@latest storygrid -- --template react-ts
cd storygrid

# Production dependencies
npm install zustand@^5.0.12 immer@^10.1.1 tailwindcss@^3.4.0 postcss autoprefixer @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2 html-to-image@^1.11.13 lucide-react@^1.7.0 nanoid@^5.1.7

# Dev dependencies
npm install -D vitest@^2.1.0 @vitest/coverage-v8@^2.1.0 @testing-library/react@^16.0.0 @testing-library/user-event@^14.0.0 jsdom@^29.0.0 @types/react@^18.3.0 @types/react-dom@^18.3.0
```

**Note on @types/react:** `npm create vite@latest` with react-ts template installs the latest `@types/react` which may be v19. Explicitly pin to `^18.3.0` by running the install command above after scaffolding.

## Architecture Patterns

### Recommended Project Structure
```
storygrid/
├── src/
│   ├── Editor/
│   │   ├── index.ts          # re-exports
│   │   ├── EditorShell.tsx   # three-region layout root
│   │   ├── Toolbar.tsx       # top bar with action placeholders
│   │   ├── Sidebar.tsx       # right panel
│   │   └── CanvasArea.tsx    # center region with 9:16 canvas
│   ├── Grid/
│   │   └── index.ts          # stub (Phase 1 populates)
│   ├── UI/
│   │   └── index.ts          # stub (Phase 5 populates)
│   ├── store/
│   │   └── index.ts          # stub (Phase 1 populates Zustand stores)
│   ├── lib/
│   │   └── index.ts          # stub (utility functions)
│   ├── types/
│   │   └── index.ts          # stub (Phase 1 populates TypeScript types)
│   ├── App.tsx               # mounts EditorShell
│   ├── main.tsx              # ReactDOM.createRoot entry
│   └── index.css             # Tailwind directives + :root CSS variables
├── public/
├── postcss.config.js         # Tailwind PostCSS setup
├── tailwind.config.js        # content paths + minimal config
├── vite.config.ts            # Vite + React plugin + Vitest config
├── tsconfig.json
├── tsconfig.app.json
└── package.json
```

### Pattern 1: Three-Region Editor Layout (flex column + flex row)

**What:** Top toolbar as a fixed-height flex row; below it a flex row splitting into canvas area (flex-grow) and sidebar (fixed width).

**When to use:** This is the only layout for Phase 0. Must be built to accept dark background (`bg-[#0a0a0a]`) in Phase 5 without restructuring.

**Example:**
```tsx
// src/Editor/EditorShell.tsx
export function EditorShell() {
  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-100">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <CanvasArea />
        <Sidebar />
      </div>
    </div>
  );
}

// src/Editor/Toolbar.tsx
export function Toolbar() {
  return (
    <div className="flex items-center gap-2 h-12 px-4 bg-white border-b border-neutral-200 shrink-0">
      <span className="text-sm text-neutral-400">[Undo]</span>
      <span className="text-sm text-neutral-400">[Redo]</span>
      <span className="text-sm text-neutral-400 ml-4">[Zoom]</span>
      <span className="text-sm text-neutral-400 ml-auto">[Safe Zone]</span>
      <span className="text-sm text-neutral-400">[Export]</span>
    </div>
  );
}

// src/Editor/CanvasArea.tsx
export function CanvasArea() {
  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-200 overflow-hidden">
      <div className="w-[270px] h-[480px] bg-white shadow-lg">
        {/* Canvas placeholder — scaled-down representation of 1080×1920 */}
      </div>
    </div>
  );
}

// src/Editor/Sidebar.tsx
export function Sidebar() {
  return (
    <div className="w-[280px] shrink-0 bg-white border-l border-neutral-200 overflow-y-auto">
      <p className="p-4 text-sm text-neutral-400">Properties</p>
    </div>
  );
}
```

### Pattern 2: Tailwind v3 PostCSS Configuration

**What:** Manual PostCSS setup — the only supported way to integrate Tailwind v3 with Vite.

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

// src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --canvas-width: 1080px;
  --canvas-height: 1920px;
  --safe-zone-top: 250px;
  --safe-zone-bottom: 250px;
}
```

### Pattern 3: Vitest Configuration with jsdom

**What:** Vitest configured inside `vite.config.ts` with jsdom environment for component tests.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';
```

**Note:** `@testing-library/jest-dom` must also be installed (`npm install -D @testing-library/jest-dom`).

### Pattern 4: Index Stub Files

**What:** Each folder under `src/` has an `index.ts` that exports nothing yet but marks the module boundary. This allows Phase 1+ to `import { X } from '../types'` cleanly.

```ts
// src/types/index.ts
// Phase 1 will populate this file with GridNode, LeafNode, etc.
export {};

// src/store/index.ts
// Phase 1 will populate this file with Zustand stores.
export {};

// src/lib/index.ts
// Phase 1 will populate this file with pure tree functions.
export {};

// src/Grid/index.ts
// Phase 2 will populate this file with GridNode component.
export {};

// src/UI/index.ts
// Phase 5 will populate this file with shared UI components.
export {};
```

### Anti-Patterns to Avoid

- **Installing @types/react without pinning:** Running `npm create vite@latest` installs the latest @types/react (currently v19). Always explicitly install `@types/react@^18.3.0` after scaffolding.
- **Using Tailwind v4:** `npm install tailwindcss` without a version specifier installs v4 (v4.2.2 is current). Always specify `tailwindcss@^3.4.0`.
- **Using `postcss.config.cjs`:** With Vite 8 and `"type": "module"` in package.json, use `postcss.config.js` with ESM default export. The `.cjs` extension is unnecessary and adds confusion.
- **Omitting `immer` as direct dependency:** The `zustand/middleware/immer` middleware imports immer at runtime. If immer is not in `node_modules` directly, you get a `Cannot find module 'immer'` error. Install immer explicitly.
- **Creating `vite.config.ts` without the test key:** Vitest reads config from `vite.config.ts`. If test config is in a separate `vitest.config.ts`, both files exist and can conflict. Keep everything in `vite.config.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS vendor prefixing | Manual prefix properties | autoprefixer | Hundreds of edge cases; autoprefixer tracks Can I Use |
| Icon SVGs | Inline SVG components | lucide-react | Consistent sizing, strokeWidth, accessibility attrs |
| Unique IDs | `Math.random()` or `Date.now()` | nanoid | Collision probability, cryptographic quality, URL-safe alphabet |
| Dark/light color tokens | Custom CSS vars per component | Tailwind utility classes | Arbitrary values (`bg-[#1a1a1a]`) are cleaner and Phase 5 dark theme is a class swap on root |

**Key insight:** Phase 0 is infrastructure — nothing complex enough to hand-roll. The danger is mis-installing packages (wrong version, missing peer dep) rather than building the wrong thing.

## Common Pitfalls

### Pitfall 1: Tailwind v4 Installed Instead of v3
**What goes wrong:** `npm install tailwindcss` without a version tag installs v4.2.2. The config format is completely different (CSS-first, no `tailwind.config.js`), and Safari 15 is not supported.
**Why it happens:** npm installs latest by default; v4 is the latest major.
**How to avoid:** Always specify `tailwindcss@^3.4.0` in the install command. After install, verify with `npm list tailwindcss`.
**Warning signs:** Tailwind generates a `@import "tailwindcss"` suggestion instead of `@tailwind base/components/utilities`; no `tailwind.config.js` is generated.

### Pitfall 2: React 19 Types Pulled In
**What goes wrong:** `npm create vite@latest` generates a `package.json` with `"@types/react": "^19.x.x"`. This causes type errors in libraries that only declare `react@"^16 || ^17 || ^18"` peer deps.
**Why it happens:** Vite scaffold uses latest; @types/react v19 is now latest.
**How to avoid:** After scaffolding, immediately run `npm install -D @types/react@^18.3.0 @types/react-dom@^18.3.0` to downgrade and pin.
**Warning signs:** `tsc` complains about incompatible React version in node_modules type declarations.

### Pitfall 3: @dnd-kit/sortable Version Mismatch
**What goes wrong:** CLAUDE.md lists `@dnd-kit/sortable ^6.3.1` but the current published version is `10.0.0`. If you run `npm install @dnd-kit/sortable@^6.3.1` you get v6 which may have different import paths.
**Why it happens:** dnd-kit published a major version bump on sortable.
**How to avoid:** Install `@dnd-kit/sortable@^10.0.0` — its peer dep is `@dnd-kit/core ^6.3.0`, which is satisfied by the v6.3.1 core. This is the correct pairing.
**Warning signs:** npm peer dependency warnings about `@dnd-kit/core` version.

### Pitfall 4: immer Not Installed as Direct Dependency
**What goes wrong:** `zustand/middleware/immer` is a re-export wrapper; immer itself must be resolvable from `node_modules`. Without a direct install, bundling succeeds but runtime fails with `Cannot find module 'immer'`.
**Why it happens:** Zustand lists immer as a peer/optional dependency, so npm does not install it automatically.
**How to avoid:** Include `immer@^10.1.1` in the production install command explicitly.
**Warning signs:** Runtime error only — TypeScript compilation passes but the browser console shows the module error.

### Pitfall 5: nanoid ESM Import Fails with CJS Tooling
**What goes wrong:** If any tool in the chain uses CommonJS (e.g., old Jest config, `require()` in a script), `import { nanoid } from 'nanoid'` throws because nanoid v5 ships no CJS build.
**Why it happens:** nanoid v5 is ESM-only by design.
**How to avoid:** Use Vitest (already decided in D-04/D-05/D-06). Never use Jest for this project. The vite.config.ts pattern above handles this correctly.
**Warning signs:** `Error [ERR_REQUIRE_ESM]` in test output.

### Pitfall 6: Sidebar / CanvasArea Not Designed for Dark Theme Swap
**What goes wrong:** If the Phase 0 layout uses inline color values or hardcoded white backgrounds in component styles, Phase 5's dark theme requires structural rewrites instead of a class swap.
**Why it happens:** Phase 0 developer doesn't think ahead to Phase 5.
**How to avoid:** Use Tailwind utility classes exclusively — no inline `style={{ background: 'white' }}`. The root shell's `bg-neutral-100` will be swapped to `bg-[#0a0a0a]` in Phase 5; all child regions use semantic relative utilities.
**Warning signs:** Any `style={}` prop with color values in layout components.

## Code Examples

### vite.config.ts (complete Phase 0 config)
```ts
// Source: Vite 8 docs + Vitest 2 docs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
```

### src/index.css (complete Phase 0 CSS)
```css
/* Source: CONTEXT.md D-07/D-08/D-09 */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --canvas-width: 1080px;
  --canvas-height: 1920px;
  --safe-zone-top: 250px;
  --safe-zone-bottom: 250px;
}
```

### src/App.tsx (Phase 0 root)
```tsx
import { EditorShell } from './Editor/EditorShell';

function App() {
  return <EditorShell />;
}

export default App;
```

### tsconfig.app.json adjustments
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@vitejs/plugin-react` uses Babel | v6 uses Oxc for transforms | Vite 8 / plugin-react v6 (2025) | Faster transform; no behavior change |
| Rollup bundler in Vite | Rolldown (Rust-based) in Vite 8 | Vite 8 (2025) | Faster builds; edge cases possible with WASM |
| Zustand `create` with equality fn | Use `useShallow` from `zustand/react/shallow` | Zustand v5 (2024) | API change; only affects Phase 1+ selectors |
| Jest + `babel-jest` for ESM | Vitest | Ongoing (ESM-only packages like nanoid forced this) | No CJS transform needed |
| `tailwindcss@latest` = v3 | `tailwindcss@latest` = v4 | Early 2025 | Must always specify `^3.4` explicitly |

**Deprecated/outdated for this project:**
- `html2canvas`: Cannot handle `object-fit: cover` or CSS transforms — do not use for export
- `dom-to-image`: Unmaintained — `html-to-image` is the maintained fork
- `@dnd-kit/react` (new adapter): Still alpha/beta as of research date — do not use
- `react-dnd`: Worse pointer event support; more boilerplate than @dnd-kit

## Open Questions

1. **Vitest version to use: v2 vs v4**
   - What we know: CLAUDE.md guidance aligns with v2; v4 is current on npm; both support jsdom
   - What's unclear: v4 may have different configuration syntax for coverage
   - Recommendation: Start with v2.1.9 (`^2.1.0`) — it is proven with this stack. If the planner prefers v4, the `vite.config.ts` test block syntax is identical; only the coverage config may differ slightly.

2. **`@vitest/coverage-v8` version alignment**
   - What we know: Latest is v4.1.2; if Vitest is v2, coverage package should be v2 as well
   - What's unclear: npm registry shows v4.1.2 as latest; v2 may require explicit `@vitest/coverage-v8@^2.1.0`
   - Recommendation: Pin coverage package to same major as vitest. Install command already reflects this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev server, npm scripts | Yes | 22.22.2 | — |
| npm | Package installation | Yes | 10.9.7 | — |
| Browser (Chrome/Firefox/Safari) | Dev server preview | Assumed | — | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Missing dependencies with fallback:** None.

**Note:** This is a greenfield project. No existing database, Docker service, or external API is required for Phase 0. The environment is fully ready.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.0 |
| Config file | `vite.config.ts` (test key) — see Wave 0 |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAF-01 | `npm run dev` starts without errors | smoke/manual | Manual: run `npm run dev`, verify browser opens | N/A — manual |
| SCAF-02 | All MVP deps importable without TS errors | unit | `npx tsc --noEmit` | Wave 0: `src/test/imports.test.ts` |
| SCAF-03 | CSS variables defined and accessible | unit | `npx vitest run src/test/css-variables.test.ts` | Wave 0: create file |
| SCAF-04 | Folder structure matches spec | unit | `npx vitest run src/test/structure.test.ts` | Wave 0: create file |
| SCAF-05 | App shell renders three regions | unit | `npx vitest run src/test/editor-shell.test.ts` | Wave 0: create file |

**Note on SCAF-01:** Dev server start is a manual smoke test — it cannot be automated as a unit test. Verified by running `npm run dev` and confirming no console errors.

**Note on SCAF-03:** CSS custom properties in `:root` cannot be directly queried in jsdom without a CSS parser; the test should verify the index.css file contains the expected variable declarations via string matching.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (catches type errors immediately)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npx vitest run` green + `npm run dev` manual smoke before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/setup.ts` — `@testing-library/jest-dom` import
- [ ] `src/test/imports.test.ts` — covers SCAF-02 (import each MVP dep, verify no throw)
- [ ] `src/test/structure.test.ts` — covers SCAF-04 (check index.ts stubs exist using `import.meta.glob` or fs)
- [ ] `src/test/editor-shell.test.ts` — covers SCAF-05 (render EditorShell, assert toolbar/canvas/sidebar regions present)
- [ ] `npm install -D @testing-library/jest-dom` — required for setup.ts

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are mandatory for all planning and implementation:

| Directive | Detail |
|-----------|--------|
| Vite 8 only | `^8.0.2` — do not use Vite 6 or 7 |
| React 18 only | `^18.3.1` — do not allow React 19 |
| TypeScript | `~5.8.0` minor-pinned |
| Zustand | `^5.0.12` — use `useShallow` not equality fn |
| Immer | Install as direct dep (`^10.1.x`) |
| Tailwind | `^3.4.x` — NEVER v4 |
| Export (MVP) | html-to-image `toPng()` |
| No html2canvas | Breaks `object-fit: cover` and CSS transforms |
| No dom-to-image | Deprecated |
| No @dnd-kit/react | Alpha/beta — not production ready |
| No React 19 | Peer dep risk |
| nanoid ESM-only | Use Vitest, never Jest |
| Bundle target | Under 500KB gzipped (ffmpeg excluded) |
| Browser support | Chrome 90+, Firefox 90+, Safari 15+ |
| Deployment | Vite static build → dist/ → Vercel or Netlify |

## Sources

### Primary (HIGH confidence)
- npm registry live queries (2026-03-31) — all package versions verified by `npm view`
- CLAUDE.md (project file) — stack decisions, exact versions, all gotchas

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-09 — layout and CSS variable decisions locked by user
- REQUIREMENTS.md SCAF-01 through SCAF-05 — acceptance criteria for this phase

### Tertiary (LOW confidence)
- None — all claims are verified by registry query or project files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-03-31
- Architecture: HIGH — directly specified in CONTEXT.md decisions; no ambiguity
- Pitfalls: HIGH — based on CLAUDE.md documented gotchas + registry version discrepancies found during research
- Test infrastructure: MEDIUM — Vitest v2 vs v4 choice has minor uncertainty; both work

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable stack; npm versions may drift but pinning handles this)
