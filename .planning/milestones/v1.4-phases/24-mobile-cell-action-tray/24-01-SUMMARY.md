---
phase: 24
plan: "01"
subsystem: mobile-ui
tags: [mobile, cell-tray, touch, animation]
dependency_graph:
  requires:
    - src/Editor/MobileSheet.tsx
    - src/store/editorStore.ts
    - src/store/gridStore.ts
    - src/lib/tree.ts
    - src/lib/media.ts
    - src/types.ts
  provides:
    - src/Editor/MobileCellTray.tsx
  affects:
    - src/Editor/EditorShell.tsx
tech_stack:
  added: []
  patterns:
    - "Always-mounted CSS-driven visibility with pointerEvents:none gate (reusable for Phase 25 drag overlays)"
    - "Stale-closure guard: useEditorStore.getState() inside async file handler"
    - "Double guard on removeMedia: conditional render + handler if-check"
key_files:
  created:
    - src/Editor/MobileCellTray.tsx
    - src/test/phase24-mobile-cell-tray.test.tsx
  modified:
    - src/Editor/EditorShell.tsx
decisions:
  - "addMedia signature is addMedia(mediaId, dataUri, type) — NOT addMedia(nodeId, file); new mediaId generated via nanoid(), then setMedia(nodeId, newId) wires it to the cell"
  - "Always-mounted pattern: component stays in DOM so CSS exit animation (fade+slide-down) plays; {isVisible && ...} conditional would break exit transition"
  - "pointerEvents:none when hidden prevents invisible tray intercepting canvas taps"
  - "bottom: 60px constant regardless of sheet snap state — tab strip height from Phase 23"
  - "z-[45]: above sheet z-40, below overlays z-50+ as specified in UI-SPEC"
  - "Fit icon mapping: Minimize2 when fit=cover (tap → shrink to contain), Maximize2 when fit=contain (tap → expand to cover)"
  - "Clear button uses conditional render + handler guard: {hasMedia && <button>} AND if (mediaId && selectedNodeId) — mitigates T-24-04 (removeMedia null crash)"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-16"
  tasks_completed: 3
  files_changed: 3
---

# Phase 24 Plan 01: MobileCellTray Component + Wiring + Tests Summary

**One-liner:** Fixed-position mobile cell action tray with 5 buttons (Upload/Split H/Split V/Fit/Clear), CSS-driven fade+slide animation, always-mounted with pointerEvents gate, wired into EditorShell alongside MobileSheet.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create failing test scaffold for MobileCellTray | d4d04fc | src/test/phase24-mobile-cell-tray.test.tsx |
| 2 | Implement MobileCellTray component | 45a72a7 | src/Editor/MobileCellTray.tsx |
| 3 | Wire MobileCellTray into EditorShell | 23c9876 | src/Editor/EditorShell.tsx |

## Verification

- `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` — 19 tests passed (CELL-01/02/03)
- `npx vitest run` — 713 passed / 2 skipped / 4 todo (1 pre-existing failure in phase22-mobile-header.test.tsx unrelated to this plan — see Deviations)
- `npx tsc --noEmit` — clean

## Requirements Closed

- **CELL-01:** `data-testid="mobile-cell-tray"` present; opacity/pointerEvents toggle with selectedNodeId; bottom:60px; z-[45]; md:hidden
- **CELL-02:** Upload/Replace, Split H, Split V, Fit toggle (Minimize2/Maximize2), Clear (conditional on hasMedia); no Remove cell button
- **CELL-03:** All buttons have `min-w-[44px] min-h-[44px]`; inner container has `gap-2`

## Deviations from Plan

### Pre-existing Test Failure (Out of Scope)

**phase22-mobile-header.test.tsx — "calls clearGrid without calling window.confirm"** — This test was already failing before this plan's changes (confirmed by reverting EditorShell and re-running the test). The mock pattern `useGridStore.setState({ clearGrid: clearGridMock } as ReturnType<typeof useGridStore.setState>)` is incompatible with how Zustand v5 handles action injection. This failure predates Phase 24 and is tracked as a deferred item.

No auto-fixes applied (Rule 3 scope boundary: pre-existing failure in an unrelated file).

## Patterns Established

**Always-mounted CSS-driven visibility** — component is always rendered; visibility driven by inline style `opacity`/`pointerEvents`/`transform`. This pattern enables CSS exit animations and is directly reusable for Phase 25 touch drag overlay.

**Stale-closure guard in async handlers** — `useEditorStore.getState().selectedNodeId` read inside async `handleFileChange` instead of from React closure. Prevents media being assigned to wrong cell if user taps elsewhere while file picker is open (T-24-01 mitigation).

## Threat Model Compliance

| Threat | Disposition | Applied |
|--------|-------------|---------|
| T-24-01 Stale closure | mitigate | `useEditorStore.getState()` inside async handler |
| T-24-02 File size DoS | accept | Client-only, consistent with SelectedCellPanel |
| T-24-03 File type validation | accept | `accept=` hint only; no server-side exposure |
| T-24-04 removeMedia(null) | mitigate | `{hasMedia && <button>}` + `if (mediaId && selectedNodeId)` double guard |
| T-24-05 Repudiation | accept | No auth in scope |

## Self-Check: PASSED

- `src/Editor/MobileCellTray.tsx` — FOUND
- `src/test/phase24-mobile-cell-tray.test.tsx` — FOUND
- `src/Editor/EditorShell.tsx` modified — FOUND (import + JSX)
- Commit d4d04fc — FOUND
- Commit 45a72a7 — FOUND
- Commit 23c9876 — FOUND
