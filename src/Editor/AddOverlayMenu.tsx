import { useEffect, useRef, useState } from 'react';
import { Type, Smile } from 'lucide-react';
import { useOverlayStore } from '../store/overlayStore';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { StickerUpload } from './StickerUpload';

interface AddOverlayMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Popover menu with three overlay-creation actions:
 * 1. Add Text — spawns a TextOverlay at canvas center
 * 2. Add Emoji — opens the lazy-loaded EmojiPickerPopover
 * 3. Upload Sticker — opens StickerUpload file picker
 *
 * Mirrors TemplatesPopover.tsx structure (D-20).
 */
export function AddOverlayMenu({ open, onOpenChange }: AddOverlayMenuProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Close on outside click (matches TemplatesPopover pattern)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onOpenChange]);

  const handleAddText = () => {
    // Spawn TextOverlay at canvas center with placeholder content (OVL-01)
    useOverlayStore.getState().addOverlay({
      type: 'text',
      x: 540,
      y: 960,
      width: 600,
      rotation: 0,
      content: 'Double tap to edit',
      fontFamily: 'Bebas Neue',
      fontSize: 72,
      color: '#ffffff',
      fontWeight: 'bold',
      textAlign: 'center',
    });
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 z-50 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg shadow-xl py-1.5"
      style={{ minWidth: 200 }}
      data-testid="add-overlay-menu"
    >
      <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider px-3 pb-1.5 pt-1">
        Add Overlay
      </p>

      {/* Add Text */}
      <button
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-[#2a2a2a] transition-colors text-left text-sm text-neutral-200"
        onClick={handleAddText}
        data-testid="add-text-button"
      >
        <Type size={16} className="text-neutral-400 shrink-0" />
        <span>Add Text</span>
      </button>

      {/* Add Emoji — button toggles lazy-loaded EmojiPickerPopover (D-19) */}
      <button
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-[#2a2a2a] transition-colors text-left text-sm text-neutral-200"
        onClick={() => setShowEmojiPicker(v => !v)}
        data-testid="add-emoji-button"
      >
        <Smile size={16} className="text-neutral-400 shrink-0" />
        <span>Add Emoji</span>
      </button>
      {showEmojiPicker && (
        <div className="px-1 pb-1">
          <EmojiPickerPopover onClose={() => { setShowEmojiPicker(false); onOpenChange(false); }} />
        </div>
      )}

      {/* Upload Sticker */}
      <StickerUpload onClose={() => onOpenChange(false)} />
    </div>
  );
}
