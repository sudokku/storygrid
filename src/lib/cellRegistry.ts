/**
 * Cell registry — maps nodeId to its rendered HTMLElement.
 *
 * Used by GlobalActionBar (portal-based) to look up the DOM rect of a hovered
 * cell without relying on brittle querySelector / data-testid lookups.
 *
 * This is a browser-only app (no SSR), so a module-level Map is fine.
 */

const cellElements = new Map<string, HTMLElement>();

export function registerCell(id: string, el: HTMLElement): void {
  cellElements.set(id, el);
}

export function unregisterCell(id: string): void {
  cellElements.delete(id);
}

export function getCellElement(id: string): HTMLElement | null {
  return cellElements.get(id) ?? null;
}
