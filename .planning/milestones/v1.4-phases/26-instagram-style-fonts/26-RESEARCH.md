# Phase 26: Instagram-Style Fonts - Research

**Researched:** 2026-04-17
**Domain:** Google Fonts loading, React font picker UI, Canvas API font rendering, mobile bottom sheet integration
**Confidence:** HIGH

---

## Summary

Phase 26 is a focused UI enhancement with three concrete deliverables: (1) replace the existing `<select>` font picker in OverlayPanel with a custom scrollable `FontPickerList` component rendering each font name in its own typeface, (2) consolidate the Google Fonts `<link>` in index.html to cover all 8 families with `display=swap`, and (3) surface OverlayPanel controls in MobileSheet when an overlay is selected.

The codebase audit shows all the wiring is already in place. `selectedOverlayId` is tracked in editorStore with `setSelectedOverlayId`. Sidebar.tsx already gates OverlayPanel on `selectedOverlayId !== null` (line 499). `document.fonts.ready` is awaited in `drawOverlaysToCanvas` (overlayExport.ts) before any `fillText` call — so export correctness is already handled. The existing OverlayPanel.test.tsx tests a `<select>` with 3 options (Geist, Playfair Display, Dancing Script); those tests must be updated to reflect the new FontPickerList with 8 buttons.

The only genuine technical risk is the visual font picker: `<option style={{ fontFamily }}>` is ignored on most platforms (macOS/Windows native select does not honour inline styles). This is exactly why D-01 mandates a custom component. A column of `<button>` elements with inline `fontFamily` style renders correctly in all target browsers. [VERIFIED: codebase review — existing select uses style={{ fontFamily }} on options, which is non-functional on macOS/Windows native pickers]

**Primary recommendation:** Three self-contained tasks: (1) Google Fonts link update in index.html, (2) FontPickerList component + OverlayPanel wiring, (3) MobileSheet overlay branch. Tasks are independent and can be planned in any order, though the Google Fonts link change is a prerequisite for visual correctness of FontPickerList.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace the native `<select>` with a custom inline scrollable list — a column of buttons, each rendering its name in that font. Always-visible in the sidebar panel (no click to open).
- **D-02:** The list shows all 8 fonts. The currently-applied font is highlighted (blue accent background). Clicking a row applies the font immediately.
- **D-03:** Replace the existing `<link>` in `index.html` with a single consolidated Google Fonts link covering all 8 families. Use `&display=swap`. Weights: 400 and 700 for all; add italic 400 for Playfair Display.
- **D-04:** The `document.fonts.ready` await in `overlayExport.ts` already handles export correctness — no changes needed there.
- **D-05:** Change the default `fontFamily` for new text overlays from `'Geist'` to `'Bebas Neue'`. Update `AddOverlayMenu.tsx` line ~45.
- **D-06:** OverlayPanel must be accessible on mobile via the bottom sheet. When an overlay is selected on mobile, the bottom sheet shows full overlay controls.
- **D-07:** Full parity between desktop and mobile overlay editing. No capability gap.
- **D-08:** Trigger for showing overlay controls in the bottom sheet: `selectedOverlayId !== null` — mirrors Sidebar.tsx line 499.

### Claude's Discretion

- How to detect "mobile" for routing overlay controls — use existing viewport/mobile detection pattern (Phase 22–24 established this).
- Font list order: follow FONT-01 order — Bebas Neue, Oswald, Dancing Script, Playfair Display, Space Mono, Pacifico, Barlow Condensed, Caveat.
- Whether to keep Geist in the font list or remove it — Claude's discretion. UI-SPEC.md has resolved this: remove Geist from the visible list; existing overlays with fontFamily: 'Geist' fall back to browser default sans-serif.

### Deferred Ideas (OUT OF SCOPE)

- No other items deferred.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FONT-01 | Text overlay font picker includes 8 Google Fonts: Bebas Neue, Oswald, Dancing Script, Playfair Display, Space Mono, Pacifico, Barlow Condensed, Caveat | FontPickerList component with 8 buttons; Google Fonts URL pattern confirmed |
| FONT-02 | Fonts load asynchronously with `font-display: swap` to avoid FOIT | `&display=swap` in Google Fonts URL; `document.fonts.ready` already awaited in overlayExport.ts |
| FONT-03 | Font picker displays each font name rendered in its own typeface | Custom `<button>` column with `style={{ fontFamily }}` inline — the only cross-browser reliable approach |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Font loading | Browser / Client | — | Google Fonts loaded via `<link>` in index.html; browser handles CSS font-face rules |
| Font picker UI | Frontend (React component) | — | New FontPickerList component inside OverlayPanel; client-side state only |
| Default font change | Frontend (React component) | — | AddOverlayMenu.tsx sets initial fontFamily on overlay creation |
| Mobile overlay editing | Frontend (React component) | — | MobileSheet content switching; reads editorStore.selectedOverlayId |
| Export font correctness | Browser / Client | — | document.fonts.ready already awaited in overlayExport.ts; Canvas API ctx.font uses fontFamily string |
| fontFamily storage | State (overlayStore) | — | TextOverlay.fontFamily field; updateOverlay() dispatches the change |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Fonts CDN | n/a | Serve web font files | Zero-install; preconnect headers already in index.html |
| React | ^18.3.x | Component rendering | Project constraint — already installed |
| Tailwind CSS | ^3.4.x | Utility styling for FontPickerList | Project constraint — already installed |
| Zustand (editorStore) | ^5.0.12 | selectedOverlayId state | Already in use for Sidebar.tsx gating |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^1.7.0 | Icons (ChevronUp/Down already in MobileSheet) | No new icons needed in this phase |

### No New Dependencies
This phase adds zero new npm packages. All capabilities are met by:
- A new React component (FontPickerList) using Tailwind utility classes
- An inline style (`fontFamily`) on each button
- An updated `<link>` tag in index.html
- A new conditional branch in MobileSheet.tsx

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
User taps font row in FontPickerList
          |
          v
  updateOverlay(id, { fontFamily })
          |
          v
  overlayStore.overlays updated
          |
     +----+----+
     |         |
     v         v
OverlayLayer   overlayExport.ts
(DOM render)   (Canvas API)
     |         |
  CSS font     await document.fonts.ready
  family       ctx.font = `${weight}${size}px "${fontFamily}"`
  applied      fillText(...)
```

```
User selects text overlay on mobile
          |
          v
  editorStore.selectedOverlayId = id
  editorStore.sheetSnapState = 'full'  (via existing auto-expand effect)
          |
          v
  MobileSheet re-renders:
    selectedOverlayId !== null  →  <OverlayPanel />
    (with FontPickerList inside)
```

### Recommended Project Structure
```
src/
├── Editor/
│   ├── FontPickerList.tsx       # NEW — extracted font picker component
│   ├── OverlayPanel.tsx         # MODIFIED — replace <select> with <FontPickerList>
│   ├── AddOverlayMenu.tsx       # MODIFIED — default fontFamily 'Geist' → 'Bebas Neue'
│   ├── MobileSheet.tsx          # MODIFIED — selectedOverlayId branch
│   └── __tests__/
│       └── OverlayPanel.test.tsx # MODIFIED — update font picker tests
├── types/index.ts               # MODIFIED — update fontFamily comment (cosmetic)
└── index.html                   # MODIFIED — consolidated 8-font Google Fonts link
```

### Pattern 1: Custom Font Picker Buttons (FONT-03)
**What:** A column of `<button>` elements each with `style={{ fontFamily }}` as an inline style. This is the only cross-browser mechanism for rendering font names in their own typeface inside a list widget.
**When to use:** Any font selection UI that must visually preview each option.
**Example:**
```typescript
// Source: [ASSUMED] — standard React pattern for font preview lists
const FONTS = [
  'Bebas Neue',
  'Oswald',
  'Dancing Script',
  'Playfair Display',
  'Space Mono',
  'Pacifico',
  'Barlow Condensed',
  'Caveat',
];

interface FontPickerListProps {
  value: string;
  onChange: (fontFamily: string) => void;
  mobile?: boolean;
}

export function FontPickerList({ value, onChange, mobile = false }: FontPickerListProps) {
  return (
    <div className="flex flex-col rounded overflow-hidden border border-[#3a3a3a]">
      {FONTS.map(font => {
        const isSelected = value === font;
        const rowHeight = mobile ? 'min-h-[44px]' : 'min-h-[36px]';
        return (
          <button
            key={font}
            style={{ fontFamily: `"${font}"` }}
            className={`
              ${rowHeight} px-3 text-sm flex items-center transition-colors duration-150
              border-b border-[#3a3a3a] last:border-b-0
              touch-action-manipulation
              focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:outline-none
              ${isSelected
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#2a2a2a] text-neutral-300 hover:bg-[#333333]'
              }
            `}
            onClick={() => onChange(font)}
            aria-label={`${font} font`}
            aria-pressed={isSelected}
          >
            {font}
          </button>
        );
      })}
    </div>
  );
}
```

### Pattern 2: Google Fonts Consolidated URL (FONT-02)
**What:** A single `<link>` tag loading all 8 families with `display=swap`.
**When to use:** Replace the current 2-family link in index.html.
**Example:**
```html
<!-- Source: [CITED: fonts.google.com] — standard multi-family URL pattern -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;700&family=Dancing+Script:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:wght@400;700&family=Pacifico&family=Barlow+Condensed:wght@400;700&family=Caveat:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

**Notes on individual families:**
- Bebas Neue: weight 400 only (it's a display face; 700 variant does not exist in Google Fonts — only request 400) [ASSUMED — verify URL in browser]
- Pacifico: weight 400 only (no bold variant in Google Fonts) [ASSUMED — verify URL in browser]
- Space Mono: weights 400, 700 available [ASSUMED]
- All others: 400 and 700 available [ASSUMED]

**Verification step (required during implementation):** Open the URL in a browser or use `curl` to confirm Google Fonts returns valid CSS. Requesting a weight that doesn't exist is silently ignored by Google Fonts (it does not error), so requesting `wght@400;700` for Bebas Neue is safe even if 700 is unavailable.

### Pattern 3: MobileSheet Overlay Branch (D-06 to D-08)
**What:** Add a `selectedOverlayId` check as the highest-priority branch in MobileSheet content switcher.
**When to use:** Mirror the Sidebar.tsx pattern exactly.
**Example:**
```typescript
// Source: [VERIFIED: codebase — Sidebar.tsx line 499]
// In MobileSheet.tsx, inside the scrollable content div:

const selectedOverlayId = useEditorStore(s => s.selectedOverlayId);

// Replace existing content switcher:
{panModeNodeId ? (
  <ExitPanMode />
) : selectedOverlayId !== null ? (         // NEW branch — highest priority
  <OverlayPanel />
) : selectedNodeId ? (
  <SelectedCellPanel nodeId={selectedNodeId} key={selectedNodeId} />
) : (
  <CanvasSettingsPanel />
)}
```

The sheet label must also be updated:
```typescript
// Replace existing label logic:
{selectedOverlayId !== null
  ? 'Text Overlay'
  : selectedNodeId
    ? 'Cell Settings'
    : 'Canvas Settings'
}
```

The auto-expand effect currently triggers on `selectedNodeId` changes (null → non-null). An equivalent effect for `selectedOverlayId` is needed:
```typescript
// Add alongside existing selectedNodeId effect in MobileSheet.tsx:
const prevOverlayRef = useRef(selectedOverlayId);
useEffect(() => {
  const prev = prevOverlayRef.current;
  prevOverlayRef.current = selectedOverlayId;
  if (!prev && selectedOverlayId) setSheetSnapState('full');
}, [selectedOverlayId, setSheetSnapState]);
```

### Anti-Patterns to Avoid

- **`<option style={{ fontFamily }}>` on a native `<select>`:** Browsers on macOS and Windows render native OS select controls; inline styles on `<option>` are universally ignored. This is exactly the current broken state. Never use this pattern for font preview. [VERIFIED: codebase — existing OverlayPanel.tsx lines 64-71 do exactly this, confirming the problem]
- **FontFace API + JS load detection per font:** Unnecessary complexity. `font-display: swap` handles FOIT at the CSS level. `document.fonts.ready` already guarantees fonts are loaded before export canvas rendering. No additional JS font loading logic is needed.
- **Conditional rendering of MobileSheet based on `isMobile` JS check:** The existing pattern uses `md:hidden` CSS class to hide MobileSheet on desktop — do not add a JS-based `isMobile` guard. The component is always rendered; CSS controls visibility. [VERIFIED: codebase — MobileSheet.tsx className `md:hidden`]
- **Changing TextOverlay type signature for fontFamily:** The `fontFamily: string` field is already typed correctly. The comment on line 53 of types/index.ts mentions `'Geist' | 'Playfair Display' | 'Dancing Script'` as examples — update the comment but do not change to a union type (would break overlay persistence compatibility for any stored overlays).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading with FOIT prevention | Custom FontFace JS loader | `&display=swap` in Google Fonts URL + `document.fonts.ready` (already present) | Browser handles swap timing natively; `document.fonts.ready` already used in overlayExport.ts |
| Cross-browser font preview in picker | `<select>` with styled `<option>` | Custom `<button>` column with `style={{ fontFamily }}` | Native `<option>` ignores inline styles on all major platforms |
| Mobile vs desktop routing | New `isMobile` hook | Existing `md:hidden` / `useMediaQuery('(min-width: 768px)')` pattern | Already established in Phases 22–24 |

**Key insight:** The entire font loading infrastructure is already in place. The only new code is the FontPickerList component and the MobileSheet branch — both are straightforward React UI components.

---

## Common Pitfalls

### Pitfall 1: Bebas Neue and Pacifico weight 700 not available on Google Fonts
**What goes wrong:** The consolidated URL requests `wght@400;700` for all families. Bebas Neue and Pacifico only have a 400 weight on Google Fonts. Requesting 700 is silently ignored (no error), but the Weight toggle in OverlayPanel would show "Bold" without visual difference for these fonts.
**Why it happens:** Display/script fonts often ship as single-weight faces.
**How to avoid:** Request only `400` for these two families in the Google Fonts URL. The implementation-time URL construction step should verify weights in the browser.
**Warning signs:** `font-weight: bold` on Bebas Neue text in the overlay doesn't visually change.

### Pitfall 2: Existing OverlayPanel test breaks (font picker has <select>)
**What goes wrong:** `OverlayPanel.test.tsx` Test 2 queries `getByLabelText('Font family')` which resolves to the `<select>` element, then asserts `options.length === 3`. After the `<select>` is replaced by FontPickerList buttons, this test fails immediately.
**Why it happens:** The test is tightly coupled to the DOM structure of the picker.
**How to avoid:** Update the test to query `<button>` elements with `aria-label` pattern `/{font} font/` and assert 8 buttons exist. Update the SEED_OVERLAY to use `fontFamily: 'Bebas Neue'` instead of `'Geist'`.
**Warning signs:** Test runner reports `Unable to find label with the text of: Font family` or `options` is undefined.

### Pitfall 3: MobileSheet auto-expand does not trigger for overlay selection
**What goes wrong:** A user taps a text overlay on mobile. `selectedOverlayId` becomes non-null but the sheet stays collapsed because the auto-expand effect only watches `selectedNodeId`.
**Why it happens:** The existing effect in MobileSheet only has `selectedNodeId` in its dependency array.
**How to avoid:** Add a parallel `useEffect` watching `selectedOverlayId` that also calls `setSheetSnapState('full')` on null → non-null transition.
**Warning signs:** On mobile, tapping an overlay shows nothing in the bottom sheet because the sheet is still collapsed.

### Pitfall 4: fontFamily CSS value quoting for multi-word font names
**What goes wrong:** `style={{ fontFamily: 'Dancing Script' }}` works, but `ctx.font = `bold 72px Dancing Script`` (without quotes) fails in Canvas API — multi-word font names must be quoted in the font shorthand string.
**Why it happens:** Canvas `ctx.font` uses CSS font shorthand syntax; unquoted multi-word names are invalid.
**How to avoid:** The existing `overlayExport.ts` already uses `ctx.font = `${weight}${overlay.fontSize}px "${overlay.fontFamily}"`` (line 68) with quoted fontFamily — this is already correct. The inline style on FontPickerList buttons uses CSS `fontFamily` property (not shorthand), where quotes are optional. No changes needed in overlayExport.ts.
**Warning signs:** Canvas-rendered text falls back to browser default serif/sans-serif for multi-word font names.

### Pitfall 5: Google Fonts URL blocked by browser ad-blockers during local dev
**What goes wrong:** Font picker rows render in system default font during development because the Google Fonts CSS is blocked.
**Why it happens:** Common in developer environments with uBlock Origin or similar.
**How to avoid:** This is a dev environment issue only; it does not affect production or testing. No code change needed. Document it so developers aren't confused.
**Warning signs:** All FontPickerList rows look identical during local dev.

---

## Code Examples

### Current index.html Google Fonts link (to replace)
```html
<!-- Source: [VERIFIED: codebase — index.html line 10] -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet" />
```

### Current OverlayPanel font section (to replace)
```typescript
// Source: [VERIFIED: codebase — OverlayPanel.tsx lines 56-72]
<select
  value={textOverlay.fontFamily}
  onChange={e => updateOverlay(overlay.id, { fontFamily: e.target.value })}
  className="w-full px-2 py-1.5 rounded text-xs bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-200 focus:outline-none focus:border-[#3b82f6]"
  aria-label="Font family"
>
  <option value="Geist" style={{ fontFamily: 'Geist' }}>Geist</option>
  <option value="Playfair Display" style={{ fontFamily: '"Playfair Display"' }}>Playfair Display</option>
  <option value="Dancing Script" style={{ fontFamily: '"Dancing Script"' }}>Dancing Script</option>
</select>
```

### AddOverlayMenu.tsx default to update
```typescript
// Source: [VERIFIED: codebase — AddOverlayMenu.tsx line 45]
// CURRENT:
fontFamily: 'Geist',
// CHANGE TO:
fontFamily: 'Bebas Neue',
```

### overlayExport.ts — already correct, no changes needed
```typescript
// Source: [VERIFIED: codebase — overlayExport.ts lines 47-48]
if (!fontsAlreadyReady && typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  await document.fonts.ready;
}
// And line 68:
ctx.font = `${weight}${overlay.fontSize}px "${overlay.fontFamily}"`;
// Multi-word font names are already quoted — correct.
```

---

## Runtime State Inventory

> This is a font name default change, not a rename/migration phase. The only stored string is `fontFamily` per overlay in overlayStore. Existing overlays storing `fontFamily: 'Geist'` are preserved and fall back to browser default sans-serif (Geist is the UI chrome font loaded via @fontsource-variable/geist, so it may still render correctly). New overlays default to 'Bebas Neue'.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | overlayStore.overlays[].fontFamily — in-memory Zustand store, no persistence configured | None — in-memory only; clears on page reload |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Nothing found requiring migration** — overlayStore uses no persistence middleware; all overlays are cleared on page reload.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vite.config.ts (vitest section) |
| Quick run command | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FONT-01 | FontPickerList renders 8 font buttons in correct order | unit | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` | ✅ (needs update) |
| FONT-01 | Clicking a font button calls updateOverlay with correct fontFamily | unit | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` | ✅ (needs update) |
| FONT-02 | document.fonts.ready is awaited in drawOverlaysToCanvas before fillText | unit | `npx vitest run src/lib/__tests__/overlayExport.test.ts` (if exists) | manual-only (font loading is browser-native) |
| FONT-03 | Each button has correct fontFamily inline style | unit | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` | ✅ (needs update) |
| FONT-03 | Each button has aria-label="{FontName} font" and aria-pressed | unit | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` | ✅ (needs update) |
| D-06/D-08 | MobileSheet renders OverlayPanel when selectedOverlayId !== null | unit | `npx vitest run src/Editor/__tests__/MobileSheet.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/Editor/__tests__/MobileSheet.test.tsx` — covers D-06/D-08 overlay branch in MobileSheet
- [ ] Update `src/Editor/__tests__/OverlayPanel.test.tsx` Test 2 — change from `<select>` assertions to `<button>` button assertions for FontPickerList; update SEED_OVERLAY fontFamily from `'Geist'` to `'Bebas Neue'`

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no use of external tools, services, runtimes, or CLIs beyond the project's own code and the Google Fonts CDN (a public URL, no credentials required).

---

## Security Domain

This phase introduces no new authentication, session management, access control, cryptography, or data persistence. The only external HTTP request is to `fonts.googleapis.com` and `fonts.gstatic.com` — both already present in index.html. No security review is required.

---

## Open Questions

1. **Bebas Neue and Pacifico bold weight availability**
   - What we know: Both are single-weight display fonts; Google Fonts URL should not request `wght@700` for these two
   - What's unclear: Whether requesting a non-existent weight causes any URL error (it doesn't error, but wastes a URL parameter)
   - Recommendation: Request only `400` for Bebas Neue and Pacifico; request `400;700` for the other 6 families. Verify the final URL returns valid CSS before committing.

2. **Geist fontFamily on existing overlays**
   - What we know: Existing overlays storing `fontFamily: 'Geist'` will fall back to browser default sans-serif after Geist is removed from the picker
   - What's unclear: Whether Geist is still available as a web font at render time (it is — loaded via @fontsource-variable/geist for UI chrome), so text overlays with fontFamily: 'Geist' may still render correctly
   - Recommendation: Do not add Geist to FontPickerList (per UI-SPEC.md decision) and do not add a data migration. The fallback is acceptable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bebas Neue only has weight 400 on Google Fonts (no 700 variant) | Code Examples / Pitfall 1 | Requesting 400;700 is silently safe; visual Bold toggle just won't change weight for this font |
| A2 | Pacifico only has weight 400 on Google Fonts | Code Examples / Pitfall 1 | Same as A1 |
| A3 | Space Mono has weights 400 and 700 on Google Fonts | Standard Stack | If only 400 exists, bold toggle won't work for this font |
| A4 | Requesting a non-existent weight variant from Google Fonts is silently ignored (no HTTP error) | Code Examples | If it 404s the entire CSS, all fonts would fail to load |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `src/Editor/OverlayPanel.tsx` — current `<select>` structure, styling tokens, store wiring
- [VERIFIED: codebase] `src/Editor/MobileSheet.tsx` — sheet architecture, content switching pattern, snap state
- [VERIFIED: codebase] `src/Editor/Sidebar.tsx` line 499 — `selectedOverlayId !== null` gate pattern
- [VERIFIED: codebase] `src/lib/overlayExport.ts` — `document.fonts.ready` await and `ctx.font` quoting
- [VERIFIED: codebase] `src/Editor/AddOverlayMenu.tsx` line 45 — current default `fontFamily: 'Geist'`
- [VERIFIED: codebase] `index.html` — existing 2-family Google Fonts link to replace
- [VERIFIED: codebase] `src/Editor/__tests__/OverlayPanel.test.tsx` — tests that must be updated
- [VERIFIED: codebase] `src/hooks/useMediaQuery.ts` — mobile detection hook available

### Secondary (MEDIUM confidence)
- [CITED: fonts.google.com] Google Fonts multi-family URL format — `family=Name&family=Name2` pattern, `display=swap` parameter

### Tertiary (LOW confidence)
- [ASSUMED] Bebas Neue and Pacifico single-weight constraint on Google Fonts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools already in the project
- Architecture: HIGH — codebase audit gives complete picture of all touch points
- Pitfalls: HIGH — existing test file and component code make all pitfalls concrete and verifiable

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable domain — Google Fonts API, React, Tailwind patterns change slowly)
