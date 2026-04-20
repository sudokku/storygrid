# Phase 32: Update Mobile Cell Tray UI/UX — Research

**Researched:** 2026-04-20
**Domain:** React/TypeScript mobile UI — component layout, Tailwind CSS, Zustand state, CSS transitions
**Confidence:** HIGH

## Summary

This phase is a surgical UI overhaul of three files: `MobileCellTray.tsx`, `MobileSheet.tsx`, and `Toolbar.tsx`. All three files have been read directly and all decisions in CONTEXT.md are concrete, with zero ambiguity about the code changes required.

The core work is: (1) extend the tray with two new conditional buttons (Effects, Audio) with text labels and horizontal scroll; (2) update tray visibility to also hide when `sheetSnapState === 'full'`; (3) remove the cell-selection auto-expand `useEffect` from `MobileSheet.tsx` while keeping the overlay-selection one; (4) compact the mobile header from `h-12` (48px) to `h-10` (40px) and the tab strip from 60px to ~48px, updating the two `SNAP_TRANSLATE` values accordingly.

The ActionBar already shows the exact audio-gate pattern and icon pairs (`Volume2`/`VolumeX`, guarded by `mediaType === 'video'` and `hasAudioTrack`). The tray must mirror this — but the desktop ActionBar uses `hasAudioTrack` in addition to `mediaType === 'video'`. The CONTEXT.md decision D-02 only gates on `mediaTypeMap[mediaId] === 'video'`, not on `hasAudioTrack`. The planner should note this discrepancy and align with the ActionBar's two-level guard or document the delta explicitly.

No new stores, no new routes, no new dependencies. The phase is entirely CSS + React component edits and one `useEffect` deletion.

**Primary recommendation:** Implement in a single plan covering all three files in order: MobileCellTray (most changes) → MobileSheet (useEffect removal + SNAP_TRANSLATE values) → Toolbar (header height). Update the test file `MobileCellTray.test.ts` to cover the new `sheetSnapState === 'full'` visibility condition.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add an **Effects** button to the tray. Always visible when a cell is selected (same visibility rule as Fit — not conditional on media). Position: between Clear and Audio.
- **D-02:** Add an **Audio toggle** button (video cells only — condition: `mediaTypeMap[mediaId] === 'video'`). Position: rightmost, after Effects.
- **D-03:** Final button order: **Upload → Split H → Split V → Fit → Clear → Effects → Audio**. Clear and Audio are conditional (Clear: hasMedia; Audio: isVideo). Effects is always shown when a cell is selected.
- **D-04:** Add a short text label below each icon. Label text: Upload, Split H, Split V, Fit, Clear, Effects, Audio. Font: small/xs, same white color as icons.
- **D-05:** No active-state color changes. Icon swap is sufficient for stateful buttons.
- **D-06:** Tray container uses **horizontally scrollable layout** (`overflow-x: auto`, `flex-nowrap`). Scroll indicators (fade edges) are Claude's discretion.
- **D-07:** Tray hides when `sheetSnapState === 'full'` — adds this condition alongside `isDragging` and `!isVisible`.
- **D-08:** Effects button taps call `setSheetSnapState('full')`. Tray hides per D-07. User collapses with chevron.
- **D-09:** **Remove** the cell-selection auto-expand `useEffect` in `MobileSheet.tsx` (lines ~32–36). Cell tap now shows only the tray.
- **D-10:** The **overlay-selection auto-expand** (lines ~40–44) is **kept unchanged**.
- **D-11:** Mobile app header: compress from `h-12` (48px) toward `h-10` (40px) or tighter, keeping touch targets ≥44px. Exact height is Claude's discretion within Apple HIG ≥44px constraint.
- **D-12:** Sheet tab strip: compress from 60px to ~44–48px. The collapsed `SNAP_TRANSLATE` value (`translateY(calc(100% - 60px))`) **must be updated** to match.
- **D-13:** The `'full'` `SNAP_TRANSLATE` (`translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))`) uses 56px as assumed app header height. If header changes, **this value must be updated**.

### Claude's Discretion

- Exact pixel values for header/tab-strip heights within Apple HIG ≥44px touch-target constraint.
- Scroll fade edges (gradient overlays) on the tray's left/right ends.
- Whether Effects button scrolls sheet content to EffectsPanel or just opens sheet to last position (simple path: just call `setSheetSnapState('full')`).
- Label truncation strategy if a label is too long for its button width.

### Deferred Ideas (OUT OF SCOPE)

- Add Overlay on mobile (text/emoji/sticker from tray)
- Safe zone toggle / zoom controls on mobile
- Overlay-selection auto-open reconsideration
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tray button additions (Effects, Audio) | Browser/Client | — | Pure React component additions in `MobileCellTray.tsx` |
| Tray horizontal scroll layout | Browser/Client | — | CSS `overflow-x: auto` + Tailwind flex-nowrap |
| Tray text labels | Browser/Client | — | DOM elements below each icon, styled via Tailwind |
| Tray visibility (sheetSnapState gate) | Browser/Client | — | Zustand selector + inline style change |
| Effects button → sheet expand | Browser/Client | — | `setSheetSnapState('full')` cross-component call via Zustand |
| Cell auto-expand removal | Browser/Client | — | Delete `useEffect` in `MobileSheet.tsx` |
| Header height compaction | Browser/Client | — | Tailwind class change + inline style on `<header>` |
| Tab strip height + SNAP_TRANSLATE update | Browser/Client | — | Inline style + constant update in `MobileSheet.tsx` |

---

## Standard Stack

All libraries are already installed. No new dependencies required. [VERIFIED: codebase grep]

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^18.3.x | Component rendering | Project requirement |
| Zustand 5 | ^5.0.12 | State: `sheetSnapState`, `selectedNodeId`, `mediaTypeMap` | Project requirement |
| Tailwind CSS v3 | ^3.4.x | All styling | Project requirement |
| lucide-react | ^1.7.0 | Icons (`Volume2`, `VolumeX`, `SlidersHorizontal`/effects icon) | Project requirement |

No installation needed for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
User tap on cell
       │
       ▼
LeafNode.tsx → setSelectedNode(id) [editorStore]
       │
       ▼
MobileCellTray (fixed, z-45) — visibility = !isDragging && isVisible && sheetSnapState !== 'full'
  [Upload] [Split H] [Split V] [Fit] [Clear?] [Effects] [Audio?]
       │                                          │
       │                                          ▼ tap Effects
       │                              setSheetSnapState('full') → tray hides (D-07)
       │
       ▼
MobileSheet (fixed, bottom-0, z-40)
  TabStrip (h≈48px) ← collapsed translateY(calc(100% - 48px))
  Content: SelectedCellPanel → EffectsPanel at bottom
       │
       ▼ user taps chevron
  setSheetSnapState('collapsed') → tray re-appears
```

### Relevant File Locations
```
src/Editor/
├── MobileCellTray.tsx     # Primary: D-01..D-08 changes
├── MobileSheet.tsx        # D-09, D-12, D-13: useEffect removal + SNAP_TRANSLATE update
├── Toolbar.tsx            # D-11: mobile branch h-12 → h-10 or tighter
└── MobileCellTray.test.ts # Extend for sheetSnapState === 'full' visibility
src/store/
├── editorStore.ts         # sheetSnapState, setSheetSnapState (already present)
└── gridStore.ts           # mediaTypeMap, toggleAudioEnabled, audioEnabled, hasAudioTrack
```

### Pattern 1: Tray Visibility Condition (extending existing pattern)

Current code in `MobileCellTray.tsx` lines 107–109: [VERIFIED: file read]
```tsx
// Current (Phase 30)
opacity: isDragging ? 0 : (isVisible ? 1 : 0),
pointerEvents: (isDragging || !isVisible) ? 'none' : 'auto',
```

Extended pattern for D-07:
```tsx
// Phase 32 — add sheetSnapState guard
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const hiddenBySheet = sheetSnapState === 'full';

opacity: (isDragging || hiddenBySheet) ? 0 : (isVisible ? 1 : 0),
pointerEvents: (isDragging || hiddenBySheet || !isVisible) ? 'none' : 'auto',
```

### Pattern 2: Horizontal Scrollable Tray

Current inner div (line 115): [VERIFIED: file read]
```tsx
<div className="mx-4 flex items-center justify-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md">
```

Updated for D-06:
```tsx
<div className="mx-4 flex items-center gap-2 px-4 py-1 bg-black/70 backdrop-blur-sm rounded-md overflow-x-auto scrollbar-none">
  {/* buttons with flex-shrink-0 */}
</div>
```

Note: `justify-center` must be dropped — it prevents scrolling when content overflows. Use `justify-start` or omit justify (flex default). `scrollbar-none` hides the scrollbar chrome on mobile (Tailwind v3 supports this via `scrollbar-hide` plugin, or use `[&::-webkit-scrollbar]:hidden` arbitrary variant). [ASSUMED — verify whether project uses scrollbar plugin]

### Pattern 3: Button with Label Layout

Update `BTN_CLASS` to stack icon + label vertically: [VERIFIED: file read]
```tsx
// Current BTN_CLASS (line 22-23):
'min-w-[44px] min-h-[44px] flex items-center justify-center rounded ...'

// Updated for D-04:
'min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded ...'
```

Label element below each icon:
```tsx
<Upload size={20} className="text-white" />
<span className="text-[10px] text-white leading-none">Upload</span>
```

The total button height may need to grow slightly (from `min-h-[44px]` to `min-h-[52px]`) to accommodate both icon and label while meeting the 44px touch target. Keep `min-h-[44px]` — the clickable area is at least 44px tall regardless of visual content height. [ASSUMED — verify visually during implementation]

### Pattern 4: Audio Button in Tray (mirroring ActionBar)

ActionBar pattern (lines 36–43, ActionBar.tsx): [VERIFIED: file read]
```tsx
const mediaType = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  if (!leaf || leaf.type !== 'leaf' || !leaf.mediaId) return null;
  return s.mediaTypeMap[leaf.mediaId] ?? null;
});
const audioEnabled = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf && leaf.type === 'leaf' ? leaf.audioEnabled : true;
});
const hasAudioTrack = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf && leaf.type === 'leaf' ? (leaf.hasAudioTrack ?? false) : false;
});
```

**IMPORTANT: Decision D-02 says gate on `mediaTypeMap[mediaId] === 'video'` only.** The ActionBar additionally gates on `hasAudioTrack`. The tray should be consistent with the full ActionBar guard: `isVideo && hasAudioTrack` for the interactive toggle, `isVideo && !hasAudioTrack` for the disabled "no audio" state. The planner should choose one and document it. Without `hasAudioTrack`, the tray's audio button would appear for muted/no-audio videos but do nothing useful.

The `toggleAudioEnabled` store action is at `useGridStore(s => s.toggleAudioEnabled)`. [VERIFIED: file read]

### Pattern 5: SNAP_TRANSLATE Update

Current values in `MobileSheet.tsx`: [VERIFIED: file read]
```tsx
const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  collapsed: 'translateY(calc(100% - 60px))',
};
```

**D-12:** When tab strip shrinks from 60px to e.g. 48px:
- `collapsed` → `'translateY(calc(100% - 48px))'`

**D-13:** When header shrinks from 48px (`h-12`) to e.g. 40px (`h-10`):
- `full` → `'translateY(max(calc(env(safe-area-inset-top) + 40px), 56px))'`

Both values are tightly coupled — if either dimension changes, both may need adjustment.

### Pattern 6: Effects Icon

EffectsPanel.tsx has no lucide icon import for its own section header — it uses no icon for the panel title. [VERIFIED: file read] The tray Effects button needs a new icon. Candidates from lucide-react: `SlidersHorizontal` (most natural for "effects/filters"), `Sparkles`, or `Wand2`. The CONTEXT.md code_context suggests: "SlidersHorizontal or Sliders (lucide) for the Effects button icon — check which is already used in EffectsPanel." Since EffectsPanel imports no lucide icons, use `SlidersHorizontal` as it semantically matches "effects sliders." [ASSUMED — confirm with user if needed, but `SlidersHorizontal` is the standard choice]

### Anti-Patterns to Avoid

- **Do not remove `justify-center` without replacing with `justify-start`** — the tray should scroll from the left edge, not reflow to center.
- **Do not add `flex-shrink-0` only to some buttons** — all buttons in a scroll container should have `flex-shrink-0` or the scrolling will be uneven.
- **Do not change `sheetSnapState` to a third value** — it is typed as `'collapsed' | 'full'`. Adding a `'half'` state is out of scope.
- **Do not break the overlay auto-expand** (lines 39–44 in MobileSheet.tsx) — only delete the cell-selection block (lines 31–36).
- **Do not update `SNAP_TRANSLATE.full` without verifying it clears the header** — the value must be ≥ new header height + safe-area-inset-top.
- **Do not apply `h-10` to the outer `<header>` and also keep `h-11` buttons** — the header outer height must be at least as tall as the tallest button.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scrollbar hiding | Custom CSS scrollbar styles | Tailwind `[&::-webkit-scrollbar]:hidden` or `scrollbar-hide` plugin | Single class, cross-browser |
| Scroll fade edges | Canvas gradient | CSS `mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)` on the scroll container | Native CSS, no JS |
| Audio state reading | Re-implement audio detection | Existing `hasAudioTrack` from `gridStore`, `toggleAudioEnabled` action | Already implemented in Phase 19/21 |
| Effects navigation | New routing/navigation | `setSheetSnapState('full')` — the sheet content already shows EffectsPanel for selected cells | Already wired |

---

## Common Pitfalls

### Pitfall 1: `justify-center` breaks overflow scroll
**What goes wrong:** `justify-center` on a flex container with `overflow-x: auto` prevents scroll because `justify-center` shrinks the scroll container to fit content. The overflow never activates.
**Why it happens:** Flexbox centers content within the available space; if content is smaller, it won't overflow; if content is larger, justify-center layout can suppress the scroll offset.
**How to avoid:** Use `justify-start` (or remove justify) on the scroll container. Items scroll from left.
**Warning signs:** No scrollbar visible on narrow screens even with many buttons.

### Pitfall 2: Both `useEffect` blocks share the same ref pattern — wrong one deleted
**What goes wrong:** The cell auto-expand block (lines 31–36) and the overlay auto-expand block (lines 39–44) use the same `prevRef.current → non-null` pattern. Deleting the wrong block breaks overlay auto-open.
**Why it happens:** Both blocks look nearly identical — different variable names but same structure.
**How to avoid:** Read MobileSheet.tsx carefully. Cell block uses `selectedNodeId`/`prevSelectedRef`. Overlay block uses `selectedOverlayId`/`prevOverlayRef`. Delete only the cell block.
**Warning signs:** Text overlay taps no longer open the sheet.

### Pitfall 3: Tab strip height update misses the content area height calculation
**What goes wrong:** MobileSheet.tsx line 86: `height: 'calc(100dvh - 60px - max(...))'` — the `60px` is the tab strip height hardcoded in the content scroll area. If the tab strip shrinks but this calculation isn't updated, the content area will be too tall and overflow.
**Why it happens:** The tab strip height appears in three places: the `style={{ height: 60 }}` on the tab strip div, the `SNAP_TRANSLATE.collapsed` string, and the content div height calc.
**How to avoid:** Search for `60px` in MobileSheet.tsx and update all three occurrences consistently.
**Warning signs:** Content area scrolls past the bottom of the sheet, or the bottom of the content clips behind the safe area.

### Pitfall 4: Header `h-10` (40px) with `h-11` (44px) buttons
**What goes wrong:** The mobile header is `h-12` (48px) and buttons are `w-11 h-11` (44px). Shrinking to `h-10` (40px) clips the buttons.
**Why it happens:** The `h-{n}` class on the outer `<header>` is a fixed height. Buttons taller than the header will overflow or be clipped.
**How to avoid:** If targeting `h-10` outer, ensure button height is ≤ 40px. To keep 44px buttons (Apple HIG), set the outer header to at least 44px. Recommend `h-11` (44px) for the outer header or rely on `min-h` instead.
**Warning signs:** Buttons visually clip at top/bottom, or the header appears to have extra padding above/below.

### Pitfall 5: tray `bottom` position not updated when tab strip shrinks
**What goes wrong:** `MobileCellTray.tsx` line 105: `bottom: '60px'` — this positions the tray above the tab strip. If the strip shrinks to 48px, the tray will float 12px above the strip.
**Why it happens:** The tray's `bottom` value is hardcoded to match the tab strip height.
**How to avoid:** Update `bottom` in MobileCellTray.tsx to match the new tab strip height (e.g., `bottom: '48px'`).
**Warning signs:** Gap between tray and tab strip, or tray overlapping the tab strip.

### Pitfall 6: Audio button in tray skips `hasAudioTrack` check
**What goes wrong:** Audio button appears for video cells without audio tracks. Tapping it calls `toggleAudioEnabled` but has no audible effect. User is confused.
**Why it happens:** Decision D-02 only mentions `mediaTypeMap[mediaId] === 'video'` as the condition. ActionBar also checks `hasAudioTrack`.
**How to avoid:** Mirror the full ActionBar condition: `{isVideo && hasAudioTrack && <button>}` for interactive toggle, `{isVideo && !hasAudioTrack && <button disabled>}` for locked state. Or simplify to just `{isVideo && <button disabled={!hasAudioTrack}>}`.
**Warning signs:** Muted-video cells showing an audio button that does nothing.

---

## Code Examples

### Tray visibility with sheetSnapState guard
```tsx
// Source: codebase — MobileCellTray.tsx + editorStore.ts
const sheetSnapState = useEditorStore(s => s.sheetSnapState);
const hiddenBySheet = sheetSnapState === 'full';
const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);

// In style prop:
opacity: (isDragging || hiddenBySheet) ? 0 : (isVisible ? 1 : 0),
pointerEvents: (isDragging || hiddenBySheet || !isVisible) ? 'none' : 'auto',
```

### Audio guard pattern (mirror of ActionBar)
```tsx
// Source: codebase — ActionBar.tsx lines 36-49
const mediaTypeMap = useGridStore(s => s.mediaTypeMap);
const isVideo = mediaId !== null && mediaTypeMap[mediaId] === 'video';

const audioEnabled = useGridStore(s => {
  if (!selectedNodeId) return true;
  const node = findNode(s.root, selectedNodeId);
  return node && node.type === 'leaf' ? (node as LeafNode).audioEnabled : true;
});
const hasAudioTrack = useGridStore(s => {
  if (!selectedNodeId) return false;
  const node = findNode(s.root, selectedNodeId);
  return node && node.type === 'leaf' ? ((node as LeafNode).hasAudioTrack ?? false) : false;
});
const toggleAudioEnabled = useGridStore(s => s.toggleAudioEnabled);
```

### MobileSheet.tsx — lines to delete (D-09)
```tsx
// DELETE this block only (lines 31-36):
const prevSelectedRef = useRef(selectedNodeId);
useEffect(() => {
  const prev = prevSelectedRef.current;
  prevSelectedRef.current = selectedNodeId;
  if (!prev && selectedNodeId) setSheetSnapState('full');
}, [selectedNodeId, setSheetSnapState]);

// KEEP this block (lines 39-44):
const prevOverlayRef = useRef(selectedOverlayId);
useEffect(() => {
  const prev = prevOverlayRef.current;
  prevOverlayRef.current = selectedOverlayId;
  if (!prev && selectedOverlayId) setSheetSnapState('full');
}, [selectedOverlayId, setSheetSnapState]);
```

### SNAP_TRANSLATE update (example for 48px strip, 40px header)
```tsx
// Source: codebase — MobileSheet.tsx lines 13-16
const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 40px), 56px))',  // was 56px → 40px
  collapsed: 'translateY(calc(100% - 48px))',                             // was 60px → 48px
};
// Content scroll area must also update:
// height: 'calc(100dvh - 48px - max(calc(env(safe-area-inset-top) + 40px), 56px))'
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SlidersHorizontal` is the right Effects icon (not `Sliders` or `Sparkles`) | Code Examples | Minor — any icon works; visual consistency only |
| A2 | `scrollbar-none` / `[&::-webkit-scrollbar]:hidden` is sufficient to hide scroll chrome on iOS/Android | Architecture Patterns | Low — worst case a scrollbar appears, cosmetic only |
| A3 | `min-h-[44px]` on buttons is sufficient for touch targets even as outer header shrinks | Common Pitfalls | Medium — if outer `h-10` clips the button, touch target drops below 44px |
| A4 | Tray `bottom` is currently hardcoded at `60px` matching tab strip height | Common Pitfalls | HIGH — if not updated, tray will visually gap from the strip |
| A5 | The Audio button in the tray should mirror the full ActionBar `hasAudioTrack` guard (not just `isVideo`) | Standard Stack | Medium — UX confusion if audio button appears for no-audio videos |

---

## Open Questions (RESOLVED)

1. **Audio button: `isVideo` only vs. `isVideo && hasAudioTrack`** — RESOLVED
   - What we know: D-02 says `mediaTypeMap[mediaId] === 'video'`. ActionBar uses both conditions.
   - What's unclear: Should the tray show a disabled/locked audio button for no-audio video cells (like ActionBar does), or hide it entirely?
   - **Resolution: Mirror the ActionBar fully** — interactive button when `isVideo && hasAudioTrack`, disabled/locked button when `isVideo && !hasAudioTrack`, hidden when not video. Implemented in Plan 01 Task 1 step 10.

2. **Header height: `h-11` (44px) vs `h-10` (40px)** — RESOLVED
   - What we know: Mobile header is `h-12` (48px). Buttons are `w-11 h-11` (44px). CONTEXT.md says target `h-10` or tighter "if padding allows 44px buttons."
   - What's unclear: At `h-10` (40px), the 44px buttons overflow. The only way this works is if the buttons are shrunk to `h-10` too — but that breaks Apple HIG.
   - **Resolution: Use `h-11` (44px)** — outer header matches the button height exactly with zero overflow. `h-10` would clip 44px buttons and violate Apple HIG. Confirmed in UI-SPEC.md spacing scale. Implemented in Plan 02 Task 1.

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no external dependencies. All code is client-side React/TypeScript with existing installed libraries.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/Editor/MobileCellTray.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-07 | Tray hides when sheetSnapState === 'full' | unit | `npx vitest run src/Editor/MobileCellTray.test.ts` | ✅ (extend existing) |
| D-09 | Cell tap no longer auto-expands sheet | unit | `npx vitest run src/Editor/__tests__/phase05.1-p01-foundation.test.tsx` | ✅ (extend or add) |
| D-03 (button order) | All 7 buttons render in correct order | unit | `npx vitest run src/Editor/MobileCellTray.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/Editor/MobileCellTray.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- `MobileCellTray.test.ts` needs new test: `sheetSnapState === 'full'` hides tray (opacity 0, pointerEvents none)
- `MobileCellTray.test.ts` needs new mock entries for `Volume2`, `VolumeX`, `SlidersHorizontal` (current mock only covers 6 icons)
- No new test files needed — extending the existing test file is sufficient

---

## Security Domain

Step skipped — this phase makes no changes to authentication, data handling, network requests, or security boundaries. It is purely a visual/layout change within an existing React client component.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/Editor/MobileCellTray.tsx` — full file read; all existing patterns verified
- Codebase: `src/Editor/MobileSheet.tsx` — full file read; SNAP_TRANSLATE values, useEffect blocks verified
- Codebase: `src/Editor/Toolbar.tsx` — full file read; mobile branch h-12 verified
- Codebase: `src/store/editorStore.ts` — full file read; sheetSnapState, setSheetSnapState confirmed
- Codebase: `src/Grid/ActionBar.tsx` — full file read; audio guard pattern (mediaType + hasAudioTrack) confirmed
- Codebase: `src/Editor/MobileCellTray.test.ts` — full file read; existing test patterns confirmed
- Codebase: `vitest.config.ts` — test runner confirmed

### Secondary (MEDIUM confidence)
- Apple HIG touch target minimum: 44×44px — widely documented; consistent with existing codebase usage of `min-w-[44px] min-h-[44px]` [ASSUMED from training]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified in codebase
- Architecture: HIGH — all three files read directly; exact line numbers known
- Pitfalls: HIGH — derived from direct code inspection of the three files being changed
- Test plan: HIGH — existing test file read; extension points clear

**Research date:** 2026-04-20
**Valid until:** 60 days (no external dependencies; codebase is the source of truth)
