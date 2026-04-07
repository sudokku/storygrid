---
type: quick
autonomous: true
files_modified:
  - src/Editor/MobileSheet.tsx
  - src/index.css
  - src/Editor/CanvasArea.tsx
---

<objective>
Fix four mobile UI regressions found during real-device testing via ngrok on iPhone:

1. MobileSheet drag handle goes off-screen in 'full' snap state (page refresh required to close)
2. Ugly serif fonts — the Geist Variable CSS variable is defined inside `.theme {}` instead of `:root {}`, so `font-family: var(--font-sans)` resolves to nothing and the browser falls back to serif
3. Sheet content not scrollable on iOS — `overflow-y: auto` alone is insufficient; `-webkit-overflow-scrolling: touch` required for momentum scrolling
4. Canvas stealing touch/scroll events when sheet is open — `CanvasArea` needs `touch-action: none` when sheet is not collapsed

Purpose: App is unusable on iPhone without these fixes.
Output: Working mobile UX — sheet always closeable, correct font, scrollable settings, no canvas scroll bleed.
</objective>

<context>
@.planning/STATE.md
@src/Editor/MobileSheet.tsx
@src/index.css
@src/Editor/CanvasArea.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix MobileSheet snap geometry, iOS scroll, and touch isolation</name>
  <files>src/Editor/MobileSheet.tsx, src/Editor/CanvasArea.tsx</files>
  <action>
**MobileSheet.tsx — four changes:**

1. **Full snap must leave a top gap.** Change SNAP_TRANSLATE['full'] from `'translateY(0)'` to:
   ```
   'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))'
   ```
   This guarantees the drag handle is always at least 56px below the safe area (status bar), never going off-screen. The outer sheet div keeps `height: '100vh'` so the content area fills correctly.

2. **iOS momentum scroll on content area.** The existing content div already has `overflow-y: auto` and `height: calc(100% - 60px)`. Add `WebkitOverflowScrolling: 'touch'` to its inline style so iOS uses native momentum scrolling. Also add `overscrollBehavior: 'contain'` to prevent the scroll from bubbling to the page behind the sheet.

3. **Prevent touch passthrough to canvas.** Add a `data-sheet-snap` attribute to the outer sheet div reflecting `sheetSnapState` (e.g. `data-sheet-snap={sheetSnapState}`). This allows CSS targeting without prop drilling to CanvasArea.

   Additionally, on the drag handle `<div>`, add `style={{ height: 60 }}` (explicit px height matching the content calc) so the handle area is always exactly 60px and doesn't collapse.

4. **Drag handle touch-action.** The drag handle div already has `className="touch-none ..."` — verify this is preserved. No change needed unless it was lost.

**CanvasArea.tsx — one change:**

Subscribe to `sheetSnapState` from `useEditorStore` and add `touch-action: none` to the `<main>` element when the sheet is not collapsed:

```tsx
import { useEditorStore } from '../store/editorStore';

export function CanvasArea() {
  const sheetSnapState = useEditorStore(s => s.sheetSnapState);
  const sheetOpen = sheetSnapState !== 'collapsed';

  return (
    <main
      className="flex flex-1 items-start justify-center overflow-hidden bg-[#0f0f0f] p-0 pt-2 md:p-8"
      style={sheetOpen ? { touchAction: 'none' } : undefined}
    >
      <CanvasWrapper />
    </main>
  );
}
```

This prevents the canvas from receiving any touch events while the sheet is at half or full state.
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - SNAP_TRANSLATE['full'] uses max(safe-area + 56px, 72px) — drag handle visible at top of sheet in full state
    - Content div has -webkit-overflow-scrolling: touch and overscroll-behavior: contain
    - CanvasArea applies touch-action: none when sheet is half or full
    - TypeScript build passes with no new errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix Geist font CSS variable scoping</name>
  <files>src/index.css</files>
  <action>
The bug: `--font-sans: 'Geist Variable', sans-serif` is currently defined inside `.theme {}` selector. The Tailwind config maps `font-sans` to `var(--font-sans)`. The `html { @apply font-sans; }` rule therefore resolves to `font-family: var(--font-sans), sans-serif` — but `var(--font-sans)` is undefined at `:root` scope (it only exists on `.theme` elements). Browser falls back to serif.

Fix: Move both font CSS variables from `.theme {}` into `:root {}` so they're globally available.

Current (broken):
```css
@layer base {
  .theme {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;
  }
  :root { ... color vars ... }
}
```

Change to:
```css
@layer base {
  :root {
    --font-sans: 'Geist Variable', sans-serif;
    --font-heading: var(--font-sans);
    ... (existing color vars remain here) ...
  }
  .theme {
    /* font vars moved to :root — nothing font-related here */
  }
}
```

Specifically: add `--font-sans: 'Geist Variable', sans-serif;` and `--font-heading: var(--font-sans);` as the first two lines inside the `:root {}` block that already contains the color CSS variables. Remove those two lines from `.theme {}`. If `.theme {}` becomes empty after removal, delete the `.theme {}` block entirely.

The `@fontsource-variable/geist` import at line 3 already loads the font face — no changes needed to font loading.
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx tsc --noEmit 2>&1 | head -20 && grep -n "font-sans" src/index.css</automated>
  </verify>
  <done>
    - `--font-sans` and `--font-heading` appear inside `:root {}` block in index.css
    - `.theme {}` block either removed or no longer contains font vars
    - TypeScript build still passes (CSS-only change, no TS impact)
    - On device: app renders in Geist Variable (sans-serif), not browser default serif
  </done>
</task>

</tasks>

<verification>
After both tasks:

```bash
cd /Users/radu/Developer/storygrid && npm run build 2>&1 | tail -20
```

Build must succeed with no errors. Then test on device (iPhone via ngrok):
- Font: body text, labels, and buttons render in a clean sans-serif (Geist)
- Sheet drag: open sheet to full snap — drag handle bar is visible below the notch, can be grabbed and dragged down
- Sheet scroll: in half or full snap with SelectedCellPanel open, scroll the settings content — it scrolls smoothly with momentum
- Canvas isolation: with sheet at half/full, tap and swipe on the canvas area behind the sheet — canvas does not respond to panning
</verification>

<success_criteria>
- MobileSheet in 'full' state shows drag handle with at least 56px gap from top of viewport
- App renders Geist Variable font globally (no serif fallback)
- Sheet content area scrolls on iOS with momentum
- Canvas does not receive touch events when sheet is open (half or full)
- `npm run build` passes clean
</success_criteria>

<output>
No SUMMARY.md needed for quick tasks — log completion in STATE.md Quick Tasks Completed table.
</output>
