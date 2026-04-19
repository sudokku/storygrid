# Phase 31: Improve mobile interactions UI/UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 31-improve-mobile-interactions-ui-ux
**Areas discussed:** Canvas interactions

---

## Canvas interactions

### Pan mode

| Option | Description | Selected |
|--------|-------------|----------|
| Keep double-tap | Current behavior: double-tap the canvas to enter pan mode | ✓ |
| Two-finger scroll to pan | Two-finger scroll natively — no mode switching | |
| Dedicated pan button in header | Add a pan-mode toggle button to the mobile header | |

**User's choice:** Keep double-tap
**Notes:** Consistent with Phase 5.1; no change needed.

---

### Pinch-to-zoom state

| Option | Description | Selected |
|--------|-------------|----------|
| Working fine, no changes | Phase 5.1 wired native pinch-to-zoom | |
| Needs fixing / improvement | Specific issues exist | ✓ |

**User's choice:** Needs fixing / improvement
**Notes:** "Sometimes the browser picks up on zoom, sometimes it jitters, other times it works fine. I believe we should find a way to completely disable the browser zoom and scroll on this page."

---

### Pinch-zoom specific issue

| Option | Description | Selected |
|--------|-------------|----------|
| Conflicts with browser zoom | Browser intercepts the pinch gesture | ✓ |
| Jittery / wrong center | Canvas jumps or wrong pinch center | ✓ |
| Works but reset is missing | No way to reset zoom | |

**User's choice:** Both browser intercept AND jitter; root cause is non-deterministic browser behavior
**Notes:** User wants to disable browser zoom/scroll on the canvas to own all touch behavior.

---

### Divider resizing failure mode

| Option | Description | Selected |
|--------|-------------|----------|
| Long-press starts cell drag instead | 250ms long-press drag threshold fires first | ✓ |
| Hit target too small | 22px isn't reliable enough | ✓ |
| Both issues | Both failures | ✓ |

**User's choice:** Both + browser scroll hijacks during the resize drag
**Notes:** "Can't reliably resize more than a few pixels because browser scroll picks up."

---

### Browser zoom lock scope

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas area only (Recommended) | touch-action: none on CanvasArea div only | ✓ |
| Whole page lock-down | user-scalable=no on viewport + touch-action: none on body | |

**User's choice:** Canvas area only
**Notes:** Surgical approach — preserves bottom sheet scrolling and browser-level features.

---

### Divider fix direction

| Option | Description | Selected |
|--------|-------------|----------|
| Bigger hit area + pointer-events priority | Widen to 32–40px + prevent 250ms drag timer | ✓ |
| Two-finger resize only | Remove touch-divider-drag entirely | |
| You decide | Claude picks approach | |

**User's choice:** Bigger hit area + pointer-events priority

---

## Claude's Discretion

- Exact pixel value for widened divider hit area (40px ± 4px acceptable)
- Whether `data-dnd-ignore` check in adapter already handles this or needs addition
- Clean merge of viewport meta attributes in index.html

## Deferred Ideas

- Add Overlay on mobile (no mobile entry point for text/emoji/sticker)
- Missing mobile tools (safe zone, overlay visibility, zoom controls)
- First-use onboarding improvements
- Two-finger pan alternative (considered, not chosen)
