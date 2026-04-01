export type SplitDirection = 'horizontal' | 'vertical';

export type MediaItem = {
  mediaId: string;
};

export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;    // percentage offset -100 to +100, default 0
  panY: number;    // percentage offset -100 to +100, default 0
  panScale: number; // 1.0-3.0, default 1
};

export type ContainerNode = {
  type: 'container';
  id: string;
  direction: SplitDirection;
  sizes: number[];
  children: GridNode[];
};

export type GridNode = ContainerNode | LeafNode;
