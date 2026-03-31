# Phase 0: Project Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 00-project-scaffolding
**Areas discussed:** Editor shell layout, Vitest setup, CSS variables strategy

---

## Editor Shell Layout

### Toolbar position

| Option | Description | Selected |
|--------|-------------|----------|
| Top bar | Horizontal toolbar across the top — classic web app pattern (Figma, Canva). Maximizes vertical canvas space. | ✓ |
| Left sidebar toolbar | Vertical icon toolbar on the left — Adobe/Sketch style. Saves horizontal space but less familiar in browser apps. | |

**User's choice:** Top bar
**Notes:** Standard web design tool pattern — no special rationale provided.

### Sidebar position

| Option | Description | Selected |
|--------|-------------|----------|
| Right side | Sidebar on the right — matches Figma/VS Code pattern, leaves canvas on the left where eye naturally goes first. | ✓ |
| Left side | Sidebar on the left — less common for design tools targeting right-handed users. | |

**User's choice:** Right side
**Notes:** No special rationale provided — accepted recommended default.

---

## Vitest Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 0 | Set up Vitest + jsdom now so Phase 1 can immediately write tests for pure tree functions. | ✓ |
| Defer to Phase 1 | Phase 0 stays lean — just scaffolding. Phase 1 adds Vitest when it needs it. | |

**User's choice:** Include in Phase 0
**Notes:** No additional context needed — recommended option accepted.

---

## CSS Variables Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| :root in index.css | Define --canvas-width, --canvas-height, --safe-zone-top in global CSS :root. Reference via Tailwind arbitrary values. | ✓ |
| Tailwind config extend | Add to tailwind.config.js extend.spacing / extend.width for utility class usage. | |

**User's choice:** `:root` in `index.css`
**Notes:** CLAUDE.md already lists this as the primary approach.

---

## Claude's Discretion

- Exact sidebar width
- Placeholder content within each region
- Editor background color for Phase 0 shell (dark theme is Phase 5)
- Vitest reporter configuration detail

## Deferred Ideas

None.
