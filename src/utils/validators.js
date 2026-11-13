/** Small reusable validation helpers. */

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function unique(values) {
  return new Set(values).size === values.length;
}

/** Escape user-provided text before inserting it into an HTML template. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Normalise a user-entered player name for duplicate detection. */
export function normalizePlayerName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID');
}
