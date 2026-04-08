---
phase: 10-restore-cell-controls-sizing-stacking
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Grid/ActionBar.tsx
autonomous: true
requirements: [CELL-02]
gap_closure: true

must_haves:
  truths:
    - "ActionBar buttons are sized via clamp(28px, 2.2vw, 36px) — not a fixed 64px"
    - "ActionBar icons scale with the button, sized via clamp(16px, 1.4vw, 20px)"
    - "The fixed w-16 h-16 class and ICON_SIZE = 32 constant no longer exist in ActionBar.tsx"
    - "Resizing the viewport from a small laptop to a 4K display keeps ActionBar buttons within the 28–36px range"
    - "npm test exits 0 (Phase 7 regression tests still pass)"
  artifacts:
    - path: "src/Grid/ActionBar.tsx"
      provides: "Viewport-stable clamp()-sized action bar buttons"
      contains: "clamp(28px, 2.2vw, 36px)"
  key_links:
    - from: "src/Grid/ActionBar.tsx"
      to: "button style"
      via: "inline style width/height driven by clamp() CSS string"
      pattern: "clamp\\(28px,\\s*2\\.2vw,\\s*36px\\)"
---

<objective>
Re-land the CELL-02 viewport-stable ActionBar button sizing that was reverted in commit 1476df2.

Purpose: The Phase 7 clamp()-based sizing (CELL-02) was reverted during an abandoned portal experiment. Currently buttons are fixed at 64px (w-16 h-16) regardless of viewport, so Flow E (laptop → 4K resize keeps buttons in 28–36px range) fails. Restore clamp() sizing in its modern form.

Output: ActionBar.tsx using `clamp(28px, 2.2vw, 36px)` for button width/height and `clamp(16px, 1.4vw, 20px)` for icon size, with the fixed `w-16 h-16` Tailwind class and `ICON_SIZE = 32` constant removed.
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
@src/Grid/ActionBar.tsx

<interfaces>
<!-- Current ActionBar.tsx state (the code to replace): -->
<!-- Line 50: const ICON_SIZE = 32; -->
<!-- Line 51: const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors w-16 h-16'; -->
<!-- Lines 72, 77, 84, 91, 98-100, 111, 119: <Icon size={ICON_SIZE} ... /> -->
<!-- Button pattern: <button className={btnClass} ...> or className={`${btnClass} ...`} -->

<!-- lucide-react icons accept EITHER a numeric `size` prop OR explicit width/height props. -->
<!-- For clamp() sizing, switch to inline `style={{ width: 'clamp(...)', height: 'clamp(...)' }}` -->
<!-- because lucide's `size` prop only accepts numbers, not CSS strings. -->
</interfaces>

<reverted_commit_reference>
Commit 1476df2 reverted the original clamp() sizing work. Executor MUST run `git show 1476df2` before editing to see the exact shape of the revert. The re-landed fix should match the spirit of the original Phase 7 sizing (per audit evidence: `clamp(28px, 2.2vw, 36px)` for buttons).
</reverted_commit_reference>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Replace fixed w-16 h-16 / ICON_SIZE with clamp() sizing</name>
  <files>src/Grid/ActionBar.tsx</files>

  <read_first>
    - src/Grid/ActionBar.tsx (ENTIRE FILE — understand all button sites)
    - .planning/v1.1-MILESTONE-AUDIT.md (CELL-02 evidence section, lines 16–18)
    - Run: `git show 1476df2 -- src/Grid/ActionBar.tsx` to see what was reverted
    - Run: `git log --oneline -- src/Grid/ActionBar.tsx | head -20` to find the original Phase 7 clamp() commit (likely f7357a4 per audit)
    - Run: `git show f7357a4 -- src/Grid/ActionBar.tsx 2>/dev/null` for the original clamp() shape (reference only; re-implement fresh)
    - src/Grid/LeafNode.tsx lines 609 and 612 (reference: existing clamp() sizing pattern already used in this codebase for empty-cell icon/label — `clamp(40px, 3.2vw, 64px)`)
  </read_first>

  <action>
    Modify src/Grid/ActionBar.tsx as follows:

    1. DELETE line 50: `const ICON_SIZE = 32;`
    2. DELETE line 51 (the fixed btnClass): `const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors w-16 h-16';`

    3. REPLACE with these constants inside the component body (above the return statement):

    ```tsx
    // CELL-02: viewport-stable sizing via clamp() — re-landed after 1476df2 revert.
    // Buttons scale linearly with viewport width between a 28px floor (small laptop)
    // and a 36px ceiling (4K display). Icons scale proportionally.
    const btnStyle: React.CSSProperties = {
      width: 'clamp(28px, 2.2vw, 36px)',
      height: 'clamp(28px, 2.2vw, 36px)',
    };
    const iconStyle: React.CSSProperties = {
      width: 'clamp(16px, 1.4vw, 20px)',
      height: 'clamp(16px, 1.4vw, 20px)',
    };
    const btnClass = 'flex items-center justify-center rounded hover:bg-white/10 transition-colors';
    ```

    Note: `btnClass` is kept as a string (without size classes) so existing `${btnClass}` template-literal concatenations (e.g. `${btnClass} cursor-grab`, `${btnClass} hover:bg-red-500/20`) keep working. Sizing moves to inline style on every `<button>`.

    4. For EVERY `<button>` or `<TooltipTrigger render={<button ... />}>` in the file (there are 7 button sites: drag handle, upload, split H, split V, toggle fit, clear media, remove cell), add `style={btnStyle}` to the button element:

    - Drag handle button (line ~62): add `style={btnStyle}` alongside existing props
    - Upload TooltipTrigger button (line ~76): `render={<button style={btnStyle} className={btnClass} ... />}`
    - Split H TooltipTrigger button (line ~83): same
    - Split V TooltipTrigger button (line ~90): same
    - Toggle Fit TooltipTrigger button (line ~97): same
    - Clear Media TooltipTrigger button (line ~110): `render={<button style={btnStyle} className={`${btnClass} hover:bg-red-500/20`} ... />}`
    - Remove Cell TooltipTrigger button (line ~118): same pattern

    5. For EVERY lucide icon invocation, REPLACE `size={ICON_SIZE}` with `style={iconStyle}` (lucide-react supports `style` which cascades to the underlying `<svg>`). DELETE the `size=` prop. DO NOT add a numeric size back.

    Icons to update (7 sites):
    - `GripVertical` (line ~72)
    - `Upload` (line ~77)
    - `SplitSquareHorizontal` (line ~84)
    - `SplitSquareVertical` (line ~91)
    - `Minimize2` / `Maximize2` ternary (lines ~99–100)
    - `ImageOff` (line ~111)
    - `Trash2` (line ~119)

    Example BEFORE:
    ```tsx
    <GripVertical size={ICON_SIZE} className="text-white" />
    ```
    Example AFTER:
    ```tsx
    <GripVertical style={iconStyle} className="text-white" />
    ```

    6. Verify no stray `w-16`, `h-16`, or `ICON_SIZE` literals remain anywhere in the file.

    7. Do NOT change the container `div` className (line 56) — gap-1 / px-1 / py-1 / rounded-md / bg-black/70 / backdrop-blur-sm stay as-is.

    8. Do NOT add new imports. React.CSSProperties is already available via the top-of-file `import React` (since React is imported default).

    CONSTRAINTS:
    - No new dependencies. Tailwind v3.4 only (clamp() is a raw CSS function, works in inline style).
    - No change to button order, aria-labels, data-testids, or event handlers.
    - TypeScript 5.8 strict — `btnStyle` and `iconStyle` must be typed as `React.CSSProperties`.
  </action>

  <behavior>
    - ActionBar renders with buttons sized 28–36px depending on viewport width (tested via computed style at 1024px and 3840px virtual widths)
    - All 7 buttons have `style={{ width: 'clamp(28px, 2.2vw, 36px)', ...}}`
    - All 7 icons have `style={iconStyle}` (no `size=` prop)
    - Existing Phase 7/9 tests in src/test/*.tsx that reference ActionBar by data-testid still pass
    - TypeScript compiles with no errors
  </behavior>

  <verify>
    <automated>
      grep -n "clamp(28px, 2.2vw, 36px)" src/Grid/ActionBar.tsx && \
      ! grep -n "w-16 h-16" src/Grid/ActionBar.tsx && \
      ! grep -n "ICON_SIZE" src/Grid/ActionBar.tsx && \
      ! grep -n "size={ICON_SIZE}" src/Grid/ActionBar.tsx && \
      npx tsc --noEmit && \
      npm test -- --run
    </automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "clamp(28px, 2.2vw, 36px)" src/Grid/ActionBar.tsx` returns >= 1
    - `grep -c "clamp(16px, 1.4vw, 20px)" src/Grid/ActionBar.tsx` returns >= 1
    - `grep "w-16 h-16" src/Grid/ActionBar.tsx` returns no matches (exit 1)
    - `grep "ICON_SIZE" src/Grid/ActionBar.tsx` returns no matches (exit 1)
    - `grep -c "style={btnStyle}" src/Grid/ActionBar.tsx` returns exactly 7 (one per button)
    - `grep -c "style={iconStyle}" src/Grid/ActionBar.tsx` returns exactly 7 (one per icon)
    - `npx tsc --noEmit` exits 0
    - `npm test -- --run` exits 0 (all existing tests pass)
  </acceptance_criteria>

  <done>
    ActionBar.tsx is driven by clamp() for both button box and icon size; the fixed 64px button and ICON_SIZE=32 constant are gone; TypeScript compiles; all existing unit tests still pass.
  </done>
</task>

</tasks>

<verification>
Maps to ROADMAP Success Criteria #1, #2, and #6 (partially — Phase 7 regression tests still pass):

- SC#1: `ActionBar.tsx` button size is driven by `clamp(28px, 2.2vw, 36px)`; fixed `w-16 h-16` and `ICON_SIZE = 32` gone → verified by grep
- SC#2: Viewport 1024 → 3840 keeps buttons 28–36px → verified by clamp() formula math (vw × 2.2 / 100 clamped to [28,36])
- SC#6: `npm test` exits 0 → verified automatically

SC#2 real-browser check is a human concern (not automated here); Flow E in the audit will be re-run post-phase.
</verification>

<success_criteria>
- [ ] `grep "clamp(28px, 2.2vw, 36px)" src/Grid/ActionBar.tsx` returns a match
- [ ] `grep "w-16 h-16" src/Grid/ActionBar.tsx` returns no matches
- [ ] `grep "ICON_SIZE" src/Grid/ActionBar.tsx` returns no matches
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test -- --run` exits 0
- [ ] Manual math check: 2.2vw at 1024px = 22.5px → clamped to 28px (floor); at 3840px = 84.5px → clamped to 36px (ceiling)
</success_criteria>

<output>
After completion, create `.planning/phases/10-restore-cell-controls-sizing-stacking/10-01-SUMMARY.md` with:
- requirements_completed: [CELL-02]
- Files modified: src/Grid/ActionBar.tsx
- Reference: re-lands the fix reverted in 1476df2
</output>
