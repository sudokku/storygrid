# Quick Task 260405-o0a: Research Summary
# @ffmpeg/ffmpeg 0.12.x Loading in Vite + React

**Date:** 2026-04-05
**Sources:** ffmpegwasm/ffmpeg.wasm GitHub, official docs, issue tracker, community reports

---

## Confirmed Working `ffmpeg.load()` Pattern

From the **official react-vite-app example** in the ffmpegwasm repo:

```typescript
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const ffmpeg = new FFmpeg();

// Single-threaded (recommended — no SharedArrayBuffer hard dependency):
const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
});

// Multi-threaded (requires crossOriginIsolated = true):
const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd";
await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
});
```

---

## `toBlobURL` — Required, Not Optional

`toBlobURL` from `@ffmpeg/util` is **mandatory**. It re-fetches the CDN file and serves it as a same-origin blob URL, bypassing the browser's cross-origin worker script restriction. Without it, the browser refuses to spin up the ffmpeg Web Worker.

---

## `workerURL` — Only for Multi-threaded (`@ffmpeg/core-mt`)

`workerURL` is only needed when using `@ffmpeg/core-mt` (multi-threaded). Single-threaded `@ffmpeg/core` does **not** require `workerURL`. For StoryGrid (single-threaded approach per CLAUDE.md), omit `workerURL`.

---

## CDN URL Pattern

**Use jsdelivr, not unpkg.** unpkg has active 404 issues for `@ffmpeg/core@0.12.10` (GitHub Issue #868, still open as of 2025). jsdelivr is reliable across all 0.12.x versions.

**Path:** `/dist/esm` or `/dist/umd` — both work with `toBlobURL`. Official docs show `umd` in most examples; the community debugger confirmed `/dist/esm` also works for Vite.

**Version pinning:** Use `@0.12.6` or `@0.12.9`. Version `@0.12.10` has CDN 404 issues in some environments (Issue #868). Pin the CDN URL to the same minor as the npm package installed.

```
https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js
https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm
```

---

## COOP/COEP Headers — Required

`window.crossOriginIsolated` must be `true` for `SharedArrayBuffer` (needed internally by ffmpeg.wasm). Without COOP/COEP headers, ffmpeg silently hangs or fails.

**Vite dev server** — add to `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
```

**Production (Vercel)** — `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

**Production (Netlify)** — `public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Important:** After changing Vite server headers, do a **full dev server restart** (not just HMR) for headers to take effect.

---

## `optimizeDeps.exclude` — Required

Vite's pre-bundler breaks `@ffmpeg/ffmpeg` and `@ffmpeg/util` because they spawn Web Workers internally and contain WASM. Excluding them from pre-bundling lets the browser load them as native ESM. Without this, you get "Cannot use import statement outside a module" or silent hang.

```typescript
optimizeDeps: {
  exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
},
```

---

## Alternative: `vite-plugin-cross-origin-isolation`

The `vite-plugin-cross-origin-isolation` npm package automates COOP/COEP header injection. However, it's low-maintenance and unmaintained since ~2023. Prefer the explicit `server.headers` config above.

---

## Known Pitfalls

| Pitfall | Cause | Fix |
|---------|-------|-----|
| `failed to import ffmpeg-core.js` | Vite pre-bundling conflict | `optimizeDeps.exclude` both packages |
| 404 on core files | unpkg CDN issue with 0.12.10 | Use jsdelivr; pin to 0.12.6 or 0.12.9 |
| Silent hang on `ffmpeg.load()` | Missing COOP/COEP headers | Add headers to vite.config.ts + production |
| `SharedArrayBuffer is not defined` | `crossOriginIsolated` is false | Headers not applied; full server restart needed |
| Worker script blocked | CDN URLs loaded directly (not blob) | Always use `toBlobURL` from `@ffmpeg/util` |
| Dynamic import breaks in bundle | ffmpeg not lazy-loaded | Load via `const { FFmpeg } = await import("@ffmpeg/ffmpeg")` |

---

## StoryGrid-Specific Recommendation

StoryGrid already has COOP/COEP headers in `vite.config.ts`, `vercel.json`, and `public/_headers` (per Phase 06 decision). The load pattern to use:

```typescript
// Lazy-load to keep initial bundle clean
const { FFmpeg } = await import("@ffmpeg/ffmpeg");
const { toBlobURL, fetchFile } = await import("@ffmpeg/util");

const ffmpeg = new FFmpeg();
const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
});
```

No `workerURL` needed (single-threaded). Pin CDN to `@ffmpeg/core@0.12.6` (stable, confirmed working). Verify `window.crossOriginIsolated === true` before calling `ffmpeg.load()`.
