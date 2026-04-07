import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { SafeZoneOverlay } from '../Grid/SafeZoneOverlay';

describe('SafeZoneOverlay (Phase 8 / CANVAS-01)', () => {
  it('renders the overlay root with correct testid', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    expect(getByTestId('safe-zone-overlay')).toBeTruthy();
  });

  it('renders top region with "Instagram header" label', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    const top = getByTestId('safe-zone-top');
    expect(top.textContent).toContain('Instagram header');
  });

  it('renders bottom region with "Instagram footer" label', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    const bottom = getByTestId('safe-zone-bottom');
    expect(bottom.textContent).toContain('Instagram footer');
  });

  it('renders an svg icon (EyeOff) in each unsafe region', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    expect(getByTestId('safe-zone-top').querySelector('svg')).toBeTruthy();
    expect(getByTestId('safe-zone-bottom').querySelector('svg')).toBeTruthy();
  });

  it('root has pointer-events-none and z-10 classes', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    const root = getByTestId('safe-zone-overlay');
    expect(root.className).toContain('pointer-events-none');
    expect(root.className).toContain('z-10');
  });

  it('top region height uses --safe-zone-top CSS variable (not hardcoded)', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    const top = getByTestId('safe-zone-top') as HTMLElement;
    expect(top.style.height).toBe('var(--safe-zone-top)');
  });

  it('bottom region height uses --safe-zone-bottom CSS variable (not hardcoded)', () => {
    const { getByTestId } = render(<SafeZoneOverlay />);
    const bottom = getByTestId('safe-zone-bottom') as HTMLElement;
    expect(bottom.style.height).toBe('var(--safe-zone-bottom)');
  });
});
