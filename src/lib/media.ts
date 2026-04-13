import { nanoid } from 'nanoid';
import type { GridNode } from '../types';
import { getBFSLeavesWithDepth } from './tree';

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
 * Detects whether a video file contains an audio track by attempting
 * to decode its audio data via AudioContext.
 *
 * Returns true if audio channels are detected, false if none.
 * On any error (no AudioContext, unsupported codec, no audio stream),
 * returns true (fail-open per D-05) — a false positive is better
 * than locking the toggle on a video that actually has audio.
 */
export async function detectAudioTrack(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      return audioBuffer.numberOfChannels > 0;
    } finally {
      await ctx.close();
    }
  } catch {
    return true;
  }
}

/**
 * Fills empty cells with files in BFS (breadth-first) order.
 * Per D-13: level-by-level fill via getBFSLeavesWithDepth.
 * Per D-14 (revised): overflow splits use overflowCount % 2 for direction
 *   (even=horizontal, odd=vertical). overflowCount reliably alternates
 *   regardless of which splitNode case (A or B) is triggered — unlike the
 *   previous depth-based approach which failed when Case B kept depth constant.
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

  let lastFilledNodeId: string | null = null;
  let overflowCount = 0;

  for (const file of mediaFiles) {
    // Re-read root each iteration to get fresh tree after splits
    const currentRoot = actions.getRoot();
    const bfsLeaves = getBFSLeavesWithDepth(currentRoot);
    const emptyEntry = bfsLeaves.find(e => e.leaf.mediaId === null);

    let targetNodeId: string;

    if (emptyEntry) {
      targetNodeId = emptyEntry.leaf.id;
    } else if (lastFilledNodeId !== null) {
      // D-14 (revised): overflow split direction based on overflowCount
      const splitDir = overflowCount % 2 === 0 ? 'horizontal' : 'vertical';
      actions.split(lastFilledNodeId, splitDir);
      overflowCount++;
      const freshLeaves = getBFSLeavesWithDepth(actions.getRoot());
      const newEmpty = freshLeaves.find(e => e.leaf.mediaId === null);
      if (!newEmpty) continue;
      targetNodeId = newEmpty.leaf.id;
    } else {
      // Edge case: single filled root leaf — no previous fill tracked
      const anyEntry = bfsLeaves[0];
      if (!anyEntry) continue;
      const splitDir = overflowCount % 2 === 0 ? 'horizontal' : 'vertical';
      actions.split(anyEntry.leaf.id, splitDir);
      overflowCount++;
      const freshLeaves = getBFSLeavesWithDepth(actions.getRoot());
      const newEmpty = freshLeaves.find(e => e.leaf.mediaId === null);
      if (!newEmpty) continue;
      targetNodeId = newEmpty.leaf.id;
    }

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

    actions.setMedia(targetNodeId, mediaId);

    // D-15: Audio detection — video files get detected, images are always false
    const hasAudio = file.type.startsWith('video/')
      ? await detectAudioTrack(file)
      : false;
    actions.setHasAudioTrack(targetNodeId, hasAudio);

    lastFilledNodeId = targetNodeId;
  }
}
