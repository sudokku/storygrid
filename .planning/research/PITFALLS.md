# Domain Pitfalls

**Domain:** Browser-based media editor (Instagram Story collage, recursive split-tree, CSS→image export)
**Stack:** Vite + React 18 + TypeScript + Zustand + Immer + Tailwind + html-to-image + @dnd-kit + @ffmpeg/ffmpeg
**Researched:** 2026-03-31

---

## Critical Pitfalls

Mistakes that cause rewrites, blank exports, or unshippable features.

---

### Pitfall 1: html-to-image produces a blank or partial PNG on the first call

**What goes wrong:**
`toPng()` internally serializes the DOM to SVG, then draws that SVG onto a canvas. On the first invocation, external resources — images, fonts, stylesheets — may not have finished fetching into the library's internal base64 cache. The result is a PNG where image cells are white rectangles and text uses the browser's fallback font.

**Why it happens:**
The library fetches every external resource referenced in computed CSS (including `@font-face` sources and `<img>` `src` attributes) during each call, re-encoding them as data URIs inside the SVG blob. On the first call the fetches race against SVG serialization. Subsequent calls often succeed because the fetches complete before serialization begins.

**Consequences:**
- MVP export silently delivers corrupt PNGs.
- Users report "blank download" but cannot reproduce after retrying.
- The bug is masked in dev because localhost has near-zero latency.

**Prevention:**
1. Call `toPng()` twice and discard the first result. This is the documented community workaround (verified: multiple issues on `bubkoo/html-to-image`).
2. Call `getFontEmbedCSS()` once at app load, store the result, and pass it as `{ fontEmbedCSS: cachedValue }` to every subsequent `toPng()` call — this skips redundant font fetching on each export.
3. Pre-load all user images as base64 data URIs at the time of upload (convert `File` → `data:` URL via `FileReader.readAsDataURL`), and store that data URI in the cell state instead of a blob URL. The export element then contains only inline data, eliminating all network fetches during capture.

**Warning signs:**
- Export works in development, fails or is incomplete in staging/production.
- First export call in a fresh session produces blank cells; retrying works.
- Console shows `SecurityError: Failed to fetch` or CORS errors during export.

**Phase relevance:** Phase 4 (Export Engine) — must be addressed before export is considered done.

---

### Pitfall 2: html-to-image and video elements — always renders blank

**What goes wrong:**
`toPng()` cannot capture the current frame of a `<video>` element. The SVG serialization step omits video content entirely; the canvas cell that corresponds to the video is blank (black or transparent). This is a hard limitation of the SVG-serialization approach — it does not use `drawImage` against the video element.

**Why it happens:**
The library rasterizes by drawing SVG into a canvas via `new Image().src = svgBlob`. At that point, video security restrictions (`tainted canvas` rules) prevent the browser from drawing cross-origin video frames, and no frame callback fires during serialization.

**Consequences:**
- Phase 6 (Video Support) cannot use the Phase 4 export path for cells that contain video.
- Shipping video cells without solving this means video frames are always missing from exports.

**Prevention:**
For video export (Phase 6) use ffmpeg.wasm's `xstack` filter entirely — do not attempt html-to-image for video frames. The architecture is already correct: Phase 4 is image-only, Phase 6 is ffmpeg-only. Never attempt to use `toPng()` on a container that has live `<video>` children.

For a "poster frame" thumbnail during video export progress display, use `requestVideoFrameCallback` or draw the video to an offscreen canvas first, then export that canvas as a data URL.

**Warning signs:**
- Any code that calls `toPng()` on a parent element containing `<video>` tags.
- Export function is not branching on whether any cells contain video.

**Phase relevance:** Phase 4 (confirm image-only path) and Phase 6 (enforce ffmpeg-only path).

---

### Pitfall 3: CORS tainted canvas prevents export of user images from object URLs or external URLs

**What goes wrong:**
If any `<img>` inside the export container has a `src` that is cross-origin (including some CDN-hosted assets or improperly handled local file URLs), the browser marks the canvas as tainted, throwing `SecurityError: The operation is insecure` when `toPng()` calls `canvas.toDataURL()`.

Separately, Chromium has a documented cache behavior: if an image is first loaded without CORS headers and then re-requested with `crossOrigin="anonymous"`, Chromium serves the cached non-CORS response, which re-taints the canvas. This is flagged as `WontFix` in Chromium's tracker.

**Why it happens:**
- User drops an image from an external URL (not a local file) directly into a cell.
- The export div uses `<img src="blob:...">` — blob URLs are same-origin, so these are safe. But if the user pastes an `https://` URL, it becomes cross-origin.
- CSS `background-image` from cross-origin URLs in the export element triggers the same failure.

**Consequences:**
Export silently produces a tainted canvas error; the download never happens.

**Prevention:**
1. At upload time, convert every user-supplied `File` object to a `data:` URI immediately using `FileReader.readAsDataURL`. Store only the data URI in `MediaItem.src`. Never store raw blob URLs in export state.
2. If external URL pasting is ever supported, proxy the image through a same-origin fetch, convert to data URI, then store.
3. In the export container, all `<img>` elements must have `crossOrigin="anonymous"` set AND be loaded against a server that returns `Access-Control-Allow-Origin: *`.

**Warning signs:**
- `MediaItem.src` stores `https://` URLs or `blob:` URLs.
- Console shows `SecurityError` or `tainted canvas` during export.
- Export works on localhost but fails on deployed Vercel/Netlify.

**Phase relevance:** Phase 3 (Media Upload — enforce data URI conversion) and Phase 4 (Export Engine).

---

### Pitfall 4: ffmpeg.wasm fails without COOP/COEP headers — and those headers break third-party embeds

**What goes wrong:**
`@ffmpeg/ffmpeg` requires `SharedArrayBuffer`, which browsers only expose in cross-origin isolated contexts. Without the following headers on every page response, ffmpeg.wasm throws `ReferenceError: SharedArrayBuffer is not defined`:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The secondary trap: once COEP is set to `require-corp`, every sub-resource (images, fonts, iframes, workers) loaded by the page must also serve `Cross-Origin-Resource-Policy: cross-origin` or `same-origin`. Any third-party resource without this header is blocked — breaking Google Fonts, external CDN images, analytics scripts, social embeds, etc.

**Why it happens:**
COEP `require-corp` enforces that no sub-resource is loaded without explicit opt-in. It was designed for post-Spectre isolation. Most public CDNs do not serve `CORP` headers.

**Consequences:**
- Adding these headers for MVP breaks Google Fonts or any externally hosted asset.
- Not adding them means ffmpeg.wasm never loads.
- Safari on iOS as of mid-2025 still has intermittent `SharedArrayBuffer` availability issues even with correct headers.

**Prevention:**
1. Do NOT set COOP/COEP headers in Phase 0-5 (MVP). Only add them in Phase 6 configuration.
2. In Vercel (`vercel.json`) and Netlify (`netlify.toml`), scope the headers to a specific route if possible, or accept that the whole app becomes cross-origin isolated for v1.
3. Use `COEP: credentialless` instead of `require-corp` where browser support allows (Chrome 96+, Firefox 119+). This is less restrictive — anonymous resources load without needing a CORP header.
4. All fonts must be self-hosted (not Google Fonts CDN) before COEP is enabled.
5. Implement ffmpeg.wasm behind a feature-flag that is only initialized after user interaction (lazy load the ~25MB WASM on first video export request).
6. Keep Safari video export explicitly out of scope — `SharedArrayBuffer` on iOS WebKit is unreliable.

**Vercel configuration:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

**Warning signs:**
- `SharedArrayBuffer is not defined` in console.
- Third-party fonts or images stop loading after adding COEP headers.
- ffmpeg.wasm imported at module level (not lazily) — adds 25MB to initial bundle.

**Phase relevance:** Phase 6 (Video Support) exclusively. No COOP/COEP in MVP phases.

---

### Pitfall 5: CSS `transform: scale()` on the preview canvas does NOT affect the export container — but it can break `overflow: hidden` clipping in Safari

**What goes wrong:**
The architecture uses a scaled-down preview (`transform: scale(viewportScale)`) alongside a hidden full-resolution export div. This is correct. The trap is two-fold:

1. **Safari overflow clipping bug**: `overflow: hidden` + `border-radius` on a parent element fails to clip children when a `transform` is applied on a descendant. The image visually overflows its cell boundary. Safari requires `isolation: isolate` on the container to enforce clipping.

2. **Export div must NOT use `transform: scale()`**: If the hidden 1080×1920px div is positioned off-screen using negative `transform: translateX(-9999px)`, html-to-image will capture it correctly. But if the export div itself has a `scale()` transform applied (e.g., mistakenly inheriting from a parent), the captured dimensions will be wrong.

**Why it happens:**
- `transform: scale()` is a visual-only operation. It does not affect layout dimensions or `getBoundingClientRect()` for capture libraries that read CSS computed styles.
- Safari's compositing layer for `overflow: hidden` does not always apply when child elements have transforms.

**Consequences:**
- Cell images overflow their borders in Safari preview mode.
- Export PNG is the wrong size (scaled instead of full-res) if the export div has an accidental scale transform.

**Prevention:**
1. Add `isolation: isolate` to every `LeafNode` container that applies `overflow: hidden` with `border-radius`.
2. The export div must be a completely separate React subtree that never inherits the preview's scale transform. Position it with `position: absolute; left: -9999px; top: 0` (NOT `transform: translate`), so it is visually off-screen but layout-present at full resolution.
3. Confirm export div dimensions with `div.getBoundingClientRect()` in a test — should be exactly `1080 × 1920`.
4. Use `transform: scale()` only on the preview canvas wrapper, never on the export canvas wrapper.

**Warning signs:**
- Cell images render outside cell borders in Safari.
- Export PNG is smaller than 1080×1920.
- Export div is a child of the scaled preview container.

**Phase relevance:** Phase 2 (Grid Rendering — Safari overflow fix) and Phase 4 (Export Engine — export div isolation).

---

### Pitfall 6: @dnd-kit causes every tree node to re-render on drag start/move

**What goes wrong:**
`DndContext` exposes an `active` property on its context. When dragging starts, `active` changes, and every component that consumes `useDraggable`, `useDroppable`, or `useSortable` gets a new context value, triggering a re-render — regardless of whether `React.memo` is applied.

In a recursive tree with 20+ leaf nodes each registered as a drop target, this means 20+ re-renders on every pointer move event, causing visible lag during divider drag-resize.

**Why it happens:**
React Context re-renders all consumers when the context value reference changes. The dnd-kit maintainer has acknowledged this as an architectural trade-off pending official React `useContextSelector` support. A partial fix (context splitting) was merged in PR #569, but re-renders are not fully eliminated.

**Consequences:**
- Divider drag-resize stutters at >10 cells on mid-tier hardware.
- Any expensive computation (tree traversal, layout recalculation) in a node's render body fires on every pointer move.

**Prevention:**
1. StoryGrid does not use dnd-kit for the divider resize interaction. Dividers use raw `pointerdown`/`pointermove`/`pointerup` handlers, completely bypassing dnd-kit's context. This is the correct architecture per PROJECT.md.
2. For any dnd-kit usage (file drop onto leaf cells), keep `DndContext` scoped as narrowly as possible — ideally wrapping only the active drop zone, not the entire canvas.
3. Every tree node component (`GridNode`, `ContainerNode`, `LeafNode`) must be wrapped with `React.memo`. Even though `React.memo` does not prevent the context-triggered re-render inside the dnd-kit hook, it prevents the render propagating to child components that are NOT dnd-kit consumers.
4. Move all state selectors inside leaf components to use per-node Zustand selectors (select `state.nodes[nodeId]`, not the entire `state.grid`), so that leaf nodes only re-render when their own data changes.

**Warning signs:**
- `DndContext` wrapping the entire editor canvas.
- Leaf node components using `useSelector(state => state.grid)` — subscribes to the entire tree.
- No `React.memo` on recursive node components.
- Drag-resize latency increases linearly with cell count.

**Phase relevance:** Phase 2 (Grid Rendering) and Phase 3 (Media Upload & Cell Controls).

---

### Pitfall 7: Object URL memory leak — `URL.createObjectURL` without `revokeObjectURL`

**What goes wrong:**
Every call to `URL.createObjectURL(file)` allocates a blob URL that holds a reference to the file's bytes in memory. These URLs persist until the page is unloaded or `revokeObjectURL` is explicitly called. In a single-page app with media replacement (user drops a new image on a cell that already has media), the old blob URL is never freed, accumulating memory with each swap.

In a multi-slide v1+ session with many images replaced across many slides, Chrome's soft limit (~10,000 active blob URLs) can be reached, causing `createObjectURL` to fail silently or the tab to crash with OOM.

**Why it happens:**
Zustand stores the blob URL string in `MediaItem.src`. When `setMedia` replaces the media item, the old string is overwritten in state, but the browser's blob registry still holds the underlying bytes until revoked.

**Consequences:**
- Memory grows ~5-20MB per replaced image, never reclaimed.
- Long editing sessions crash the tab.
- Harder to diagnose than JS heap leaks because the memory is in the browser's blob registry, not the JS heap.

**Prevention:**
1. At upload time, convert `File` → `data:` URI (base64) using `FileReader.readAsDataURL`. Do NOT use `createObjectURL` for images stored in state. Data URIs are owned by the JS heap (garbage collected normally) and have no separate registry.
2. If `blob:` URLs are needed for performance with large video files, implement a `MediaStore` utility that:
   - Tracks every active blob URL keyed by `nodeId`.
   - On `setMedia(nodeId, newMedia)`, calls `URL.revokeObjectURL(oldUrl)` before replacing.
   - On `removeNode(nodeId)`, revokes the URL.
   - On React component unmount, revokes the URL.
3. In `useEffect` cleanup for any component that calls `createObjectURL`, always revoke:
   ```typescript
   useEffect(() => {
     const url = URL.createObjectURL(file);
     setPreviewUrl(url);
     return () => URL.revokeObjectURL(url);
   }, [file]);
   ```

**Warning signs:**
- Task Manager shows tab memory growing continuously during editing.
- `blob:` URLs appear in `MediaItem.src` in the Zustand devtools store.
- No `URL.revokeObjectURL` call anywhere in the codebase.

**Phase relevance:** Phase 3 (Media Upload) — must be correct from day one; retrofitting revocation logic into stored state is painful.

---

## Moderate Pitfalls

---

### Pitfall 8: Zustand + Immer undo history — full state snapshots grow unbounded

**What goes wrong:**
The PROJECT.md architecture stores undo history as an array of full `GridState` snapshots (one snapshot per mutating action). A complex grid with 8 cells, each with a base64 image (~500KB each), produces state snapshots of ~4MB each. With 50 undo steps, that is ~200MB of JS heap used for history alone.

**Why it happens:**
Immer produces structurally-shared immutable trees, so unchanged subtrees share references. However, when images are stored as base64 data URIs in state, those large strings are duplicated across every snapshot that postdates the upload, because Immer treats strings as primitives (no sharing).

**Consequences:**
- Memory exhaustion in long editing sessions.
- `JSON.stringify` for persistence to localStorage fails or produces huge strings.
- Undo/redo becomes slow as the history array grows.

**Prevention:**
1. Do NOT store image data URIs in the undo-tracked state. Store a `mediaId` string instead, and keep a separate `mediaRegistry: Record<mediaId, dataUri>` that is excluded from undo history (it is append-only; images are never un-uploaded by undo).
2. Cap the undo stack at 50 entries maximum. On push, if `history.length >= 50`, shift the oldest entry.
3. For the undo history, only snapshot the `grid` tree structure (node IDs, split directions, size ratios, selected media IDs) — not the full editor UI state (zoom level, selected node, safe zone toggle). These should be separate Zustand slices.
4. Consider `zundo` (< 700B, Zustand middleware) for production-quality undo/redo with built-in equality checks that skip no-op actions.

**Warning signs:**
- `history` array in Zustand devtools shows snapshots with large `dataUri` strings.
- `localStorage.setItem` throws `QuotaExceededError`.
- Browser memory profiler shows heap growing with each image upload.

**Phase relevance:** Phase 1 (Grid Tree Engine — design history correctly before it is hard to change) and Phase 7 (Save/Load — serialize only what is necessary).

---

### Pitfall 9: Stale closures in memoized recursive tree nodes

**What goes wrong:**
In a recursive component tree (`GridNode → ContainerNode → LeafNode`), each node receives callbacks via props (e.g., `onSplit`, `onRemove`, `onResize`). If these callbacks are created in a parent and memoized with `useCallback`, they capture state at their creation time. When a sibling node is added/removed, the captured tree snapshot is stale. The callback fires with the old tree, overwriting the current state.

**Why it happens:**
`React.memo` prevents re-render from propagating down; `useCallback` caches the closure. Together they create a classic stale closure: the child component never gets a new callback, so the callback still references the old state.

**Consequences:**
- Split / resize operations silently operate on outdated state, corrupting the tree.
- Difficult to debug — the bug depends on the sequence of actions.

**Prevention:**
1. Do NOT pass tree-mutating callbacks as props. Instead, each node component calls a Zustand action directly (`useGridStore(s => s.splitNode)`). Zustand actions always operate on current state, never on captured snapshots.
2. Selectors per node: `useGridStore(s => s.nodes[props.nodeId])`. This is a stable subscription — the component re-renders only when its own node data changes.
3. If callbacks must be passed as props (e.g., for testing), use a `ref`-wrapped callback pattern:
   ```typescript
   const callbackRef = useRef(callback);
   callbackRef.current = callback; // always fresh
   const stableCallback = useCallback((...args) => callbackRef.current(...args), []);
   ```

**Warning signs:**
- Tree mutation callbacks defined in `App.tsx` or a high-level `Editor` component and drilled down via props.
- `useCallback` with `[]` dependency array on functions that read tree state.
- Intermittent "wrong cell got split" bugs that depend on operation order.

**Phase relevance:** Phase 1 (store design) and Phase 2 (Grid Rendering).

---

### Pitfall 10: html-to-image fails silently on Safari / iOS — blank PNG with no error

**What goes wrong:**
On Safari (macOS and iOS), `toPng()` frequently returns a valid-looking but blank PNG. The promise resolves (no rejection), but the image contains only the background color. No error is thrown. The issue is caused by Safari's stricter canvas security model and different `foreignObject` SVG rendering behavior.

**Why it happens:**
Safari renders SVG `foreignObject` content differently from Chrome. Specifically, remote resources (images, fonts) that have not already been painted in the current tab's rendering context are not re-fetched during SVG serialization, leaving those elements invisible.

**Consequences:**
- Export appears to succeed (no error, download happens), but the PNG is blank.
- Users may not notice until they open the downloaded file.

**Prevention:**
1. Use the double-call workaround: call `toPng()` twice; use the second result.
2. All images must be pre-converted to data URIs before the export div is mounted (not just before export is triggered).
3. Test export on Safari explicitly in Phase 4. Do not rely on Chrome-passing tests as proxy.
4. Display an export progress indicator that shows "Preparing assets…" during the pre-flight image conversion step, so the user does not click export while images are still loading.

**Warning signs:**
- Export not tested on Safari.
- Images stored as `blob:` or `https://` URLs in cell state (not data URIs).
- No double-call pattern in export code.

**Phase relevance:** Phase 4 (Export Engine).

---

## Minor Pitfalls

---

### Pitfall 11: `html-to-image` captures content outside viewport — but only if layout is correct

**What goes wrong:**
If the export div (1080×1920px) is positioned such that it causes page scroll (e.g., `position: relative` in normal document flow), `toPng()` only captures the portion of the element that is within the viewport. Content below the fold is missing from the export.

**Prevention:**
The export div must be `position: absolute` (or `fixed`) and removed from normal document flow. Using `position: absolute; left: -9999px; width: 1080px; height: 1920px; overflow: hidden` ensures the full element is present in the layout without affecting scroll.

**Phase relevance:** Phase 4 (Export Engine).

---

### Pitfall 12: Divider resize updates cause excessive Zustand state writes

**What goes wrong:**
Divider drag fires `pointermove` at 60fps. If each move event directly calls the Zustand `resize` action (which Immer wraps in a full state production), 60 state writes per second trigger 60 re-renders across all subscribed components.

**Prevention:**
1. Throttle `pointermove` handler to ~16ms using `requestAnimationFrame`.
2. Use a local React `useRef` to accumulate the drag delta during drag; only commit to Zustand state on `pointerup` (or at most on animation frames). This means intermediate positions are purely local state, not global.
3. Pattern: `localSizeRef.current = newRatio` during drag, `store.resize(nodeId, localSizeRef.current)` on release.

**Phase relevance:** Phase 2 (Grid Rendering).

---

### Pitfall 13: Recursive tree can render infinitely if a `ContainerNode` with zero children is created

**What goes wrong:**
If a bug in `removeNode` or `mergeNode` produces a `ContainerNode` with an empty `children` array, the recursive renderer enters an infinite loop trying to render the container's children, causing a React stack overflow.

**Prevention:**
1. Add a guard in `splitNode` and `removeNode` pure functions: a `ContainerNode` must always have exactly 2 children. Throw a descriptive error (in dev) or auto-correct to a `LeafNode` (in prod) if this invariant is violated.
2. Add a `MAX_DEPTH = 8` guard in the renderer: `if (depth > 8) return <ErrorBoundary />`.
3. TypeScript discriminated union (`NodeType: 'container' | 'leaf'`) enforced at every mutation site prevents accidental creation of invalid states.

**Phase relevance:** Phase 1 (Grid Tree Engine) and Phase 2 (Grid Rendering).

---

### Pitfall 14: `@ffmpeg/ffmpeg` vite build requires explicit WASM plugin configuration

**What goes wrong:**
Vite does not natively support ES Module WebAssembly imports. Without `vite-plugin-wasm` (or equivalent), the Vite production build either inlines the 25MB WASM as base64 (bloating the JS bundle) or fails to load it entirely with a `TypeError: Failed to fetch dynamically imported module`.

**Prevention:**
1. Install `vite-plugin-wasm` and add it to `vite.config.ts` before Phase 6.
2. The ffmpeg WASM core and worker files must be served as static assets, not bundled. Configure Vite to copy them to `public/`:
   ```typescript
   // vite.config.ts
   import wasm from 'vite-plugin-wasm';
   export default { plugins: [wasm()] }
   ```
3. Use the `@ffmpeg/ffmpeg` dynamic import pattern: `const { createFFmpeg } = await import('@ffmpeg/ffmpeg')` inside the export handler — never at module top level.

**Warning signs:**
- ffmpeg imported at the top of any file (not lazy).
- Build output includes a >5MB JS chunk.
- `TypeError: WebAssembly.instantiate` errors in production console.

**Phase relevance:** Phase 6 (Video Support).

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Phase 1 | Undo history design | Large base64 images duplicated in every snapshot | Store mediaId references only; exclude media registry from history |
| Phase 1 | Tree invariants | `ContainerNode` with 0 or 1 children causes infinite render | Enforce 2-child invariant in all pure tree functions |
| Phase 2 | Recursive rendering | Stale closure callbacks mutate wrong state | Nodes call Zustand actions directly; no drilled callbacks |
| Phase 2 | Safari overflow clipping | `overflow: hidden` + border-radius not respected with transforms | Add `isolation: isolate` to all leaf containers |
| Phase 2 | Divider drag performance | 60fps Zustand writes | Buffer delta in `useRef`; commit on `pointerup` |
| Phase 3 | Media upload | `blob:` URLs leak memory on cell replace | Convert to data URI at upload; revoke on replace |
| Phase 4 | Export PNG blank | First `toPng()` call races with resource fetch | Double-call; pre-convert images; cache `getFontEmbedCSS()` |
| Phase 4 | Export off-screen div | Wrong position causes viewport-clipped capture | `position: absolute; left: -9999px`; no scale transform |
| Phase 4 | Cross-origin images | CORS taint blocks canvas export | Data URIs only in export div |
| Phase 6 | COOP/COEP activation | Breaks third-party resources; not needed for MVP | Enable only in Phase 6; use `credentialless` mode; self-host fonts first |
| Phase 6 | ffmpeg.wasm bundle size | 25MB hits initial load | Lazy import behind user interaction; Vite WASM plugin |
| Phase 6 | Video in html-to-image | Always blank | Never call `toPng()` when video cells exist; ffmpeg-only path |

---

## Sources

- [html-to-image GitHub issues — CORS, Safari, fonts](https://github.com/bubkoo/html-to-image/issues)
- [html-to-image issue #179: CORS/Crossdomain](https://github.com/bubkoo/html-to-image/issues/179)
- [html-to-image issue #207: Google Fonts CORS](https://github.com/bubkoo/html-to-image/issues/207)
- [html-to-image issue #199: Blank Safari](https://github.com/bubkoo/html-to-image/issues/199)
- [html-to-image issue #461: Blank Safari (more recent)](https://github.com/bubkoo/html-to-image/issues/461)
- [dnd-kit issue #389: Unnecessary re-renders](https://github.com/clauderic/dnd-kit/issues/389)
- [dnd-kit issue #898: Sortable tree performance](https://github.com/clauderic/dnd-kit/issues/898)
- [dnd-kit issue #1071: Re-rendering all draggable items](https://github.com/clauderic/dnd-kit/issues/1071)
- [ffmpeg.wasm issue #263: SharedArrayBuffer not defined](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/263)
- [ffmpeg.wasm issue #299: iOS support](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/299)
- [Zustand discussions #1773: Out of memory with large state](https://github.com/pmndrs/zustand/discussions/1773)
- [zundo — undo/redo middleware for Zustand](https://github.com/charkour/zundo)
- [URL.revokeObjectURL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
- [COEP header — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)
- [Setting COOP/COEP on static hosting](https://blog.tomayac.com/2025/03/08/setting-coop-coep-headers-on-static-hosting-like-github-pages/)
- [Netlify custom headers docs](https://docs.netlify.com/manage/routing/headers/)
- [React stale closures — TkDodo](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures)
- [Zustand re-render optimization](https://dev.to/eraywebdev/optimizing-zustand-how-to-prevent-unnecessary-re-renders-in-your-react-app-59do)
