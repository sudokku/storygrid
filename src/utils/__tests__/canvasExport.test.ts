import { describe, it, expect } from 'vitest';
// This import intentionally fails until Plan 03 Task 1 creates src/lib/overlayExport.ts
import { drawOverlaysToCanvas } from '../../lib/overlayExport';

describe('canvas overlay export (OVL-10/11/12) — Wave 0 stub', () => {
  it('exports drawOverlaysToCanvas (expanded in Plan 03)', () => {
    expect(typeof drawOverlaysToCanvas).toBe('function');
  });

  it('renders a text overlay via ctx.fillText (smoke)', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, prop) => (...args: unknown[]) => { calls.push({ method: String(prop), args }); },
      set: () => true,
    });
    const overlay = {
      id: 'o1', type: 'text' as const, x: 540, y: 960, width: 400, rotation: 0, zIndex: 1,
      content: 'hello', fontFamily: 'Geist', fontSize: 64,
      color: '#fff', fontWeight: 'regular' as const, textAlign: 'center' as const,
    };
    await drawOverlaysToCanvas(ctx, [overlay], {}, new Map());
    const fillTextCall = calls.find(c => c.method === 'fillText');
    expect(fillTextCall).toBeDefined();
    expect(fillTextCall?.args[0]).toBe('hello');
  });
});
