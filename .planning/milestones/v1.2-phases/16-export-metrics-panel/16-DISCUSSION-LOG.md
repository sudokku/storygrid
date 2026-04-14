# Phase 16: Export Metrics Panel — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 16-export-metrics-panel
**Areas discussed:** Dismiss behavior, ETA formula, Perf.mark() spans, Post-export state

---

## Dismiss Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse to status line | Panel shrinks to single line showing phase + progress %. Click re-expands. | ✓ |
| Full dismiss | Panel disappears entirely until next export. | |
| You decide | Claude picks simpler approach. | |

**User's choice:** Collapse to status line

---

### Sub-question: Reappear on next export?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always reappear expanded | Dismiss is per-export only — not a persistent preference. | ✓ |
| Respect last state | Start collapsed if user left it collapsed. | |

**User's choice:** Always reappear expanded

---

## ETA Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Simple frames extrapolation | ETA = (totalFrames - framesEncoded) / encodeFps | ✓ |
| Phases-aware estimate | Account for audio + finalize with empirical weights. | |
| Skip ETA | Remove ETA row entirely. | |

**User's choice:** Simple frames extrapolation

---

## Perf.mark() Spans

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, emit marks | per-frame marks gated behind METRICS_ENABLED | ✓ |
| No, skip marks | Panel metrics are sufficient. | |

**User's choice:** Yes, emit marks

---

## Post-Export State

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss after 3s | Final snapshot shows for 3s then fades. | |
| Stay until closed | Panel stays with final metrics until [×] clicked. | ✓ |
| Instant dismiss | Panel disappears as soon as export completes. | |

**User's choice:** Stay until closed — allows copy-paste / screenshot of final numbers.

---

## Claude's Discretion

- Animation/transition style for collapse/expand
- Exact color scheme for collapsed status line
- `useRef` vs `useState` for interval handle
- Exact wording for unavailable metrics ("N/A" vs "—") on non-Chrome

## Deferred Ideas

None.
