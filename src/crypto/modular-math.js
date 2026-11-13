/**
 * Modular arithmetic helpers used by the educational Affine cipher.
 *
 * The cipher works modulo 26 (the number of letters in A-Z). A multiplier is
 * only usable when it is relatively prime to 26; otherwise two different
 * letters would map to the same value and decryption would be impossible.
 */

/** Mathematical modulo (always returns a value in 0..m-1). */
export function mod(value, modulus) {
  if (!Number.isInteger(value) || !Number.isInteger(modulus) || modulus <= 0) {
    throw new TypeError('mod() membutuhkan bilangan bulat dan modulus positif.');
  }
  return ((value % modulus) + modulus) % modulus;
}

/** Greatest common divisor using the Euclidean algorithm. */
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

/** True when the two integers share no factor other than 1. */
export function isCoprime(a, b) {
  return gcd(a, b) === 1;
}

/**
 * Extended Euclidean algorithm.
 * Returns { g, x, y } such that a*x + b*y = g = gcd(a, b).
 */
export function extendedGcd(a, b) {
  let oldR = a;
  let r = b;
  let oldS = 1;
  let s = 0;
  let oldT = 0;
  let t = 1;

  while (r !== 0) {
    const quotient = Math.trunc(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  return { g: oldR, x: oldS, y: oldT };
}

/**
 * Multiplicative inverse of a modulo m.
 * Throws when the inverse does not exist (a and m are not coprime).
 */
export function modInverse(a, m) {
  if (!Number.isInteger(a) || !Number.isInteger(m) || m <= 1) {
    throw new TypeError('modInverse() membutuhkan bilangan bulat dan modulus > 1.');
  }
  const { g, x } = extendedGcd(mod(a, m), m);
  if (g !== 1) {
    throw new RangeError(`${a} tidak memiliki invers modulo ${m} karena gcd = ${g}.`);
  }
  return mod(x, m);
}

/** Format a two-digit display code (01..26 when offset is 1). */
export function pad2(value) {
  return String(value).padStart(2, '0');
}
