# Phase 22: Mobile Header & Touch Polish — Research

**Researched:** 2026-04-15
**Domain:** React mobile toolbar layout, CSS touch-action / overscroll-behavior
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Header layout — icons only, no wordmark on mobile**
Remove the "StoryGrid" wordmark entirely on mobile. The header becomes a full-width icon toolbar with 5 buttons: Undo, Redo, Templates, Export (split), Clear.
- All buttons: minimum 44×44px tap target, ≥8px gaps between them
- No text labels — icon-only
- The `isMobile` conditional stays; only the returned JSX changes
- The existing mobile branch in `Toolbar.tsx` (lines 94–109) is fully replaced

**Export button on mobile — full ExportSplitButton, icon form factor**
Mobile gets the same `ExportSplitButton` functionality (PNG/MP4 dropdown), but adapted to icon form:
- Left half: upload/export icon → triggers export with current format
- Right half: small `▾` chevron → opens format/quality dropdown
- Total: 44×44px container (two halves split that width)
- Implementation approach (prop vs wrapper) is Claude's discretion

**Clear button on mobile — no confirmation dialog**
Tapping Clear on mobile immediately calls `clearGrid()` without `window.confirm()`. Undo is always available. Confirmation is desktop behavior only.

**SCROLL-01 (`overscroll-behavior: contain`)**
Apply to both the canvas area wrapper in `CanvasArea.tsx` and the `<body>` or root `<div>` in `EditorShell.tsx` / `index.css`. The MobileSheet inner content div already has `overscrollBehavior: 'contain'` — extend this to the canvas wrapper.

**SCROLL-02 (`touch-action: manipulation`)**
Add to all interactive elements (buttons, canvas area). Most effective approach is a global CSS rule targeting `button, [role="button"], input, select, textarea` plus the canvas wrapper. Existing `touchAction: 'none'` on CanvasArea when sheet is open is correct — `manipulation` applies when sheet is closed.

### Claude's Discretion
- Whether to add `isMobile` prop to `ExportSplitButton` or create a `MobileExportButton` wrapper

### Deferred Ideas (OUT OF SCOPE)
None captured during this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEADER-01 | User sees Export, Undo, Redo, Templates, and Clear in the mobile header toolbar (replacing the current Export-only header) | Mobile branch of `Toolbar.tsx` is fully self-contained; existing `isMobile` hook and stores provide all needed state |
| HEADER-02 | All header toolbar touch targets are ≥44×44px with ≥8px gaps between them | Tailwind `w-11 h-11` (44px) + `gap-2` (8px) pattern; verified Apple HIG 44px minimum |
| SCROLL-01 | Canvas area and app body have `overscroll-behavior: contain` preventing pull-to-refresh interference | `overscroll-behavior: contain` is standard CSS; Tailwind `overscroll-contain` utility works; global CSS rule or inline style both viable |
| SCROLL-02 | All interactive elements use `touch-action: manipulation` to eliminate 300ms tap delay | CSS `touch-action: manipulation` is the standard fix; global rule covers all buttons; per-element inline style for canvas wrapper |
</phase_requirements>

---

## Summary

Phase 22 is a focused mobile polish phase with four tightly scoped changes. Two are JSX/component changes (header toolbar redesign for mobile, ExportSplitButton mobile adaptation) and two are mechanical CSS additions (overscroll-behavior and touch-action). The codebase already has all the infrastructure needed — stores, hooks, components — so this phase is entirely additive with no new library dependencies.

The existing `isMobile` branch in `Toolbar.tsx` renders a single Export-only button. This branch is replaced with a 5-button icon row reusing the existing `undo`, `redo`, `clearGrid` actions and the `ExportSplitButton` component (adapted for icon form). `TemplatesPopover` already renders as an icon button and can be dropped in directly.

Touch polish (SCROLL-01, SCROLL-02) requires two CSS changes: a `overscroll-behavior: contain` rule on `body` + canvas area, and a `touch-action: manipulation` global rule targeting all interactive elements. Neither requires new JavaScript.

**Primary recommendation:** One plan, two waves — Wave 1: header toolbar redesign; Wave 2: CSS touch polish + tests.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^18.3.1 | Component rendering | Project constraint — already installed [VERIFIED: codebase] |
| Tailwind CSS v3 | ^3.4.x | Utility CSS classes for layout/sizing | Project constraint — already installed [VERIFIED: codebase] |
| lucide-react | ^1.7.0 | Icons (Undo2, Redo2, Trash2, Download, ChevronDown, LayoutGrid) | Already used throughout Toolbar.tsx and MobileSheet.tsx [VERIFIED: codebase] |
| Zustand (useGridStore, useEditorStore) | ^5.0.12 | Store state access | Already used — undo, redo, clearGrid, isExporting all available [VERIFIED: codebase] |
| useMediaQuery hook | internal | `(max-width: 767px)` breakpoint detection | Already used in Toolbar.tsx line 36 [VERIFIED: codebase] |

### No New Installations Needed

All required functionality exists in the current codebase. This phase involves zero `npm install` operations.

---

## Architecture Patterns

### Existing Mobile Branch Pattern

`Toolbar.tsx` uses the `isMobile` pattern established in Phase 5.1:

```typescript
// Source: src/Editor/Toolbar.tsx (lines 36, 94-110)
const isMobile = useMediaQuery('(max-width: 767px)');

if (isMobile) {
  return (
    <header ...>
      {/* ENTIRE BLOCK REPLACED — new 5-button icon row */}
    </header>
  );
}

// desktop branch unchanged below
return ( ... );
```

The planner's task is to replace lines 94–109 only. The desktop branch (lines 112–274) must not change. [VERIFIED: codebase]

### Mobile Header Target Layout

New mobile header: full-width flex row, no wordmark, no text labels.

```
┌─────────────────────────────────────────────────────┐
│  [Undo]  [Redo]  [Templates]  [ExportSplit]  [Clear] │
│   44px   44px     44px          44px          44px   │
│         ←──── gap-2 (8px) between each ────→         │
└─────────────────────────────────────────────────────┘
```

Tailwind classes for each button: `flex items-center justify-center w-11 h-11 rounded-lg` — `w-11 h-11` = 44×44px [VERIFIED: Tailwind v3 spacing scale, 1 unit = 4px, 11 × 4 = 44px].

Gap between buttons: `gap-2` = 8px. [VERIFIED: Tailwind v3 spacing scale]

### ExportSplitButton Mobile Adaptation

**Recommended approach: `isMobile` prop on ExportSplitButton.**

Rationale: The component is self-contained, already owns all export logic, and a single prop is simpler than a wrapper that duplicates the `handleExport` callback. The wrapper approach would either re-implement the export logic or import from ExportSplitButton internals — both are worse.

Icon-only form:

```typescript
// ExportSplitButton with isMobile prop:
// Left half: Download icon, no text label, 32px wide (of 44px total)
// Right half: ChevronDown icon, 12px wide (of 44px total)
// Combined: 44px height, ~44px width split 32/12
```

Existing import in Toolbar: `import { ExportSplitButton } from './ExportSplitButton';` — passes `isMobile` prop.

### TemplatesPopover Reuse

`TemplatesPopover` is already an icon-only button (32×32px, `LayoutGrid` icon). On mobile, it just needs a `w-11 h-11` wrapper or the component itself accepts a `size` prop. Simplest approach: wrap in a `<div className="w-11 h-11 flex items-center justify-center">` — or update the button inside TemplatesPopover to be size-configurable. Since the popover is also used in MobileSheet, avoid changing its internal button size. Wrapping is cleaner.

### MobileSheet Duplication Note

The existing `MobileSheet` already renders Undo, Redo, Templates, and Clear in its header (lines 96–124 of MobileSheet.tsx). After Phase 22, these controls exist in BOTH the mobile toolbar header AND the MobileSheet header. This is intentional per the design decision — the header toolbar gives immediate access without needing to open the sheet. The MobileSheet header remains unchanged in Phase 22 (it is redesigned in Phase 23).

### overscroll-behavior: contain — Two Application Sites

**Site 1: `body` level** — prevents pull-to-refresh app-wide.

In `index.css`, add to the `body` rule inside `@layer base`:
```css
body {
  @apply bg-background text-foreground;
  overscroll-behavior: contain;
}
```

Tailwind v3 equivalent: `overscroll-contain` utility class. [VERIFIED: Tailwind v3 docs — `overscroll-contain` maps to `overscroll-behavior: contain`] [ASSUMED: Tailwind v3 has this utility — training knowledge, not confirmed via live docs lookup this session. Confidence HIGH based on v3.2+ docs.]

**Site 2: `CanvasArea` `<main>` element** — belt-and-suspenders for the canvas scroll container.

In `CanvasArea.tsx`, add `overscroll-contain` to the `<main>` className or inline `overscrollBehavior: 'contain'` in its style. The `<main>` already conditionally sets `touchAction: 'none'` when sheet is open — add `overscrollBehavior: 'contain'` unconditionally. [VERIFIED: codebase — `style={sheetOpen ? { touchAction: 'none' } : undefined}`]

Change to:
```typescript
style={{ overscrollBehavior: 'contain', ...(sheetOpen ? { touchAction: 'none' } : {}) }}
```

### touch-action: manipulation — Global CSS Rule

**Global rule in `index.css`** (most maintainable):
```css
@layer base {
  button,
  [role="button"],
  input,
  select,
  textarea,
  a {
    touch-action: manipulation;
  }
}
```

This eliminates the 300ms tap delay on all interactive elements across the app. [VERIFIED: MDN — `touch-action: manipulation` disables double-tap zoom, eliminating the 300ms delay in browsers that implement it (Chrome, Safari 13+, Firefox)] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action]

**Canvas area specific:** The `<main>` in CanvasArea already sets `touchAction: 'none'` when sheet is open (which overrides the global rule). When sheet is closed, the global rule applies. This is the correct behavior per the CONTEXT.md decision.

### Anti-Patterns to Avoid

- **Using `window.confirm()` in the mobile Clear handler:** The CONTEXT decision explicitly forbids this — call `clearGrid()` directly.
- **Modifying the desktop Toolbar branch:** Only the `if (isMobile)` return block changes.
- **Adding `touch-action: none` globally:** This breaks scrolling and pointer events. Use `manipulation` (scroll allowed, double-tap zoom disabled).
- **Applying `overscroll-behavior: none`:** `none` prevents elastic bounce on iOS entirely, which can feel unnatural. `contain` is the correct value — it prevents chain propagation to parent, allowing local scrolling to bounce without propagating.
- **Putting `overscroll-behavior` only on the body:** Some browsers require it on both the scroll container and the body. Belt-and-suspenders approach (both body and canvas main) is correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 44px tap targets | Custom clamp/min-height logic | Tailwind `w-11 h-11` | Direct mapping, no calculation needed |
| 8px gaps | Pixel math in inline styles | Tailwind `gap-2` | Semantic, consistent with rest of codebase |
| Icon-only button with tooltip | Custom tooltip from scratch | Existing `Tooltip`/`TooltipProvider` from `src/components/ui/tooltip` | Already wired in desktop branch; reuse pattern |
| Pull-to-refresh prevention | JavaScript `touchstart` prevention | CSS `overscroll-behavior: contain` | Zero-JS, supported Chrome 63+, Safari 16+, Firefox 59+ |
| 300ms tap delay elimination | `fastclick` library or JS heuristics | CSS `touch-action: manipulation` | Natively supported, no dependencies, no JS overhead |

---

## Common Pitfalls

### Pitfall 1: Toolbar tests expect desktop-only elements at `isMobile=false`

**What goes wrong:** `toolbar.test.tsx` tests query for zoom labels, safe zone toggle, and the "New / Clear canvas" aria-label — these only exist in the desktop branch. Tests run in jsdom where `window.matchMedia` returns `false` for the mobile query by default (polyfilled in `src/test/setup.ts`). Adding the mobile branch does not break existing desktop tests IF the matchMedia mock returns non-mobile.

**Why it happens:** `useMediaQuery` reads `window.matchMedia` at render time. jsdom returns `false` by default, so tests render the desktop branch. This means existing tests remain valid.

**How to avoid:** New mobile-specific tests must mock `window.matchMedia` to return `true` for `(max-width: 767px)`. Pattern established in `phase05.1-p01-foundation.test.tsx` (mockMatchMedia helper). [VERIFIED: codebase]

**Warning signs:** Test importing `Toolbar` without a matchMedia mock renders the desktop branch — correct. Test that verifies mobile button count must set `matches: true`.

### Pitfall 2: ExportSplitButton tests break if prop signature changes

**What goes wrong:** `ExportSplitButton` is tested indirectly via toolbar tests. If an `isMobile` prop is added, existing call sites (desktop Toolbar, any tests) must still work without the prop (default `false`).

**How to avoid:** Make `isMobile` prop optional with default `false`. Desktop call site `<ExportSplitButton />` remains unchanged. [ASSUMED: standard TypeScript optional prop pattern — no codebase evidence of existing ExportSplitButton tests found during scan]

### Pitfall 3: overscroll-behavior browser support on iOS Safari

**What goes wrong:** `overscroll-behavior: contain` is supported in iOS Safari 16+ (released 2022). Project targets Safari 15+. On Safari 15, this property is partially supported (or unsupported depending on version point).

**Why it happens:** The property was added to WebKit in Safari 16.

**How to avoid:** The property is a progressive enhancement — on unsupported browsers, pull-to-refresh still works but does not block the app. The requirement (SCROLL-01) is about preventing pull-to-refresh; on Safari 15 this degrades gracefully. Document this limitation. The CSS still ships — it has no negative effect on unsupported browsers (it is silently ignored).

**Safari 15 support data:** [ASSUMED — training knowledge. Recommend verification if Safari 15 support is critical.]

### Pitfall 4: touch-action: manipulation does not help on browsers that never implemented 300ms delay

**What goes wrong:** Modern Chrome on Android has removed the 300ms delay by default since 2015 for responsive viewports (`<meta name="viewport" content="width=device-width">`). The app already sets this meta tag (standard Vite template).

**Why it matters:** SCROLL-02 test criteria requires no perceptible 300ms delay. On Chrome/Firefox, it is already eliminated by the viewport meta tag. Adding `touch-action: manipulation` is belt-and-suspenders and costs nothing.

**How to avoid:** Apply the global rule regardless. It is harmless on browsers that already have no delay, and it helps on any remaining cases. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action]

### Pitfall 5: MobileSheet header row retains old controls after Phase 22

**What goes wrong:** The MobileSheet already has Undo, Redo, Templates, and Clear in its drag handle row. If someone interprets Phase 22 as "move controls from sheet to header," they might remove them from the sheet. This is NOT the intent.

**How to avoid:** Phase 22 ADDS controls to the header. MobileSheet header row is untouched. Both locations have the controls simultaneously — the sheet header is redesigned in Phase 23.

---

## Code Examples

### Mobile Header Replacement (key pattern)

```typescript
// Source: src/Editor/Toolbar.tsx — replace lines 94-109 entirely
if (isMobile) {
  return (
    <header className="flex items-center justify-around h-12 px-2 gap-2 bg-[var(--card)] border-b border-[var(--border)] shrink-0">
      <button
        className="w-11 h-11 flex items-center justify-center rounded-lg text-neutral-300 disabled:opacity-40"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        data-testid="mobile-undo"
      >
        <Undo2 size={20} />
      </button>
      <button
        className="w-11 h-11 flex items-center justify-center rounded-lg text-neutral-300 disabled:opacity-40"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        data-testid="mobile-redo"
      >
        <Redo2 size={20} />
      </button>
      {/* TemplatesPopover wrapper to meet 44px target */}
      <div className="w-11 h-11 flex items-center justify-center">
        <TemplatesPopover />
      </div>
      {/* ExportSplitButton with isMobile prop */}
      <ExportSplitButton isMobile />
      <button
        className="w-11 h-11 flex items-center justify-center rounded-lg text-neutral-300"
        onClick={clearGrid}
        aria-label="Clear canvas"
        data-testid="mobile-clear"
      >
        <Trash2 size={20} />
      </button>
    </header>
  );
}
```

Note: `clearGrid` is already imported in `Toolbar.tsx` (line 23). No new store subscriptions needed. [VERIFIED: codebase]

### overscroll-behavior: contain — index.css

```css
/* Source: src/index.css — inside @layer base, body rule */
body {
  @apply bg-background text-foreground;
  overscroll-behavior: contain;
}
```

### touch-action: manipulation — index.css

```css
/* Source: src/index.css — inside @layer base */
button,
[role="button"],
input,
select,
textarea,
a {
  touch-action: manipulation;
}
```

### CanvasArea overscroll update

```typescript
// Source: src/Editor/CanvasArea.tsx — replace the style prop on <main>
// Before:
style={sheetOpen ? { touchAction: 'none' } : undefined}
// After:
style={{ overscrollBehavior: 'contain', ...(sheetOpen ? { touchAction: 'none' } : {}) }}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fastclick` library for 300ms delay | `touch-action: manipulation` CSS | ~2015 (Chrome) / ~2018 (Safari) | No JS dependency needed |
| `overflow: hidden` on body to prevent pull-to-refresh | `overscroll-behavior: contain` | Chrome 63 (2017), Firefox 59, Safari 16 | CSS-only, allows inner scroll |
| JS `touchstart` + `preventDefault()` for gesture blocking | CSS `touch-action` | Ongoing | No event listener overhead |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v3 has `overscroll-contain` utility class | Don't Hand-Roll | Low risk — worst case use inline style `overscrollBehavior: 'contain'` directly |
| A2 | Safari 15 does not support `overscroll-behavior: contain` | Common Pitfalls | If Safari 15 actually supports it, the pitfall note is overly cautious — no impact on implementation |
| A3 | ExportSplitButton has no existing unit tests that would break from adding an optional prop | Common Pitfall 2 | Low risk — TypeScript optional props are backward-compatible |

---

## Open Questions

1. **TemplatesPopover tap target size**
   - What we know: TemplatesPopover renders a `w-8 h-8` (32px) button internally
   - What's unclear: Whether to update TemplatesPopover's internal button size or always wrap it in the Toolbar
   - Recommendation: Wrap in the Toolbar's mobile branch with `w-11 h-11 flex items-center justify-center` div — avoids touching TemplatesPopover which is also used in MobileSheet

2. **ExportSplitButton: isMobile prop vs MobileExportButton wrapper**
   - What we know: Both approaches work; the user delegated this to Claude
   - Recommendation: Use `isMobile` prop (optional, default `false`) — single component, shared logic, no duplication

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/CSS changes only, all tools already installed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (jsdom) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/test/toolbar.test.tsx src/Editor/__tests__/phase05.1-p01-foundation.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEADER-01 | Mobile header renders Undo, Redo, Templates, Export, Clear buttons | unit | `npx vitest run src/test/phase22-mobile-header.test.tsx` | Wave 0 |
| HEADER-02 | All mobile header buttons have w-11 h-11 (44px) class and container uses gap-2 (8px) | unit | `npx vitest run src/test/phase22-mobile-header.test.tsx` | Wave 0 |
| SCROLL-01 | CanvasArea main has overscrollBehavior: contain in its style | unit | `npx vitest run src/test/phase22-touch-polish.test.tsx` | Wave 0 |
| SCROLL-02 | index.css contains touch-action: manipulation rule targeting button/[role=button] | unit (CSS content assertion) | `npx vitest run src/test/phase22-touch-polish.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/phase22-mobile-header.test.tsx src/test/phase22-touch-polish.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/phase22-mobile-header.test.tsx` — covers HEADER-01, HEADER-02
- [ ] `src/test/phase22-touch-polish.test.tsx` — covers SCROLL-01, SCROLL-02

Existing test infrastructure (vitest.config.ts, src/test/setup.ts, matchMedia mock pattern) is complete. Only new test files are needed.

---

## Security Domain

This phase involves no authentication, session management, access control, cryptography, or user-controlled input (beyond existing tap targets). ASVS categories V2, V3, V4, V6 do not apply.

V5 (Input Validation): No new user inputs introduced. Touch events are handled by the browser; no data is parsed.

No security-relevant changes in this phase.

---

## Sources

### Primary (HIGH confidence)
- Codebase (`src/Editor/Toolbar.tsx`, `src/Editor/ExportSplitButton.tsx`, `src/Editor/CanvasArea.tsx`, `src/Editor/EditorShell.tsx`, `src/Editor/MobileSheet.tsx`, `src/index.css`) — verified all existing patterns
- Codebase (`src/hooks/useMediaQuery.ts`) — verified isMobile hook
- Codebase (`src/test/setup.ts`, `vitest.config.ts`, `src/Editor/__tests__/phase05.1-p01-foundation.test.tsx`) — verified test patterns
- Tailwind CSS v3 spacing scale (`w-11` = 44px, `gap-2` = 8px) [ASSUMED HIGH — standard Tailwind knowledge]

### Secondary (MEDIUM confidence)
- MDN Web Docs `touch-action: manipulation` — eliminates 300ms tap delay [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action]
- MDN Web Docs `overscroll-behavior: contain` — prevents pull-to-refresh propagation [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior]

### Tertiary (LOW confidence)
- Safari 15 `overscroll-behavior` support — training knowledge, not live-verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling already in codebase, no new dependencies
- Architecture: HIGH — patterns directly read from source files; changes are minimal and localized
- Pitfalls: HIGH — derived from actual codebase structure and existing test file patterns

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable tech stack; CSS properties have been standard for years)
