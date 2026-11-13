/**
 * Configuration validation and self-testing for the cipher.
 *
 * A key must pass a complete 26-letter round-trip test before the game is
 * allowed to generate board or card ciphertext.
 */

import { buildCipher, formulaText } from './encryption.js';
import { normalizeForComparison } from './alphabet.js';

const AFFINE_KEYS = ['a', 'b'];

function validateAffineShape(definition, label, errors) {
  if (!definition || typeof definition !== 'object') {
    errors.push(`${label} belum diisi.`);
    return;
  }
  if (definition.type !== 'AFFINE') {
    errors.push(`${label} harus bertipe AFFINE.`);
    return;
  }
  for (const key of AFFINE_KEYS) {
    if (!Number.isInteger(definition[key])) {
      errors.push(`${label}.${key} harus bilangan bulat.`);
    }
  }
}

/**
 * Validate a raw encryption configuration.
 * Returns { ok, errors, warnings, cipher, formulas } rather than throwing,
 * so the UI can explain the problem in readable Indonesian.
 */
export function validateEncryptionConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['Konfigurasi enkripsi tidak ditemukan.'], warnings, cipher: null, formulas: null };
  }

  if (typeof config.alphabet !== 'string') {
    errors.push('Alfabet enkripsi belum diisi.');
  } else {
    if (config.alphabet.length !== 26) errors.push('Alfabet harus berisi 26 huruf.');
    if (!/^[A-Z]+$/.test(config.alphabet)) errors.push('Alfabet hanya boleh berisi huruf kapital A-Z tanpa spasi.');
    if (new Set(config.alphabet).size !== config.alphabet.length) errors.push('Alfabet tidak boleh memuat huruf ganda.');
  }

  if (!Number.isInteger(config.modulus) || config.modulus !== 26) {
    errors.push('Modulus harus 26 untuk alfabet Latin A-Z.');
  }
  if (config.mapping !== 'A_TO_0') {
    errors.push('Pemetaan harus A_TO_0 (A=0, B=1, ..., Z=25).');
  }

  validateAffineShape(config.functionF, 'functionF', errors);
  validateAffineShape(config.functionG, 'functionG', errors);

  if (!['G_AFTER_F', 'F_AFTER_G'].includes(config.compositionOrder)) {
    errors.push('compositionOrder harus G_AFTER_F atau F_AFTER_G.');
  }
  if (![0, 1].includes(config.displayOffset)) {
    errors.push('displayOffset harus 0 atau 1.');
  }
  if (
    typeof config.wordSeparator !== 'string' ||
    config.wordSeparator.length !== 1 ||
    /[A-Za-z0-9\s]/.test(config.wordSeparator)
  ) {
    errors.push('wordSeparator harus satu karakter non-alfanumerik, misalnya "/".');
  }
  if (typeof config.approved !== 'boolean') {
    errors.push('Flag approved harus bernilai true atau false.');
  } else if (!config.approved) {
    warnings.push('Kunci ini belum disetujui guru dan hanya boleh dipakai dalam mode pengembangan/demo.');
  }
  if (config.mode !== 'DEVELOPMENT' && config.mode !== 'PRODUCTION') {
    errors.push('mode harus DEVELOPMENT atau PRODUCTION.');
  }
  if (!config.keyId) {
    warnings.push('keyId belum diisi; kunci sulit dilacak saat berganti versi.');
  }

  let cipher = null;
  let formulas = null;
  if (errors.length === 0) {
    try {
      cipher = buildCipher(config);

      // Extra explicit self-test: encrypt and decrypt every letter.
      for (let index = 0; index < 26; index += 1) {
        const encrypted = cipher.encryptIndex(index);
        const decrypted = cipher.decryptIndex(encrypted);
        if (decrypted !== index) {
          errors.push(`Uji putar-balik gagal pada indeks ${index}.`);
        }
      }

      // Text-level round trip with spaces, punctuation, and digits.
      const sample = 'HALO DUNIA 2099!';
      const roundTrip = cipher.decryptText(cipher.encryptText(sample));
      if (normalizeForComparison(roundTrip) !== normalizeForComparison(sample)) {
        errors.push(`Uji teks campuran gagal: "${roundTrip}".`);
      }

      formulas = cipher.formulas;
    } catch (error) {
      errors.push(`Kunci ditolak: ${error.message}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, cipher, formulas };
}

/** Throw when the configuration is invalid. */
export function assertValidEncryptionConfig(config) {
  const result = validateEncryptionConfig(config);
  if (!result.ok) {
    throw new Error(`Konfigurasi enkripsi tidak valid: ${result.errors.join(' ')}`);
  }
  return result;
}

/**
 * A game may only start with an unapproved key when the explicit demo mode is
 * enabled. The setup screen also asks the host to acknowledge this.
 */
export function canStartWithConfig(config) {
  return Boolean(config && (config.approved === true || config.mode === 'DEVELOPMENT'));
}

/** Describe the key for the UI without exposing anything secret (it is educational). */
export function describeConfig(config) {
  const result = validateEncryptionConfig(config);
  if (!result.ok) return { ok: false, errors: result.errors, warnings: result.warnings };
  return {
    ok: true,
    warnings: result.warnings,
    formulas: result.formulas,
    cipher: result.cipher,
    approved: config.approved === true,
    mode: config.mode,
    keyId: config.keyId
  };
}

export { formulaText };
