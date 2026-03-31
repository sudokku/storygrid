import { describe, it, expect } from 'vitest';

describe('MVP dependency imports', () => {
  it('imports zustand', async () => {
    const mod = await import('zustand');
    expect(mod).toBeDefined();
  });

  it('imports immer', async () => {
    const mod = await import('immer');
    expect(mod.produce).toBeDefined();
  });

  it('imports @dnd-kit/core', async () => {
    const mod = await import('@dnd-kit/core');
    expect(mod).toBeDefined();
  });

  it('imports @dnd-kit/sortable', async () => {
    const mod = await import('@dnd-kit/sortable');
    expect(mod).toBeDefined();
  });

  it('imports html-to-image', async () => {
    const mod = await import('html-to-image');
    expect(mod.toPng).toBeDefined();
  });

  it('imports lucide-react', async () => {
    const mod = await import('lucide-react');
    expect(mod).toBeDefined();
  });

  it('imports nanoid', async () => {
    const { nanoid } = await import('nanoid');
    expect(typeof nanoid()).toBe('string');
  });
});
