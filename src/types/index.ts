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
};

export type ContainerNode = {
  type: 'container';
  id: string;
  direction: SplitDirection;
  sizes: number[];
  children: GridNode[];
};

export type GridNode = ContainerNode | LeafNode;
