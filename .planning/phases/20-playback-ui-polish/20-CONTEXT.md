# Phase 20: Playback UI Polish - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

CSS-only visual redesign of `src/Editor/PlaybackTimeline.tsx`. The goal is a dark, polished scrubber bar aligned with contemporary story editor conventions (IG/TikTok aesthetic). **Zero logic changes** — no TypeScript changes to event handlers, store subscriptions, playback logic, or component structure. All changes are Tailwind class modifications only.

**In scope:** Background treatment, scrubber track styling, thumb styling (including scale-on-drag), play/pause button appearance, time display legibility on dark background.

**Out of scope:** Playback logic, overlay/floating positioning, progress-fill on track (requires JS), any changes to CanvasArea.tsx layout, Phase 21 audio features.

</domain>

<decisions>
## Implementation Decisions

### D-01: Layout — Footer Strip (no layout change)
- The PlaybackTimeline stays as a **footer strip below the canvas** — not overlaid on it.
- No changes to the `absolute`/`relative` positioning or parent CanvasArea.tsx layout.
- All visual changes happen inside `PlaybackTimeline.tsx` class strings only.

### D-02: Background — `bg-black/80 backdrop-blur-sm`
- Replace the current `bg-card border-t border-border` with `bg-black/80 backdrop-blur-sm`.
- Drop the `border-t border-border` (the dark background itself provides visual separation).
- The `backdrop-blur-sm` gives a glassy, slightly translucent feel while remaining clearly dark and legible.

### D-03: Accent & Track Colors — White on Dark
- **Icons (play/pause):** `text-white` (currently `text-foreground`)
- **Time display:** `text-white/70 text-xs tabular-nums` (currently `text-muted-foreground text-xs tabular-nums`)
- **Scrubber track:** `bg-white/20` (currently `bg-muted`) — applies to both webkit and moz track pseudo-elements
- **Scrubber thumb:** `bg-white` (currently `bg-[#3b82f6]`) — clean white on dark, high contrast

### D-04: Scrubber Track Height — 2–3px
- Use `h-[3px]` on the track pseudo-elements (currently `h-1` = 4px).
- Applies to `[&::-webkit-slider-runnable-track]:h-[3px]` and `[&::-moz-range-track]:h-[3px]`.
- The thumb `-mt` offset must be adjusted accordingly: with a 3px track and ~16px thumb, use `-mt-[6.5px]` on the webkit thumb (currently `-mt-1.5`).

### D-05: Thumb Scale on Drag
- Add active-state scale to the webkit thumb: `[&::-webkit-slider-thumb]:active:scale-150` with `[&::-webkit-slider-thumb]:transition-transform` and `[&::-webkit-slider-thumb]:duration-100`.
- Firefox thumb: `[&::-moz-range-thumb]:active:scale-150` with `[&::-moz-range-thumb]:transition-transform`.
- This is pure CSS — no JS or event handler changes needed.

### D-06: Play Button — Ghost Circle, White Icon
- Keep `w-11 h-11 rounded-full flex items-center justify-center` shape.
- Switch hover to `hover:bg-white/10` (currently `hover:bg-muted`).
- Icon is `text-white` (via D-03 above on the parent or directly on the button).

### Claude's Discretion
- Exact `-mt` offset value for the webkit thumb with the new 3px track height (calculate from thumb size ÷ 2 − track height ÷ 2).
- Whether to add `[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing` for better drag affordance — fine to include if it improves the feel.
- Whether to add `will-change-transform` to the thumb for smoother scale transition.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source File to Modify
- `src/Editor/PlaybackTimeline.tsx` — the only file that changes in this phase

### Visual Context
- `src/Editor/CanvasArea.tsx:104` — existing dark overlay style reference: `bg-black/70 backdrop-blur-sm text-white` (used for the "Drop image or video" pill — sets a precedent for dark overlay aesthetics in this component tree)

### Requirements
- `.planning/REQUIREMENTS.md` §PLAY-01, PLAY-02, PLAY-03 — acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Current PlaybackTimeline classes (before this phase)
- Container: `h-12 flex flex-row items-center w-full shrink-0 bg-card border-t border-border px-4 gap-3`
- Play/pause button: `w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted text-foreground`
- Range input track (webkit): `h-1 rounded-full bg-muted`
- Range input thumb (webkit): `w-4 h-4 rounded-full bg-[#3b82f6] appearance-none -mt-1.5`
- Time display: `text-muted-foreground text-xs tabular-nums min-w-[5rem] text-right`

### No structural changes needed
- The JSX structure stays identical (div → button → input → span).
- Only the `className` strings change.

</code_context>
