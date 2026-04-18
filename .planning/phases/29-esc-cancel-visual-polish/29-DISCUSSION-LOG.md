# Phase 29: ESC-Cancel + Visual Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 29-esc-cancel-visual-polish
**Areas discussed:** Ghost (position + size + opacity), ESC-cancel, Snap-back, Drop flash, Wobble

---

## Areas Selected

| Option | Description | Selected |
|--------|-------------|----------|
| ESC-cancel wiring | KeyboardSensor vs. custom listener | ✓ |
| Snap-back animation | dropAnimation vs. custom CSS | ✓ |
| Drop flash tracking | dragStore vs. local state | ✓ |
| Wobble character | Subtle / Medium / Pronounced | ✓ |
| Ghost issues (user notes) | Position timing, size cap, opacity change | ✓ (extra) |

**User notes at selection:** Ghost spawns in wrong position (pointer offset stale), ghost should be smaller (max ~200px), ghost should be ~20% opacity to see drop target. Fixing position might also unblock edge drop zones.

---

## Ghost — Position Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Capture pointer at mousedown | Store clientX/Y in dragStore at onPointerDown, use in grabOffsetModifier | ✓ |
| Use activatorEvent as-is, snap ghost | CSS transition to hide the jump | |

**User's choice:** Capture pointer at mousedown
**Notes:** Root cause: activatorEvent records coords after sensor threshold (8px/250ms), not at mousedown. Fix: add pointerDownX/Y to dragStore, set at onPointerDown, use in grabOffsetModifier instead of activatorEvent.

---

## Ghost — Size Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed max: 200px × 200px | Simple, predictable thumbnail-sized ghost | ✓ |
| % of viewport (e.g. 20vw/20vh) | Scales with screen size | |

**User's choice:** Fixed max ~200px
**Notes:** User unsure about exact value — deferred to UI-spec phase. Implement with CSS variable or Tailwind arbitrary value for easy tuning.

---

## Ghost — Opacity

Not presented as a formal question — captured from user's selection notes.

**User's choice:** 20% opacity (opacity: 0.2)
**Notes:** Overrides GHOST-03 (80%). Lower opacity makes drop target visible through ghost, helping zone selection.

---

## ESC-Cancel Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| KeyboardSensor + ESC | dnd-kit handles ESC natively, fires onDragCancel | ✓ |
| window keydown + dragStore.end() | Custom listener, but dnd-kit stays in dragging state | |

**User's choice:** KeyboardSensor + ESC
**Notes:** DND-01 prohibited TouchSensor + MouseSensor in favor of PointerSensor — KeyboardSensor is a separate concern (cancel gesture) and doesn't violate that requirement.

---

## Snap-Back Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Re-enable dnd-kit dropAnimation | duration: 200ms, easing: ease-in, automatic on cancel | ✓ |
| Instant disappear on cancel | dropAnimation stays null | |

**User's choice:** Re-enable dnd-kit dropAnimation
**Notes:** Currently `dropAnimation={null}` was intentionally disabled in Phase 28. Re-enable with custom 200ms config.

---

## Drop Flash Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| dragStore lastDropId + setTimeout | Centralized, consistent with drag state pattern | ✓ |
| LeafNode local useState + useEffect | Per-component, requires prop threading | |

**User's choice:** dragStore lastDropId + setTimeout
**Notes:** Add lastDropId, setLastDrop(id), clearLastDrop() to dragStore. handleDragEnd calls setLastDrop(toId) + setTimeout(700ms, clearLastDrop). LeafNode subscribes via selector.

---

## Wobble Character

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle: 2–3px, 150ms | Gentle acknowledgment, professional feel | ✓ |
| Medium: 4–6px, 300ms | More visible, iOS jiggle-like | |
| Pronounced: 8px, 400ms | Strong iOS long-press style | |

**User's choice:** Subtle — ±1.5deg rotation over 150ms

---

## Claude's Discretion

- Flash visual style (background color vs. ring/outline)
- Wobble fill-mode behavior
- Whether flash applies to all drop zones including center (swap)

## Deferred Ideas

- Ghost size cap exact value — UI-spec phase
- Other DnD visual polish details — UI-spec phase
- Mobile haptics, MobileSheet auto-collapse, cross-device CSS — Phase 30
