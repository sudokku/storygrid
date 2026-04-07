# Phase 8: Canvas & Workspace UX - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three specific friction points in the editing workspace (v1.1 polish milestone):

1. **Safe zone is barely visible** (CANVAS-01) — today `SafeZoneOverlay.tsx` renders only two dashed top/bottom border lines, with no striped/dimmed fill and no icon. Users cannot tell at a glance what content will be covered by Instagram's header/footer.
2. **Template confirmation dialog** (TPL-01) — **already satisfied** by quick-260407-vth (commits 41cc818, 64a7cf8). Phase 8 only adds a regression test; no implementation work.
3. **File drop zone is cell-only** (DROP-01, DROP-02) — today `onDragOver`/`onDrop` handlers live only in `LeafNode.tsx`. Dropping a file on the padding around the canvas, or on the `<main>` background, does nothing. Users need to accept drops anywhere in the workspace and get clear visual feedback while dragging.

No new features. All changes are confined to:
- `src/Grid/SafeZoneOverlay.tsx` (overlay redesign)
- `src/Editor/CanvasArea.tsx` and/or `src/Grid/CanvasWrapper.tsx` (workspace-level drop handlers + ring)
- A new regression test for template apply

</domain>

<decisions>
## Implementation Decisions

### Safe Zone Visual Overlay (CANVAS-01)
- **D-01:** Replace the dashed border-only overlay with a **dimmed + diagonal stripes combined** treatment over the unsafe top and bottom regions. Use `bg-black/` tint plus a `repeating-linear-gradient` (or SVG `<pattern>`) diagonal stripe. Exact tint opacity and stripe spacing are Claude's discretion.
- **D-02:** Render **one icon + small text label per unsafe region** — top region labeled "Instagram header", bottom region labeled "Instagram footer". Icon and label centered within each region.
- **D-03:** Icon is **`EyeOff`** from `lucide-react`. Rationale: accurately conveys "content will not be visible here" without being literal like an Instagram logo.
- **D-04:** Overlay renders **above grid media** (`z-10` or equivalent) so the safe zone warning stays visible even after cells are filled with media. The user toggles it off via the existing Show Safe Zone control when ready to export.
- **D-05:** The overlay must respect the existing CSS vars `--safe-zone-top` and `--safe-zone-bottom` — the unsafe regions are from canvas top down to `--safe-zone-top`, and from `bottom - --safe-zone-bottom` to canvas bottom. Do not hardcode pixel values.

### Workspace Drop Zone Boundary (DROP-01)
- **D-06:** Drop target scope = `<main>` element in `CanvasArea.tsx` — the full area to the left of the sidebar, below the toolbar. Matches REQUIREMENTS.md DROP-01 wording literally. Sidebar itself does NOT accept drops.
- **D-07:** Cell-level drop handlers in `LeafNode.tsx` take precedence. The new workspace-level handler only fires when the drop target is NOT inside a leaf cell (i.e., on padding, canvas background, or the space around the scaled canvas). Coexistence mechanism: cell handler calls `e.stopPropagation()` (it already does) so the workspace handler does not double-fire.
- **D-08:** Workspace drop routes through the existing `autoFillCells(files, {addMedia, setMedia, split, getRoot})` helper — the same code path as the Toolbar Upload button and the `<input type="file">` onChange path. **No new routing logic.** This guarantees identical behavior between Upload button and workspace drop.
- **D-09:** When all cells are full at drop time, workspace drop matches whatever `autoFillCells` currently does (do not introduce divergence between the Upload button and workspace drop). Planner/executor must read the current `autoFillCells` implementation before coding to confirm the behavior.
- **D-10:** Non-media files and directory drops match the existing `LeafNode.handleDrop` filtering behavior (`e.dataTransfer.files` filtered to image/* and video/* silently). Planner to verify the current filtering in `autoFillCells` and mirror it exactly in the workspace handler.
- **D-11:** Desktop-only drop support, consistent with the existing cell-swap ADR (`.planning/decisions/adr-cell-swap-touch.md`). No mobile touch handling. Mobile already has the Toolbar upload button + MobileSheet flow.

### Drag-Over Visual Feedback (DROP-02)
- **D-12:** Workspace drag-over feedback = **accent-blue inset ring** on the `<main>` element: `ring-4 ring-[#3b82f6] ring-inset` (or equivalent). NO full-screen dimming overlay.
- **D-13:** A **top-center label pill** appears while dragging, with copy **"Drop image or video"**. Styling follows existing dark-theme conventions (`bg-black/70 backdrop-blur-sm` or similar) — exact treatment is Claude's discretion.
- **D-14:** **Nested highlights:** when the drag is over a specific cell, both the workspace ring AND the per-cell ring (`ring-2 ring-[#3b82f6] ring-inset` from `LeafNode.tsx`) are active simultaneously. The existing `LeafNode` drag-over logic stays unchanged.
- **D-15:** Workspace ring activates **only for file drops** — i.e., when `dataTransfer.types` includes `'Files'`. It does NOT activate for cell-swap drags (where the type is `'text/cell-id'`). Rationale: showing a workspace-level drop target during a cell-to-cell swap would be misleading.
- **D-16:** Drag-leave handling must correctly detect when the pointer truly leaves the `<main>` element, not when it transitions between nested children (a well-known HTML5 drag pitfall). Use the standard counter pattern (increment on dragenter, decrement on dragleave, clear state at 0) or `e.relatedTarget` containment check — Claude's discretion which.

### Template Confirmation (TPL-01) — Already Satisfied
- **D-17:** TPL-01 was resolved by quick-260407-vth (commits 41cc818 `feat: apply templates silently without confirm dialog`, 64a7cf8 `feat: migrate media across applyTemplate`). `TemplatesPopover.handleApply` (src/components/TemplatesPopover.tsx:135-138) calls `applyTemplate(buildTemplate(entry.name))` directly — no `confirm()`, no dialog.
- **D-18:** Phase 8 adds a **regression test** in the TemplatesPopover test file that:
  - Spies on `window.confirm`
  - Renders the popover
  - Clicks each template button
  - Asserts the store's `applyTemplate` action was called AND `window.confirm` was never invoked
  No implementation changes to `TemplatesPopover.tsx` or `gridStore.applyTemplate`.

### Claude's Discretion
- Exact stripe spacing, angle, and opacity for the safe zone pattern (D-01)
- Implementation mechanism for diagonal stripes: CSS `repeating-linear-gradient` vs. SVG `<pattern>` (D-01)
- Label pill styling and position offset from the top edge (D-13)
- Drag-leave detection mechanism: counter pattern vs. `e.relatedTarget` containment check (D-16)
- Whether the workspace drop handler lives on `<main>` in `CanvasArea.tsx` or is hoisted further up — planner decides based on event bubbling cleanliness

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` — CANVAS-01, TPL-01, DROP-01, DROP-02 definitions (Phase 8 requirements table)
- `.planning/ROADMAP.md` §"Phase 8: Canvas & Workspace UX" — success criteria

### Prior Phase Context (relevant carry-forward)
- `.planning/phases/07-cell-controls-display-polish/07-CONTEXT.md` — overflow-visible + clamp sizing patterns established in Phase 7
- `.planning/decisions/adr-cell-swap-touch.md` — desktop-only HTML5 drag rationale (if file exists; planner to verify path)

### Prior Quick Work
- `.planning/quick/260407-vth-apply-templates-silently-without-confirm-di/` — TPL-01 resolution context (quick-260407-vth SUMMARY + PLAN)

### Key Source Files
- `src/Grid/SafeZoneOverlay.tsx` — current overlay (will be fully rewritten per D-01..D-05)
- `src/Grid/CanvasWrapper.tsx:78-99` — where `<SafeZoneOverlay />` mounts; shows `showSafeZone` selector and canvas surface structure
- `src/Editor/CanvasArea.tsx` — the `<main>` element that will host the workspace-level drop handlers + ring
- `src/Editor/EditorShell.tsx:86-96` — overall layout (toolbar, canvas area, sidebar, mobile sheet) for confirming drop boundary scope
- `src/Grid/LeafNode.tsx:414-452` — existing per-cell `handleDragOver` / `handleDragLeave` / `handleDrop` logic — workspace handler must coexist via `stopPropagation` precedence (D-07)
- `src/lib/autoFillCells.ts` (or wherever `autoFillCells` lives) — the routing helper that D-08 reuses; planner to grep for definition
- `src/components/TemplatesPopover.tsx:113-184` — TemplatesPopover source for the D-18 regression test
- `src/index.css` — CSS custom properties `--safe-zone-top` / `--safe-zone-bottom` that D-05 references

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`autoFillCells` helper** — already used by `LeafNode.handleDrop`, `LeafNode.handleFileChange`, and the Toolbar Upload button. Workspace drop (D-08) reuses this exact helper with no modification.
- **CSS vars `--safe-zone-top` / `--safe-zone-bottom`** — already defined and consumed by the current `SafeZoneOverlay`. New overlay (D-05) keeps using them.
- **`showSafeZone` selector in `editorStore`** — already exists, already toggled by the Toolbar Show Safe Zone control. No store changes needed for CANVAS-01.
- **Accent blue `#3b82f6`** — already used for selected-cell ring (`LeafNode.tsx`) and active Cover/Contain toggle. Reusing it for the workspace drag-over ring (D-12) keeps the palette consistent.
- **`bg-black/70 backdrop-blur-sm` pattern** — already used by the ActionBar (`src/Grid/ActionBar.tsx`) for the floating dark pill. The workspace drag-over label pill (D-13) can reuse the same treatment.
- **`lucide-react` `EyeOff` icon** — already a dependency, no new install.

### Established Patterns
- **Overflow isolation (Phase 7):** The cell container is `overflow-visible` to let ActionBar escape; media clipping lives on an inner canvas wrapper. The safe zone overlay sits on the canvas surface (inside `CanvasWrapper`'s scaled `<div>`) and should not be affected by this, but the planner must verify the overlay is NOT clipped by any wrapper between `CanvasWrapper` and the rendered stripes.
- **Parallel store maps keyed by id** (established in Phases 3/7 for `mediaRegistry`, `mediaTypeMap`, `thumbnailMap`) — not directly relevant to Phase 8 since no new store fields are needed, but good to know the codebase convention.
- **`useShallow` for multi-field selectors** — used in `CanvasWrapper` for background mode fields. Follow this pattern if the workspace-drop component needs multiple editor store fields.
- **Native HTML5 drag, not dnd-kit, for file-from-desktop drops** — confirmed by `LeafNode.handleDrop`. Phase 8 workspace handler uses the same native API.

### Integration Points
- **`CanvasArea.tsx` `<main>` element** (src/Editor/CanvasArea.tsx:12) — the root of the workspace drop zone. New `onDragEnter` / `onDragOver` / `onDragLeave` / `onDrop` handlers attach here, along with the `ring-*` conditional class driven by local state.
- **`CanvasWrapper.tsx:96`** — where `<SafeZoneOverlay />` is mounted inside the scaled canvas surface. The new overlay replaces the current component at the same mount point; no structural changes to `CanvasWrapper` needed.
- **`LeafNode.tsx:425-452` `handleDrop`** — already calls `e.stopPropagation()` before routing to `autoFillCells`. This preserves D-07 (cell handler wins over workspace handler) without any `LeafNode` modifications.
- **TemplatesPopover regression test** — add to the existing test file for TemplatesPopover (or create one if none exists; planner to check `src/test/phase05-p01-templates.test.tsx` or `src/components/__tests__/`).

</code_context>

<specifics>
## Specific Ideas

- The "diagonal stripes + dim" treatment is the classic "caution / reserved area" visual language — users will recognize it without explanation. Stripes should be subtle enough that the user can still see underlying media through them (otherwise the overlay obscures composition work); dim tint keeps readability while signaling "not visible."
- The top-center label pill (D-13) is the standard SaaS drop-target affordance (Figma, Notion, Slack, Dropbox all use it). It's loud enough to be unmissable but doesn't obscure the canvas beneath, which matters because the user may be aiming at a specific cell while dragging.
- Nested drop rings (D-14) give the most informative signal: workspace ring = "I will accept this file", cell ring = "this exact cell will receive it."
- The TPL-01 regression test (D-18) is cheap insurance against a future refactor re-introducing a confirm dialog. It also gives TPL-01 a traceable "done" marker inside Phase 8 verification instead of leaving the requirement closed only by an orphaned quick-task commit.

</specifics>

<deferred>
## Deferred Ideas

- **Template preview on hover** — not raised during discussion; noted as a v1.2+ possibility if templates get more complex.
- **Warning when applying a template would wipe media** — resolved a different way by quick-260407-vth (media migration instead of warning). No action needed.
- **Custom user templates** — v1.2+ feature, out of scope for this milestone.
- **Drag-and-drop on mobile touch devices** — deferred per existing ADR (`adr-cell-swap-touch.md`). Same rationale applies: native HTML5 drag doesn't fire on touch, and a TouchSensor-based workaround would be significant rework.

</deferred>

---

*Phase: 08-canvas-workspace-ux*
*Context gathered: 2026-04-07*
