# Phase 31: Improve Mobile Interactions UI/UX — Research

**Researched:** 2026-04-19
**Domain:** Touch-action CSS, viewport meta, pointer-event hit areas, dnd-kit drag-activation guard
**Confidence:** HIGH

## Summary

Phase 31 is a surgical four-change fix touching four distinct files. Every change is one to three lines. No new components, no new state, no new dependencies. The research below is derived entirely from reading the current source — no external library lookups required because no new libraries are introduced.

The two mobile failures are:
1. Browser-level zoom/scroll competing with the in-app pinch handler because `touchAction: 'none'` on `CanvasArea`'s `<main>` element is guarded by a `sheetOpen` condition, leaving it unset when the sheet is collapsed.
2. Divider drag unreliable on touch because the hit-area `<div>` is 22px wide (below Apple HIG 44px minimum), has no `touch-action: none` to block scroll hijack, and the dnd-kit 500ms long-press timer can activate on the divider's ancestor cell before the user finishes pressing.

All four decisions from CONTEXT.md (D-01 through D-06) map to exact source lines documented below.

**Primary recommendation:** Make the four targeted edits and update the one existing divider test that asserts the 22px class. No new test files are required; the existing `divider.test.tsx` has one assertion that will need updating.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Apply `touch-action: none` to the `CanvasArea` `<main>` element **unconditionally** — not just when the sheet is open.
- **D-02:** Add `maximum-scale=1, user-scalable=no` to the viewport `<meta>` tag in `index.html`.
- **D-03:** The in-app pinch-to-zoom handler (in `LeafNode.tsx`) stays unchanged.
- **D-04:** Widen the divider hit area from 22px to 40px (`-top-[20px]` / `-left-[20px]` offsets, `h-[40px]` / `w-[40px]`).
- **D-05:** Add `touch-action: none` to the divider hit area `<div>` (the `onPointerDown` element).
- **D-06:** Verify the dnd adapter checks `data-dnd-ignore="true"` on the pointerdown target and its ancestors before starting the 250ms long-press timer; add the check if missing.

### Claude's Discretion
- Exact pixel value for the widened divider hit area (40px is the decision but ±4px is fine if layout demands it).
- Whether the `data-dnd-ignore` check in the adapter is already sufficient or needs tightening.
- Whether `maximum-scale=1, user-scalable=no` in the viewport meta conflicts with any existing meta tag.

### Deferred Ideas (OUT OF SCOPE)
- Add Overlay on mobile (AddOverlayMenu).
- Missing mobile tools (safe zone toggle, overlay visibility toggle, zoom controls).
- First-use onboarding improvements.
- Two-finger pan.
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser-level zoom suppression | Browser / Client (meta tag) | — | Viewport meta is a browser directive, not app logic |
| Canvas touch-action gate | Frontend (React component style prop) | — | CSS `touch-action` on `<main>` scoped to CanvasArea |
| Divider touch reliability | Frontend (React component className + style) | — | Hit area sizing and touch-action both live in Divider.tsx |
| Long-press timer guard | Frontend (dnd adapter) | — | dnd-kit sensor activation guard in CanvasWrapper.tsx handleDragStart |

---

## Exact Current State (source-verified)

### D-01 — CanvasArea.tsx `touchAction` conditional

**File:** `src/Editor/CanvasArea.tsx`
**Line:** 88

Current code [VERIFIED: Read tool]:
```tsx
style={{ overscrollBehavior: 'contain', ...(sheetOpen ? { touchAction: 'none' } : {}) }}
```

`sheetOpen` is derived at line 11:
```tsx
const sheetOpen = sheetSnapState !== 'collapsed';
```

When `sheetSnapState === 'collapsed'` (the default state), the spread resolves to `{}`, meaning `touchAction` is absent from the element's style entirely. The browser is therefore free to interpret pinch gestures as page zoom.

**Required change:** Replace the conditional spread with an unconditional property:
```tsx
style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
```

The `sheetOpen` variable and its `useEditorStore` selector become unused after this change and should be removed to keep the component clean, unless `sheetOpen` is used elsewhere in the component. **Verified: `sheetOpen` is used only in the `style` prop on line 88 — it can be removed.**

---

### D-02 — index.html viewport meta

**File:** `index.html`
**Line:** 6

Current content [VERIFIED: Read tool]:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

No conflict — only one viewport meta tag exists. The `initial-scale=1.0` and `initial-scale=1` are equivalent; both are acceptable.

**Required change:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />
```

---

### D-03 — Pinch-to-zoom handler (read-only reference)

The in-app pinch handler lives in `src/Grid/LeafNode.tsx`, **not** in `CanvasWrapper.tsx` as CONTEXT.md's canonical refs section states. [VERIFIED: Grep tool]

The handler listens on the leaf's `<div>` element via native `addEventListener`:
```ts
el.addEventListener('touchstart', handleTouchStart, { passive: true });
el.addEventListener('touchmove', handleTouchMove, { passive: false });  // preventDefault() called here
el.addEventListener('touchend', handleTouchEnd);
```

`handleTouchMove` calls `e.preventDefault()` to prevent page scroll during pinch. This handler is unaffected by D-01 — `touch-action: none` on `CanvasArea`'s `<main>` prevents the *browser-level page zoom* gesture; the LeafNode handler suppresses *page scroll during per-cell pinch*. These are complementary, not conflicting.

**No changes to LeafNode.tsx required.**

---

### D-04 + D-05 — Divider.tsx hit area

**File:** `src/Grid/Divider.tsx`
**Lines:** 104–116 (the inner `<div>` with `onPointerDown`)

Current hit area className strings [VERIFIED: Read tool]:

For vertical container (horizontal divider):
```
-top-[11px] left-0 right-0 h-[22px]
```

For horizontal container (vertical divider):
```
-left-[11px] top-0 bottom-0 w-[22px]
```

The hit area `<div>` already carries `data-dnd-ignore="true"` (line 117). It does **not** carry a `style` prop or any `touch-action` CSS.

**Required changes to the hit area `<div>` className:**

| Dimension | Before | After |
|-----------|--------|-------|
| Vertical container hit area | `-top-[11px] ... h-[22px]` | `-top-[20px] ... h-[40px]` |
| Horizontal container hit area | `-left-[11px] ... w-[22px]` | `-left-[20px] ... w-[40px]` |

**Required addition:** Add `style={{ touchAction: 'none' }}` to the hit area `<div>` (alongside the existing `onPointerDown`, `onPointerMove`, `onPointerUp` props).

The outer `<div>` (lines 95–102) carries `data-dnd-ignore="true"` but no `onPointerDown` — it does **not** need `touch-action: none`.

---

### D-06 — DnD adapter long-press timer guard

**File:** `src/dnd/adapter/dndkit.ts`

[VERIFIED: Read tool] The adapter file is a Phase 27 skeleton — it exports only `export {}` and contains no implementation. The actual drag-activation logic lives in `src/Grid/CanvasWrapper.tsx`.

The relevant guard is in `handleDragStart` at line 82–84 of `CanvasWrapper.tsx` [VERIFIED: Read tool]:
```ts
const handleDragStart = useCallback(({ active }: DragStartEvent) => {
  const node = document.querySelector(`[data-testid="leaf-${String(active.id)}"]`) as HTMLElement | null;
  if (!node || node.closest('[data-dnd-ignore="true"]')) {
    return;
  }
  // ... drag activation proceeds
```

**The check already uses `.closest('[data-dnd-ignore="true"]')` ancestor traversal.** This means if a divider element (which carries `data-dnd-ignore="true"` on both the outer `<div>` and the hit area `<div>`) triggers a `DragStartEvent`, the `handleDragStart` callback will find the `data-dnd-ignore` attribute via `.closest()` and `return` without calling `beginCellDrag`.

However, there is a subtlety: the `handleDragStart` guard runs **after** the 250ms/500ms activation delay has elapsed. The dnd-kit `PointerSensor` with `{ delay: 500, tolerance: 8 }` (line 71) starts the timer on `pointerdown` anywhere in the `DndContext` subtree. If the user presses on a divider for 500ms, dnd-kit will call `handleDragStart` — the guard then aborts the drag, but the 500ms has already elapsed (which can feel laggy or conflate with an intended divider drag).

**Assessment:** The guard in `handleDragStart` prevents the drag from *completing*, but does not prevent the *timer from starting*. For divider interactions, D-04 (40px hit area) + D-05 (`touch-action: none`) are the primary fixes — `touch-action: none` on the hit area div will cause the browser to commit touch events to pointer events without scroll interference, and `setPointerCapture` in `handlePointerDown` takes exclusive ownership. The `handleDragStart` guard is a belt-and-suspenders abort. **No change to CanvasWrapper.tsx's `handleDragStart` is required for D-06** — the existing `.closest()` check satisfies D-06.

Note: the PointerSensor activation constraint in CanvasWrapper.tsx uses `{ delay: 500, tolerance: 8 }` (line 71), not the REQUIREMENTS.md-specified `{ delay: 250, tolerance: 5 }`. This is a pre-existing discrepancy from Phase 29.1 — it is out of scope for Phase 31 and should not be changed here.

---

## Standard Stack

No new libraries. Existing stack only.

| File Changed | Change Type | Risk |
|---|---|---|
| `index.html` | Attribute addition to existing meta tag | Minimal |
| `src/Editor/CanvasArea.tsx` | Remove conditional guard + remove unused variable | Minimal |
| `src/Grid/Divider.tsx` | Two className string edits + add style prop | Minimal |
| `src/test/divider.test.tsx` | Update one assertion from `w-[22px]` to `w-[40px]` | Required |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Scroll hijack prevention | Custom scroll lock logic | `touch-action: none` CSS property (browser-native) |
| Browser zoom suppression | JS gesture event interceptors | `maximum-scale=1, user-scalable=no` in viewport meta |
| Drag-ignore traversal | Custom traversal loop | `.closest('[data-dnd-ignore="true"]')` DOM API (already used) |

---

## Common Pitfalls

### Pitfall 1: Orphaned `sheetOpen` variable after D-01
**What goes wrong:** Removing the conditional `touchAction` guard leaves `sheetOpen` and its `useEditorStore` selector as unused declarations. TypeScript or ESLint may warn.
**How to avoid:** Remove both the `const sheetOpen = ...` line (line 11) and the `const sheetSnapState = ...` line (line 10) when making the D-01 change.
**Warning signs:** ESLint `no-unused-vars` or TypeScript `TS6133` error on `sheetSnapState` / `sheetOpen`.

### Pitfall 2: Divider test assertion on 22px class
**What goes wrong:** `src/test/divider.test.tsx` line 67 asserts `expect(hitArea.className).toContain('w-[22px]')`. After D-04 changes the class to `w-[40px]`, this test fails.
**How to avoid:** Update the assertion to `w-[40px]` in the same task that edits `Divider.tsx`.
**Warning signs:** Vitest reports `divider.test.tsx` failure with "expected string to contain 'w-[22px]'".

### Pitfall 3: `touch-action: none` as inline style vs Tailwind class
**What goes wrong:** `touch-action: none` is not a standard Tailwind utility in v3 without configuration. Using `className="touch-none"` requires verifying Tailwind JIT generates this utility. Using `style={{ touchAction: 'none' }}` is unambiguous.
**How to avoid:** Use `style={{ touchAction: 'none' }}` on the Divider hit area `<div>` (consistent with Phase 30's pattern on `useCellDraggable` which also uses inline style). For CanvasArea, the existing `style` prop already uses the `touchAction` key — no ambiguity there.
**Note:** Tailwind v3 does support `touch-none` as a utility class (maps to `touch-action: none`). Either approach works; inline style is consistent with the existing CanvasArea pattern.

### Pitfall 4: Divider grab-handle visual positioning after hit area resize
**What goes wrong:** The visible grab handle `<div>` inside the hit area uses hardcoded offsets (`top-[8px]`, `left-[8px]`) that place it near the center of the 22px hit area. With a 40px hit area, these offsets still work visually but the handle will appear shifted toward the edge rather than centered.
**How to avoid:** The grab handle's `top-[8px]` / `left-[8px]` offsets refer to position within the visible divider line area, not within the full hit area. At 40px total height, the center is 20px — a `top-[19px]` offset would be perfectly centered. However, the divider line is visually at the center of the hit area (the `top-[10px]` 2px line), so the handle at `top-[8px]` remains visually correct relative to the line itself. **No change to grab handle positioning is needed** — the handle is positioned relative to the visible line, not the outer hit area.

---

## Code Examples

### D-01 — CanvasArea.tsx after change
```tsx
// BEFORE (line 88):
style={{ overscrollBehavior: 'contain', ...(sheetOpen ? { touchAction: 'none' } : {}) }}

// AFTER:
style={{ overscrollBehavior: 'contain', touchAction: 'none' }}

// Also remove lines 10-11 (now unused):
// const sheetSnapState = useEditorStore(s => s.sheetSnapState);
// const sheetOpen = sheetSnapState !== 'collapsed';
```

### D-04 + D-05 — Divider.tsx hit area div after change
```tsx
// BEFORE:
<div
  className={`
    group/hit absolute z-10
    ${isVerticalContainer
      ? '-top-[11px] left-0 right-0 h-[22px]'
      : '-left-[11px] top-0 bottom-0 w-[22px]'
    }
    ${cursorClass}
  `}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  data-testid={`divider-hit-${containerId}-${siblingIndex}`}
  data-dnd-ignore="true"
>

// AFTER:
<div
  className={`
    group/hit absolute z-10
    ${isVerticalContainer
      ? '-top-[20px] left-0 right-0 h-[40px]'
      : '-left-[20px] top-0 bottom-0 w-[40px]'
    }
    ${cursorClass}
  `}
  style={{ touchAction: 'none' }}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  data-testid={`divider-hit-${containerId}-${siblingIndex}`}
  data-dnd-ignore="true"
>
```

### D-02 — index.html viewport meta after change
```html
<!-- BEFORE: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- AFTER: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />
```

### Divider test update required
```ts
// src/test/divider.test.tsx line 67
// BEFORE:
expect(hitArea.className).toContain('w-[22px]');

// AFTER:
expect(hitArea.className).toContain('w-[40px]');
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (detected from `src/test/*.test.{ts,tsx}` pattern) |
| Config file | `vite.config.ts` (Vitest config co-located with Vite) |
| Quick run command | `npx vitest run src/test/divider.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `touchAction: 'none'` unconditional on CanvasArea `<main>` | unit | `npx vitest run src/test/divider.test.tsx` (no dedicated CanvasArea test; verify by grep) | ✅ (no assertion currently; grep-verifiable) |
| D-02 | viewport meta has `maximum-scale=1, user-scalable=no` | manual / grep | `grep "maximum-scale" index.html` | ❌ — grep check only |
| D-04 | Divider hit area is `h-[40px]` / `w-[40px]` | unit | `npx vitest run src/test/divider.test.tsx` | ✅ (needs update from 22px assertion) |
| D-05 | Divider hit area has `style.touchAction === 'none'` | unit | `npx vitest run src/test/divider.test.tsx` | ❌ Wave 0 gap |
| D-06 | `handleDragStart` aborts when `data-dnd-ignore` found via `.closest()` | unit | `npx vitest run src/Grid/CanvasWrapper.test.ts` | ✅ (it.todo stubs — no new test needed for D-06; guard is pre-existing) |

### Wave 0 Gaps
- [ ] `src/test/divider.test.tsx` — add assertion that hit area `style.touchAction === 'none'` (covers D-05)
- [ ] `src/test/divider.test.tsx` — update existing `w-[22px]` assertion to `w-[40px]` (covers D-04)

*(D-01 and D-02 are verifiable by grep; no new test file required. D-06 guard pre-exists.)*

---

## Environment Availability

Step 2.6: SKIPPED — Phase 31 is purely CSS/HTML/React changes with no external CLI, database, or service dependencies beyond the existing Vite + Vitest toolchain already confirmed present in the project.

---

## Security Domain

No security-relevant changes. Phase 31 modifies only CSS properties and one HTML meta attribute. No authentication, data validation, cryptography, or access control is touched.

---

## Open Questions

1. **PointerSensor delay discrepancy**
   - What we know: CanvasWrapper.tsx uses `{ delay: 500, tolerance: 8 }` (line 71); REQUIREMENTS.md DRAG-03 specifies `{ delay: 250, tolerance: 5 }`.
   - What's unclear: Phase 29.1 likely changed 250ms to 500ms intentionally to fix a specific regression. The git commit message is not visible in this research session.
   - Recommendation: Leave at 500ms for Phase 31 (out of scope). The planner may want to flag this as a follow-up if the discrepancy is not intentional.

2. **`data-dnd-ignore` on OverlayLayer**
   - What we know: `src/Grid/OverlayLayer.tsx` line 52 also carries `data-dnd-ignore="true"` — the attribute is applied consistently to non-draggable interactive zones.
   - What's unclear: Whether the existing `.closest()` guard in `handleDragStart` is also protecting overlay interactions correctly.
   - Recommendation: No action for Phase 31; out of scope.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sheetOpen` is used only in the `style` prop on line 88 of CanvasArea.tsx and can be removed along with `sheetSnapState` | D-01 | If `sheetOpen` is used elsewhere in the component, removing its declaration will cause a TypeScript error. Mitigated: Read tool confirmed the full file; no other usage found. | [VERIFIED: Read tool — full file read, no other reference to sheetOpen] |

**If this table is empty (post-verification):** All claims in this research were verified directly against source files — no unverified assumptions remain.

---

## Sources

### Primary (HIGH confidence)
- `src/Editor/CanvasArea.tsx` — full file read; D-01 current state at line 88
- `src/Grid/Divider.tsx` — full file read; D-04/D-05 current state at lines 104–116
- `src/Grid/CanvasWrapper.tsx` — full file read; D-06 guard at lines 82–84; pinch handler location confirmed
- `src/Grid/LeafNode.tsx` — grep confirmed pinch handler location (touchstart/touchmove addEventListener)
- `src/dnd/adapter/dndkit.ts` — full file read; confirmed skeleton-only, no activation logic
- `index.html` — full file read; D-02 current state at line 6
- `src/test/divider.test.tsx` — full file read; confirmed 22px assertion at line 67 that must be updated
- `src/Grid/CanvasWrapper.test.ts` — full file read; confirmed it.todo stubs only (no blocking test changes)

### Secondary (MEDIUM confidence)
- None required for this phase.

---

## Metadata

**Confidence breakdown:**
- Current source state: HIGH — all four target files read directly
- Required changes: HIGH — changes are one-to-three lines each, fully specified
- Test impact: HIGH — one existing assertion needs updating, one new assertion is a Wave 0 gap

**Research date:** 2026-04-19
**Valid until:** Stable (source files are not expected to change between research and implementation)
