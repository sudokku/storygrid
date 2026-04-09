# Phase 11: Effects & Filters - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-cell visual effects for leaf nodes: 6 named preset filters (B&W, Sepia, Vivid, Fade, Warm, Cool) plus four adjustment sliders (brightness, contrast, saturation, blur) that apply identically in the live preview canvas, PNG export, and MP4 video export. Effects are non-destructive — parameters live on the `LeafNode`, the original media is never mutated. Everything outside per-cell color/blur treatment (overlays, audio, persistence) belongs to later v1.2 phases.

</domain>

<decisions>
## Implementation Decisions

### Browser Support & Safari Strategy
- **D-01:** Use `ctx.filter = 'brightness(...) contrast(...) saturate(...) blur(...)'` directly inside `drawLeafToCanvas()`. No polyfill, no hand-rolled compositing.
- **D-02:** Drop effective Safari support for effects to Safari 18+. Older Safari users (<1% of target audience) are explicitly not a concern — no fallback, no degradation notice, no polyfill bundle weight. Core editor (grid, media, export) continues to work on Safari 15+; only the effects feature requires Safari 18+.
- **D-03:** Do NOT add `context-filter-polyfill` or similar. The bundle size impact (~15KB) and maintenance surface are not justified for the <1% affected users.
- **D-04:** Blur-at-clip-edge mitigation from PITFALLS §2 still applies (draw source blurRadius*2 beyond the cell rect so clipping has real pixels to trim). This is an implementation detail for the planner.

### Effects Data Model
- **D-05:** Add a required `effects: EffectSettings` field to `LeafNode` in `src/types/index.ts`. Number primitives only — no nested objects, no metadata.
  ```ts
  type EffectSettings = {
    preset: PresetName | null;  // active preset label, or null if none/custom
    brightness: number;  // -100..+100, default 0
    contrast: number;    // -100..+100, default 0
    saturation: number;  // -100..+100, default 0
    blur: number;        // 0..20, default 0 (px)
  };
  type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool';
  ```
- **D-06:** Effects are applied inside `drawLeafToCanvas()` in `src/lib/export.ts` (line 304) — the existing unified draw path. NEVER via CSS `filter:` on the preview `<canvas>` element (PITFALLS §3). This guarantees WYSIWYG by construction: preview and export call the same function.
- **D-07:** Preset definitions live in a single `PRESET_VALUES` constant (e.g., `src/lib/effects.ts`) mapping preset name → `{brightness, contrast, saturation, blur}` tuple. Planner picks exact values; suggested starting point below in Specific Ideas.

### Preset Carousel UI
- **D-08:** Horizontal strip of **6 named chips with a generic sample thumbnail**. Each chip shows the SAME fixed stock image rendered through its preset + the preset name below. Not per-cell live previews of the user's image, not text-only chips.
- **D-09:** The sample thumbnail is a pre-rendered static asset bundled with the app (one small base image, 6 pre-processed variants) — zero runtime canvas work, zero cost on cell selection. Planner decides asset path and format.
- **D-10:** Chips render in the **sidebar `SelectedCellPanel`** (`src/Editor/Sidebar.tsx` line 200) above the existing pan/fit controls. Also visible in `MobileSheet` via the existing shared import pattern — no mobile-specific layout needed.
- **D-11:** Tapping a chip calls an action that loads `PRESET_VALUES[name]` into the cell's `effects` fields AND sets `effects.preset = name`. Single history snapshot.

### Slider Behavior
- **D-12:** Four sliders: brightness, contrast, saturation, blur — in that vertical order below the preset carousel.
- **D-13:** Slider drag uses raw pointer events with `setPointerCapture` (consistent with divider/pan patterns from Phases 1/5) — NOT dnd-kit, NOT a native `<input type="range">` for the drag logic. Planner may use a native `<input type="range">` purely for styling/keyboard accessibility if it can still gate history commits on pointerup.
- **D-14:** `pointermove` calls a **non-history-committing** store action that updates `effects` live for WYSIWYG preview. `pointerup` calls a separate action that commits exactly ONE `pushSnapshot` with the final value (EFF-09). This mirrors the pattern used for pan/zoom in Phase 5 quick tasks.
- **D-15:** Moving ANY slider after a preset was applied sets `effects.preset = null` immediately (in the pointerdown or first pointermove). The preset chip highlight clears — raw slider values only, no "modified" indicator. Preset acts purely as a starting point.

### Reset Buttons
- **D-16:** **Two separate reset buttons** in the SelectedCellPanel:
  - **"Reset effects"** — clears `effects` to defaults only (`preset: null`, all numeric fields → 0). Pan/zoom/fit/backgroundColor untouched. Satisfies EFF-06.
  - **"Reset cell"** — clears effects AND pan/zoom/fit/backgroundColor back to as-uploaded defaults. Broader escape hatch.
- **D-17:** Both reset actions commit exactly one history snapshot.
- **D-18:** Button placement: planner's call (likely a small footer row under the sliders, or icon buttons aligned right). Must be discoverable but not dominate the panel.

### Store & History
- **D-19:** Add `setEffects(nodeId, partial: Partial<EffectSettings>)` to `gridStore` for the live pointermove path — updates state via Immer, does NOT call `pushSnapshot`.
- **D-20:** Add `commitEffects(nodeId, final: EffectSettings)` for the pointerup path — updates state AND calls `pushSnapshot` once.
- **D-21:** Add `applyPreset(nodeId, presetName)` and `resetEffects(nodeId)` and `resetCell(nodeId)` — each commits exactly one snapshot.
- **D-22:** `mediaRegistry` is NOT touched — effects are pure number primitives, structuredClone cost is negligible per PITFALLS §4.

### Claude's Discretion
- Exact preset numeric values (brightness/contrast/saturation/blur tuples per preset) — planner/researcher picks tasteful defaults; sample chips drive visual identity.
- Slider primitive: build custom with raw pointer events, or wrap a native range with pointer capture layered on top. Either is acceptable as long as D-13/D-14 are satisfied.
- Exact Tailwind classes / visual design of chips and sliders (colors, spacing, track styling) — defer to UI-SPEC if `/gsd:ui-phase 11` is invoked.
- Whether the Reset buttons use icons, text, or both.
- Whether "Effects" section gets a collapsible header in the panel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Effects & Filters — EFF-01 through EFF-10, the acceptance criteria this phase must satisfy
- `.planning/ROADMAP.md` §Phase 11 — goal, success criteria, plan-phase research flag (Safari smoke test), and key pitfalls summary

### Research (v1.2)
- `.planning/research/PITFALLS.md` §1 — ctx.filter Safari disabled-by-default status (SUPERSEDED by D-01/D-02: user explicitly opts out of Safari <18 support)
- `.planning/research/PITFALLS.md` §2 — Blur-at-clip-edge bleeding; mitigation (draw blurRadius*2 beyond cell rect)
- `.planning/research/PITFALLS.md` §3 — CSS filter on preview canvas breaks WYSIWYG; MUST apply effects inside `drawLeafToCanvas()`
- `.planning/research/PITFALLS.md` §4 — Effects must be number primitives, not nested objects (structuredClone cost)
- `.planning/research/PITFALLS.md` §448 — Slider oninput pushSnapshot pitfall; pointerup-only commit pattern
- `.planning/research/ARCHITECTURE.md` — Store/history/render architecture for v1.2
- `.planning/research/FEATURES.md` — Feature catalogue and scope intent for v1.2

### Project
- `CLAUDE.md` §Tech Stack — Vite 8, React 18, Zustand 5, Immer 10, Tailwind 3.4 (locked); also lists Browser Support Chrome 90+/Firefox 90+/Safari 15+ — D-02 narrows this to Safari 18+ for the effects feature only
- `.planning/PROJECT.md` — Vision, principles, non-negotiables

### Prior Phase Context (relevant decisions carried forward)
- `.planning/milestones/v1.0-phases/01-grid-tree-engine/01-CONTEXT.md` — `pushSnapshot` pattern, history cap of 50, `mapNode` primitive
- `.planning/milestones/v1.0-phases/04-export-engine/04-CONTEXT.md` — `drawLeafToCanvas` unified draw path contract
- `.planning/milestones/v1.0-phases/05-polish-ux/05-CONTEXT.md` — Raw pointer event pattern with `setPointerCapture` for drags
- `.planning/milestones/v1.0-phases/06-video-support-v2/06-CONTEXT.md` — Video element integration in `drawLeafToCanvas` (effects must work with HTMLVideoElement source too)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/export.ts` line 304 — `drawLeafToCanvas(ctx, img, rect, leaf)`: the single draw site. Extend the `leaf` parameter's `Pick<LeafNode, ...>` union to include `effects`, apply `ctx.filter` at the top of the function (before any `drawImage`), and reset it in the `ctx.restore()` path. Works for both image and video branches automatically.
- `src/store/gridStore.ts` — Existing `pushSnapshot` helper centralizes history commits; pattern for live-update + pointerup-commit already exists from pan/zoom work (quick phases 260402-63e, 260402-lae).
- `src/Editor/Sidebar.tsx` line 200 — `SelectedCellPanel` React.memo component with `key={selectedNodeId}` for clean remounts; natural host for the effects UI. Already shared between desktop sidebar and `MobileSheet`.
- `src/types/index.ts` — `LeafNode` type definition, single source of truth.

### Established Patterns
- **Raw pointer events over dnd-kit for drags** (CLAUDE.md + Phase 1/5 decisions) — slider dragging follows this pattern.
- **Unified draw path** — `drawLeafToCanvas` is the contract; preview LeafNode canvas AND export `renderNode` both call it. Effects hook here once, WYSIWYG is automatic.
- **Media stays out of history snapshots** — `mediaRegistry` is parallel to the tree; effects being pure numbers on the tree is safe for structuredClone.
- **React.memo + key={selectedNodeId}** for SelectedCellPanel — effect state changes will trigger re-renders of only the selected cell panel, not the whole sidebar.
- **getState() in async/event handlers** — avoid stale closures in pointerup handlers.

### Integration Points
- `src/types/index.ts` — add `EffectSettings` type and `effects` field on `LeafNode`.
- `src/lib/export.ts` `drawLeafToCanvas()` — apply `ctx.filter` from `leaf.effects` before drawImage.
- `src/store/gridStore.ts` — add `setEffects`, `commitEffects`, `applyPreset`, `resetEffects`, `resetCell` actions; update `createLeafNode` factory to initialize `effects` to defaults.
- `src/Editor/Sidebar.tsx` `SelectedCellPanel` — add new Effects subsection (preset carousel + sliders + reset buttons).
- Any code that constructs a `LeafNode` literal in tests (`src/test/*`, `src/Editor/__tests__/*`) — add `effects: DEFAULT_EFFECTS` to avoid TS errors. The mapNode + mediaId migration pattern from Phase 10 is a template.
- New file: `src/lib/effects.ts` — `PRESET_VALUES`, `DEFAULT_EFFECTS`, `effectsToFilterString(effects)` pure helper.
- New static assets: 6 pre-rendered preset sample thumbnails (planner picks location under `src/assets/` or `public/`).

### Creative Options
- `effectsToFilterString()` as a pure function makes unit testing trivial — no canvas needed, just assert string output.
- Preset chips could be a simple `<button>` array mapped from `Object.entries(PRESET_VALUES)` — no framework primitives needed.

</code_context>

<specifics>
## Specific Ideas

- User framing: "Why even bother with older versions of browsers? This is a small and fast tool. I don't care about some legacy browsers filling less than 1% of users." — drives D-01/D-02/D-03 decisively. Effects feature targets modern browsers only; no polyfill bundle weight.
- Preset carousel aesthetic: think Instagram Stories bottom filter strip, but simplified — fixed sample thumbnails, clear name labels, horizontal scroll if overflow.
- Suggested preset starting values (planner may tune):
  - **B&W**: saturation -100
  - **Sepia**: saturation -100, brightness +5, (warm tint via contrast +10 or separate hue-rotate — planner decides; ctx.filter supports `sepia()` natively if preferred over manual composition)
  - **Vivid**: saturation +40, contrast +15
  - **Fade**: contrast -20, brightness +10, saturation -15
  - **Warm**: saturation +10, brightness +5 (and optionally `hue-rotate` via ctx.filter)
  - **Cool**: saturation +10, brightness -5 (and optionally `hue-rotate` via ctx.filter)
  - These are starting points — the planner/researcher should test against sample images and tune.
- Two reset buttons language: "Reset effects" vs "Reset cell" — short, clear, different scopes.
- Slider committing one snapshot on pointerup is the SAME pattern used for pan/zoom in earlier phases — planner should grep for existing examples before writing from scratch.

</specifics>

<deferred>
## Deferred Ideas

- **Live per-cell thumbnails in preset carousel** — discussed and rejected for Phase 11 (chose static sample thumbnails for simplicity and zero per-cell render cost). Can be revisited post-v1.2 if users request more personalized previews.
- **Modified-preset indicator** (sticky "Vivid +custom" badge after slider nudges) — rejected for simpler mental model. Preset acts purely as a starting point.
- **Safari 15–17 fallback strategy** — explicitly dropped. Not revisiting unless analytics shows meaningful Safari <18 traffic.
- **Per-canvas global filter** (EFF-F-03 future requirement) — already listed in REQUIREMENTS.md §Effects (future). Out of scope for Phase 11.
- **Compare-to-original long-press toggle** (EFF-F-02) — future requirement. Out of scope.
- **Additional sliders** (warmth, tint, vignette, highlights, shadows — EFF-F-01) — future requirement. Out of scope.
- **Custom LUT import** (EFF-F-04) — future requirement. Out of scope.

</deferred>

---

*Phase: 11-effects-filters*
*Context gathered: 2026-04-09*
