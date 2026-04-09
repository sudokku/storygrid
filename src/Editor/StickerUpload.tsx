import { useRef } from 'react';
import { Image } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useOverlayStore } from '../store/overlayStore';
import { sanitizeSvgString } from '../lib/svgSanitize';

interface StickerUploadProps {
  onClose: () => void;
}

export function StickerUpload({ onClose }: StickerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let dataUri: string;

    if (file.type === 'image/svg+xml') {
      // SVG: read as text, sanitize via DOMPurify before storage (D-07, T-13-09)
      const text = await file.text();
      const sanitized = sanitizeSvgString(text);
      // Convert sanitized SVG to a data URI via base64
      dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(sanitized)));
    } else {
      // PNG: read as data URL via FileReader (per MEDI-03 pattern)
      dataUri = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
    }

    // Generate sticker registry key (OVL-17: data stored in registry, not inlined)
    const stickerId = 'sk_' + nanoid();

    // Store data in registry side-channel (D-06: not in undo history)
    useOverlayStore.getState().addSticker(stickerId, dataUri);

    // Spawn StickerOverlay at canvas center (OVL-08 spawn spec: x=540, y=960)
    useOverlayStore.getState().addOverlay({
      type: 'sticker',
      stickerRegistryId: stickerId,
      x: 540,
      y: 960,
      width: 320,
      rotation: 0,
    });

    onClose();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        // Reset value so same file can be re-selected
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />
      <button
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-[#2a2a2a] transition-colors text-left text-sm text-neutral-200"
        onClick={() => inputRef.current?.click()}
      >
        <Image size={16} className="text-neutral-400 shrink-0" />
        <span>Upload Sticker</span>
      </button>
    </div>
  );
}
