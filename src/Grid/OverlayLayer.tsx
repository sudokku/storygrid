import React, { useEffect, useState } from 'react';
import { useOverlayStore } from '../store/overlayStore';
import { useEditorStore } from '../store/editorStore';
import { OverlayHandles } from '../Editor/OverlayHandles';
import { InlineTextEditor } from '../Editor/InlineTextEditor';
import type { Overlay, TextOverlay } from '../types';

export function OverlayLayer() {
  const overlays = useOverlayStore(state => state.overlays);
  const stickerRegistry = useOverlayStore(state => state.stickerRegistry);
  const deleteOverlay = useOverlayStore(state => state.deleteOverlay);
  const selectedOverlayId = useEditorStore(state => state.selectedOverlayId);
  const setSelectedOverlayId = useEditorStore(state => state.setSelectedOverlayId);
  const canvasScale = useEditorStore(state => state.canvasScale);
  const updateOverlay = useOverlayStore(state => state.updateOverlay);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);

  // Exit edit mode when the selected overlay changes (e.g. user clicks another overlay)
  useEffect(() => {
    setEditingOverlayId(null);
  }, [selectedOverlayId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedOverlayId === null) return;

      // Security guard (T-13-04): do not delete overlay when focus is inside
      // an input/textarea/contenteditable — user is editing sidebar text.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      deleteOverlay(selectedOverlayId);
      setSelectedOverlayId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOverlayId, deleteOverlay, setSelectedOverlayId]);

  const sorted = [...overlays].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      {sorted.map((overlay: Overlay) => {
        const isSelected = overlay.id === selectedOverlayId;

        return (
          <div
            key={overlay.id}
            data-testid={`overlay-${overlay.id}`}
            style={{
              position: 'absolute',
              left: overlay.x,
              top: overlay.y,
              width: overlay.width,
              transformOrigin: 'center center',
              transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
              pointerEvents: 'auto',
              cursor: 'move',
            }}
            onPointerDown={(e) => {
              setSelectedOverlayId(overlay.id);
              e.stopPropagation();
            }}
            onDoubleClick={() => {
              if (overlay.type === 'text') {
                setEditingOverlayId(overlay.id);
              }
            }}
          >
            {overlay.type === 'text' && (
              <>
                <div
                  style={{
                    fontFamily: overlay.fontFamily,
                    fontSize: overlay.fontSize,
                    color: overlay.color,
                    fontWeight: overlay.fontWeight === 'bold' ? 700 : 400,
                    textAlign: overlay.textAlign,
                    whiteSpace: 'pre-wrap',
                    userSelect: 'none',
                    visibility: editingOverlayId === overlay.id ? 'hidden' : 'visible',
                  }}
                >
                  {overlay.content}
                </div>
                {editingOverlayId === overlay.id && (
                  <InlineTextEditor
                    overlay={overlay as TextOverlay}
                    onCommit={(newContent) => {
                      updateOverlay(overlay.id, { content: newContent });
                      setEditingOverlayId(null);
                    }}
                    onCancel={() => setEditingOverlayId(null)}
                  />
                )}
              </>
            )}
            {overlay.type === 'emoji' && (
              <span style={{ fontSize: overlay.width }}>
                {overlay.char}
              </span>
            )}
            {overlay.type === 'sticker' && stickerRegistry[overlay.stickerRegistryId] && (
              <img
                src={stickerRegistry[overlay.stickerRegistryId]}
                style={{ width: overlay.width, height: 'auto', display: 'block' }}
                draggable={false}
                alt=""
              />
            )}
            {isSelected && (
              <OverlayHandles
                overlay={overlay}
                canvasScale={canvasScale}
                onUpdate={(u) => updateOverlay(overlay.id, u)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
