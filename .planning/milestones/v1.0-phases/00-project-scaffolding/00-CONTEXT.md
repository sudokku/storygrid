# Phase 0: Project Scaffolding - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the complete Vite + React + TypeScript development foundation: all MVP packages installed and importable, folder structure created, Tailwind configured with CSS variables, Vitest test infrastructure ready, and an editor shell with three visible regions (toolbar, canvas, sidebar) rendering in the browser.

This phase delivers a dev environment and a visible skeleton — no real functionality. Placeholder content in all three regions is acceptable.

</domain>

<decisions>
## Implementation Decisions

### Editor Shell Layout
- **D-01:** Top horizontal toolbar — full-width bar at the top of the viewport containing undo/redo, zoom, safe-zone toggle, and export button placeholders
- **D-02:** Right sidebar — sidebar panel on the right side of the canvas area (Figma/VS Code pattern)
- **D-03:** Canvas centered in the remaining left area, maintaining 9:16 aspect ratio

Layout structure:
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

### Test Infrastructure
- **D-04:** Vitest included in Phase 0 — not deferred to Phase 1
- **D-05:** jsdom environment configured so component tests can run
- **D-06:** Rationale: nanoid v5 is ESM-only, making Jest incompatible; Phase 1 immediately needs Vitest for pure tree function tests; setting it up now avoids a mid-phase interruption

### CSS Variables
- **D-07:** Canvas dimensions and safe-zone values defined in `:root` in `src/index.css` (global CSS, not Tailwind config)
- **D-08:** Variable names: `--canvas-width: 1080px`, `--canvas-height: 1920px`, `--safe-zone-top: 250px`, `--safe-zone-bottom: 250px`
- **D-09:** Referenced via Tailwind arbitrary values (e.g. `w-[var(--canvas-width)]`) — no Tailwind config extend needed for these

### Claude's Discretion
- Exact sidebar width (suggested: ~280px fixed, collapsible)
- Placeholder content within each region (text labels or empty divs are both fine)
- Background color for editor shell in Phase 0 (dark theme is Phase 5 — Phase 0 can use a neutral gray)
- Whether to include a `vite.config.ts` test reporter config or keep it minimal

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack and Versions
- `CLAUDE.md` — Full tech stack decisions, exact package versions, Tailwind v3 vs v4 rationale, all gotchas (nanoid ESM-only, Zustand v5 changes, etc.)

### Requirements
- `.planning/REQUIREMENTS.md` §Scaffolding — SCAF-01 through SCAF-05 are the acceptance criteria for this phase
- `.planning/ROADMAP.md` §Phase 0 — Success criteria checklist

No external specs — requirements fully captured in CLAUDE.md and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield project. `CLAUDE.md` is the only file in the repo.

### Established Patterns
- None yet — Phase 0 establishes them.

### Integration Points
- `src/App.tsx` → root layout shell (all three regions)
- `src/index.css` → CSS variables definition
- `src/store/` → Zustand stores (created as empty stubs in this phase)
- `src/types/` → TypeScript type stubs (created but not populated until Phase 1)

</code_context>

<specifics>
## Specific Ideas

- Folder structure is specified exactly: `Editor/`, `Grid/`, `UI/`, `store/`, `lib/`, `types/` under `src/` — with index files present per SCAF-04
- The three-region layout matches Phase 5's dark theme target, so the flex/grid structure must be designed to accept a dark background later without restructuring

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 00-project-scaffolding*
*Context gathered: 2026-03-31*
