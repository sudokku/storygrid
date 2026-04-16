// ---------------------------------------------------------------------------
// FontPickerList
// ---------------------------------------------------------------------------
// Custom font picker component that renders 8 Instagram-style font options,
// each displayed in its own typeface. Replaces the native <select> element.
// Responsive: 44px touch targets on mobile, 36px rows on desktop (md breakpoint).

const FONTS = [
  'Bebas Neue',
  'Oswald',
  'Dancing Script',
  'Playfair Display',
  'Space Mono',
  'Pacifico',
  'Barlow Condensed',
  'Caveat',
] as const;

interface FontPickerListProps {
  value: string;
  onChange: (fontFamily: string) => void;
}

export function FontPickerList({ value, onChange }: FontPickerListProps) {
  return (
    <div className="flex flex-col rounded overflow-hidden border border-[#3a3a3a]">
      {FONTS.map(font => {
        const isSelected = value === font;
        return (
          <button
            key={font}
            style={{ fontFamily: `"${font}"` }}
            className={[
              'min-h-[44px] md:min-h-[36px]',
              'px-3 text-base md:text-sm',
              'flex items-center',
              'transition-colors duration-150',
              'border-b border-[#3a3a3a] last:border-b-0',
              'touch-manipulation',
              'focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:outline-none',
              isSelected
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#2a2a2a] text-neutral-300 hover:bg-[#333333]',
            ].join(' ')}
            onClick={() => onChange(font)}
            aria-label={`${font} font`}
            aria-pressed={isSelected}
          >
            {font}
          </button>
        );
      })}
    </div>
  );
}
