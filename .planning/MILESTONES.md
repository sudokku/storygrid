# Milestones

## v1.0 MVP (Shipped: 2026-04-07)

**Phases completed:** 8 phases (0–6 + 5.1 INSERTED), 23 plans, 29 tasks
**Timeline:** 2026-03-31 → 2026-04-07 (7 days)
**Codebase:** ~10,683 lines TypeScript/TSX, 216 files changed

**Key accomplishments:**

1. Full-stack Vite 8 + React 18 + TypeScript scaffold with Tailwind v3 PostCSS, Zustand + Immer, Vitest jsdom TDD setup, and three-region editor shell — all 22 baseline tests passing
2. Recursive split-tree engine with 10 pure functions, Zustand gridStore/editorStore with Immer middleware, undo/redo history (50-entry cap, mediaRegistry excluded from snapshots)
3. Grid rendering with draggable pointer-event dividers, React.memo per-node Zustand subscriptions, canvas CSS scale, selection/hover action bar, Safari isolation fix
4. FileReader-based base64 image upload pipeline, auto-fill cells, full ActionBar/Toolbar/Sidebar controls, Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts
5. Canvas API export pipeline replacing html-to-image — pixel-perfect 1080×1920px PNG/JPEG download with progress toast and JPEG quality control
6. Templates, gap/radius/background controls, pan/zoom, cell-swap via dnd-kit, dark theme (#0a0a0a), keyboard shortcuts, first-time onboarding overlay
7. Mobile-first responsive UI (INSERTED phase 5.1): 768px layout swap, bottom sheet with snap states, touch-adapted dividers, pinch-to-zoom in pan mode, mobile welcome card
8. Video cells with canvas rAF preview loop, timeline play/pause/scrub sync, MediaRecorder-based MP4 export (replaced ffmpeg.wasm), COOP/COEP headers for Vercel/Netlify

**Archived:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
