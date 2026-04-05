// ---------------------------------------------------------------------------
// videoRegistry — Global registry for video DOM elements and draw functions
//
// Not in Zustand: holds mutable DOM references that are not serializable.
// LeafNode components register on mount and unregister on unmount.
// ---------------------------------------------------------------------------

/** Maps nodeId -> HTMLVideoElement for playback sync and canvas drawing */
export const videoElementRegistry = new Map<string, HTMLVideoElement>();

/** Maps nodeId -> draw function that repaints the per-cell canvas */
export const videoDrawRegistry = new Map<string, () => void>();

/**
 * Register a video element and its associated canvas draw function.
 * Called from the LeafNode component when it mounts with a video mediaId.
 */
export function registerVideo(
  nodeId: string,
  video: HTMLVideoElement,
  draw: () => void,
): void {
  videoElementRegistry.set(nodeId, video);
  videoDrawRegistry.set(nodeId, draw);
}

/**
 * Unregister a video element and its draw function.
 * Called from the LeafNode component on unmount or when media changes.
 */
export function unregisterVideo(nodeId: string): void {
  videoElementRegistry.delete(nodeId);
  videoDrawRegistry.delete(nodeId);
}
