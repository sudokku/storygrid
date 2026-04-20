# Phase 32: Update mobile cell tray UI/UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 32-update-mobile-cell-tray-ui-ux
**Areas discussed:** Tray content, Visual design, Layout & overflow, Position & behavior, Header compaction

---

## Tray Content

| Option | Description | Selected |
|--------|-------------|----------|
| Add Overlay (text/emoji/sticker) | Open AddOverlayMenu from tray | |
| Audio toggle | Video cells only; mute/unmute | ✓ |
| Effects access | Button opens effects panel | ✓ (added mid-discussion) |
| None — keep current 5 | Polish only | |

**User's choice:** Audio toggle (initially), then revised to also include Effects button.

**Audio button order:**
| Option | Selected |
|--------|----------|
| After Clear (rightmost, conditional) | ✓ |
| Before Clear | |
| Always visible (disabled for non-video) | |

**Final button order:** Upload → Split H → Split V → Fit → Clear → Effects → Audio

**Notes:** User added Effects mid-discussion after realizing it was the natural entry-point into deep cell editing on mobile.

---

## Visual Design

| Option | Description | Selected |
|--------|-------------|----------|
| Add labels below icons | Short text label under each icon | ✓ |
| Active-state styling only | Keep icon-only, add highlight for active state | |
| Full redesign — Claude decides | Open-ended visual overhaul | |

**Active-state styling:**

| Option | Selected |
|--------|----------|
| Accent color when active | |
| White glow/brightness | |
| No — icon change is enough | ✓ |

**User's choice:** Labels added; icon swap alone is sufficient for stateful buttons.

---

## Layout & Overflow

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontally scrollable tray | Single row, swipe to reveal | ✓ |
| Abbreviate labels | Fit all in fixed width | |
| Two rows | Primary + secondary row | |

**User's choice:** Scrollable tray.

---

## Position & Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current position | bottom:60px, no change | |
| Stays visible when sheet full | Tray + sheet simultaneously | |
| Hide when sheet is fully open | Tray hides when sheetSnapState === 'full' | ✓ |

**User's choice:** Tray hides when sheet is fully open.

**Additional decisions from post-summary clarification:**

| Decision | Choice |
|----------|--------|
| Effects button behavior | Opens sheet to Effects panel (calls setSheetSnapState('full')) |
| Audio toggle opens sheet? | No — inline toggle only |
| Cell tap auto-opens sheet | Disabled (remove useEffect in MobileSheet.tsx) |
| Overlay tap auto-opens sheet | Kept unchanged |

---

## Header Compaction

| Option | Description | Selected |
|--------|-------------|----------|
| Claude decides (h-12 → h-10) | Moderate reduction | |
| Minimal (shave 4–6px) | Subtle | |
| Aggressive (Apple HIG minimum) | As compact as 44px touch targets allow | ✓ |

**User's choice:** Aggressive — compress app header and sheet tab strip to minimum height that keeps touch targets ≥44×44px.

**Notes:** Goal is to recover vertical canvas space. User explicitly noted: "make the Action Tray actually useful" — sheet auto-open on cell tap was burying the tray.

---

## Deferred Ideas

- Add Overlay button on mobile (text/emoji/sticker)
- Safe zone toggle / zoom controls on mobile
- Reconsider overlay-selection auto-open
