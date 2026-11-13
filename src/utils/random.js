/**
 * Injectable randomness.
 *
 * The engine never calls Math.random directly. Tests and deterministic demos
 * can inject a seeded generator to reproduce dice rolls and shuffles.
 */

/** Mulberry32 seeded PRNG, returning a function with the Math.random contract. */
export function createSeededRng(seed = 1) {
  let state = seed >>> 0;
  return function seededRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function randomInt(rng, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError('Rentang randomInt tidak valid.');
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Fisher–Yates shuffle. Returns a new array and does not mutate the input.
 * A copy of the RNG contract keeps shuffles reproducible in tests.
 */
export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Roll one standard six-sided die. */
export function rollDie(rng = Math.random) {
  return randomInt(rng, 1, 6);
}
