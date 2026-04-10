---
phase: quick-260410-obm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - src/lib/transcodeToMp4.ts
  - src/lib/videoExport.ts
  - src/Editor/Toast.tsx
  - src/Editor/ExportSplitButton.tsx
autonomous: true
requirements: [QUICK-OBM]

must_haves:
  truths:
    - "MediaRecorder only attempts WebM MIME types (no video/mp4 variants)"
    - "After MediaRecorder produces a WebM blob, ffmpeg.wasm transcodes it to H.264 MP4"
    - "Exported MP4 has moov atom at front (faststart) and opens in macOS QuickTime Player"
    - "Toast shows 'Transcoding' stage with progress after encoding completes"
    - "Downloaded file is always .mp4 regardless of browser"
    - "mediabunny is not in package.json dependencies"
  artifacts:
    - path: "src/lib/transcodeToMp4.ts"
      provides: "ffmpeg.wasm lazy-load + WebM-to-MP4 transcode function"
      exports: ["transcodeWebmToMp4"]
    - path: "src/lib/videoExport.ts"
      provides: "WebM-only MediaRecorder + transcoding integration"
    - path: "src/Editor/Toast.tsx"
      provides: "transcoding toast state"
      contains: "transcoding"
    - path: "src/Editor/ExportSplitButton.tsx"
      provides: "transcoding progress callback + always-.mp4 download"
  key_links:
    - from: "src/lib/videoExport.ts"
      to: "src/lib/transcodeToMp4.ts"
      via: "import transcodeWebmToMp4"
      pattern: "transcodeWebmToMp4"
    - from: "src/Editor/ExportSplitButton.tsx"
      to: "src/Editor/Toast.tsx"
      via: "ToastState includes transcoding"
      pattern: "transcoding"
    - from: "src/lib/transcodeToMp4.ts"
      to: "@ffmpeg/ffmpeg + @ffmpeg/util"
      via: "dynamic import and CDN core load"
      pattern: "FFmpeg|fetchFile"
---

<objective>
Replace MediaRecorder MP4 codec variants with WebM-only, then pipe the WebM blob through ffmpeg.wasm to produce a QuickTime-compatible flat MP4 with moov atom at front. Remove the unused mediabunny dependency.

Purpose: MediaRecorder with video/mp4 produces fragmented MP4 (no moov atom) which macOS QuickTime cannot open. WebM recording + ffmpeg.wasm transcode to H.264 MP4 with -movflags +faststart produces a universally compatible file.

Output: Working WebM-to-MP4 pipeline, new transcodeToMp4.ts module, updated progress UI with transcoding stage, mediabunny removed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/videoExport.ts
@src/lib/export.ts
@src/Editor/Toast.tsx
@src/Editor/ExportSplitButton.tsx
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove mediabunny, create transcodeToMp4.ts with ffmpeg.wasm lazy-load and transcode</name>
  <files>package.json, src/lib/transcodeToMp4.ts</files>
  <action>
**Step 1: Remove mediabunny from package.json.**
Run `npm uninstall mediabunny` to remove it from dependencies and package-lock.json.

**Step 2: Create `src/lib/transcodeToMp4.ts`** with the following implementation:

```typescript
// transcodeToMp4.ts — Lazy-load ffmpeg.wasm and transcode WebM to QuickTime-compatible MP4

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Singleton ffmpeg instance — cached after first load.
let ffmpegInstance: FFmpeg | null = null;

/**
 * Get or create the singleton FFmpeg instance.
 * Loads @ffmpeg/core from unpkg CDN (single-threaded, no COOP/COEP required).
 */
async function getFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Transcode a WebM blob to a QuickTime-compatible H.264 MP4.
 *
 * Uses:
 *   -c:v libx264   — H.264 video codec
 *   -preset fast    — good speed/quality balance
 *   -crf 23         — constant quality factor
 *   -r 30           — explicit 30fps (known constant from MediaRecorder)
 *   -pix_fmt yuv420p — required for QuickTime + iOS compatibility
 *   -movflags +faststart — moov atom at front (the actual QuickTime fix)
 *   -c:a aac        — AAC audio codec
 *   -b:a 192k       — audio bitrate
 *
 * @param webmBlob - The WebM blob from MediaRecorder
 * @param onProgress - Progress callback (0-100)
 * @returns MP4 Blob with correct moov placement
 */
export async function transcodeWebmToMp4(
  webmBlob: Blob,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // Write input WebM to ffmpeg virtual filesystem.
  const inputData = await fetchFile(webmBlob);
  await ffmpeg.writeFile('input.webm', inputData);

  // Set up progress handler if provided.
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      // progress is 0.0-1.0
      onProgress(Math.min(99, Math.round(progress * 100)));
    });
  }

  // Transcode WebM to MP4 with QuickTime-compatible settings.
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '192k',
    'output.mp4',
  ]);

  // Read output MP4 from virtual filesystem.
  const outputData = await ffmpeg.readFile('output.mp4');

  // Clean up virtual filesystem.
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');

  // Convert Uint8Array to Blob.
  return new Blob([outputData], { type: 'video/mp4' });
}
```

Key design points:
- Singleton pattern: ffmpeg instance is created once and reused across exports.
- CDN loading: @ffmpeg/core loaded from unpkg at runtime (not bundled). Single-threaded core — no SharedArrayBuffer / COOP/COEP headers needed.
- Progress: ffmpeg emits progress events (0.0-1.0) which map to percent for the UI.
- Cleanup: input/output files deleted from the virtual FS after each transcode.
  </action>
  <verify>
    <automated>node -e "const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8')); if (pkg.dependencies.mediabunny) { console.error('mediabunny still in deps'); process.exit(1); } if (!pkg.dependencies['@ffmpeg/ffmpeg']) { console.error('ffmpeg missing'); process.exit(1); } console.log('OK: mediabunny removed, ffmpeg present');" && test -f src/lib/transcodeToMp4.ts && echo "transcodeToMp4.ts exists"</automated>
  </verify>
  <done>mediabunny removed from package.json. src/lib/transcodeToMp4.ts exists with transcodeWebmToMp4 export that lazy-loads ffmpeg.wasm from CDN and transcodes WebM to H.264 MP4 with -movflags +faststart.</done>
</task>

<task type="auto">
  <name>Task 2: Update videoExport.ts to WebM-only and integrate transcoding, update Toast and ExportSplitButton</name>
  <files>src/lib/videoExport.ts, src/Editor/Toast.tsx, src/Editor/ExportSplitButton.tsx</files>
  <action>
**Step 1: Update `src/lib/videoExport.ts`:**

1. **Add import** at top of file:
   ```typescript
   import { transcodeWebmToMp4 } from './transcodeToMp4';
   ```

2. **Update onProgress type** in the `exportVideoGrid` function signature. Change:
   ```typescript
   onProgress: (stage: 'preparing' | 'encoding', percent?: number) => void,
   ```
   to:
   ```typescript
   onProgress: (stage: 'preparing' | 'encoding' | 'transcoding', percent?: number) => void,
   ```

3. **Replace the mimeTypes array** (lines 274-280). Remove ALL mp4 variants. New array:
   ```typescript
   const mimeTypes = [
     'video/webm;codecs=vp9',
     'video/webm;codecs=vp8',
     'video/webm',
   ];
   ```

4. **Update the error message** (lines 289-292) to only mention WebM:
   ```typescript
   throw new Error(
     'Video export requires a browser that supports MediaRecorder with WebM. ' +
     'Use Chrome 51+ or Firefox 43+.',
   );
   ```

5. **After the recorder.onstop resolves the blob, add the transcoding step.** The current `recorder.onstop` directly resolves with the blob. Change the Promise body so that `recorder.onstop` triggers transcoding before resolving:

   In the `recorder.onstop` handler, instead of:
   ```typescript
   const blob = new Blob(chunks, { type: selectedMimeType });
   resolve(blob);
   ```
   
   Change to:
   ```typescript
   const webmBlob = new Blob(chunks, { type: selectedMimeType });
   // Transcode WebM to QuickTime-compatible MP4 via ffmpeg.wasm.
   onProgress('transcoding', 0);
   transcodeWebmToMp4(webmBlob, (percent) => {
     onProgress('transcoding', percent);
   })
     .then((mp4Blob) => {
       onProgress('transcoding', 100);
       resolve(mp4Blob);
     })
     .catch((err) => {
       reject(new Error(`Transcode failed: ${err instanceof Error ? err.message : String(err)}`));
     });
   ```

6. **Update the comment block** at the top of `exportVideoGrid` (the architecture docs around lines 224-262). Update:
   - Remove references to "MP4 (Chrome 130+)" from the OUTPUT FORMAT section.
   - Change output format docs to say WebM only, then transcoded to MP4 via ffmpeg.wasm.
   - Add step 8.5: "recorder.onstop → WebM Blob → transcodeWebmToMp4 → MP4 Blob → return to caller."

**Step 2: Update `src/Editor/Toast.tsx`:**

1. Add `'transcoding'` to the `ToastState` type:
   ```typescript
   export type ToastState = 'preparing' | 'exporting' | 'error' | 'encoding' | 'transcoding' | null;
   ```

2. Add a new rendering block for the `'transcoding'` state, after the `'encoding'` block:
   ```tsx
   if (state === 'transcoding') {
     return (
       <div className={containerClass} role="status">
         <Loader2 size={14} className="animate-spin text-neutral-400" />
         <span>Transcoding {encodingPercent ?? 0}%...</span>
       </div>
     );
   }
   ```

**Step 3: Update `src/Editor/ExportSplitButton.tsx`:**

1. **Update the onProgress callback** in the video export path (around line 109). Add handling for the 'transcoding' stage:
   ```typescript
   (stage, percent) => {
     if (stage === 'preparing') {
       setToastState('preparing');
     } else if (stage === 'transcoding') {
       setToastState('transcoding');
       if (percent !== undefined) setEncodingPercent(percent);
     } else {
       setToastState('encoding');
       if (percent !== undefined) setEncodingPercent(percent);
     }
   },
   ```

2. **Change the download extension** to always be 'mp4'. Replace:
   ```typescript
   const ext = blob.type.startsWith('video/mp4') ? 'mp4' : 'webm';
   ```
   with:
   ```typescript
   const ext = 'mp4';
   ```

3. **Update the popover description text** (line 219). Change:
   ```
   Exports as MP4 (H.264) or WebM (VP9)
   ```
   to:
   ```
   Exports as MP4 (H.264)
   ```

4. Add `mediaTypeMap` to the `useCallback` dependency array if not already present (it is already there — verify, do not duplicate).
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- videoExport.ts mimeTypes array contains ONLY webm variants (no video/mp4 entries)
- videoExport.ts imports and calls transcodeWebmToMp4 after MediaRecorder stops
- onProgress type includes 'transcoding' stage
- Toast.tsx shows "Transcoding N%..." for the transcoding state
- ExportSplitButton.tsx handles 'transcoding' stage in progress callback
- ExportSplitButton.tsx always downloads as .mp4
- Popover says "Exports as MP4 (H.264)" (no WebM mention)
- TypeScript compiles without errors
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CDN -> ffmpeg.wasm | Loading WASM binary from unpkg CDN |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-obm-01 | Tampering | ffmpeg-core CDN load | accept | unpkg mirrors npm registry; pinned to exact version 0.12.6; no secrets processed by ffmpeg; risk is supply-chain — same as any CDN dependency |
| T-obm-02 | Denial of Service | ffmpeg transcode OOM | accept | Single-threaded core limits memory; 1080x1920 30fps WebM is bounded input; user initiates export voluntarily |
</threat_model>

<verification>
1. `npm run build` completes without errors
2. `npx tsc --noEmit` passes
3. `grep -c "video/mp4" src/lib/videoExport.ts` returns 0
4. `grep "mediabunny" package.json` returns nothing
5. `grep "transcoding" src/Editor/Toast.tsx` finds the transcoding state
6. Manual: Export a video composition in Chrome — observe toast sequence: Preparing -> Encoding N% -> Transcoding N% -> file downloads as .mp4
7. Manual: Open the downloaded .mp4 in macOS QuickTime Player — it plays without error
</verification>

<success_criteria>
- mediabunny fully removed from package.json and package-lock.json
- MediaRecorder tries ONLY webm codecs (vp9, vp8, webm) — zero mp4 mime types
- After recording, WebM blob is transcoded to MP4 via ffmpeg.wasm with -movflags +faststart
- Toast UI shows three stages: Preparing -> Encoding -> Transcoding
- Downloaded file is always .mp4
- TypeScript compiles cleanly, build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/260410-obm-webm-mediarecorder-ffmpeg-transcode-to-q/260410-obm-SUMMARY.md`
</output>
