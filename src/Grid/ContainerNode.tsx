import React, { useRef, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import type { ContainerNode } from '../types';
import { GridNodeComponent } from './GridNode';
import { Divider } from './Divider';

interface ContainerNodeProps {
  id: string;
}

export const ContainerNodeComponent = React.memo(function ContainerNodeComponent({ id }: ContainerNodeProps) {
  const node = useGridStore(state => findNode(state.root, id) as ContainerNode | null);
  const gap = useEditorStore(s => s.gap);
  const containerRef = useRef<HTMLDivElement>(null);
  const [localSizes, setLocalSizes] = useState<number[] | null>(null);

  if (!node || node.type !== 'container') return null;

  const activeSizes = localSizes ?? node.sizes;

  const halfGap = gap / 2;
  const isVertical = node.direction === 'vertical';

  return (
    <div
      ref={containerRef}
      className={`flex ${node.direction === 'horizontal' ? 'flex-row' : 'flex-col'} w-full h-full`}
      data-testid={`container-${id}`}
    >
      {node.children.map((child, i) => (
        <React.Fragment key={child.id}>
          <div
            className="min-h-0 min-w-0"
            style={{
              flex: activeSizes[i],
              ...(isVertical
                ? {
                    marginTop: i > 0 ? halfGap : 0,
                    marginBottom: i < node.children.length - 1 ? halfGap : 0,
                  }
                : {
                    marginLeft: i > 0 ? halfGap : 0,
                    marginRight: i < node.children.length - 1 ? halfGap : 0,
                  }),
            }}
          >
            <GridNodeComponent id={child.id} />
          </div>
          {i < node.children.length - 1 && (
            <Divider
              containerId={id}
              siblingIndex={i}
              direction={node.direction}
              sizes={activeSizes}
              containerRef={containerRef}
              onLocalSizesChange={setLocalSizes}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
});
