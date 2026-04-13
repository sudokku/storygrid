import { nanoid } from 'nanoid';
import type { GridNode } from '../types';
import { getBFSLeavesWithDepth, getParentDirection } from './tree';

/**
 * Converts a File to a base64 data URI using FileReader.
 * Per MEDI-03: NEVER use URL.createObjectURL — must be base64.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Actions subset required by autoFillCells. Accepts the gridStore actions.
 */
export type FillActions = {
  addMedia: (mediaId: string, dataUri: string, type?: 'image' | 'video') => void;
  setMedia: (nodeId: string, mediaId: string) => void;
  split: (nodeId: string, direction: 'horizontal' | 'vertical') => void;
  getRoot: () => GridNode;
  setHasAudioTrack: (nodeId: string, hasAudio: boolean) => void;
};

/**
 * Detects whether a video file contains an audio track using HTMLVideoElement.
 *
 * Uses the AudioTrackList API (Chrome/Safari) or mozHasAudio (Firefox) to
 * detect audio presence after loading video metadata. Falls open (returns true)
 * when detection fails, the video element errors, times out, or the browser
 * does not support either API.
 *
 * Returns true if audio is detected or detection is uncertain (fail-open).
 * Returns false only when the browser confirms no audio track is present.
 * A false positive is better than locking the toggle on a video that has audio.
 */
export async function detectAudioTrack(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';

    return await new Promise<boolean>((resolve) => {
      // 5-second timeout — fail-open if metadata never loads (T-19-gc-02)
      const timer = setTimeout(() => resolve(true), 5000);

      video.addEventListener('loadedmetadata', () => {
        clearTimeout(timer);
        const audioTracks = (video as unknown as { audioTracks?: { length: number } }).audioTracks;
        const mozHasAudio = (video as unknown as { mozHasAudio?: boolean }).mozHasAudio;

        if (audioTracks !== undefined) {
          // Chrome/Safari: AudioTrackList API available
          if (audioTracks.length > 0) {
            resolve(true);
          } else if (mozHasAudio === true) {
            // Belt-and-suspenders: Firefox also has audioTracks in newer versions
            resolve(true);
          } else {
            resolve(false);
          }
        } else if (mozHasAudio !== undefined) {
          // Firefox: mozHasAudio available, audioTracks not
          resolve(mozHasAudio === true);
        } else {
          // Neither API available — fail-open, browser doesn't support detection
          resolve(true);
        }
      });

      video.addEventListener('error', () => {
        clearTimeout(timer);
        resolve(true); // fail-open on video load error
      });

      video.src = url;
    });
  } catch {
    return true; // fail-open on any unexpected error
  } finally {
    URL.revokeObjectURL(url); // T-19-gc-01: always revoke blob URL
  }
}

/**
 * Fills cells with files using a two-phase BFS approach.
 *
 * Phase 1 — Pre-expand: Grow the tree until it has at least N empty leaves,
 *   using a FIFO queue seeded with all current leaves in BFS order. Each
 *   split uses the cross-direction of the parent (horizontal parent → vertical
 *   split, vertical parent → horizontal split) to force Case C in splitNode
 *   (wrap in new container). This prevents Case B (same-direction sibling
 *   append at the same depth) and ensures all splits descend uniformly,
 *   producing a balanced tree.
 *
 * Phase 2 — Fill: Assign media to empty leaves in BFS order (level-by-level,
 *   left-to-right) so all cells at the same depth are filled before going deeper.
 *
 * Per D-13: level-by-level fill via getBFSLeavesWithDepth.
 * Per D-15: audio detection runs for video files; images are always false.
 */
export async function autoFillCells(
  files: File[],
  actions: FillActions,
): Promise<void> {
  if (files.length === 0) return;

  // Accept image and video files; filter out anything else
  const mediaFiles = files.filter(
    f => f.type.startsWith('image/') || f.type.startsWith('video/'),
  );
  if (mediaFiles.length === 0) return;

  const N = mediaFiles.length;

  // Phase 1: Pre-expand the tree until there are at least N empty leaves.
  // FIFO queue ensures BFS-order expansion (all nodes at depth D before D+1).
  {
    const initialLeaves = getBFSLeavesWithDepth(actions.getRoot());
    const expandQueue: string[] = initialLeaves.map(e => e.leaf.id);

    while (true) {
      const emptyCount = getBFSLeavesWithDepth(actions.getRoot())
        .filter(e => e.leaf.mediaId === null).length;
      if (emptyCount >= N) break;

      const toSplitId = expandQueue.shift();
      if (!toSplitId) break;

      // Capture current leaf IDs so we can identify the newly created sibling
      const beforeIds = new Set(
        getBFSLeavesWithDepth(actions.getRoot()).map(e => e.leaf.id),
      );

      // Always use the cross-direction of the parent to force Case C (deeper
      // nesting). If there is no parent the leaf is root — use horizontal.
      const parentDir = getParentDirection(actions.getRoot(), toSplitId);
      const splitDir: 'horizontal' | 'vertical' =
        parentDir === 'horizontal' ? 'vertical' : 'horizontal';

      actions.split(toSplitId, splitDir);

      // Enqueue the original leaf (still exists, just moved deeper) and the
      // new sibling at the back of the queue. Both go to the end so all
      // current-level nodes are processed before descending another level.
      const newLeafId = getBFSLeavesWithDepth(actions.getRoot())
        .find(e => !beforeIds.has(e.leaf.id))?.leaf.id;
      expandQueue.push(toSplitId);
      if (newLeafId) expandQueue.push(newLeafId);
    }
  }

  // Phase 2: Fill empty leaves in BFS order (level-by-level, left-to-right).
  for (const file of mediaFiles) {
    const bfsLeaves = getBFSLeavesWithDepth(actions.getRoot());
    const emptyEntry = bfsLeaves.find(e => e.leaf.mediaId === null);
    if (!emptyEntry) break;

    const mediaId = nanoid();

    if (file.type.startsWith('video/')) {
      // D-01: Use blob URL for video (NOT base64 — videos are too large for data URIs)
      const blobUrl = URL.createObjectURL(file);
      actions.addMedia(mediaId, blobUrl, 'video');
    } else {
      // Image: convert to base64 data URI (per MEDI-03)
      const dataUri = await fileToBase64(file);
      actions.addMedia(mediaId, dataUri, 'image');
    }

    actions.setMedia(emptyEntry.leaf.id, mediaId);

    // D-15: Audio detection — video files get detected, images are always false
    const hasAudio = file.type.startsWith('video/')
      ? await detectAudioTrack(file)
      : false;
    actions.setHasAudioTrack(emptyEntry.leaf.id, hasAudio);
  }
}
