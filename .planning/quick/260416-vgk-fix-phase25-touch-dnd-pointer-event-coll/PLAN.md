---
quick_id: 260416-vgk
date: 2026-04-16
description: Fix phase 25 touch DnD pointer event collision and scale visual overflow
files_modified:
  - src/Grid/LeafNode.tsx
---

<objective>
Fix two bugs found during phase 25 verification:
1. @dnd-kit drag never initiates because handlePointerDown overrides dragListeners in JSX
2. transform: scale(1.08) on root div causes visual overflow outside cell layout box
</objective>

<tasks>

<task>
<name>Fix pointer event collision — move dragListeners spread to last position</name>
<files>src/Grid/LeafNode.tsx</files>
<action>
In the root div JSX of LeafNodeComponent:

CURRENT (broken): `{...dragListeners}` is spread at line ~615 (before all explicit handlers).
`onPointerDown={handlePointerDown}` at line ~639 comes AFTER and overrides @dnd-kit's handler.
In non-pan mode, handlePointerDown returns early — @dnd-kit never gets the event.

FIX:
1. Remove `{...dragListeners}` from its current position near the top of the div props.
2. Add `{...(!isPanMode ? dragListeners : {})}` as the LAST spread before data-testid/aria props.
   - In non-pan mode: @dnd-kit's onPointerDown overrides handlePointerDown (which was a no-op)
   - In pan mode: spread is {}, so handlePointerDown wins for pan tracking

3. Add `isPanModeRef` to track pan mode for native listeners:
   - Declare `const isPanModeRef = useRef(false);` in the hook block (before early return)
   - After `const isPanMode = panModeNodeId === id;` (after early return), update ref inline:
     `isPanModeRef.current = isPanMode;`

4. Add native pointerdown listener (useEffect) to set isPendingDrag=true in non-pan mode.
   This makes the hold-pulse animation actually trigger during the 500ms hold wait.
   Add BEFORE the early return guard (with other useEffect hooks):
   ```typescript
   useEffect(() => {
     const el = divRef.current;
     if (!el) return;
     const onDown = () => { if (!isPanModeRef.current) setIsPendingDrag(true); };
     const onUp = () => setIsPendingDrag(false);
     el.addEventListener('pointerdown', onDown, { passive: true });
     el.addEventListener('pointerup', onUp, { passive: true });
     el.addEventListener('pointercancel', onUp, { passive: true });
     return () => {
       el.removeEventListener('pointerdown', onDown);
       el.removeEventListener('pointerup', onUp);
       el.removeEventListener('pointercancel', onUp);
     };
   }, []);
   ```

Result: @dnd-kit's sensor gets the pointer events in non-pan mode. Pan mode still works.
isPendingDrag is set on pointerdown and cleared on pointerup/drag-start.
</action>
</task>

<task>
<name>Fix scale visual overflow — replace transform scale with box-shadow lift</name>
<files>src/Grid/LeafNode.tsx</files>
<action>
In the root div style (isDragging branch):

CURRENT: `...(isDragging ? { transform: 'scale(1.08)', opacity: 0.6 } : {})`
`transform: scale(1.08)` visually overflows the cell's layout box into adjacent cells.
Parent containers clip at the original layout size, so the "border" appears smaller than the content.

FIX:
Replace `transform: scale(1.08)` with `boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.6)'`.
Keep `opacity: 0.6`.
Also update the transition from `'transform 150ms ease-out, opacity 150ms ease-out'`
to `'opacity 150ms ease-out, box-shadow 150ms ease-out'`.

Result: dragged cell shows a white inset ring + reduced opacity — clearly "selected/lifted" —
without overflowing its layout boundary.
</action>
</task>

<task>
<name>Verify — TypeScript and tests pass</name>
<files></files>
<action>
Run:
  npx tsc --noEmit
  npx vitest run
Both must exit 0.
</action>
</task>

</tasks>

<success_criteria>
- src/Grid/LeafNode.tsx root div: {…dragListeners} spread appears LAST (or conditionally last)
- In non-pan mode, @dnd-kit's onPointerDown is no longer overridden
- isDragging style has NO transform: scale — uses boxShadow inset instead
- isPendingDrag=true fires on native pointerdown when not in pan mode
- npx tsc --noEmit exits 0
- npx vitest run exits 0
</success_criteria>
