import { describe, it } from 'vitest';

describe('GridNode dispatcher (REND-01)', () => {
  it.todo('renders ContainerNode for container type nodes');
  it.todo('renders LeafNode for leaf type nodes');
  it.todo('is wrapped in React.memo');
});

describe('ContainerNode flex layout (REND-02)', () => {
  it.todo('renders flex-row for horizontal direction');
  it.todo('renders flex-col for vertical direction');
  it.todo('applies flex: {size} to each child wrapper');
  it.todo('renders Divider between each pair of siblings');
});

describe('LeafNode empty state (REND-04)', () => {
  it.todo('renders dashed border with upload prompt text');
  it.todo('renders upload icon centered in cell');
  it.todo('shows "Drop image or click to upload" text');
});

describe('LeafNode media state (REND-05)', () => {
  it.todo('renders img element with object-fit: cover by default');
  it.todo('renders img element with object-fit: contain when leaf.fit is contain');
  it.todo('applies objectPosition from leaf.objectPosition');
});

describe('LeafNode selection and action bar (REND-06)', () => {
  it.todo('shows blue ring-2 border when selected');
  it.todo('shows no selection border when not selected');
  it.todo('reveals action bar on hover');
  it.todo('action bar has Split H, Split V, Remove, Toggle Fit buttons');
});

describe('SafeZoneOverlay (REND-08)', () => {
  it.todo('renders dashed lines at safe zone positions');
  it.todo('has pointer-events: none so clicks pass through');
  it.todo('is only rendered when showSafeZone is true');
});

describe('Per-node memo and selectors (REND-09)', () => {
  it.todo('GridNodeComponent is React.memo wrapped');
  it.todo('ContainerNode is React.memo wrapped');
  it.todo('LeafNode is React.memo wrapped');
  it.todo('LeafNode subscribes only to its own node slice');
});

describe('Safari isolation fix (REND-10)', () => {
  it.todo('LeafNode wrapper has isolation: isolate (Tailwind isolate class)');
});
