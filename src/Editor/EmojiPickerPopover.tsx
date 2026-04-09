import { useState, useEffect } from 'react';
import { useOverlayStore } from '../store/overlayStore';

interface EmojiPickerPopoverProps {
  onClose: () => void;
}

/**
 * Lazy-loaded emoji-mart Picker. Imports @emoji-mart/react and @emoji-mart/data
 * on first render via dynamic import (D-19 — keeps them out of the initial bundle).
 *
 * Spawns an EmojiOverlay at canvas center (x=540, y=960) on emoji selection (OVL-08).
 */
export function EmojiPickerPopover({ onClose }: EmojiPickerPopoverProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [PickerComponent, setPickerComponent] = useState<React.ComponentType<any> | null>(null);
  const [emojiData, setEmojiData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pickerMod, dataMod] = await Promise.all([
          import('@emoji-mart/react'),
          import('@emoji-mart/data'),
        ]);
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPickerComponent(() => (pickerMod as any).default ?? (pickerMod as any).Picker);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEmojiData((dataMod as any).default ?? dataMod);
      } catch {
        if (!cancelled) setError('Failed to load emoji picker');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;
  if (!PickerComponent || !emojiData) {
    return <div className="p-4 text-zinc-400 text-sm">Loading emoji picker…</div>;
  }

  return (
    <PickerComponent
      data={emojiData}
      theme="dark"
      onEmojiSelect={(emoji: { native: string }) => {
        useOverlayStore.getState().addOverlay({
          type: 'emoji',
          x: 540,
          y: 960,
          width: 128,
          rotation: 0,
          char: emoji.native,
        });
        onClose();
      }}
    />
  );
}
