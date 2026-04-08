---
phase: 10-restore-cell-controls-sizing-stacking
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Grid/LeafNode.tsx
  - src/Editor/Sidebar.tsx
autonomous: true
requirements: [CELL-01, MEDIA-01]
gap_closure: true

must_haves:
  truths:
    - "LeafNode.tsx root div no longer applies the `isolate` utility, so the z-50 ActionBar wrapper can paint above sibling LeafNodes"
    - "The stale comment block at/near LeafNode.tsx:678 accurately reflects the actual className state (no `isolate`)"
    - "The Sidebar Replace file input accepts video files (`accept` attribute contains `video/*`)"
    - "Phase 7 / Phase 9 regression tests still pass after the changes"
  artifacts:
    - path: "src/Grid/LeafNode.tsx"
      provides: "LeafNode root without isolate; ActionBar z-50 escapes stacking context"
      contains: "relative w-full h-full overflow-visible select-none"
    - path: "src/Editor/Sidebar.tsx"
      provides: "Sidebar Replace input that accepts both images and videos"
      contains: "accept=\"image/*,video/*\""
  key_links:
    - from: "src/Grid/LeafNode.tsx root div"
      to: "ActionBar wrapper z-50"
      via: "absence of `isolate` on any ancestor within the cell"
      pattern: "className=`\\s*relative w-full h-full overflow-visible"
    - from: "src/Editor/Sidebar.tsx Replace input"
      to: "video upload path"
      via: "accept attribute including video/*"
      pattern: "accept=\"image/\\*,video/\\*\""
---

<objective>
Close two v1.1 audit gaps in a single focused plan:

1. CELL-01 stacking-context risk: LeafNode root has `isolate` which creates a per-cell stacking context, preventing the z-50 ActionBar wrapper from painting above sibling cells at small sizes. The stale comment at line ~678 already claims "no isolate" — the comment was true once, but the class drifted. Fix by removing `isolate` (aligning code with the documented intent).

2. MEDIA-01 polish: Sidebar Replace `<input type="file">` has `accept="image/*"`, blocking video uploads via the sidebar button. Other upload paths (cell ActionBar Upload button, drag-drop) already accept `image/*,video/*`. Align the sidebar to match.

Purpose: Restore ActionBar visibility at small cell sizes near sibling boundaries (Flow F real-browser risk), and make the sidebar Replace button consistent with the rest of the app.

Output: LeafNode.tsx with `isolate` removed from the root className; Sidebar.tsx with video/* added to the Replace input accept attribute.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/v1.1-MILESTONE-AUDIT.md
@.planning/REQUIREMENTS.md
@src/Grid/LeafNode.tsx
@src/Editor/Sidebar.tsx

<interfaces>
<!-- Current LeafNode.tsx root div (lines 559-566): -->
<!--   <div -->
<!--     ref={divRef} -->
<!--     className={` -->
<!--       relative w-full h-full isolate overflow-visible select-none -->
<!--       ${isHovered && !isPanMode ? 'z-20' : ''} -->
<!--       ${ringClass} -->
<!--       ${hasMedia ? '' : 'bg-[#1c1c1c]'} -->
<!--     `} -->

<!-- Current stale comment (lines 675-680): -->
<!--   ActionBar — sibling of the canvas-clip-wrapper (NOT a descendant), so it -->
<!--   is not subject to overflow:hidden. Cell root is overflow-visible and has -->
<!--   no `isolate`, so z-50 escapes per-cell stacking and paints above any -->
<!--   neighbouring sibling cell the bar overflows into. -->
<!-- The comment claims "no isolate" but the className has `isolate`. Fix by -->
<!-- removing `isolate` so the comment becomes factually accurate. -->

<!-- Current Sidebar.tsx Replace input (lines 397-403): -->
<!--   <input -->
<!--     ref={inputRef} -->
<!--     type="file" -->
<!--     accept="image/*" -->
<!--     multiple -->
<!--     className="hidden" -->
<!--     onChange={handleFileChange} -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Remove `isolate` from LeafNode root, align stale comment with actual code</name>
  <files>src/Grid/LeafNode.tsx</files>

  <read_first>
    - src/Grid/LeafNode.tsx (lines 550–700: root div + ActionBar wrapper block + comment)
    - .planning/v1.1-MILESTONE-AUDIT.md (CELL-01 gap evidence and tech debt section for the stale comment)
    - .planning/phases/07-cell-controls-display-polish/07-01-SUMMARY.md if present (for original Phase 7 decision context around `isolate`)
    - Run: `git log --oneline -L '/className={`/,/`}/:src/Grid/LeafNode.tsx' | head -20` to trace when `isolate` was added
  </read_first>

  <action>
    Modify src/Grid/LeafNode.tsx as follows:

    1. In the root div className template literal (currently lines 561–566):

    BEFORE:
    ```tsx
    <div
      ref={divRef}
      className={`
        relative w-full h-full isolate overflow-visible select-none
        ${isHovered && !isPanMode ? 'z-20' : ''}
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
    ```

    AFTER (delete the literal word `isolate`):
    ```tsx
    <div
      ref={divRef}
      className={`
        relative w-full h-full overflow-visible select-none
        ${isHovered && !isPanMode ? 'z-20' : ''}
        ${ringClass}
        ${hasMedia ? '' : 'bg-[#1c1c1c]'}
      `}
    ```

    The rest of the className stays identical: relative, w-full, h-full, overflow-visible, select-none, conditional z-20, ringClass, bg conditional.

    2. The existing comment block at lines ~675–680 already says "no `isolate`" — it becomes accurate after step 1, so the TEXT of the comment stays as-is. However, to avoid future drift, EXTEND the comment with a CELL-01 reference so future developers know why `isolate` must not come back:

    REPLACE the existing comment block (between the `{activeZone === 'center' && ...}` block and the `{isHovered && !isPanMode && (` ActionBar block) with:

    ```tsx
    {/*
      ActionBar — sibling of the canvas-clip-wrapper (NOT a descendant), so it
      is not subject to overflow:hidden. Cell root is overflow-visible and has
      no `isolate`, so z-50 escapes per-cell stacking and paints above any
      neighbouring sibling cell the bar overflows into.

      CELL-01 (Phase 10, v1.1 audit): do NOT re-introduce `isolate` on the root
      div. `isolate` creates a per-cell stacking context that traps the z-50
      ActionBar wrapper inside the cell and clips it at sibling boundaries at
      small cell sizes. The audit flagged this as a real-browser regression
      risk even though jsdom could not detect it.
    */}
    ```

    3. Do NOT change any other className, event handler, overlay, or the ActionBar render block itself. Only the root div className loses the word `isolate`, and the comment gains a CELL-01 paragraph.

    4. Do NOT remove `z-20` or any other stacking-related class — only the literal token `isolate`.

    CONSTRAINTS:
    - Tailwind v3.4, React 18, TypeScript 5.8 only.
    - No new imports, no new state, no behavior changes beyond the className tweak.
    - The comment update MUST be wrapped in `{/* ... */}` (JSX comment) matching existing style.
  </action>

  <behavior>
    - LeafNode root div className no longer contains the word `isolate`
    - The comment above the ActionBar wrapper explicitly references CELL-01 and the Phase 10 audit decision
    - Existing tests in src/test/ that mount LeafNode still pass (none assert on `isolate` class directly)
    - TypeScript compiles cleanly
    - Visually: in a real browser, the z-50 ActionBar escapes the per-cell stacking context when hovered at small cell sizes
  </behavior>

  <verify>
    <automated>
      ! grep -nE "relative w-full h-full isolate" src/Grid/LeafNode.tsx && \
      ! grep -n " isolate " src/Grid/LeafNode.tsx && \
      grep -n "CELL-01" src/Grid/LeafNode.tsx && \
      grep -n "no \`isolate\`" src/Grid/LeafNode.tsx && \
      npx tsc --noEmit
    </automated>
  </verify>

  <acceptance_criteria>
    - `grep "relative w-full h-full isolate" src/Grid/LeafNode.tsx` returns no matches
    - `grep -E "^\s+relative w-full h-full overflow-visible select-none$" src/Grid/LeafNode.tsx` returns exactly 1 match (the root className line)
    - `grep "CELL-01" src/Grid/LeafNode.tsx` returns at least 1 match (in the expanded comment)
    - `grep "no \`isolate\`" src/Grid/LeafNode.tsx` returns at least 1 match (comment still mentions no isolate)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>
    LeafNode root className is `isolate`-free; the comment at ~line 678 explicitly references CELL-01 and the Phase 10 audit so future edits know not to re-introduce `isolate`; TypeScript compiles.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend Sidebar Replace input accept to include video/*</name>
  <files>src/Editor/Sidebar.tsx</files>

  <read_first>
    - src/Editor/Sidebar.tsx lines 390–420 (the file input + surrounding handleFileChange)
    - src/Grid/LeafNode.tsx line 587 (reference: existing `accept="image/*,video/*"` pattern used by the LeafNode file input)
    - src/Grid/ActionBar.tsx (how it triggers uploads — for context that both paths should behave identically)
    - .planning/v1.1-MILESTONE-AUDIT.md (tech debt section: "Sidebar.tsx:400 file input accept='image/*' blocks video upload")
  </read_first>

  <action>
    Modify src/Editor/Sidebar.tsx:

    1. Locate the Replace file input around line 397–404:
    ```tsx
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={handleFileChange}
    ```

    2. REPLACE `accept="image/*"` with `accept="image/*,video/*"`.

    This exactly matches the pattern already used in src/Grid/LeafNode.tsx line 587.

    3. Do NOT change `multiple`, `className`, `type`, `ref`, or `onChange`.

    4. Check `handleFileChange` in Sidebar.tsx. If it already routes through the same upload action as LeafNode (which handles both image and video media types per the Phase 6 mediaTypeMap work), NO FURTHER CHANGES are needed. If it does NOT handle videos, STOP and surface this as a blocker — do not invent a new upload path. (Per the audit, the underlying upload action already supports video — only the accept attribute is the gap.)

    CONSTRAINTS:
    - No new dependencies.
    - No change to button labels or aria text in the sidebar.
    - No change to other file inputs elsewhere in Sidebar.tsx (if any exist).
  </action>

  <behavior>
    - Clicking Replace in the sidebar opens a file picker that accepts both image and video files
    - Uploading a video via the sidebar Replace button succeeds with the same flow as dragging a video onto a cell
    - Existing sidebar tests still pass
  </behavior>

  <verify>
    <automated>
      grep -n 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx && \
      ! grep -n 'accept="image/\*"$' src/Editor/Sidebar.tsx && \
      npx tsc --noEmit
    </automated>
  </verify>

  <acceptance_criteria>
    - `grep 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx` returns at least 1 match
    - `grep 'accept="image/\*"' src/Editor/Sidebar.tsx` returns no exact-equals matches (only the combined form remains)
    - `npx tsc --noEmit` exits 0
    - `handleFileChange` in Sidebar.tsx was verified to support video media types (or executor flagged as blocker before editing)
  </acceptance_criteria>

  <done>
    Sidebar Replace input accepts `image/*,video/*`, matching ActionBar and drag-drop upload paths; TypeScript compiles.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Run full regression suite + grep gate for both fixes</name>
  <files>(verification only — no file changes)</files>

  <read_first>
    - src/Grid/LeafNode.tsx (confirm Task 1 landed)
    - src/Editor/Sidebar.tsx (confirm Task 2 landed)
  </read_first>

  <action>
    Run the full regression gate after Tasks 1 and 2 in this plan and Task 1 in plan 10-01 have all landed. If run as part of plan 10-02 alone, still run the full suite to catch any LeafNode integration breakage.

    Commands to run in order:

    1. `npx tsc --noEmit` — full TypeScript check
    2. `npm run lint` (if the project has a lint script — check package.json; if no lint script, skip this step silently)
    3. `npm test -- --run` — full Vitest suite

    If any command fails, STOP and report the failure. Do NOT attempt to fix test failures by modifying tests — if Phase 7/9 tests broke, that is a regression from this phase's changes and must be surfaced.

    Grep gates (must all pass):
    - `! grep "relative w-full h-full isolate" src/Grid/LeafNode.tsx`
    - `grep "CELL-01" src/Grid/LeafNode.tsx`
    - `grep 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx`
  </action>

  <verify>
    <automated>
      npx tsc --noEmit && \
      npm test -- --run && \
      ! grep "relative w-full h-full isolate" src/Grid/LeafNode.tsx && \
      grep -q "CELL-01" src/Grid/LeafNode.tsx && \
      grep -q 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx
    </automated>
  </verify>

  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0
    - `npm test -- --run` exits 0 (all existing tests including Phase 7 and Phase 9 pass)
    - All grep gates pass
  </acceptance_criteria>

  <done>
    Full regression suite green; both fixes verified present in the tree.
  </done>
</task>

</tasks>

<verification>
Maps to ROADMAP Success Criteria #3, #4, #5, and #6:

- SC#3: `LeafNode.tsx` root no longer creates a stacking context that clips the ActionBar → `isolate` removed (Task 1); grep-verified
- SC#4: The stale "no isolate" comment at `LeafNode.tsx:678` is corrected → comment now accurately describes the code AND references CELL-01 for future-proofing (Task 1)
- SC#5: Sidebar Replace file input accepts video files → Task 2; grep-verified
- SC#6: Phase 7 regression tests still pass → Task 3 full test run

Real-browser verification of SC#3 (Flow F: shrink cell, hover, ActionBar visible above sibling) is a human check to be performed after the phase lands. Automated jsdom cannot verify stacking contexts.
</verification>

<success_criteria>
- [ ] `grep "relative w-full h-full isolate" src/Grid/LeafNode.tsx` returns no matches
- [ ] `grep "CELL-01" src/Grid/LeafNode.tsx` returns a match inside the ActionBar comment block
- [ ] `grep 'accept="image/\*,video/\*"' src/Editor/Sidebar.tsx` returns a match
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test -- --run` exits 0
- [ ] Post-phase human verification: shrink a cell in a real browser, hover — ActionBar paints above sibling cells without clipping
</success_criteria>

<output>
After completion, create `.planning/phases/10-restore-cell-controls-sizing-stacking/10-02-SUMMARY.md` with:
- requirements_completed: [CELL-01, MEDIA-01]
- Files modified: src/Grid/LeafNode.tsx, src/Editor/Sidebar.tsx
- Note: SC#3 real-browser verification is a human-only check — record the outcome of that check in the summary if performed during execution
</output>
