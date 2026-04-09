import { AlignLeft, AlignCenter, AlignRight, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useOverlayStore } from '../store/overlayStore';
import type { TextOverlay } from '../types';

// ---------------------------------------------------------------------------
// OverlayPanel
// ---------------------------------------------------------------------------
// Sidebar panel rendered when an overlay is selected. Shows type-discriminated
// controls: z-order and delete for all overlays; text-specific controls for
// TextOverlay only.

export function OverlayPanel() {
  const selectedOverlayId = useEditorStore(s => s.selectedOverlayId);
  const overlay = useOverlayStore(s =>
    s.overlays.find(o => o.id === selectedOverlayId) ?? null,
  );

  if (overlay === null) return null;

  const { updateOverlay, deleteOverlay, bringForward, sendBackward } =
    useOverlayStore.getState();

  const handleDelete = () => {
    deleteOverlay(overlay.id);
    useEditorStore.getState().setSelectedOverlayId(null);
  };

  const isText = overlay.type === 'text';
  const textOverlay = isText ? (overlay as TextOverlay) : null;

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        Overlay
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Text-specific controls                                              */}
      {/* ------------------------------------------------------------------ */}
      {isText && textOverlay && (
        <>
          {/* Content */}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Content</label>
            <textarea
              value={textOverlay.content}
              onChange={e => updateOverlay(overlay.id, { content: e.target.value })}
              rows={3}
              className="w-full px-2 py-1.5 rounded text-xs bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-200 resize-none focus:outline-none focus:border-[#3b82f6]"
              aria-label="Overlay content"
            />
          </div>

          {/* Font family */}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Font</label>
            <select
              value={textOverlay.fontFamily}
              onChange={e => updateOverlay(overlay.id, { fontFamily: e.target.value })}
              className="w-full px-2 py-1.5 rounded text-xs bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-200 focus:outline-none focus:border-[#3b82f6]"
              aria-label="Font family"
            >
              <option value="Geist" style={{ fontFamily: 'Geist' }}>Geist</option>
              <option value="Playfair Display" style={{ fontFamily: '"Playfair Display"' }}>
                Playfair Display
              </option>
              <option value="Dancing Script" style={{ fontFamily: '"Dancing Script"' }}>
                Dancing Script
              </option>
            </select>
          </div>

          {/* Font size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-neutral-400">Size</label>
              <span className="text-xs text-neutral-400 font-mono">{textOverlay.fontSize}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={256}
              step={1}
              value={textOverlay.fontSize}
              onChange={e => updateOverlay(overlay.id, { fontSize: Number(e.target.value) })}
              className="w-full accent-[#3b82f6]"
              aria-label="Font size"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Color</label>
            <input
              type="color"
              value={textOverlay.color}
              onChange={e => updateOverlay(overlay.id, { color: e.target.value })}
              className="w-full h-8 rounded border border-[#2a2a2a] cursor-pointer bg-transparent"
              aria-label="Text color"
            />
          </div>

          {/* Font weight toggle */}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Weight</label>
            <div className="flex rounded overflow-hidden border border-[#2a2a2a]">
              <button
                className={`flex-1 py-1.5 text-xs transition-colors ${
                  textOverlay.fontWeight === 'regular'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'
                }`}
                onClick={() => updateOverlay(overlay.id, { fontWeight: 'regular' })}
              >
                Regular
              </button>
              <button
                className={`flex-1 py-1.5 text-xs transition-colors font-bold ${
                  textOverlay.fontWeight === 'bold'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'
                }`}
                onClick={() => updateOverlay(overlay.id, { fontWeight: 'bold' })}
              >
                Bold
              </button>
            </div>
          </div>

          {/* Alignment picker */}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Alignment</label>
            <div className="flex rounded overflow-hidden border border-[#2a2a2a]">
              <button
                className={`flex-1 flex items-center justify-center py-1.5 text-xs transition-colors ${
                  textOverlay.textAlign === 'left'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'
                }`}
                onClick={() => updateOverlay(overlay.id, { textAlign: 'left' })}
                aria-label="Align left"
              >
                <AlignLeft size={14} />
              </button>
              <button
                className={`flex-1 flex items-center justify-center py-1.5 text-xs transition-colors ${
                  textOverlay.textAlign === 'center'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'
                }`}
                onClick={() => updateOverlay(overlay.id, { textAlign: 'center' })}
                aria-label="Align center"
              >
                <AlignCenter size={14} />
              </button>
              <button
                className={`flex-1 flex items-center justify-center py-1.5 text-xs transition-colors ${
                  textOverlay.textAlign === 'right'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#2a2a2a] text-neutral-400 hover:bg-[#333333]'
                }`}
                onClick={() => updateOverlay(overlay.id, { textAlign: 'right' })}
                aria-label="Align right"
              >
                <AlignRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Layer order (all overlay types)                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Layer order</label>
        <div className="flex gap-2">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 transition-colors"
            onClick={() => bringForward(overlay.id)}
            aria-label="Bring forward"
          >
            <ChevronUp size={14} />
            Bring Forward
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 transition-colors"
            onClick={() => sendBackward(overlay.id)}
            aria-label="Send backward"
          >
            <ChevronDown size={14} />
            Send Backward
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Delete (all overlay types)                                          */}
      {/* ------------------------------------------------------------------ */}
      <button
        className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-red-500/20 text-red-400 transition-colors"
        onClick={handleDelete}
        aria-label="Delete overlay"
      >
        <Trash2 size={14} />
        Delete overlay
      </button>
    </div>
  );
}
