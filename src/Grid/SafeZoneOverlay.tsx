import { EyeOff } from 'lucide-react';

// Diagonal stripes via repeating-linear-gradient.
// 45deg with 12px period, 6px transparent / 6px white-at-8% — subtle "caution" pattern
// stacked under a 40% black tint via two backgrounds.
const STRIPE_BG =
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px), rgba(0,0,0,0.40)';

export function SafeZoneOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      data-testid="safe-zone-overlay"
    >
      {/* Top unsafe region — Instagram header */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-white/90"
        style={{ height: 'var(--safe-zone-top)', background: STRIPE_BG }}
        data-testid="safe-zone-top"
      >
        <EyeOff size={64} strokeWidth={1.5} />
        <span className="mt-3 text-2xl font-medium tracking-wide">Instagram header</span>
      </div>

      {/* Bottom unsafe region — Instagram footer */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-white/90"
        style={{ height: 'var(--safe-zone-bottom)', background: STRIPE_BG }}
        data-testid="safe-zone-bottom"
      >
        <EyeOff size={64} strokeWidth={1.5} />
        <span className="mt-3 text-2xl font-medium tracking-wide">Instagram footer</span>
      </div>
    </div>
  );
}
