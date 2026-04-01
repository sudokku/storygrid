export function SafeZoneOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none" data-testid="safe-zone-overlay">
      <div
        className="absolute inset-x-0 border-t border-dashed border-white/20"
        style={{ top: 'var(--safe-zone-top)' }}
      />
      <div
        className="absolute inset-x-0 border-b border-dashed border-white/20"
        style={{ bottom: 'var(--safe-zone-bottom)' }}
      />
    </div>
  );
}
