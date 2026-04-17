---
phase: 28-cell-to-cell-drag
plan: 06
subsystem: dnd
tags: [dnd, component, overlay, lucide, phase-28, drop-zone-visuals]

# Dependency graph
requires:
  - phase: 27-dnd-foundation
    provides: "DropZoneIndicators skeleton file with 12-line header (lines 1-12) locked — Phase 28 fills the body"
  - plan: 28-01
    provides: "DropZone type from dragStore (imported for Props contract — forward-compat for Phase 29 active/inactive)"
provides:
  - "Live DropZoneIndicators({ zone }) component — 5-icon absolute overlay"
  - "Root div: absolute inset-0 pointer-events-none, z-index 20, data-testid='drop-zones'"
  - "5 zone children with stable test-ids: drop-zone-center / top / bottom / left / right"
  - "lucide-react icons: ArrowLeftRight (center, swap), ArrowUp/Down/Left/Right (edge inserts)"
  - "Screen-constant icon sizing via iconSize = 32 / canvasScale"
  - "pointer-events-none on root AND every child (D-16 — drop passes through to LeafNode)"
  - "No insertion lines (DROP-05 — Phase 25 edge-line pattern explicitly NOT reintroduced)"
affects:
  - 28-07 (CanvasWrapper DndContext mount) — no direct dependency; this component is rendered inside LeafNode, not CanvasWrapper
  - 28-08 (LeafNode surgical rewire) — Plan 08 mounts `<DropZoneIndicators zone={activeZone} />` conditionally when `useDragStore(s => s.overId === id && s.status === 'dragging')` is true
  - 29-* (Visual Polish phase) — Phase 29 wires DROP-02/03 active/inactive styling off the zone prop; the Phase 28 base state locks the render contract those styles build on

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skeleton-body replacement pattern — header block (lines 1-12) preserved byte-identical; only function body replaced"
    - "Scale-stable icon sizing via `32 / canvasScale` (precedent: Divider.tsx:136 `scale(1 / canvasScale)` + Phase 25 LeafNode.tsx:754 — being deleted in Plan 08)"
    - "Unused prop pattern (`zone: _zone`) — accepts prop for forward-compat with Phase 29 without triggering no-unused-vars"
    - "All-5-zones-always-render contract — D-15 explicit; zone prop exists but does not gate visibility in Phase 28"

key-files:
  created:
    - "src/dnd/DropZoneIndicators.test.tsx — 19 specs across 7 describe blocks (root contract, 5-zones-render, lucide-svg count, scale-stable sizing at 3 scales, pointer-events, no-insertion-lines DROP-05, no-Phase29-polish D-15)"
  modified:
    - "src/dnd/DropZoneIndicators.tsx — body replaced (was: `export function DropZoneIndicators(): null { return null; }`; now: 5-zone absolute overlay with icon sizing and Props-typed `zone` accepted for forward-compat). Header lines 1-12 preserved byte-identical."

key-decisions:
  - "Zone prop typed as `DropZone | null` and accepted but prefixed `_zone` inside the destructure — honors D-12 forward-compat contract while keeping Phase 28 scope limited to base-state render (D-15). Phase 29 wires this prop to DROP-02/03 styling."
  - "Every child carries `pointer-events-none` independently instead of relying on inheritance — defense-in-depth per T-28-15 threat-model entry (overlay child cannot accidentally reintroduce pointer-events:auto)."
  - "Icon size computed once at component top (`const iconSize = 32 / canvasScale`) rather than inlined per-Icon — one subscription, one value, five sites."
  - "Single-line lucide import (not multi-line) to satisfy the plan's exact grep contract `grep -q \"import { ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'\"`."
  - "Skipped REFACTOR commit — implementation is minimal (6 JSX blocks with near-identical structure); extracting a shared helper would add indirection without readability gains."

patterns-established:
  - "Pattern: Scale-stable visual overlay inside a transform: scale() ancestor. Icon size divided by `useEditorStore.getState().canvasScale` (or selector) to remain screen-constant. Reusable in any future overlay that mounts inside the scaled canvas."
  - "Pattern: Unconditional multi-zone render with prop accepted but unused in the current phase — enables cross-phase feature layering (Phase 28 renders; Phase 29 styles) without changing the render tree in Phase 29."

requirements-completed: [DROP-01, DROP-05]

# Metrics
duration: ~4min
tasks: 1
files_modified: 1
files_created: 1
tests_added: 19
tests_passing_delta: +19
tests_failing_delta: 0
completed: 2026-04-17
---

# Phase 28 Plan 06: DropZoneIndicators 5-icon overlay Summary

**Filled the Phase 27 `DropZoneIndicators` skeleton body in `src/dnd/DropZoneIndicators.tsx` with a 5-zone absolute-positioned overlay (center swap + 4 edge inserts), using lucide-react icons sized via `32 / canvasScale` for screen-constant visuals, with `pointer-events-none` propagated to every element so drop events pass through to the LeafNode root — preserving the 12-line header block verbatim and matching Phase 25's proportional zone layout without reintroducing the edge-line insertion pattern (DROP-05).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T12:22:14Z
- **Completed:** 2026-04-17T12:26:00Z (approx)
- **Tasks:** 1/1
- **Files created:** 1 (test file)
- **Files modified:** 1 (component)

## Accomplishments

- `DropZoneIndicators({ zone })` now returns a 5-zone absolute overlay — Phase 27 `return null;` stub is gone.
- Root div contract locked: `position: absolute; inset: 0; pointer-events: none; z-index: 20; data-testid="drop-zones"`.
- 5 zone children with stable test-ids — `drop-zone-center`, `drop-zone-top`, `drop-zone-bottom`, `drop-zone-left`, `drop-zone-right`.
- 5 lucide icons rendered at `32 / canvasScale` — verified at canvasScale=1 (→32), canvasScale=0.5 (→64), and canvasScale=0.25 (→128).
- `pointer-events-none` on root AND every child (D-16 / T-28-15 threat-model mitigation).
- No insertion lines (DROP-05) — zero `edge-line-*` test-ids in the file.
- No Phase 29 active/inactive differentiation (D-15) — no `text-white/30` or `scale-110` classes anywhere.
- 19 new unit tests across 7 describe blocks — all passing.
- `npx tsc --noEmit` clean.
- Full test suite: **850 passing / 9 pre-existing failing / 2 skipped / 4 todo** — **+19 new passing, 0 new failures**. The 9 failing tests remain the documented Phase 25 / ActionBar / phase22 / phase25-touch-dnd set scheduled for deletion in Plans 08-10 (D-21/D-22).

## Task Commits

Task 1 was executed as a TDD cycle (test → feat; no refactor):

1. **Task 1 RED (failing tests):** `26eb678` — `test(28-06): add failing tests for DropZoneIndicators 5-icon overlay`
2. **Task 1 GREEN (implementation):** `7a1724f` — `feat(28-06): implement DropZoneIndicators 5-icon absolute overlay`

_REFACTOR skipped — GREEN implementation is already minimal (6 JSX blocks with near-identical structure; extracting a shared helper would add indirection without readability gains)._

## Files Created/Modified

### Created
- **`src/dnd/DropZoneIndicators.test.tsx`** (178 lines, 19 tests) — 7 describe blocks:
  1. Root container contract (D-13): `data-testid="drop-zones"`, absolute + inset-0 + pointer-events-none classes, `style.zIndex === '20'`.
  2. All 5 zones render unconditionally (D-15): `drop-zone-{center,top,bottom,left,right}` present whether `zone={null}` or `zone={<any of the 5>}`.
  3. Root contains exactly 5 `<svg>` children (D-14 — lucide icon count).
  4. Icon sizing scales with canvasScale at 1, 0.5, 0.25 → width/height 32, 64, 128 (D-14 formula).
  5. Root has `pointer-events-none` class (D-16).
  6. DROP-05: no `edge-line-*` test-ids anywhere.
  7. D-15: no `text-white/30` or `scale-110` utilities anywhere in the rendered tree (Phase 29 polish deferred).

### Modified
- **`src/dnd/DropZoneIndicators.tsx`**:
  - Lines 1-12 (the 12-line header comment block) — **preserved byte-identical**.
  - Added imports (lines 14-16): `ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight` from `lucide-react`; `useEditorStore` from `../store/editorStore`; `DropZone` type from `./dragStore`.
  - Added `Props` interface with documented `zone: DropZone | null` forward-compat note.
  - Replaced body: `DropZoneIndicators(): null { return null; }` → `DropZoneIndicators({ zone: _zone }: Props) { ... }` that subscribes to `canvasScale`, computes `iconSize = 32 / canvasScale`, and renders the absolute root with 5 zone children.

## Decisions Made

1. **Zone prop accepted but unused in Phase 28 (D-12 / D-15 combined).** The prop is typed `DropZone | null` per the locked contract but prefixed `_zone` inside the destructure to silence `no-unused-vars` while documenting the forward-compat intent. Phase 29 (DROP-02/03) switches this from decorative to load-bearing without changing the prop shape.

2. **Every child carries `pointer-events-none` independently.** Technically `pointer-events: none` on the root inherits to children in CSS (children do not restore `auto` unless explicitly set). Still, I applied the class to every child as defense-in-depth per T-28-15 ("mitigate: overlay child bypassing root PE"). The acceptance grep `grep -q "pointer-events-none"` passes either way; explicit-per-child reads clearer and prevents accidental regression if a future edit unsets it on the root.

3. **Computed `iconSize` once at top of component** rather than inlined into every `<Icon size={...} />`. Single Zustand subscription, single division, five consumers. Matches React's idiomatic "compute then use" pattern.

4. **Single-line lucide import.** Multi-lining the five named imports would be equally valid TypeScript, but the plan's exact-grep acceptance check (`grep -q "import { ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'"`) is a single-line literal. I format-matched to satisfy it verbatim.

5. **Skipped REFACTOR commit.** The 5 zone `<div>` blocks share near-identical structure (absolute positioning + flex center + one icon); I considered extracting them to a shared `<Zone />` helper. Rejected because:
   - Each zone has a different position rule (inset-[20%], top-0/left-0/right-0 + height:20%, etc.) and a different icon component — the "shared" portion is effectively 3 CSS classes.
   - Inlining keeps all 5 zones visible in a single read without chasing a helper's prop surface.
   - Phase 29 will likely specialize each zone's styling (DROP-02/03); pulling them apart later is trivial.

## Deviations from Plan

**None functionally.** One stylistic formatting note below.

### Plan acceptance grep vs multi-line formatting (documentation-level)

- **Initial formatting:** My first GREEN commit had the 5-import lucide statement multi-lined (one per line), which is easier to read at cell-tower-scroll-speed but failed the plan's exact-literal grep `grep -q "import { ArrowLeftRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'"`.
- **Resolution:** Reformatted to a single line *before* the GREEN commit landed — the failing grep was caught in pre-commit verification, reformatted, then committed. Zero extra commits spent on this.
- **Why it matters:** The plan's greps are contracts; satisfying them literally (not just in spirit) means downstream verifier agents can run them without interpretation.

No other deviations.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 07 (CanvasWrapper `DndContext` mount)** — Unaffected; this component is NOT mounted at the CanvasWrapper level. Plan 07 wires the imperative drag pipeline; Plan 08 mounts `<DropZoneIndicators />` inside LeafNode.
- **Plan 08 (LeafNode surgical rewire)** — Unblocked. Plan 08 can now:
  - Import `DropZoneIndicators` from `../dnd` or from `../dnd/DropZoneIndicators`.
  - Conditionally mount `{isOverThisCell && <DropZoneIndicators zone={activeZone} />}` where `isOverThisCell = useDragStore(s => s.overId === id && s.status === 'dragging')` per D-12.
  - Delete the 5 inline zone JSX blocks at `LeafNode.tsx:720-756` (the edge-line + swap-overlay pattern being replaced by this component).
- **Plans 09-10 (test wave + integration)** — Test-contract stability locked: any future Plan 10 integration test that asserts "5 zones appear on hover" has a stable set of 5 test-ids + a stable root test-id to target.
- **Phase 29 (DROP-02/03 active/inactive)** — Will consume the `zone` prop this plan accepts. The rename of `_zone` → `zone` + adding classes conditional on `zone === 'center'`/etc. is a single-site edit.

## TDD Gate Compliance

- **RED gate:** ✓ Commit `26eb678` (`test(28-06)`) — 18/19 tests failed as expected before implementation (skeleton returned null → every `getByTestId` threw). The 1 test that "passed" in RED is the DROP-05 negative test (`queryByTestId('edge-line-*')` returned null correctly because the skeleton rendered nothing at all). Still a legitimate RED state per the TDD spirit — the test was not satisfying the intent, just passing vacuously.
- **GREEN gate:** ✓ Commit `7a1724f` (`feat(28-06)`) — 19/19 DropZoneIndicators tests pass; 850 total suite tests pass (+19 delta vs baseline); 9 pre-existing failures unchanged; `npx tsc --noEmit` exit 0.
- **REFACTOR gate:** Skipped — see Decision 5.

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| File imports 5 lucide icons AND `useEditorStore` AND `DropZone` type | PASS |
| Component accepts `{ zone: DropZone | null }` prop | PASS |
| Renders exactly 5 data-testid values: `drop-zone-{center,top,bottom,left,right}` + root `drop-zones` | PASS (test 'renders 5 zones' for each) |
| All icons sized via `32 / canvasScale` | PASS (tested at 3 scales) |
| Root + all 5 children carry `pointer-events-none` | PASS (tested on root; verified in source) |
| No active/inactive styling (Phase 29 scope preserved untouched) | PASS (D-15 test: no `text-white/30`, no `scale-110`) |
| `npx tsc --noEmit` exits 0 | PASS |
| Existing tests still pass | PASS (850 pass / 9 pre-existing failed — same set as baseline) |
| All plan greps (12 positive + 3 negative) | PASS |

## Known Stubs

None. The component is fully implemented. Forward-compat fields (`zone` prop accepted but unused) are documented as such; they are not stubs — they are the explicit Phase 28 contract per D-12/D-15.

## Threat Flags

None. This plan adds no new trust boundaries, no network/auth/file-access surface, and no schema changes. The threat model's two entries (T-28-14 canvasScale=0 producing Infinity; T-28-15 child reintroducing pointer-events:auto) are both either `accept` or explicitly mitigated:
- T-28-14: `canvasScale=0` path — CSS gracefully handles `Infinity` by rejecting the value (no crash); `canvasScale` is set by ResizeObserver from positive layout rects so 0 is unreachable in practice.
- T-28-15: Every child carries `pointer-events-none` explicitly (Decision 2); acceptance grep asserts no `pointer-events: auto` is introduced.

## Self-Check: PASSED

- File `src/dnd/DropZoneIndicators.tsx` — FOUND (git show 7a1724f lists it; 72 final lines)
- File `src/dnd/DropZoneIndicators.test.tsx` — FOUND (git show 26eb678 created it; 178 lines)
- Commit `26eb678` — FOUND in git log (`test(28-06): add failing tests...`)
- Commit `7a1724f` — FOUND in git log (`feat(28-06): implement DropZoneIndicators...`)
- Acceptance greps — all 12 positive + 3 negative pass
- Type check: `npx tsc --noEmit` → exit 0
- Test suite: 850 passed / 9 failed (same pre-existing set) / 2 skipped / 4 todo — delta +19 passing vs baseline

---
*Phase: 28-cell-to-cell-drag*
*Plan: 06*
*Completed: 2026-04-17*
