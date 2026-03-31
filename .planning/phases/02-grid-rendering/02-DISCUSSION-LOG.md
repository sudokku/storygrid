# Phase 2: Grid Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-01
**Phase:** 02 — Grid Rendering

---

## Area 1: Divider Visual & Interaction Model

**Q: How should the divider look at rest?**
Options: Invisible / Subtle line / Explicit handle
**Selected:** Custom — three-state model:
- Cursor not on canvas: no lines visible
- Cursor on canvas: 2px lines between siblings
- Cursor hovering specific divider: explicit grab handle appears

**Q: During drag, how are size changes applied?**
Options: Local state only / Continuous store writes
**Selected:** Local state only
**User rationale:** "fewer writes to the store — easier to implement undo/redo actions"

---

## Area 2: Leaf Action Bar Design

**Q: Where should the action bar appear?**
Options: Top-center inside cell / Bottom-center inside cell / Outside cell
**Selected:** Top-center inside cell

**Q: Icons only or labeled buttons?**
Options: Icons only / Icon + label / Icons with tooltips
**Selected:** Icons with shadcn/ui Tooltips
**User note:** "use beautiful icons (maybe from shadcn/ui)" → lucide-react (already installed) covers icons; shadcn/ui Tooltip (Radix UI) added for tooltip chrome

**Q: Dismiss/fade behavior?**
Options: Immediate hide / Short delay
**Selected:** Short delay with opacity 1→0 animation (`transition-opacity`)
**User note:** "would adding opacity 1 -> 0 animation be a good fit?" — confirmed yes

---

## Area 3: Canvas Scaling Strategy

**Q: What drives the scale factor?**
Options: Auto-fit to container / Fixed initial scale / Fit-to-height
**Selected:** Auto-fit to container (~90% of editor area); `editorStore.zoom` as multiplier on top; recalculates on window resize

---

## Area 4: Cell Selection Behavior

**Q: Does clicking a container select anything?**
Options: No / Yes, selects container
**Selected:** No — leaves only selectable in Phase 2

**User asked:** "if containers are not selectable for now, would that be easy to add in the future?"
**Answer:** Yes — `selectedNodeId` accepts any node ID; adding container selection is just adding click handlers + actions in a future phase.

**Q: How does the user deselect?**
Options: Click canvas background / Click same cell again / Both
**Selected:** Both

---

## Additional Discussion: Image Repositioning in Leaf

**User raised:** Axis-constrained drag to reposition image within leaf (drag horizontally if image overflows width, vertically if overflows height). Wanted to know if this helps as a foundation for future pan/zoom.

**Resolution:** Deferred to Phase 5. Phase 5 POLH-06 simplified: remove "double-click to enter pan mode", replace with direct image drag (axis-constrained). Phase 2 renders `object-position` from `leaf.objectPosition` (default: `center center`) as the architectural hook.

---

*Log generated: 2026-04-01*
