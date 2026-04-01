import React from 'react';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import { ContainerNodeComponent } from './ContainerNode';
import { LeafNodeComponent } from './LeafNode';

interface GridNodeProps {
  id: string;
}

export const GridNodeComponent = React.memo(function GridNodeComponent({ id }: GridNodeProps) {
  const nodeType = useGridStore(state => findNode(state.root, id)?.type);
  if (nodeType === 'container') return <ContainerNodeComponent id={id} />;
  if (nodeType === 'leaf') return <LeafNodeComponent id={id} />;
  return null;
});
