# Phase 8: Canvas & Workspace UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 08-canvas-workspace-ux
**Areas discussed:** Safe zone visual style, Workspace drop zone boundary, Workspace drop routing, Drag-over visual feedback, TPL-01 handling

---

## Area 1: Safe Zone Visual Style (CANVAS-01)

### Q1a — Overlay treatment
| Option | Description | Selected |
|--------|-------------|----------|
| Diagonal striped pattern | SVG `<pattern>` or CSS `repeating-linear-gradient` stripes over unsafe regions | |
| Solid dimmed overlay | `bg-black/50` with subtle border where safe area begins | |
| Dimmed + stripes combined | Dimmed base with faint stripes for texture | ✓ |
| Claude's discretion | I pick something tasteful | |

**User's choice:** Dimmed + stripes combined
**Notes:** Chose the louder option — both the dimming and the stripes. Matches "caution / reserved area" convention.

### Q1b — Icon placement
| Option | Description | Selected |
|--------|-------------|----------|
| Centered icon per region | One icon top, one bottom — symmetric | ✓ |
| Single icon top-only | Only one icon at the top | |
| Small label + icon pair | e.g., "Reserved for Instagram UI" — more explanatory | |
| Claude's discretion | | |

**User's choice:** (a) centered per region
**Notes:** Paired with the recommendation's suggestion of labels — will carry labels "Instagram header" / "Instagram footer" per region.

### Q1c — Which icon
| Option | Description | Selected |
|--------|-------------|----------|
| `EyeOff` | Content not visible here — neutral, accurate | ✓ |
| `Ban` | Reserved / not allowed | |
| `Lock` | Locked region | |
| `Instagram` | Literal IG logo | |

**User's choice:** EyeOff

### Q1d — Overlay z-index
| Option | Description | Selected |
|--------|-------------|----------|
| Above media | `z-10` — always visible, even after dropping images | ✓ |
| Below media | Only visible on empty cells | |

**User's choice:** Above media
**Notes:** Warning must stay visible during composition; user dismisses by toggling Show Safe Zone off when ready to export.

---

## Area 2: Drop Zone Boundary (DROP-01)

### Q2a — Drop target scope
| Option | Description | Selected |
|--------|-------------|----------|
| `<main>` (CanvasArea) | Full area left of sidebar, below toolbar — matches REQ literally | ✓ |
| Everything except toolbar | Includes sidebar as drop target | |
| CanvasArea + sidebar preview only | Hybrid | |

**User's choice:** (a) via "all recommendations"
**Notes:** REQ-DROP-01 wording ("full area excluding navbar and sidebar") explicitly excludes the sidebar.

### Q2b — Cell vs workspace handler precedence
| Option | Description | Selected |
|--------|-------------|----------|
| Cell handler wins via stopPropagation | Workspace handler only fires on drops outside any cell | ✓ |
| Remove cell-level file handling | All drops via workspace | |
| Workspace as fallback (same outcome as a) | | |

**User's choice:** (a) via "all recommendations"
**Notes:** Cell `handleDrop` already calls `e.stopPropagation()`, so coexistence requires no LeafNode changes.

### Q2c — Mobile touch support
| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-only | Consistent with cell-swap ADR | ✓ |
| Add touch support | Significant rework | |

**User's choice:** Desktop-only via "all recommendations"

---

## Area 3: Workspace Drop Routing

### Q3a — Routing strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `autoFillCells` | Same helper as Upload button & cell drop | ✓ |
| Replace selected cell | If none selected, fill first empty | |
| Fill first empty only | Ignore multi-file auto-split | |

**User's choice:** (a) Reuse autoFillCells
**Notes:** Zero new routing logic — workspace drop behaves identically to Upload button.

### Q3b — All cells full
| Option | Description | Selected |
|--------|-------------|----------|
| Silently replace starting from first leaf | Overwrite | |
| Do nothing / no-op | | |
| Match existing `autoFillCells` behavior | Planner verifies | ✓ |

**User's choice:** (c) match existing behavior

### Q3c — Non-media / directory drops
| Option | Description | Selected |
|--------|-------------|----------|
| Filter to image/* and video/* silently | | |
| Reject entirely | | |
| Match existing LeafNode.handleDrop behavior | Planner verifies | ✓ |

**User's choice:** (c) match existing behavior

---

## Area 4: Drag-Over Visual Feedback (DROP-02)

### Q4a — Feedback style
| Option | Description | Selected |
|--------|-------------|----------|
| Full-workspace dimmed overlay + icon + label | `bg-black/40` + centered content — loud | |
| Accent-blue inset ring + top label pill | Standard SaaS pattern — doesn't obscure canvas | ✓ |
| Both combined | Loudest | |

**User's choice:** (b) ring + label pill

### Q4b — Cell vs workspace ring interaction
| Option | Description | Selected |
|--------|-------------|----------|
| Both show simultaneously (nested) | Workspace outer + cell inner | ✓ |
| Workspace only off-cell, cell only over-cell | Mutually exclusive | |
| Only workspace ring, remove cell ring | | |

**User's choice:** (a) nested highlights

### Q4c — Cell-swap drag behavior
| Option | Description | Selected |
|--------|-------------|----------|
| No workspace ring during cell-swap | Only activate for `Files` in dataTransfer.types | ✓ |
| Yes — any drag shows ring | | |

**User's choice:** (a) file drags only

### Q4d — Label copy
| Option | Description | Selected |
|--------|-------------|----------|
| "Drop to add media" | | |
| "Drop image or video" | Specific, matches `accept` attr | ✓ |
| "Drop files here" | | |
| Claude's discretion | | |

**User's choice:** "Drop image or video"

---

## Area 5: TPL-01 Handling

### Q5a — How to handle TPL-01
| Option | Description | Selected |
|--------|-------------|----------|
| Mark already satisfied + add regression test | Close the requirement in Phase 8 verification | ✓ |
| Skip entirely | Trust existing work, no test | |
| Re-verify via full commit diff review | Cautious path | |

**User's choice:** Already satisfied (+ regression test)

### Q5b — Broader template UX concerns
**User's choice:** No broader concerns raised — stay focused on CANVAS-01 / DROP-01 / DROP-02.

---

## Claude's Discretion

- Exact stripe spacing, angle, and opacity for the safe zone pattern
- CSS `repeating-linear-gradient` vs SVG `<pattern>` implementation mechanism for stripes
- Label pill exact styling and top offset
- Drag-leave detection: counter pattern vs `e.relatedTarget` check
- Whether workspace drop handler lives on `<main>` in CanvasArea or is hoisted further up

## Deferred Ideas

- Template preview on hover (v1.2+)
- Media-wipe warning on template apply (resolved differently by quick-260407-vth)
- Custom user templates (v1.2+)
- Drag-and-drop on mobile touch devices (per cell-swap ADR)
