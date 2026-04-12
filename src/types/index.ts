import type { EffectSettings } from '../lib/effects';

export type SplitDirection = 'horizontal' | 'vertical';

export type MediaItem = {
  mediaId: string;
};

export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition: string;
  backgroundColor: string | null;
  panX: number;    // percentage offset -100 to +100, default 0
  panY: number;    // percentage offset -100 to +100, default 0
  panScale: number; // 1.0-3.0, default 1
  effects: EffectSettings;
  audioEnabled: boolean;
  hasAudioTrack: boolean;
};

export type ContainerNode = {
  type: 'container';
  id: string;
  direction: SplitDirection;
  sizes: number[];
  children: GridNode[];
};

export type GridNode = ContainerNode | LeafNode;

// ---------------------------------------------------------------------------
// Phase 13 Overlay types
// ---------------------------------------------------------------------------
// NOTE: x and y are VISUAL CENTER coordinates in canvas pixel space (0–1080 / 0–1920).
// This matches the DOM translate(-50%,-50%) wrapper in OverlayLayer (Plan 02) and
// the center-to-top-left conversion in Plan 03's drawOverlaysToCanvas.
// All overlay `x`, `y`, `width` are in canvas pixel space (D-08).

export type OverlayBase = {
  id: string;
  x: number;        // canvas pixel space 0–1080; VISUAL CENTER (matches DOM translate(-50%,-50%))
  y: number;        // canvas pixel space 0–1920; VISUAL CENTER
  width: number;    // canvas pixel space
  rotation: number; // degrees, 0 = no rotation
  zIndex: number;
};

export type TextOverlay = OverlayBase & {
  type: 'text';
  content: string;
  fontFamily: string;         // 'Geist' | 'Playfair Display' | 'Dancing Script'
  fontSize: number;           // 16..256 canvas px
  color: string;              // hex (#rrggbb)
  fontWeight: 'regular' | 'bold';
  textAlign: 'left' | 'center' | 'right';
};

export type EmojiOverlay = OverlayBase & {
  type: 'emoji';
  char: string;               // raw Unicode emoji
};

export type StickerOverlay = OverlayBase & {
  type: 'sticker';
  stickerRegistryId: string;  // key into overlayStore.stickerRegistry
};

export type Overlay = TextOverlay | EmojiOverlay | StickerOverlay;
