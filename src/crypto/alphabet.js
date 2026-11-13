/**
 * Alphabet and text-normalisation helpers.
 *
 * Mapping: A = 0, B = 1, ..., Z = 25.
 * Ciphertext display: every encrypted value is written as two digits
 * (value + displayOffset, normally 1 so A..Z becomes 08.. etc. after
 * encryption). Letters inside a word are separated by spaces, while words
 * are separated by the configured word separator ("/").
 */

export const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Convert one Latin letter to its 0..25 index. Returns -1 for non-letters. */
export function letterToIndex(letter) {
  if (typeof letter !== 'string' || letter.length !== 1) return -1;
  const code = letter.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return -1;
  return code - 65;
}

/** Convert a 0..25 index back to an uppercase letter. */
export function indexToLetter(index, alphabet = DEFAULT_ALPHABET) {
  if (!Number.isInteger(index) || index < 0 || index >= alphabet.length) {
    throw new RangeError(`Indeks huruf tidak valid: ${index}`);
  }
  return alphabet[index];
}

/**
 * Normalise text for display/encryption: uppercase and trim outer spaces.
 * Interior whitespace is collapsed by encryptText, not here.
 */
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .toUpperCase()
    .trim();
}

/**
 * Normalise an answer for comparison. It ignores differences that do not
 * change meaning: letter case, repeated spaces, punctuation, and typographic
 * quotes/dashes. Words, letters, and digits must still match exactly.
 */
export function normalizeForComparison(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toUpperCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Split plaintext into words while preserving punctuation inside each word.
 * The ciphertext format uses "/" between words, so repeated whitespace is
 * presentation-only and can be collapsed safely.
 */
export function splitWords(text) {
  const normalized = String(text ?? '').replace(/\u00a0/g, ' ').trim();
  if (!normalized) return [];
  return normalized.split(/\s+/);
}

/** Extract only alphabetic characters (used in calculations and tests). */
export function lettersOnly(text) {
  return Array.from(String(text ?? '').toUpperCase()).filter((ch) => /[A-Z]/.test(ch));
}

/** True when every character can be represented by the A-Z alphabet. */
export function isAlphabetOnly(text) {
  return /^[A-Z ]*$/.test(String(text ?? '').toUpperCase());
}
