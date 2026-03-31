# Feature Landscape: Instagram Story Photo Collage Editor

**Domain:** Browser-based Instagram Story collage/grid creation tool (9:16 canvas, photo-first, export to PNG/video)
**Researched:** 2026-03-31
**Brief reference:** StoryGrid PROJECT.md (Phases 0–7)

---

## Brief Validation Summary

The PROJECT.md brief is well-aligned with user expectations for this category. The core interaction model (recursive split-tree, drag-to-fill, PNG export) covers the most critical table-stakes features. Two moderate gaps were identified: per-cell pan/zoom/reposition is described in Phase 7 but user research shows it is more of a table-stakes expectation than a differentiator, and there is no mention of a "swap cells by dragging" interaction which is a well-established UX convention in grid editors.

---

## Table Stakes

Features users expect in any collage/grid editor. Absence causes users to abandon or complain immediately.

| Feature | Why Expected | Complexity | Brief Status | Notes |
|---------|--------------|------------|--------------|-------|
| Fixed-size canvas at 9:16 (1080×1920) | All Story-focused tools publish to this spec; users know it | Low | Phase 0 (CSS vars) | Instagram safe zones (~250px top/bottom) must be shown |
| Preset layout templates | Canva, BeFunky, Unfold, Instagram Layout all offer this as entry point; users reach for it first | Low | Phase 5 | Brief has 6 presets; adequate for MVP |
| Drag image from OS onto cell | Universal drag-drop expectation in browser tools since 2018 | Medium | Phase 3 | Multi-file drop to auto-fill is a bonus — include |
| Click empty cell to upload | Fallback for touch/trackpad users who cannot drag | Low | Phase 3 | Also required for accessibility |
| Pan and zoom (reposition) within a cell | TurboCollage, BeFunky, Canva all offer this; users complain when photos cannot be repositioned inside a cell | Medium | **Phase 7 — may be too late** | See flag below |
| Gap/spacing control between cells | BeFunky, Canva, every grid tool offers spacing slider | Low | Phase 5 (0–20px slider) | Correct placement |
| Corner radius control | Standard in modern collage tools (BeFunky, Canva frames) | Low | Phase 5 (0–24px) | Correct placement |
| Download / export to PNG | Non-negotiable — the entire purpose of the tool | Medium | Phase 4 | 1080×1920 pixel-perfect required |
| Undo / redo | Users will make mistakes immediately; Ctrl+Z is a reflex action; Instagram itself tested adding this | Low | Phase 1 (Zustand history) | Ctrl+Z / Ctrl+Shift+Z correct |
| Background color for canvas | Expected when cells don't fill the full frame (gaps show through) | Low | Phase 5 | Correct |
| "Fit vs fill" toggle per cell | Users have portrait and landscape photos; fit (letterbox) vs fill (crop to frame) is table stakes | Low | Phase 3 | Brief calls it "toggle fit" — correct |
| Remove a cell | Users split then change their mind | Low | Phase 2/3 | Correct |
| Swap images between cells by dragging | PicCollage, Fotor, BeFunky all allow dragging images between cells to reorder; users expect it | Medium | **Not in brief** | See flag below |
| Clear media from a cell without removing the cell | Different from remove-cell; users want to swap one photo | Low | Phase 3 | Brief has "clear media" — correct |
| Export progress indicator | Large images take 1–4s; without feedback users click again thinking it failed | Low | Phase 4 | Correct |

### Flags on Table-Stakes Items

**Pan/zoom within cell (Phase 7 risk):** Research shows drag-to-reposition and scroll-to-zoom within a cell is a standard expectation in all grid tools reviewed (TurboCollage, BeFunky, Canva, PhotoJoiner). The brief places this in Phase 7 alongside effects and text overlays. Consider moving the core reposition behavior (object-position drag) to Phase 5 or treating it as a Phase 3 upgrade. Without it, many uploaded photos will look wrong — the subject will be in a corner of a cell rather than centered.

**Swap cells by dragging (not in brief):** Multiple tools (BeFunky Grid mode, PicCollage, Fotor) support dragging a filled image from one cell to another to swap or rearrange. This is a natural follow-on to drag-to-fill and users discover it by trying it. The brief uses @dnd-kit which is capable of supporting this. Consider as a Phase 5 addition — low complexity given the DnD infrastructure.

---

## Differentiators

Features that set a product apart. Users do not expect these but value them when present.

| Feature | Value Proposition | Complexity | Brief Status | Notes |
|---------|-------------------|------------|--------------|-------|
| Recursive arbitrary-depth splitting (Figma model) | No other consumer Story tool offers freeform recursive layout; all competitors use preset grid slots | High | Core (Phase 1–2) | This IS the product's primary differentiator — validate it is surfaced clearly in UX |
| Resizable dividers via drag | Users can tune cell proportions exactly; competitors only offer fixed ratio presets | Medium | Phase 2 | Strong differentiator — real-time drag feedback is essential |
| Video cells with synchronized playback | Competitors either do video-only OR photo-only; mixed photo+video grid is rare | High | Phase 6 | Correct placement as v1 |
| Per-cell CSS filters (brightness, contrast, etc.) | Adobe Express and Canva offer filters but not per-cell in a grid context | Medium | Phase 7 | Good differentiator; reasonable v1+ placement |
| Multi-slide story (pages) with batch export | Unfold is the main tool offering multi-slide; most web tools are single-frame only | High | Phase 7 | High value for power users; correct deferral |
| Save/load project as JSON file | No web-based Story collage tool offers portable project files; very rare | Low | Phase 7 | "Portability-first" angle; good for power users |
| Gradient background on canvas | Most tools only offer solid background; gradients are on-trend (Canva 2026 trends report) | Low | Phase 5 | Brief includes this — good catch |
| Zero accounts, zero watermarks, no paywall | Canva gates PNG export quality; many apps watermark free exports; users explicitly hate this | Low (business model) | By design | Make this a prominent headline in any landing copy |
| Keyboard shortcuts for all actions | Professional tools (Figma, Canva pro) offer shortcuts; web Story tools do not | Low | Phase 5 | Brief has Ctrl+Z, E, H, V, F, Delete, Escape — solid set |

---

## Anti-Features

Features that seem useful but add complexity without proportional value in this product context. Do not build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI layout suggestion / auto-collage | Adds significant complexity (ML model or API call), introduces latency and cost, and the product's core value is manual creative control — auto-suggestions undermine that. Users in other tools report these prompts as "more annoying than helpful" | Offer preset templates in a sidebar — fast, predictable, no inference required |
| Stickers, emoji overlays, decorative elements | Canva and Instagram's native editor already do this exhaustively; competing here adds scope without differentiation, and assets need ongoing curation | Let the user add text; everything else is out of scope |
| Direct-to-Instagram publish / share API | Requires Meta App Review (2–4 week process), OAuth flow, and platform policy compliance; breaks the zero-backend constraint | Export PNG → user uploads natively. Friction is acceptable for MVP. |
| Cloud storage / sync | Breaks zero-backend constraint; adds auth, storage cost, session management; Instagram Stories are ephemeral anyway | localStorage for save/load is correct; .storygrid.json export is the "cloud" escape hatch |
| Real-time collaboration | Incompatible with the static-only architecture; massive scope addition | Single-user session only |
| Social feed / gallery of user designs | Requires backend, moderation, storage — none of which this product can afford | Focus on creation; no discovery layer |
| AI background removal / cutout | Adds a heavy ML dependency (WASM or API) for a feature users can do in Photos.app before uploading | Keep it out of MVP; revisit only if user feedback is overwhelming |
| Color palette extraction from photos | Feels useful but adds complexity; users with a brand kit will handle this outside the tool | The background color picker is sufficient |
| Undo history longer than ~50 steps | localStorage size constraints; history snapshots of a full tree can be large; very few users go beyond 20 steps | 50-step cap is reasonable; document it |
| Animated GIF export | ffmpeg.wasm can do this but GIF has terrible compression; Story collages are meant for 9:16 video or static image | Stick to MP4 (H.264) for video and PNG for static |
| Watermark / branding on export | Users immediately seek alternatives; primary reason users leave free tools per community feedback | No watermark, ever — this is the product's stated value |

---

## UX Patterns and Conventions

Patterns observed across Canva, BeFunky, Unfold, Instagram Layout, TurboCollage, and PicCollage that should inform implementation decisions.

### Canvas-First vs Template-First Entry

**Convention:** Most consumer tools (Canva, Unfold, PicCollage) lead with template selection before showing the canvas. Professional tools (Figma) start blank.

**Recommendation for StoryGrid:** Lead with the blank canvas (because the split-tree model is the hook) but show the presets panel open by default on first visit. The onboarding overlay (Phase 5) should demonstrate a split action within the first 3 seconds.

### Cell Fill State Visual Language

**Convention:** Empty cells show a dashed border with a plus icon or upload icon in the center. Filled cells show the image with a hover overlay revealing action buttons. This is consistent across BeFunky, Canva frames, Fotor, and Pixlr.

**Brief alignment:** Phase 2 describes "dashed border, upload prompt" for empty state and "blue border" for selected state. Correct. Add a subtle hover overlay with action icons (split, remove, replace) — the brief includes this in Phase 2 leaf hover actions.

### Gap/Spacing as a Global Control

**Convention:** All grid tools reviewed use a single global spacing slider rather than per-edge margins. BeFunky's spacing control is a single slider (0–30px). Canva's element spacing is also global.

**Brief alignment:** Phase 5 "global gap slider (0–20px)" is exactly correct. Do not add per-cell padding as a separate control — it will confuse users.

### Pan/Zoom Within Cell Interaction

**Convention (critical):** The universal UX pattern is: double-click (or single-click on an already-selected cell) enters "pan mode" — then drag to reposition, scroll/pinch to zoom. A secondary "done / confirm" click exits pan mode. TurboCollage, BeFunky, Canva all use a variant of this.

**Brief gap:** The brief describes "drag to reposition, scroll to scale" (Phase 7) but does not specify the mode-entry interaction. Implement as: click selected cell again → enters pan mode with a visual indicator; Escape or click outside → exits. This prevents accidental repositioning while the user is selecting cells.

### Template Application

**Convention:** Applying a template replaces the current grid structure. Users expect a confirmation ("This will replace your current layout") if cells are filled. Canva shows a "replace" confirmation. BeFunky silently replaces.

**Recommendation:** Show a brief toast or inline confirmation if any cells have media. Silent replacement is a common source of frustration.

### Export Flow

**Convention:** Export buttons are always in the top-right corner (Canva, Adobe Express, BeFunky). The flow is: click Export → format picker appears (or defaults) → download begins → progress indicator shown.

**Brief alignment:** Phase 4 export settings (format/quality) before download is correct. Keep the export button in the toolbar top-right as the primary CTA.

### Aspect Ratio and Safe Zones

**Convention:** Instagram displays Stories with UI chrome (profile header, reply bar) covering approximately the top and bottom 250px of a 1920px canvas. Tools like Unfold show safe zone guides.

**Brief alignment:** Safe zone toggle is in Phase 2/3 as a dashed overlay guide. Correct — make it ON by default for first-time users.

### Responsive / Minimum Viewport

**Convention:** Web-based collage editors are desktop-first. BeFunky, Canva, Fotor all require a minimum ~1024px wide viewport and show a "use desktop" message on mobile. No mobile web editing is expected.

**Brief alignment:** Phase 5 specifies "desktop min 1024px, sidebar collapses on smaller." Correct — do not attempt a mobile web editor.

---

## Feature Dependencies

```
Phase 1 (tree engine) → Phase 2 (rendering) → Phase 3 (media upload)
Phase 3 (media in cells) → Phase 4 (export — needs real content to test)
Phase 3 + Phase 4 → Phase 5 (polish is meaningless without working core)
Phase 5 (stable image pipeline) → Phase 6 (video cells)
Phase 6 (video playback) → Phase 6 (video export via ffmpeg.wasm)
Phase 7 (filters, text) → depends on Phase 3 media + Phase 2 rendering
Phase 7 (save/load) → depends on Phase 1 tree serialization shape (design JSON schema early)
```

**JSON schema note:** The save/load feature (Phase 7) requires the GridNode tree to serialize cleanly. The tree type design in Phase 1 should explicitly consider JSON serialization — circular references and non-serializable values (File objects, Blob URLs) must be normalized before storage. Design this constraint into Phase 1 types even if save/load ships in Phase 7.

---

## MVP Recommendation

Phases 0–5 as specified in the brief constitute a solid, shippable MVP. Priority within that scope:

1. Grid tree + rendering (Phases 1–2) — the core differentiator; nothing else matters without this
2. Media upload + cell controls (Phase 3) — without this it is a wireframe tool
3. Export (Phase 4) — the product's reason for existence
4. Pan/zoom within cell — **promote from Phase 7**; strongly recommended as a Phase 5 item or late Phase 3 addition
5. Preset templates + polish (Phase 5) — significantly reduces time-to-first-result for new users
6. Swap cells by dragging — **add to Phase 5**; low complexity with @dnd-kit infrastructure already in place

**Defer without regret:**
- Video (Phase 6): high complexity, significant browser compatibility surface
- Per-cell filters (Phase 7): nice-to-have, easy to add post-MVP
- Multi-slide (Phase 7): correct deferral; most users will use single-frame Stories

---

## Sources

- [How to Make a Collage on Instagram Story (2026) — PhotoGrid Blog](https://www.photogrid.app/blog/how-to-make-a-collage-on-instagram-story/)
- [Instagram Animated Collage Tool Launch — Threads/Lia Haberman](https://www.threads.com/@liahaberman/post/DPhLRN7krMO/)
- [Unfold Review — Product London Design](https://productlondondesign.com/unfold-review/)
- [Unfold App Store Reviews — Apple](https://apps.apple.com/us/app/unfold-reels-story-maker/id1247275033?see-all=reviews)
- [BeFunky Collage Maker Feature Page](https://www.befunky.com/features/collage-maker/)
- [BeFunky Customizing Your Collage — Help Center](https://support.befunky.com/hc/en-us/articles/360025107732-Customizing-Your-Collage)
- [Canva Instagram Stories Guide](https://www.canva.com/learn/instagram-stories/)
- [Adobe Express vs. Canva (2025) — Paperlike](https://paperlike.com/blogs/paperlikers-insights/adobe-express-vs-canva)
- [TurboCollage Pan and Zoom UX](https://www.turbocollage.com/6-photo-collage.html)
- [PhotoJoiner Collage Maker Features](https://www.photojoiner.com/features/collage-maker)
- [Best Collage Maker Online for Free — PhotoGrid](https://www.photogrid.app/blog/best-photo-collage-maker-online-for-free/)
- [14 Best Free Collage Makers — Icecream Apps (2025)](https://icecreamapps.com/learn/best-free-collage-makers.html)
- [Instagram Story Tips & Tricks — Instagram Official](https://about.instagram.com/blog/tips-and-tricks/instagram-story-tips-tricks)
- [Canva 2026 Design Trends Report](https://www.yoo.paris/en/blog/canva-unveils-the-7-design-trends-that-will-dominate-2026)
- [Instagram Testing Undo Button for Stories — Social Barrel](https://socialbarrel.com/instagram-is-testing-an-undo-button-for-stories/134256/)
