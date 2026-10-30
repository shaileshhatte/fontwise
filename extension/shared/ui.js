/*
  ui.js — keyboard and screen-reader helpers for Fontwise pages.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});

  const visible = (el) => !el.disabled && !el.hidden && el.getClientRects().length > 0;

  /** Makes `active` (or the first item) the single tab stop of a roving group. */
  FW.setTabStop = (container, selector, active = null) => {
    const items = [...container.querySelectorAll(selector)];
    const stop = active && items.includes(active) ? active : items.find(visible) ?? items[0];
    for (const item of items) item.tabIndex = item === stop ? 0 : -1;
  };

  /**
   * Arrow-key navigation inside a group with one tab stop (WAI-ARIA roving tabindex).
   * activate: click the newly focused item (radio groups, tabs). grid: Up/Down move between rows.
   */
  FW.roving = (container, selector, { activate = false, grid = false } = {}) => {
    container.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const current = event.target.closest?.(selector);
      if (!current || !container.contains(current)) return;
      const items = [...container.querySelectorAll(selector)].filter(visible);
      const index = items.indexOf(current);
      const rtl = getComputedStyle(container).direction === 'rtl';
      const step = (delta) => items[(index + delta + items.length) % items.length];
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const backward = rtl ? 'ArrowRight' : 'ArrowLeft';

      const moves = {
        [forward]: () => (grid ? items[index + 1] : step(1)),
        [backward]: () => (grid ? items[index - 1] : step(-1)),
        ArrowDown: () => (grid ? verticalNeighbour(items, current, 1) : step(1)),
        ArrowUp: () => (grid ? verticalNeighbour(items, current, -1) : step(-1)),
        Home: () => items[0],
        End: () => items.at(-1),
      };
      if (!moves[event.key]) return;

      event.preventDefault();
      const next = moves[event.key]();
      if (!next || next === current) return;
      FW.setTabStop(container, selector, next);
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
      if (activate) next.click();
    });
  };

  // Nearest item in the next (1) or previous (-1) visual row, by horizontal centre.
  function verticalNeighbour(items, current, direction) {
    const from = current.getBoundingClientRect();
    const centre = from.left + from.width / 2;
    const candidates = items
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => (direction > 0 ? rect.top >= from.bottom - 1 : rect.bottom <= from.top + 1));
    if (!candidates.length) return null;
    const rowTop = direction > 0
      ? Math.min(...candidates.map(({ rect }) => rect.top))
      : Math.max(...candidates.map(({ rect }) => rect.top));
    return candidates
      .filter(({ rect }) => Math.abs(rect.top - rowTop) < 2)
      .sort((a, b) => Math.abs(a.rect.left + a.rect.width / 2 - centre) - Math.abs(b.rect.left + b.rect.width / 2 - centre))[0].el;
  }

  let announceTimer = 0;

  /** Speaks `text` through the page's polite live region (#status). */
  FW.announce = (text) => {
    const region = document.getElementById('status');
    if (!region) return;
    region.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => (region.textContent = text), 60);
  };
})();
