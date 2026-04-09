import { describe, it, expect } from 'vitest';
// This import intentionally fails until Plan 03 Task 1 creates src/lib/overlayExport.ts
import { drawOverlaysToCanvas } from '../../lib/overlayExport';

describe('canvas overlay export (OVL-10/11/12) — Wave 0 stub', () => {
  it('exports drawOverlaysToCanvas (expanded in Plan 03)', () => {
    expect(typeof drawOverlaysToCanvas).toBe('function');
  });
});
