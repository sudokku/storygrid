import React, { useState, useCallback } from 'react';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';
import type { LeafNode } from '../types';
import { ImageIcon } from 'lucide-react';
import { ActionBar } from './ActionBar';

interface LeafNodeProps {
  id: string;
}

export const LeafNodeComponent = React.memo(function LeafNodeComponent({ id }: LeafNodeProps) {
  const node = useGridStore(state => findNode(state.root, id) as LeafNode | null);
  const mediaUrl = useGridStore(state => {
    const n = findNode(state.root, id) as LeafNode | null;
    return n?.mediaId ? state.mediaRegistry[n.mediaId] ?? null : null;
  });
  const isSelected = useEditorStore(s => s.selectedNodeId === id);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);
  const [isHovered, setIsHovered] = useState(false);

  if (!node || node.type !== 'leaf') return null;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // D-12: toggle selection — click already-selected deselects
    setSelectedNode(isSelected ? null : id);
  }, [id, isSelected, setSelectedNode]);

  return (
    <div
      className={`
        relative w-full h-full isolate overflow-hidden
        ${isSelected
          ? 'ring-2 ring-[#3b82f6] ring-inset'
          : !mediaUrl ? 'border border-dashed border-[#333333]' : ''
        }
        bg-[#1c1c1c]
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`leaf-${id}`}
      aria-selected={isSelected}
      role="gridcell"
    >
      {mediaUrl ? (
        <img
          src={mediaUrl}
          className={`w-full h-full ${node.fit === 'cover' ? 'object-cover' : 'object-contain'}`}
          style={{ objectPosition: node.objectPosition ?? 'center center' }}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2">
          <ImageIcon size={24} className="text-[#666666]" />
          <span className="text-sm text-[#666666]">Drop image or click to upload</span>
        </div>
      )}
      {/* Dim overlay on hover when filled */}
      {mediaUrl && isHovered && (
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      )}
      {/* ActionBar: visible on hover with 150ms fade (D-06) */}
      <div
        className={`
          absolute top-2 left-1/2 -translate-x-1/2 z-20
          transition-opacity duration-150
          ${isHovered ? 'opacity-100 delay-150' : 'opacity-0 pointer-events-none'}
        `}
      >
        <ActionBar nodeId={id} fit={node.fit} />
      </div>
    </div>
  );
});
