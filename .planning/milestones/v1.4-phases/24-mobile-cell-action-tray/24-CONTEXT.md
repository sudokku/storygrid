# Phase 24: Mobile Cell Action Tray - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a compact action tray (Upload, Split H, Split V, Fit toggle, Clear) that appears above the bottom sheet when a cell is selected on mobile. The tray gives one-tap access to the most frequent cell actions without requiring the user to open the full sheet.

</domain>

<decisions>
## Implementation Decisions

### Tray Placement
- **D-01:** The tray renders as a **separate fixed bar** positioned above the tab strip — not inside the 60px tab strip itself.
- **D-02:** Layout from bottom of viewport: tab strip (60px) → action tray (~52px) → canvas area above.
- **D-03:** The tray is **always visible when a cell is selected**, regardless of sheet snap state (collapsed or full). It appears in both states.
- **D-04:** The tray uses `fixed` positioning at the bottom of the viewport, sitting directly above the sheet (above z-40).

### Tray Animation
- **D-05:** Tray animates **in with fade + slide-up (~8px)** when a cell is selected, reverses (fade + slide-down) when deselected. Duration/easing should match or complement the sheet's `0.3s cubic-bezier(0.32, 0.72, 0, 1)`.

### Sheet Auto-Expand (Phase 23 behavior retained)
- **D-06:** Tapping a cell still triggers the Phase 23 auto-expand — sheet opens to `full` AND the tray appears simultaneously. No change to existing `useEffect` in `MobileSheet.tsx`.

### Button Set
- **D-07:** Exactly **5 buttons**: Upload, Split Horizontal, Split Vertical, Fit toggle, Clear media.
- **D-08:** "Remove cell" is **NOT** in the tray — stays in the full sheet (SelectedCellPanel) only. Tray is intentionally non-destructive at the grid level.
- **D-09:** Each button: minimum 44×44px touch target, minimum 8px gap between buttons (matches CELL-03).

### Fit Toggle Visual State
- **D-10:** Icon swap approach — same as desktop ActionBar:
  - `Maximize2` icon when current fit is `'cover'` (tap to switch to contain)
  - `Minimize2` icon when current fit is `'contain'` (tap to switch to cover)

### Visual Style
- **D-11 (Claude's Discretion):** Style TBD by implementer. Suggested: dark pill style consistent with existing desktop ActionBar (`bg-black/70 backdrop-blur-sm rounded-md`) — keeps visual language consistent across desktop and mobile action surfaces.

### Claude's Discretion
- Tray component name and file location (e.g., `src/Editor/MobileCellTray.tsx`)
- Whether to render the tray inside `MobileSheet.tsx` or as a sibling in `EditorShell.tsx`
- Exact z-index value (must be above z-40 sheet; below z-50+ overlays)
- Whether to use `md:hidden` class or `isMobile` hook for desktop suppression

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 24 goal, success criteria, requirements (CELL-01, CELL-02, CELL-03)
- `.planning/REQUIREMENTS.md` — CELL-01, CELL-02, CELL-03 definitions

### Existing Components to Understand
- `src/Editor/MobileSheet.tsx` — Sheet structure, snap state, z-index (z-40), tab strip layout (60px)
- `src/Grid/ActionBar.tsx` — Existing desktop action bar: same button set, icons used, button sizing patterns
- `src/store/editorStore.ts` — `selectedNodeId`, `sheetSnapState`, `setSheetSnapState`
- `src/store/gridStore.ts` — `split`, `updateCell`, `removeMedia` actions used by action buttons

### Prior Phase Context
- `.planning/phases/23-bottom-sheet-redesign/23-CONTEXT.md` — Phase 23 decisions: tab strip layout, auto-expand behavior, snap states
- `.planning/phases/22-mobile-header-touch-polish/22-CONTEXT.md` — Phase 22 decisions: 44px touch targets, touch-action: manipulation global

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Grid/ActionBar.tsx`: Contains all 5 required button implementations (Upload, Split H, Split V, Fit toggle with Maximize2/Minimize2 swap, Clear). Button logic, icon imports, and store hooks can be directly referenced or partially reused.
- `lucide-react` icons already installed: `Upload`, `SplitSquareHorizontal`, `SplitSquareVertical`, `Maximize2`, `Minimize2`, `ImageOff` (clear) — all used in ActionBar.
- `useMediaQuery('(max-width: 767px)')` hook in `src/hooks/useMediaQuery.ts` — established mobile detection pattern.

### Established Patterns
- `md:hidden` Tailwind class is used on `MobileSheet` to suppress on desktop — same approach for the tray.
- `touch-action: manipulation` is global — no need to add it to tray buttons individually.
- `React.memo` wrapping is the established pattern for Editor-level components.
- Fixed positioning at bottom: `fixed bottom-0 left-0 right-0` — same anchor used by `MobileSheet`.

### Integration Points
- Tray must account for the 60px tab strip height when computing its `bottom` offset: `bottom: 60px`.
- When sheet is `full`, tray bottom offset stays `60px` (tab strip still visible at bottom of full sheet).
- `selectedNodeId` from `useEditorStore` drives tray visibility.
- `fit` value for Fit toggle comes from the selected `LeafNode` in `gridStore`.

</code_context>

<specifics>
## Specific Ideas

No specific visual references provided — open to standard approaches consistent with existing ActionBar dark pill style.

</specifics>

<deferred>
## Deferred Ideas

None captured during this discussion.

</deferred>
