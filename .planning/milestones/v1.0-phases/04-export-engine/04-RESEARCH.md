# Phase 4: Export Engine - Research

**Researched:** 2026-04-01
**Domain:** Browser-side image capture via html-to-image, React context for export mode suppression, split-button UI, toast notifications, download trigger
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Export Trigger Flow**
- D-01: The toolbar Export button is a split button: left side triggers immediate download using last-used settings (default: PNG), right side (▼) opens a settings popover.
- D-02: The quick export path (left click) uses the last-selected format and quality — first run defaults to PNG.

**Export Settings UI**
- D-03: The ▼ popover contains: Format toggle (PNG / JPEG segmented control) + Quality slider (70%–100%, only visible when JPEG is selected) + a Download button.
- D-04: The quality slider corresponds to html-to-image `quality` option mapped from 0.7–1.0 (displayed as 70%–100%).
- D-05: The popover is self-contained — no sidebar section needed for export settings.

**Progress & Error UX**
- D-06: Progress and errors are shown via toast notifications, not inline in the button.
- D-07: Toast states: "⧗ Preparing…" → "⧗ Exporting…" → dismisses on success (download starts). On failure: "⚠ Export failed" toast with a "Try again" action.
- D-08: The Export button is disabled while export is in progress (prevents double-clicks).
- D-09: Video-guarded export (EXPO-03): if any cell contains a video, export is blocked with a clear toast message — "Export not available: remove video cells first."

**ExportSurface Architecture**
- D-10: ExportSurface reuses the same GridNode/ContainerNode/LeafNode components as the live preview — no separate renderer.
- D-11: ExportSurface is a fixed 1080×1920px container (`position: absolute; left: -9999px; visibility: hidden`), always mounted, never conditionally rendered. No CSS `transform: scale()` — renders at actual pixel dimensions.
- D-12: ExportSurface subscribes to gridStore directly (same store as the preview). It stays in sync automatically — no props threading or manual sync needed.
- D-13: ExportSurface must suppress interactive behaviors (hover action bars, divider drag handles, selection borders) — pass an `isExporting` or `exportMode` prop to Grid components, or use a React context to hide interactive elements in export context.

**Double-Call Pattern (locked in requirements)**
- D-14: html-to-image `toPng()` is called twice per export. First call result is discarded (blank-PNG browser paint workaround per EXPO-02). Second call result is used for download.
- D-15: The "Preparing…" toast maps to the first `toPng()` call; "Exporting…" maps to the second call.

**Download**
- D-16: PNG filename: `storygrid-{timestamp}.png` where timestamp = `Date.now()`.
- D-17: JPEG filename: `storygrid-{timestamp}.jpg`.
- D-18: Download triggered via a dynamically created `<a>` tag with `download` attribute and `href` set to the data URL.

### Claude's Discretion
- Toast implementation: use a minimal custom toast (no external toast library needed for 2 states). A simple fixed-position div with transition is sufficient.
- Split button styling: consistent with existing toolbar button style (Tailwind utility classes only). The ▼ arrow is a small secondary segment separated by a divider.
- Popover implementation: can use a simple absolutely-positioned div (no Radix Popover needed for this single-use case).
- Whether to extract an `exportStore` or keep export state (isExporting, format, quality) in `editorStore` — either is fine; lean toward `editorStore` to avoid store proliferation.

### Deferred Ideas (OUT OF SCOPE)
- Video export (Phase 6)
- Visual polish controls: gap, border-radius, background color (Phase 5)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPO-01 | Export renders the grid in a hidden off-screen div (position: absolute; left: -9999px; visibility: hidden) at actual 1080×1920px with no transform scaling | ExportSurface architecture: always-mounted absolute div; html-to-image toPng() reads clientWidth/clientHeight, which are correct on un-scaled DOM nodes |
| EXPO-02 | html-to-image `toPng()` is called twice; first result discarded (blank-PNG workaround); second result triggers download | Double-call pattern documented in CONTEXT.md and CLAUDE.md; root cause: first call triggers browser repaint needed for SVG foreignObject image resolution |
| EXPO-03 | Export never called on a container with video children (guarded by checking leaf types) | `getAllLeaves()` tree utility exists in `src/lib/tree.ts`; check leaf.mediaId against mediaRegistry entry mime prefix OR add a `mediaType` field to LeafNode |
| EXPO-04 | Downloaded PNG is exactly 1080×1920px; filename auto-generated as `storygrid-{timestamp}.png` | html-to-image reads element.scrollWidth/scrollHeight; ExportSurface at actual 1080×1920 without transform guarantees correct dimensions; `Date.now()` filename |
| EXPO-05 | Export settings: PNG (default) or JPEG with quality slider (0.7–1.0) | `toPng()` vs `toJpeg()` from html-to-image; `quality` option (0–1) maps directly; segmented control + conditional quality slider UI |
| EXPO-06 | Progress indicator shown during export ("Preparing…" → "Exporting…"); errors shown as user-friendly message | Custom minimal toast component; two sequential async calls; try/catch around both calls for error path |
| EXPO-07 | ExportSurface component is always mounted (not conditionally rendered); hidden via visibility:hidden | React context for export mode suppression; never use conditional rendering on ExportSurface; `visibility: hidden` rather than `display: none` to keep layout stable |
</phase_requirements>

---

## Summary

Phase 4 wires up the export pipeline using the html-to-image library (already installed at `^1.11.13`) with a predictable, well-understood pattern. The primary complexity is not algorithmic — it is architectural: the ExportSurface must be an always-present, full-resolution, non-interactive clone of the grid that html-to-image can capture reliably.

The double-call workaround (D-14) is the single most critical implementation detail. Without the first discarded call, Chromium's paint-on-demand optimization means images embedded in SVG foreignObject are not rendered before the second capture. Since all images are already stored as base64 data URIs (Phase 3 MEDI-03 guarantee), there are no CORS issues — the usual biggest risk with html-to-image is neutralized.

The UI work is moderate: a split button replacing the existing Export placeholder, an absolutely-positioned popover for settings, and a minimal 2-state toast system. All store state can live in `editorStore` to avoid store proliferation.

**Primary recommendation:** Build ExportSurface as a React-context-aware tree rendering at true 1080×1920, use `toPng()` twice (first discarded), download via anchor-click pattern, and keep all UI as Tailwind-only custom components.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| html-to-image | ^1.11.13 | DOM-to-PNG/JPEG capture | Pre-decided in CLAUDE.md; already installed |
| React 18 | ^18.3.1 | Component tree for ExportSurface | Already in use |
| Zustand 5 | ^5.0.12 | Export state (isExporting, format, quality) | Already used for editorStore |
| Tailwind CSS v3 | ^3.4.19 | Split button, popover, toast styling | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^1.7.0 | ChevronDown icon for split button | Already installed |
| React Context | built-in | ExportMode context for suppressing interactive UI | Needed to pass `exportMode` flag down the Grid tree without prop drilling |

### Not Needed
| Library | Why Not |
|---------|---------|
| Radix Popover / @base-ui Popover | Overkill for a single-use absolutely-positioned settings panel |
| react-hot-toast / sonner | Overkill for a 2-state linear toast flow |
| file-saver | The anchor-click download pattern is sufficient; no external library needed |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 4)
```
src/
├── Editor/
│   ├── Toolbar.tsx            # Replace Export placeholder with ExportSplitButton
│   ├── ExportSplitButton.tsx  # Split button + popover (new)
│   └── Toast.tsx              # Minimal 2-state toast (new)
├── Grid/
│   ├── ExportSurface.tsx      # Always-mounted 1080×1920 hidden export container (new)
│   ├── ExportModeContext.tsx  # React context for exportMode flag (new)
│   ├── GridNode.tsx           # Pass exportMode through; suppress ActionBar/Divider in export mode
│   ├── ContainerNode.tsx      # Suppress Divider when exportMode=true
│   └── LeafNode.tsx           # Suppress hover/selection UI when exportMode=true
├── lib/
│   └── export.ts              # exportGrid() orchestration function (new)
└── store/
    └── editorStore.ts         # Add isExporting, exportFormat, exportQuality state
```

### Pattern 1: Always-Mounted ExportSurface with Export Mode Context

**What:** A full-resolution 1080×1920 div that is always present in the DOM, hidden with `visibility: hidden`, positioned off-screen. A React context (`ExportModeContext`) passes a boolean flag down into the Grid component tree to suppress interactive elements.

**When to use:** Required — prevents blank-PNG race condition (browser needs the DOM node to have been painted at least once before html-to-image can capture it correctly).

**Example:**
```tsx
// src/Grid/ExportModeContext.tsx
import { createContext, useContext } from 'react';
export const ExportModeContext = createContext(false);
export const useExportMode = () => useContext(ExportModeContext);

// src/Grid/ExportSurface.tsx
import { useRef } from 'react';
import { useGridStore } from '../store/gridStore';
import { ExportModeContext } from './ExportModeContext';
import { GridNodeComponent } from './GridNode';

export function ExportSurface({ exportRef }: { exportRef: React.RefObject<HTMLDivElement> }) {
  const rootId = useGridStore(s => s.root.id);
  return (
    <div
      ref={exportRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: 1080,
        height: 1920,
        visibility: 'hidden',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <ExportModeContext.Provider value={true}>
        <GridNodeComponent id={rootId} />
      </ExportModeContext.Provider>
    </div>
  );
}
```

### Pattern 2: Double-Call toPng() with Toast Lifecycle

**What:** The export orchestration calls `toPng()` twice. The first call (mapped to "Preparing…" toast state) is awaited but its result discarded. The second call (mapped to "Exporting…" toast state) produces the final data URL. Both calls are wrapped in a single try/catch.

**When to use:** Every PNG export. Also apply this pattern for `toJpeg()` — the same blank-first-frame race condition applies.

**Example:**
```typescript
// src/lib/export.ts
import { toPng, toJpeg } from 'html-to-image';

export type ExportFormat = 'png' | 'jpeg';

export async function exportGrid(
  node: HTMLElement,
  format: ExportFormat,
  quality: number,
  onStage: (stage: 'preparing' | 'exporting') => void,
): Promise<string> {
  const options = {
    width: 1080,
    height: 1920,
    pixelRatio: 1,
    ...(format === 'jpeg' ? { quality } : {}),
  };

  // First call — discarded (forces browser paint / font embed)
  onStage('preparing');
  if (format === 'jpeg') {
    await toJpeg(node, options);
  } else {
    await toPng(node, options);
  }

  // Second call — produces the real output
  onStage('exporting');
  if (format === 'jpeg') {
    return toJpeg(node, options);
  } else {
    return toPng(node, options);
  }
}
```

### Pattern 3: Anchor-Click Download

**What:** Create a temporary `<a>` element, set `download` and `href`, programmatically click it, then remove it.

**When to use:** For all format downloads. Avoids need for file-saver or other external dependencies.

**Example:**
```typescript
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

### Pattern 4: Export Mode Suppression in LeafNode / ContainerNode

**What:** Components read `useExportMode()` and conditionally render interactive elements.

**Key suppressions needed:**
- `LeafNode`: skip hover dim overlay, skip ActionBar, skip selection ring, skip `onMouseEnter`/`onMouseLeave` handlers
- `ContainerNode`: skip Divider component rendering
- `CanvasWrapper`: ExportSurface is placed as a sibling inside `EditorShell`, not inside `CanvasWrapper`, to avoid inheriting the CSS `transform: scale()`.

**Example:**
```tsx
// In LeafNode.tsx
const exportMode = useExportMode();
// ...
{!exportMode && (
  <ActionBar nodeId={id} fit={node.fit} hasMedia={hasMedia} onUploadClick={handleUploadClick} />
)}
// Selection ring class: only apply when !exportMode
```

### Pattern 5: Export State in editorStore

**What:** Add `isExporting`, `exportFormat`, `exportQuality` to the existing `editorStore`. No new store needed.

**Additions to editorStore:**
```typescript
type EditorState = {
  // ... existing fields ...
  isExporting: boolean;
  exportFormat: 'png' | 'jpeg';
  exportQuality: number;        // 0.7–1.0
  lastExportFormat: 'png' | 'jpeg';  // persists last selection
  lastExportQuality: number;
  setIsExporting: (v: boolean) => void;
  setExportFormat: (f: 'png' | 'jpeg') => void;
  setExportQuality: (q: number) => void;
};
```

### Pattern 6: Split Button in Toolbar

**What:** Replace the existing placeholder Export button with a two-segment split button. Left segment = immediate export using last settings. Right segment (▼) = opens popover.

**Implementation approach:** Two adjacent `<button>` elements inside a shared container with a `|` divider. The popover is an absolutely-positioned `<div>` toggled by the ▼ button, closed on outside click via `useEffect` + document event listener.

**Existing toolbar pattern to follow:**
- Buttons use class `flex items-center justify-center rounded hover:bg-white/10 transition-colors text-neutral-300`
- Tooltip system uses `@base-ui/react` TooltipTrigger with `render` prop pattern (not `asChild`)
- The split button left segment should not use `TooltipTrigger render` pattern on the entire button — separate the tooltip from the button to allow the split

### Anti-Patterns to Avoid

- **Conditionally mounting ExportSurface:** Using `{isExporting && <ExportSurface />}` causes the blank-PNG bug because the DOM node is freshly mounted and not yet fully painted. ExportSurface MUST always be mounted.
- **Placing ExportSurface inside CanvasWrapper:** CanvasWrapper applies `transform: scale(finalScale)` to its canvas surface div. ExportSurface placed inside that tree would inherit scaling and produce wrong pixel dimensions. Place ExportSurface as a sibling of CanvasArea in EditorShell.
- **Using `display: none` instead of `visibility: hidden`:** `display: none` removes the element from layout; html-to-image cannot capture elements that have been removed from layout flow. `visibility: hidden` preserves layout while hiding from view.
- **Calling `toPng()` only once:** Single call produces blank or partially-rendered images in Chrome/Safari due to lazy browser paint of SVG foreignObject content.
- **Checking for video by looking at `<video>` DOM elements:** The DOM in ExportSurface only renders `<img>` tags (Phase 6 video not yet implemented). The guard should check `mediaRegistry` entry content (data URI prefix `data:video/`) or a `mediaType` field on the leaf node. Since Phase 3 only accepted `image/*` files, `getAllLeaves()` + checking for a leaf with a video mediaId is sufficient — in practice video cells cannot exist in Phase 4. The guard is still required by EXPO-03 as defensive code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM-to-image capture | Custom canvas/SVG renderer | `toPng()` / `toJpeg()` from html-to-image | Handles CSS cloning, pseudo-elements, font embedding, image inlining |
| Filename timestamp | Custom date formatter | `Date.now()` directly | Returns ms epoch — unique, sortable, no formatting needed |
| Image download | Fetch + Blob + URL.createObjectURL | Anchor-click pattern with data URL href | Simpler; html-to-image already returns data URL; no extra async step |

**Key insight:** html-to-image handles the hard parts (recursive CSS clone, font embedding, image inlining). The application only needs to configure it correctly (pixelRatio, width, height) and invoke it on the right DOM node.

---

## Common Pitfalls

### Pitfall 1: Blank or Partially-Rendered PNG on First Export
**What goes wrong:** The exported image is entirely white or missing image content.
**Why it happens:** Chromium and Safari defer painting of SVG foreignObject content until the first time a DOM subtree is captured. On the very first `toPng()` call, image textures have not been loaded into the compositor.
**How to avoid:** Always call `toPng()` twice. Discard the first result. The second call captures the fully-painted state.
**Warning signs:** Export works on second click but not the first; images appear white in the output.

### Pitfall 2: ExportSurface Inherits CSS Transform Scale
**What goes wrong:** The exported image is the correct file size (1080×1920) but rendered at screen-preview scale (e.g., ~40% of actual canvas content).
**Why it happens:** If ExportSurface is placed inside `CanvasWrapper`'s scaled div, it inherits `transform: scale(finalScale)`. html-to-image uses `element.scrollWidth` and `scrollHeight` which reflect the un-transformed dimensions, but renders the visually scaled content.
**How to avoid:** Mount ExportSurface as a sibling of `CanvasArea` inside `EditorShell`. Do NOT nest it under any element with a CSS transform.
**Warning signs:** Exported image shows tiny grid content surrounded by whitespace.

### Pitfall 3: ExportSurface Not Updated When State Changes
**What goes wrong:** The exported image shows an older version of the grid (stale state).
**Why it happens:** If ExportSurface receives grid state via props instead of subscribing to `gridStore` directly, it can fall out of sync.
**How to avoid:** ExportSurface (and its child GridNodeComponents) subscribe to `gridStore` directly, exactly as the live preview does. No props threading needed (D-12).
**Warning signs:** Export shows grid layout from before the last split or media drop.

### Pitfall 4: Interactive UI Appears in Export
**What goes wrong:** The exported PNG includes the hover action bar, blue selection rings, or divider grab handles.
**Why it happens:** The ExportSurface renders the same components as the live preview without suppression.
**How to avoid:** Use a React context (`ExportModeContext`) that Grid components read. When `exportMode === true`, suppress ActionBar, Divider, selection rings, and hover overlays. Do not use DOM `filter` option in html-to-image (fragile; class-name based).
**Warning signs:** QA feedback that exported images contain UI chrome.

### Pitfall 5: JPEG Quality Slider Value Mismatch
**What goes wrong:** User selects 70% quality but the image is exported at a different quality.
**Why it happens:** The html-to-image `quality` option accepts 0–1, but the UI displays 70–100. Off-by-one mapping error.
**How to avoid:** Store quality in the 0.0–1.0 range in state. Display as `Math.round(quality * 100)` in the UI. Map slider `min={0.7}` `max={1.0}` `step={0.05}` directly to the stored value.
**Warning signs:** Export file size at "70%" quality is identical to PNG (quality option being ignored for toJpeg).

### Pitfall 6: Split Button ▼ Popover Not Closing on Outside Click
**What goes wrong:** The settings popover stays open after the user clicks elsewhere.
**Why it happens:** No outside-click handler registered.
**How to avoid:** In the ExportSplitButton component, use a `useEffect` that adds `mousedown` listener to `document` when popover is open, and removes it on close or unmount. Check that the click target is not inside the popover ref before closing.
**Warning signs:** Popover requires pressing the ▼ button a second time to close.

### Pitfall 7: Export Button Remains Disabled After Error
**What goes wrong:** After an export failure, the Export button stays disabled forever.
**Why it happens:** `isExporting` flag is set to `true` at start but `setIsExporting(false)` is only called on success, not in the catch block.
**How to avoid:** Use `try/catch/finally` — `setIsExporting(false)` in the `finally` block, not just on success.
**Warning signs:** After "⚠ Export failed" toast, Export button is grayed out and unresponsive.

---

## Code Examples

Verified patterns from official html-to-image source and existing project code:

### Calling toPng with explicit dimensions
```typescript
// Source: html-to-image README (verified from installed node_modules/html-to-image/README.md)
import { toPng, toJpeg } from 'html-to-image';

const dataUrl = await toPng(node, {
  width: 1080,
  height: 1920,
  pixelRatio: 1,  // Force 1:1 — no device pixel ratio scaling
});
```

### Filter option for excluding UI chrome (alternative to React context)
```typescript
// Source: html-to-image README
const filter = (node: HTMLElement) => {
  return !node.classList?.contains('export-exclude');
};
const dataUrl = await toPng(element, { filter });
// However: React context approach is preferred over className-based filtering
// because className-based filtering requires consistent class application
// across all interactive components
```

### Existing Zustand store state injection pattern (from editorStore.ts)
```typescript
// Source: src/store/editorStore.ts (project code)
export const useEditorStore = create<EditorState>()(set => ({
  // ... existing state ...
  isExporting: false,
  exportFormat: 'png' as const,
  exportQuality: 0.9,
  setIsExporting: (v) => set({ isExporting: v }),
  setExportFormat: (f) => set({ exportFormat: f }),
  setExportQuality: (q) => set({ exportQuality: q }),
}));
```

### ExportSurface placement in EditorShell
```tsx
// src/Editor/EditorShell.tsx — after Phase 4
export function EditorShell() {
  const exportRef = useRef<HTMLDivElement>(null);
  // ...
  return (
    <div className="flex flex-col h-screen w-screen bg-[#111111]">
      <Toolbar exportRef={exportRef} />
      <div className="flex flex-1 overflow-hidden">
        <CanvasArea />
        <Sidebar />
      </div>
      {/* Always mounted, never conditionally rendered — EXPO-07 */}
      <ExportSurface exportRef={exportRef} />
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dom-to-image (original) | html-to-image (fork) | ~2019 | html-to-image is the maintained successor; same SVG foreignObject technique |
| canvas-only capture (html2canvas) | SVG foreignObject + canvas | Ongoing | html2canvas cannot handle `object-fit: cover` or CSS transforms reliably — confirmed in CLAUDE.md §What NOT to Use |
| CORS image proxies for external URLs | base64 data URIs at upload time | Phase 3 decision | Eliminates all html-to-image CORS failures for this project |

**Deprecated/outdated:**
- `dom-to-image`: Unmaintained original; html-to-image is the drop-in replacement
- `html2canvas`: Cannot handle `object-fit: cover`, CSS custom properties, or CSS transforms — explicitly ruled out in CLAUDE.md

---

## Open Questions

1. **Video media detection for EXPO-03 guard**
   - What we know: Phase 3 only allows `image/*` in the file picker; `mediaRegistry` values are always image data URIs currently
   - What's unclear: The guard should be defensive. The LeafNode type has no `mediaType` field. Detection options: (a) check `dataUri.startsWith('data:video/')` from mediaRegistry, (b) add `mediaType: 'image' | 'video'` to LeafNode type now (Phase 6 prep), or (c) simply return false from `hasVideoCell()` until Phase 6
   - Recommendation: Option (a) — check mediaRegistry data URI prefix. It's zero-cost and correctly future-proofs for Phase 6 without schema changes.

2. **ExportRef ownership: EditorShell vs. App**
   - What we know: The `exportRef` pointing to the ExportSurface DOM node needs to be accessible by the Toolbar's Export button handler
   - What's unclear: Whether to thread `exportRef` as a prop from EditorShell to Toolbar, or to expose a `triggerExport()` function via `editorStore`, or to use a module-level ref
   - Recommendation: Pass `exportRef` as a prop from EditorShell to Toolbar (or to ExportSplitButton). This is the simplest approach, keeps the ref in React's tree, and avoids store contamination with DOM refs.

3. **html-to-image artifact risk with CSS filters / border-radius**
   - What we know: Phase 4 does not yet include border-radius or CSS filter effects (those are Phase 5)
   - What's unclear: Whether html-to-image handles the current Phase 4 CSS (object-fit: cover, isolation: isolate on LeafNode, flex layout) without artifacts
   - Recommendation: Validate at the Phase 4 verify step. CLAUDE.md §Open Questions already documents the fallback: if artifacts appear, swap to `modern-screenshot@^4.6.8` as an API-compatible replacement. No preemptive action needed for Phase 4 planning.

---

## Environment Availability

Step 2.6: SKIPPED (Phase 4 is code-only; all dependencies are already installed in node_modules; no external services, CLI tools, or databases required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | vite.config.ts (integrated; `/// <reference types="vitest" />`) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPO-01 | ExportSurface mounts with correct position/size styles | unit | `npx vitest run src/test/export-surface.test.tsx -t "EXPO-01"` | ❌ Wave 0 |
| EXPO-02 | exportGrid() calls the capture function twice; first result discarded | unit | `npx vitest run src/test/export.test.ts -t "EXPO-02"` | ❌ Wave 0 |
| EXPO-03 | Export blocked when a leaf with a video mediaId exists | unit | `npx vitest run src/test/export.test.ts -t "EXPO-03"` | ❌ Wave 0 |
| EXPO-04 | Filename is `storygrid-{timestamp}.png` / `.jpg`; anchor download triggered | unit | `npx vitest run src/test/export.test.ts -t "EXPO-04"` | ❌ Wave 0 |
| EXPO-05 | JPEG export passes `quality` option; PNG export does not | unit | `npx vitest run src/test/export.test.ts -t "EXPO-05"` | ❌ Wave 0 |
| EXPO-06 | Toast lifecycle: "Preparing" shown before first call, "Exporting" before second, dismissed on success, error toast on failure | unit | `npx vitest run src/test/export-split-button.test.tsx -t "EXPO-06"` | ❌ Wave 0 |
| EXPO-07 | ExportSurface always present in DOM regardless of isExporting state | unit | `npx vitest run src/test/export-surface.test.tsx -t "EXPO-07"` | ❌ Wave 0 |

**Note on html-to-image mocking:** html-to-image calls are not testable in jsdom (no real browser rendering). All tests for the export logic must mock `toPng` and `toJpeg` from `html-to-image` using `vi.mock('html-to-image', ...)`. Tests verify call counts, arguments, and the orchestration flow — not actual pixel output.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/export.test.ts` — covers EXPO-02, EXPO-03, EXPO-04, EXPO-05 (pure logic: exportGrid fn, video guard, filename, download)
- [ ] `src/test/export-surface.test.tsx` — covers EXPO-01, EXPO-07 (ExportSurface DOM structure and always-mounted behavior)
- [ ] `src/test/export-split-button.test.tsx` — covers EXPO-06 (toast lifecycle, button disabled during export, split button segments)

---

## Sources

### Primary (HIGH confidence)
- `node_modules/html-to-image/README.md` — API: `toPng`, `toJpeg`, `quality` option, `filter` option, `pixelRatio` option, `width`/`height` options, React usage pattern — verified from installed package
- `src/store/editorStore.ts` — Existing store shape; confirmed no isExporting/format/quality fields yet
- `src/Grid/LeafNode.tsx` — Confirmed interactive UI elements to suppress: ActionBar, hover dim overlay, selection ring, drag events
- `src/Grid/ContainerNode.tsx` — Confirmed Divider is direct child — must be suppressed in export mode
- `src/Grid/CanvasWrapper.tsx` — Confirmed `transform: scale(finalScale)` exists; ExportSurface must be sibling outside this tree
- `src/Editor/EditorShell.tsx` — Confirmed structure; ExportSurface placement point identified
- `src/Editor/Toolbar.tsx` — Confirmed Export button is a placeholder at `onClick={() => {}}`; ready for replacement

### Secondary (MEDIUM confidence)
- CLAUDE.md §Rationale and Gotchas §html-to-image — blank-PNG double-call workaround documented (project-level decision, internally consistent)
- CONTEXT.md D-14/D-15 — Double-call toast mapping locked by user discussion

### Tertiary (LOW confidence — not needed; all answers found in project sources)
- None required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; API verified from node_modules
- Architecture: HIGH — ExportSurface placement and context pattern are standard React; verified against existing component tree
- Pitfalls: HIGH — double-call workaround confirmed in CLAUDE.md; CSS transform pitfall derived from CanvasWrapper code inspection; remaining pitfalls are standard React/async patterns
- Test strategy: HIGH — existing test infrastructure (Vitest + jsdom + RTL) confirmed working from prior phases; mocking pattern for html-to-image is straightforward vi.mock

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries; no fast-moving dependencies in this phase)
