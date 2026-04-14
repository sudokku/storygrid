---
phase: 13
plan: 04
subsystem: overlay-ux
tags: [overlay, emoji, sticker, svg-sanitization, toolbar, dompurify, emoji-mart]
completed: "2026-04-09T23:48:00Z"
duration_minutes: 8
tasks_completed: 2
files_created: 5
files_modified: 1
dependency_graph:
  requires: [13-01, 13-02]
  provides: [OVL-01, OVL-08, OVL-09]
  affects: [src/Editor/Toolbar.tsx, src/store/overlayStore.ts]
tech_stack:
  added:
    - dompurify@^3.3.3 (installed, was in package.json but not node_modules)
    - "@emoji-mart/react + @emoji-mart/data (installed, lazy chunk)"
  patterns:
    - Dynamic import lazy-loading (emoji-mart kept out of initial bundle)
    - DOMPurify SVG sanitization before storage (T-13-09 mitigation)
    - TemplatesPopover popover pattern mirrored in AddOverlayMenu
key_files:
  created:
    - src/lib/svgSanitize.ts
    - src/lib/__tests__/svgSanitize.test.ts
    - src/Editor/StickerUpload.tsx
    - src/Editor/AddOverlayMenu.tsx
    - src/Editor/EmojiPickerPopover.tsx
  modified:
    - src/Editor/Toolbar.tsx
key_decisions:
  - "EmojiPickerPopover lazy-loads on first open via useEffect + Promise.all dynamic import; loading/error states shown"
  - "AddOverlayMenu uses showEmojiPicker toggle state so the picker only loads when the user explicitly clicks Add Emoji"
  - "StickerUpload reads SVG as text then sanitizes via sanitizeSvgString before base64 encoding for storage"
  - "dompurify and emoji-mart packages installed (were declared in package.json but missing from node_modules)"
---

# Phase 13 Plan 04: Add Overlay UX Summary

**One-liner:** Toolbar Add button → popover menu → Text/Emoji/Sticker actions with lazy emoji-mart and DOMPurify SVG sanitization before stickerRegistry storage.

## What Was Built

Four new editor files and one sanitizer library helper completing the primary overlay-creation UX (OVL-01, OVL-08, OVL-09):

1. **`src/lib/svgSanitize.ts`** — `sanitizeSvgString(raw)` wrapping DOMPurify with `USE_PROFILES: { svg: true, svgFilters: true }`. Applied before any SVG content enters the stickerRegistry (T-13-09 mitigation).

2. **`src/lib/__tests__/svgSanitize.test.ts`** — 5 unit tests covering script-tag injection, onclick event handler injection, foreignObject/script nesting (T-13-09), and preservation of safe SVG attributes (circle/fill, path/d).

3. **`src/Editor/StickerUpload.tsx`** — File input component accepting `image/png,image/svg+xml`. SVG path: `file.text()` → `sanitizeSvgString` → base64 data URI. PNG path: FileReader `readAsDataURL`. Generates `sk_<nanoid>` sticker key, calls `addSticker` then `addOverlay({type:'sticker', x:540, y:960, width:320})`.

4. **`src/Editor/AddOverlayMenu.tsx`** — Popover menu (mirrors TemplatesPopover structure) with three actions: Add Text (spawns TextOverlay at canvas center with `fontSize:72`, `content:'Double tap to edit'`), Add Emoji (toggles EmojiPickerPopover), Upload Sticker (delegates to StickerUpload). Outside-click dismiss via document mousedown listener.

5. **`src/Editor/EmojiPickerPopover.tsx`** — Lazy-loads `@emoji-mart/react` and `@emoji-mart/data` via `Promise.all` on first mount. Renders loading/error states during async import. On emoji select, calls `addOverlay({type:'emoji', char:emoji.native, x:540, y:960, width:128})` then `onClose()`.

6. **`src/Editor/Toolbar.tsx`** (modified) — New `addMenuOpen` state, `PlusCircle` icon button with `aria-label="Add overlay"` placed in the left section after TemplatesPopover, wrapped in a `relative` container hosting `<AddOverlayMenu>`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `167ecb4` | feat(13-04): sanitizeSvgString helper + StickerUpload + AddOverlayMenu with Add Text action (OVL-01, OVL-09) |
| Task 2 | `94f9130` | feat(13-04): lazy-loaded EmojiPickerPopover + Toolbar Add button (OVL-08) |

## Test Results

- `src/lib/__tests__/svgSanitize.test.ts`: 5/5 pass
- Full suite: 54 test files, 610 tests pass, 2 skipped — no regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dompurify and emoji-mart not installed despite being in package.json**
- **Found during:** Task 1 (vitest run failed with "Failed to resolve import 'dompurify'")
- **Issue:** `dompurify`, `@types/dompurify`, `emoji-mart`, `@emoji-mart/react`, `@emoji-mart/data` were declared in package.json but absent from node_modules
- **Fix:** `npm install dompurify @types/dompurify emoji-mart @emoji-mart/react @emoji-mart/data`
- **Files modified:** `package-lock.json` (node_modules updated)
- **Commit:** included in `167ecb4`

**2. [Discretion] EmojiPickerPopover renders on toggle, not always**
- The plan's Task 1 showed `<EmojiPickerPopover onClose=... />` rendered inline in AddOverlayMenu for the emoji row. With a full implementation this would start loading emoji-mart immediately whenever the menu opens. Updated AddOverlayMenu to toggle `showEmojiPicker` state — the picker only mounts (and lazy-loads) when the user clicks "Add Emoji". This matches the spirit of D-19 (lazy load on first open) more faithfully.

## Known Stubs

None — all three overlay creation actions are fully wired.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries beyond what the plan's threat model already covers (T-13-09 SVG upload sanitized, T-13-10 emoji.native string-only extraction, T-13-11/T-13-12 accepted/mitigated as planned).

## Self-Check

- [x] `src/lib/svgSanitize.ts` exists
- [x] `src/lib/__tests__/svgSanitize.test.ts` exists (5 tests)
- [x] `src/Editor/StickerUpload.tsx` exists
- [x] `src/Editor/AddOverlayMenu.tsx` exists
- [x] `src/Editor/EmojiPickerPopover.tsx` exists (full implementation)
- [x] `src/Editor/Toolbar.tsx` has `aria-label="Add overlay"` and `AddOverlayMenu` import+JSX
- [x] Commit `167ecb4` exists
- [x] Commit `94f9130` exists
- [x] `npx vitest run` — 610 pass, 0 fail
- [x] `npx tsc --noEmit` — clean

## Self-Check: PASSED
