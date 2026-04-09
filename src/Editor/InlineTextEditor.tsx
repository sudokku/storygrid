import { useEffect, useRef } from 'react';
import type { TextOverlay } from '../types';

interface InlineTextEditorProps {
  overlay: TextOverlay;
  onCommit: (newContent: string) => void;
  onCancel: () => void;
}

export function InlineTextEditor({ overlay, onCommit, onCancel }: InlineTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Focus and place cursor at end on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // Outside-click commit (T-13-13: read textContent, not innerHTML)
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCommit(ref.current.textContent ?? '');
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [onCommit]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onCommit(ref.current?.textContent ?? '')}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        fontFamily: `"${overlay.fontFamily}"`,
        fontSize: overlay.fontSize,
        color: overlay.color,
        fontWeight: overlay.fontWeight === 'bold' ? 700 : 400,
        textAlign: overlay.textAlign,
        whiteSpace: 'pre-wrap',
        outline: '2px solid #3b82f6',
        background: 'rgba(0,0,0,0.4)',
        userSelect: 'text',
        pointerEvents: 'auto',
      }}
    >
      {overlay.content}
    </div>
  );
}
