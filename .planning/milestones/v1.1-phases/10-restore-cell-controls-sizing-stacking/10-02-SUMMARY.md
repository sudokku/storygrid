---
phase: 10-restore-cell-controls-sizing-stacking
plan: 02
subsystem: cell-controls-stacking
tags: [cell-01, media-01, stacking-context, sidebar-upload, audit-gap-closure]
requirements_completed: [CELL-01, MEDIA-01]
dependency_graph:
  requires: []
  provides:
    - "LeafNode root free of `isolate` (ActionBar z-50 escapes per-cell stacking)"
    - "Sidebar Replace input supports video uploads"
  affects:
    - src/Grid/LeafNode.tsx
    - src/Editor/Sidebar.tsx
    - src/test/grid-rendering.test.tsx
tech_stack:
  added: []
  patterns:
    - "Sidebar single-file replace now branches on file.type — mirrors autoFillCells image/video split"
    - "CELL-01 invariant test asserts ABSENCE of `isolate` (supersedes stale REND-10)"
key_files:
  created: []
  modified:
    - src/Grid/LeafNode.tsx
    - src/Editor/Sidebar.tsx
    - src/test/grid-rendering.test.tsx
decisions:
  - "CELL-01 invariant: LeafNode root must NOT include Tailwind `isolate` — codified in comment and regression test"
  - "REND-10 Safari isolation test superseded by CELL-01 — audit decision takes precedence over stale Phase 2 assertion"
  - "Sidebar single-file-replace path fixed to handle video (Rule 2 deviation): uses blob URL + mediaType='video' mirroring autoFillCells"
metrics:
  duration: 4min
  tasks: 3
  files: 3
  completed: 2026-04-08
---

# Phase 10 Plan 02: LeafNode Stacking + Sidebar Video Upload Summary

Close two v1.1 audit gaps: remove stale `isolate` from LeafNode root so the z-50 ActionBar escapes per-cell stacking at small cell sizes (CELL-01), and make the Sidebar Replace input accept (and correctly handle) video uploads (MEDIA-01).

## Tasks Completed

| Task | Name                                                                 | Commit  | Files                                |
| ---- | -------------------------------------------------------------------- | ------- | ------------------------------------ |
| 1    | Remove `isolate` from LeafNode root; reinforce comment with CELL-01  | 687ad33 | src/Grid/LeafNode.tsx                |
| 2    | Sidebar Replace accepts video + fix single-file video branch        | 0bcfed9 | src/Editor/Sidebar.tsx               |
| —    | Update REND-10 test to assert CELL-01 invariant (deviation fix)     | 27adb72 | src/test/grid-rendering.test.tsx     |
| 3    | Run full regression suite (tsc + vitest) + grep gates              | —       | (verification only)                  |

## Verification

- `grep "relative w-full h-full isolate" src/Grid/LeafNode.tsx` — no matches
- `grep "CELL-01" src/Grid/LeafNode.tsx` — match at line 681 (ActionBar comment)
- `grep 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx` — 1 match (line 412)
- `npx tsc --noEmit` — exit 0 after each task
- `npm test -- --run` — 489 passed, 2 skipped, 0 failed (43 test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Sidebar single-file-replace path could not handle video**

- **Found during:** Task 2 — while editing the accept attribute, inspection of `handleFileChange` in `src/Editor/Sidebar.tsx` showed the single-file-replace branch called `fileToBase64(files[0])` unconditionally and invoked `addMedia(newId, dataUri)` without a mediaType argument. For video files this would (a) FileReader-encode the entire video as base64 (defeats the MEDI-03 blob-URL contract) and (b) leave `mediaTypeMap[newId]` undefined so the cell would render as image.
- **Issue:** Changing only the accept attribute would have exposed a latent bug as soon as a user replaced an existing image with a video via the sidebar button.
- **Fix:** Mirrored `autoFillCells` branching in the single-file path: if `file.type.startsWith('video/')` use `URL.createObjectURL(file)` + `addMedia(newId, blobUrl, 'video')`; otherwise keep `fileToBase64` + `addMedia(newId, dataUri, 'image')`. Added early-return guard when file type is neither image nor video.
- **Files modified:** src/Editor/Sidebar.tsx (single edit — covered by the Task 2 commit)
- **Commit:** 0bcfed9
- **Scope justification:** This is a correctness requirement for MEDIA-01 itself — the gap's user-facing goal ("video upload via sidebar Replace works") cannot be met with an attribute-only change.

**2. [Rule 1 - Stale test] REND-10 Safari isolation test contradicted CELL-01**

- **Found during:** Task 3 regression run — `src/test/grid-rendering.test.tsx` asserted `leafEl.className.toContain('isolate')` under a `Safari isolation fix (REND-10)` describe block. This assertion was true before CELL-01 but is now the exact opposite of the intended invariant.
- **Issue:** Regression test failure after Task 1 commit; the test was stale guidance, not a legitimate regression.
- **Fix:** Rewrote the describe block as `ActionBar stacking context (CELL-01)` with a test that asserts `not.toMatch(/\bisolate\b/)`. Added a header comment documenting that CELL-01 supersedes REND-10 and why. This locks the audit decision in as a regression test for future developers.
- **Files modified:** src/test/grid-rendering.test.tsx
- **Commit:** 27adb72

### Cross-Agent Observations

During Task 3 regression, a stashed-work probe revealed that Plan 10-01's parallel executor had in-flight modifications to `src/Grid/ActionBar.tsx` and `src/Grid/__tests__/ActionBar.test.tsx`. Those files are owned by Plan 10-01 and were left untouched by this agent. The final regression run (after 10-01 had landed or stabilized) saw all 489 tests pass, confirming no cross-plan interference.

### Out-of-Scope Deferrals

Lint reported 299 pre-existing unused-vars errors in `src/test/**` files (phase03-phase09 test suites). None are caused by this plan's changes; per scope boundary, not fixed here. No new lint violations introduced by Tasks 1 or 2.

## Known Stubs

None. Both fixes are fully wired and runtime-functional.

## Real-Browser Verification (SC#3) — Pending

Automated jsdom cannot detect CSS stacking-context clipping — the actual visible regression only manifests in a real browser where `isolate` would trap the z-50 ActionBar within the cell's bounding box. Human verification (Flow F):

1. Load the app in Chrome/Firefox/Safari
2. Split a cell down to a small size (~80px tall)
3. Hover the small cell — the ActionBar should paint above sibling cells rather than being clipped at the cell edge

This check is a manual acceptance step for the v1.1 milestone and is not executable from this plan.

## Self-Check: PASSED

- src/Grid/LeafNode.tsx — `isolate` removed, CELL-01 comment present — FOUND
- src/Editor/Sidebar.tsx — `accept="image/*,video/*"` + video branch — FOUND
- src/test/grid-rendering.test.tsx — CELL-01 assertion — FOUND
- Commit 687ad33 — FOUND (Task 1)
- Commit 0bcfed9 — FOUND (Task 2)
- Commit 27adb72 — FOUND (test update)
- All 489 vitest tests pass
