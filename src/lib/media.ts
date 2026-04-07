import { nanoid } from 'nanoid';
import type { GridNode } from '../types';
import { getAllLeaves } from './tree';

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
};

/**
 * Fills empty cells with files in getAllLeaves() document order.
 * Per D-04: fill existing empty cells first.
 * Per D-05: overflow files auto-split the last filled leaf (horizontal).
 * Per D-06: used by both action bar upload and canvas drag-drop.
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

  for (const file of mediaFiles) {
    // Re-read root each iteration to get fresh tree after splits
    const currentRoot = actions.getRoot();
    const leaves = getAllLeaves(currentRoot);
    const emptyLeaf = leaves.find(l => l.mediaId === null);

    let targetNodeId: string;

    if (emptyLeaf) {
      targetNodeId = emptyLeaf.id;
    } else if (lastFilledNodeId) {
      // D-05: split last filled cell horizontally; the new sibling will be empty
      actions.split(lastFilledNodeId, 'horizontal');
      // After split, re-read root and find the newly created empty sibling
      const freshRoot = actions.getRoot();
      const freshLeaves = getAllLeaves(freshRoot);
      const newEmpty = freshLeaves.find(l => l.mediaId === null);
      if (!newEmpty) continue; // should not happen
      targetNodeId = newEmpty.id;
    } else {
      // No empty cells and no previous fill — edge case: tree is a single filled leaf, split it
      const anyLeaf = leaves[0];
      if (!anyLeaf) continue;
      actions.split(anyLeaf.id, 'horizontal');
      const freshRoot = actions.getRoot();
      const freshLeaves = getAllLeaves(freshRoot);
      const newEmpty = freshLeaves.find(l => l.mediaId === null);
      if (!newEmpty) continue;
      targetNodeId = newEmpty.id;
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
    lastFilledNodeId = targetNodeId;
  }
}
