import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MobileWelcomeCard } from './MobileWelcomeCard';

const STORAGE_KEY = 'storygrid_onboarding_done';

type Step = {
  targetSelector: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    targetSelector: '[data-testid="canvas-surface"]',
    title: 'Step 1 of 3',
    description: 'Click a cell to select. Hover to see split options.',
  },
  {
    targetSelector: '[data-testid="canvas-surface"]',
    title: 'Step 2 of 3',
    description: 'Drop images or click a cell to upload.',
  },
  {
    targetSelector: '[data-testid="export-button"]',
    title: 'Step 3 of 3',
    description: 'Export your collage as a PNG.',
  },
];

export function Onboarding() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Update spotlight rect on step change
  useEffect(() => {
    if (dismissed) return;
    const step = STEPS[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    }
  }, [currentStep, dismissed]);

  // Recalculate on resize
  useEffect(() => {
    if (dismissed) return;
    const handleResize = () => {
      const step = STEPS[currentStep];
      const el = document.querySelector(step.targetSelector);
      if (el) setSpotlightRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable — dismiss in memory only
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= STEPS.length - 1) {
      handleDismiss();
    } else {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, handleDismiss]);

  if (dismissed) return null;

  if (isMobile) {
    return <MobileWelcomeCard onDismiss={handleDismiss} />;
  }

  if (!spotlightRect) return null;

  const step = STEPS[currentStep];
  const padding = 8;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      data-testid="onboarding-overlay"
    >
      {/* Spotlight cutout via box-shadow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: spotlightRect.top - padding,
          left: spotlightRect.left - padding,
          width: spotlightRect.width + padding * 2,
          height: spotlightRect.height + padding * 2,
          borderRadius: 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
          zIndex: 9998,
        }}
      />
      {/* Tooltip card — fixed to right side, always visible */}
      <div
        className="fixed bg-[#1a1a1a] border border-[#333] rounded-lg p-4 shadow-xl w-[240px]"
        style={{
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 9999,
        }}
        data-testid="onboarding-tooltip"
      >
        <p className="text-xs text-neutral-400 mb-1">{step.title}</p>
        <p className="text-sm text-white mb-3">{step.description}</p>
        <div className="flex items-center justify-between">
          <button
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            onClick={handleDismiss}
            data-testid="onboarding-skip"
          >
            Skip
          </button>
          <button
            className="px-3 py-1 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded transition-colors"
            onClick={handleNext}
            data-testid="onboarding-next"
          >
            {currentStep >= STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
