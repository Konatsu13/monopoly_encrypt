/**
 * Decryption helpers.
 *
 * Decryption is deliberately a separate module from encryption so the
 * inverse-function workflow can be taught and tested independently.
 */

import { normalizeForComparison } from './alphabet.js';
import { buildCipher } from './encryption.js';

/** Decrypt formatted ciphertext with a compiled cipher. */
export function decryptWithCipher(cipher, ciphertext) {
  return cipher.decryptText(ciphertext);
}

/** Decrypt formatted ciphertext with a raw configuration object. */
export function decryptText(config, ciphertext) {
  return buildCipher(config).decryptText(ciphertext);
}

/** Decrypt a single two-digit code to one letter. */
export function decryptCode(config, code) {
  return buildCipher(config).decryptCode(code);
}

/**
 * Compare a submitted answer with the real card instruction.
 * Only presentation differences (case, spacing, punctuation) are ignored.
 */
export function checkAnswer(expectedPlaintext, submittedAnswer) {
  const expected = normalizeForComparison(expectedPlaintext);
  const answer = normalizeForComparison(submittedAnswer);
  return {
    correct: answer.length > 0 && answer === expected,
    normalizedExpected: expected,
    normalizedAnswer: answer,
    empty: answer.length === 0
  };
}

/**
 * Parse a ciphertext typed by a player and return one decoded letter per code.
 * Useful for the "Cara Dekripsi" tester.
 */
export function decodePreview(cipher, ciphertext) {
  const decoded = cipher.decryptText(ciphertext);
  return {
    decoded,
    words: decoded ? decoded.split(' ') : []
  };
}
