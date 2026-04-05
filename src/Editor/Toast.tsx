import { Loader2, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastState = 'preparing' | 'exporting' | 'error' | 'encoding' | null;

interface ToastProps {
  state: ToastState;
  encodingPercent?: number;
  onRetry: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

export function Toast({ state, encodingPercent, onRetry, onDismiss }: ToastProps) {
  if (state === null) return null;

  const containerClass =
    'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium shadow-lg bg-[#1c1c1c] border border-white/10 min-w-[200px] max-w-[300px] transition-all duration-200';

  if (state === 'preparing') {
    return (
      <div className={containerClass} role="status">
        <Loader2 size={14} className="animate-spin text-neutral-400" />
        <span>Preparing...</span>
      </div>
    );
  }

  if (state === 'exporting') {
    return (
      <div className={containerClass} role="status">
        <Loader2 size={14} className="animate-spin text-neutral-400" />
        <span>Exporting...</span>
      </div>
    );
  }

  if (state === 'encoding') {
    return (
      <div className={containerClass} role="status">
        <Loader2 size={14} className="animate-spin text-neutral-400" />
        <span>Encoding {encodingPercent ?? 0}%...</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={containerClass} role="alert">
        <AlertCircle size={14} className="text-destructive" />
        <span>Export failed.</span>
        <button
          onClick={onRetry}
          className="text-xs underline text-destructive ml-auto"
        >
          Try again
        </button>
      </div>
    );
  }

  // Dismiss button for manual dismissal of error toast
  void onDismiss;

  return null;
}
