/**
 * Original, generic inline SVG icons. No external artwork or brand assets.
 * All icons use a 24x24 viewBox and currentColor.
 */

const PATHS = {
  // Token shapes
  diamond: '<path d="M12 2 21 9 12 22 3 9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  key: '<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m11 11 9 9m-4-4 2-2m-5 0 2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  hexagon: '<path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  leaf: '<path d="M20 4C11 4 4 9 4 17c0 2 1 3 1 3s1-7 9-10c-5 4-7 7-7 10 8 1 13-5 13-16Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  ring: '<circle cx="12" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m9 6 3-4 3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  arrow: '<path d="M3 12h16m-6-7 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="m12 2 3 7 7 .7-5.3 4.7 1.5 7-6.2-3.8L5.8 21l1.5-7L2 9.7 9 9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  tower: '<path d="M6 22V8l6-5 6 5v14M9 22v-6h6v6M9 10h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',

  // UI icons
  close: '<path d="m5 5 14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  house: '<path d="m3 11 9-8 9 8v10H3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="2"/>',
  hotel: '<path d="M3 21V5h10v16M13 10h8v11M6 8h4M6 12h4M6 16h4M16 13h2M16 17h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  gavel: '<path d="m14 4 6 6M9 9l6 6M4 20l5-5M3 21l3-3M12 2l3 3M17 7l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  archive: '<path d="M3 6h18M5 6v14h14V6M9 10h6M9 14h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  signal: '<path d="M4 20v-4M9 20V9M14 20V4M19 20v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  jail: '<rect x="4" y="3" width="16" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 3v18M12 3v18M16 3v18" fill="none" stroke="currentColor" stroke-width="2"/>',
  go: '<path d="M4 12h14m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="12" r="1.6" fill="currentColor"/>',
  tax: '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  parking: '<path d="M12 2 3 7v10l9 5 9-5V7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 10h14M8 21l2-4M16 21l-2-4M9 6h.01M15 6h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 8-12h-6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  help: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4ZM20 4h-3a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/>',
  save: '<path d="M5 3h12l4 4v14H3V3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 3v6h9V3M7 21v-7h10v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  warning: '<path d="M12 2 22 21H2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 8v6M12 17.5h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  check: '<path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  users: '<circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3.2 3.2 0 0 1 0 6M17 14.5a6 6 0 0 1 4.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  coins: '<ellipse cx="12" cy="6" rx="8" ry="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 6v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6M4 12v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-6" fill="none" stroke="currentColor" stroke-width="2"/>',
  chevronRight: '<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

const FALLBACK = PATHS.diamond;

export function iconSvg(name, { size = 16, className = '' } = {}) {
  const path = PATHS[name] ?? FALLBACK;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" class="${className}">${path}</svg>`;
}

export function icon(name, options = {}) {
  const span = document.createElement('span');
  span.className = `icon ${options.className ?? ''}`.trim();
  span.innerHTML = iconSvg(name, options);
  return span;
}

export function hasIcon(name) {
  return Boolean(PATHS[name]);
}

export function tokenIcon(tokenIcon, options = {}) {
  return iconSvg(tokenIcon, options);
}
