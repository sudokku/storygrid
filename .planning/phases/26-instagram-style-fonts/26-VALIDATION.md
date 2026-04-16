---
phase: 26
slug: instagram-style-fonts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 0 | FONT-01 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 26-01-02 | 01 | 1 | FONT-01 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 26-01-03 | 01 | 1 | FONT-02 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 26-01-04 | 01 | 2 | FONT-03 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `src/components/__tests__/OverlayPanel.test.tsx` — rewrite Test 2 to query FontPickerList buttons (8 fonts) instead of `<select>` with 3 options

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No FOIT flash during font load | FONT-02 | Visual/timing — cannot assert in unit tests | Apply a new font to a text overlay; confirm text stays visible (no blank period) during load |
| Each font name renders in its own typeface in picker | FONT-03 | Visual rendering — CSS `fontFamily` on buttons | Open font picker; verify each name visually matches its typeface |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
