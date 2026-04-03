interface MobileWelcomeCardProps {
  onDismiss: () => void;
}

export function MobileWelcomeCard({ onDismiss }: MobileWelcomeCardProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      data-testid="mobile-welcome-card"
    >
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm text-center">
        <p className="text-xl font-semibold text-white mb-1">StoryGrid</p>
        <p className="text-xl font-semibold text-white mb-4">Build your story.</p>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          Tap a cell to select it. Tap an empty cell to add a photo. Hit Export when you're ready.
        </p>
        <button
          className="w-full py-3 rounded-xl text-sm font-medium bg-[var(--sidebar-primary)] text-white"
          onClick={onDismiss}
          data-testid="welcome-dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
