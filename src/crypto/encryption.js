/**
 * Encryption engine.
 *
 * Composition model (default G_AFTER_F):
 *   f(x) = (a*x + b) mod 26
 *   g(x) = (c*x + d) mod 26
 *   E(x) = g(f(x))
 *
 * Decryption reverses the composition order:
 *   E^-1(y) = f^-1(g^-1(y))
 *
 * The same module also renders formatted ciphertext. Alphabetic characters
 * become two-digit codes; spaces become "/" word separators; digits are kept
 * readable inside square brackets so they can never be mistaken for codes;
 * punctuation is preserved.
 */

import { mod, modInverse, pad2 } from './modular-math.js';
import { DEFAULT_ALPHABET, indexToLetter, letterToIndex, splitWords } from './alphabet.js';

/** Apply one affine function. */
export function affine(a, b, x, modulus = 26) {
  return mod(a * x + b, modulus);
}

/** Validate a single affine function description and return canonical values. */
function readAffine(definition, label, modulus) {
  if (!definition || typeof definition !== 'object') {
    throw new Error(`${label} belum dikonfigurasi.`);
  }
  if (definition.type !== 'AFFINE') {
    throw new Error(`${label} harus bertipe AFFINE (ditemukan: ${definition.type}).`);
  }
  if (!Number.isInteger(definition.a) || !Number.isInteger(definition.b)) {
    throw new Error(`${label} membutuhkan koefisien a dan b berupa bilangan bulat.`);
  }
  const a = mod(definition.a, modulus);
  const b = mod(definition.b, modulus);
  if (a === 0) {
    throw new Error(`${label}: koefisien a tidak boleh 0.`);
  }
  // Throws with a readable message if gcd(a, modulus) != 1.
  modInverse(a, modulus);
  return { a, b };
}

/** Human-readable linear formula without the outer modulo. */
export function linearExpression({ a, b }, variable = 'x') {
  const coefficient = a === 1 ? '' : a === -1 ? '-' : String(a);
  let expression = `${coefficient}${variable}`;
  if (b > 0) expression += ` + ${b}`;
  if (b < 0) expression += ` - ${Math.abs(b)}`;
  return expression;
}

/** Human-readable formula with modulus. */
export function formulaText(definition, variable = 'x', modulus = 26) {
  return `${linearExpression(definition, variable)} mod ${modulus}`;
}

/**
 * Build a compiled cipher from a configuration object.
 * This performs the mathematical validation needed to guarantee reversibility.
 */
export function buildCipher(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Konfigurasi enkripsi tidak ditemukan.');
  }

  const modulus = config.modulus;
  const alphabet = config.alphabet;

  if (!Number.isInteger(modulus) || modulus < 2) {
    throw new Error('Modulus enkripsi harus bilangan bulat minimal 2.');
  }
  if (typeof alphabet !== 'string' || alphabet.length !== modulus) {
    throw new Error('Panjang alfabet harus sama dengan modulus.');
  }
  if (new Set(alphabet).size !== alphabet.length) {
    throw new Error('Alfabet tidak boleh memuat huruf ganda.');
  }

  const f = readAffine(config.functionF, 'Fungsi f(x)', modulus);
  const g = readAffine(config.functionG, 'Fungsi g(x)', modulus);

  const order = config.compositionOrder || 'G_AFTER_F';
  if (!['G_AFTER_F', 'F_AFTER_G'].includes(order)) {
    throw new Error('Urutan komposisi harus G_AFTER_F atau F_AFTER_G.');
  }

  const offset = config.displayOffset;
  if (!Number.isInteger(offset) || (offset !== 0 && offset !== 1)) {
    throw new Error('displayOffset harus 0 atau 1 agar setiap kode tetap dua digit.');
  }

  const wordSeparator = config.wordSeparator || '/';
  if (typeof wordSeparator !== 'string' || wordSeparator.length !== 1 || /[A-Za-z0-9\s]/.test(wordSeparator)) {
    throw new Error('Pemisah kata harus satu karakter non-alfanumerik, misalnya "/".');
  }

  // Inverse affine functions. For f(x)=a*x+b, f^-1(y)=a^-1*y - a^-1*b.
  const fInverseA = modInverse(f.a, modulus);
  const fInverseB = mod(-fInverseA * f.b, modulus);
  const gInverseA = modInverse(g.a, modulus);
  const gInverseB = mod(-gInverseA * g.b, modulus);
  const fInverse = { a: fInverseA, b: fInverseB };
  const gInverse = { a: gInverseA, b: gInverseB };

  // Composed function coefficients, useful for the explanation panel.
  let composed;
  let composedInverse;
  if (order === 'G_AFTER_F') {
    composed = {
      a: mod(g.a * f.a, modulus),
      b: mod(g.a * f.b + g.b, modulus)
    };
    composedInverse = {
      a: mod(fInverse.a * gInverse.a, modulus),
      b: mod(fInverse.a * gInverse.b + fInverse.b, modulus)
    };
  } else {
    composed = {
      a: mod(f.a * g.a, modulus),
      b: mod(f.a * g.b + f.b, modulus)
    };
    composedInverse = {
      a: mod(gInverse.a * fInverse.a, modulus),
      b: mod(gInverse.a * fInverse.b + gInverse.b, modulus)
    };
  }

  function encryptIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= modulus) {
      throw new RangeError(`Indeks ${index} di luar alfabet.`);
    }
    if (order === 'G_AFTER_F') {
      return affine(g.a, g.b, affine(f.a, f.b, index, modulus), modulus);
    }
    return affine(f.a, f.b, affine(g.a, g.b, index, modulus), modulus);
  }

  function decryptIndex(value) {
    if (!Number.isInteger(value) || value < 0 || value >= modulus) {
      throw new RangeError(`Nilai ${value} di luar alfabet.`);
    }
    if (order === 'G_AFTER_F') {
      return affine(fInverse.a, fInverse.b, affine(gInverse.a, gInverse.b, value, modulus), modulus);
    }
    return affine(gInverse.a, gInverse.b, affine(fInverse.a, fInverse.b, value, modulus), modulus);
  }

  // A compiled key is only accepted after a complete round-trip test.
  for (let x = 0; x < modulus; x += 1) {
    const encrypted = encryptIndex(x);
    const decrypted = decryptIndex(encrypted);
    if (decrypted !== x) {
      throw new Error(`Kunci tidak reversibel: indeks ${x} menjadi ${decrypted}.`);
    }
  }

  function codeForIndex(index) {
    return pad2(encryptIndex(index) + offset);
  }

  function encryptLetter(letter) {
    const index = letterToIndex(letter);
    if (index < 0 || index >= modulus) {
      throw new Error(`Karakter "${letter}" bukan huruf alfabet yang didukung.`);
    }
    return codeForIndex(index);
  }

  function decryptCode(code) {
    if (!/^\d{2}$/.test(String(code))) {
      throw new Error(`Kode "${code}" harus terdiri dari dua digit.`);
    }
    const value = Number(code) - offset;
    if (value < 0 || value >= modulus) {
      throw new Error(`Kode "${code}" berada di luar rentang 01-${String(modulus + offset - 1).padStart(2, '0')}.`);
    }
    return indexToLetter(decryptIndex(value), alphabet);
  }

  /**
   * Encrypt one word. Letters become codes; digit runs stay literal inside
   * brackets; punctuation stays attached to the neighbouring token.
   */
  function encryptWord(word) {
    const parts = [];
    let index = 0;
    const text = String(word).toUpperCase();

    while (index < text.length) {
      const char = text[index];

      if (/[A-Z]/.test(char)) {
        const letterIndex = letterToIndex(char);
        if (letterIndex >= modulus) {
          throw new Error(`Huruf "${char}" tidak ada di alfabet yang dikonfigurasi.`);
        }
        parts.push(codeForIndex(letterIndex));
        index += 1;
        continue;
      }

      if (/\d/.test(char)) {
        let digits = '';
        while (index < text.length && /\d/.test(text[index])) {
          digits += text[index];
          index += 1;
        }
        const literal = `[${digits}]`;
        if (parts.length > 0) parts[parts.length - 1] += literal;
        else parts.push(literal);
        continue;
      }

      // Punctuation and other literal separators are preserved.
      if (parts.length > 0) parts[parts.length - 1] += char;
      else parts.push(char);
      index += 1;
    }

    return parts.join(' ');
  }

  /** Format a full plaintext string as numeric ciphertext. */
  function encryptText(text) {
    const words = splitWords(text);
    if (words.length === 0) return '';
    return words.map(encryptWord).join(` ${wordSeparator} `);
  }

  /** Decode a code/word token back into letters and literal characters. */
  function decryptWord(word) {
    let output = '';
    let index = 0;
    const token = String(word).trim();

    while (index < token.length) {
      const char = token[index];

      if (char === '[') {
        const end = token.indexOf(']', index + 1);
        if (end === -1) throw new Error(`Tanda "[" pada "${token}" tidak ditutup.`);
        output += token.slice(index + 1, end);
        index = end + 1;
        continue;
      }

      if (/\d/.test(char)) {
        let digits = '';
        while (index < token.length && /\d/.test(token[index])) {
          digits += token[index];
          index += 1;
        }
        // Two-digit numbers are ciphertext codes; longer runs are literal text.
        if (digits.length === 2) {
          output += decryptCode(digits);
        } else {
          output += digits;
        }
        continue;
      }

      // Punctuation, or already-readable letters, are preserved.
      output += char;
      index += 1;
    }

    return output;
  }

  /** Decrypt a formatted ciphertext string back to readable uppercase text. */
  function decryptText(ciphertext) {
    if (typeof ciphertext !== 'string' || ciphertext.trim() === '') return '';
    const escaped = wordSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = ciphertext.split(new RegExp(`\\s*${escaped}\\s*`));
    return words
      .map((word) => word.trim().split(/\s+/).filter(Boolean).map(decryptWord).join(''))
      .join(' ')
      .trim();
  }

  const formulas = {
    f: formulaText(f, 'x', modulus),
    g: formulaText(g, 'x', modulus),
    encryption:
      order === 'G_AFTER_F'
        ? `E(x) = g(f(x)) = ${formulaText(composed, 'x', modulus)}`
        : `E(x) = f(g(x)) = ${formulaText(composed, 'x', modulus)}`,
    inverseF: formulaText(fInverse, 'y', modulus),
    inverseG: formulaText(gInverse, 'y', modulus),
    decryption:
      order === 'G_AFTER_F'
        ? `E⁻¹(y) = f⁻¹(g⁻¹(y)) = ${formulaText(composedInverse, 'y', modulus)}`
        : `E⁻¹(y) = g⁻¹(f⁻¹(y)) = ${formulaText(composedInverse, 'y', modulus)}`,
    composed,
    composedInverse,
    order
  };

  return {
    config,
    modulus,
    alphabet,
    offset,
    wordSeparator,
    f,
    g,
    fInverse,
    gInverse,
    composed,
    composedInverse,
    formulas,
    encryptIndex,
    decryptIndex,
    codeForIndex,
    encryptLetter,
    decryptCode,
    encryptWord,
    encryptText,
    decryptWord,
    decryptText,
    describe() {
      return { ...formulas, keyId: config.keyId ?? 'tanpa-id' };
    }
  };
}

/** Convenience: encrypt using a raw configuration object. */
export function encryptText(config, text) {
  return buildCipher(config).encryptText(text);
}

/** Convenience: decrypt using a raw configuration object. */
export function decryptText(config, ciphertext) {
  return buildCipher(config).decryptText(ciphertext);
}

export { DEFAULT_ALPHABET };
