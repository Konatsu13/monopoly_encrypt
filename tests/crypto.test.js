import test from 'node:test';
import assert from 'node:assert/strict';
import { mod, gcd, extendedGcd, modInverse, isCoprime, pad2 } from '../src/crypto/modular-math.js';
import {
  letterToIndex,
  indexToLetter,
  normalizeForComparison,
  splitWords
} from '../src/crypto/alphabet.js';
import { buildCipher, linearExpression, formulaText } from '../src/crypto/encryption.js';
import { checkAnswer } from '../src/crypto/decryption.js';
import { validateEncryptionConfig } from '../src/crypto/crypto-validation.js';
import { data } from './helpers/data.js';

const config = data.encryptionConfig;

test('modular math: mod handles negatives', () => {
  assert.equal(mod(-1, 26), 25);
  assert.equal(mod(27, 26), 1);
  assert.equal(mod(0, 26), 0);
});

test('modular math: gcd and extended gcd', () => {
  assert.equal(gcd(5, 26), 1);
  assert.equal(gcd(2, 26), 2);
  assert.equal(gcd(0, 7), 7);
  const { g, x, y } = extendedGcd(5, 26);
  assert.equal(g, 1);
  assert.equal(5 * x + 26 * y, 1);
});

test('modular inverse is computed, not guessed', () => {
  assert.equal(modInverse(5, 26), 21);
  assert.equal(modInverse(7, 26), 15);
  assert.equal(modInverse(9, 26), 3);
  assert.throws(() => modInverse(2, 26), /tidak memiliki invers/);
  assert.equal(isCoprime(13, 26), false);
  assert.equal(isCoprime(15, 26), true);
});

test('alphabet mapping A=0..Z=25', () => {
  assert.equal(letterToIndex('A'), 0);
  assert.equal(letterToIndex('Z'), 25);
  assert.equal(letterToIndex('a'), 0);
  assert.equal(letterToIndex('1'), -1);
  assert.equal(indexToLetter(0), 'A');
  assert.equal(indexToLetter(25), 'Z');
  assert.equal(pad2(8), '08');
});

test('dev key composes f and g correctly: E(x) = (9x + 7) mod 26', () => {
  const cipher = buildCipher(config);
  for (let x = 0; x < 26; x += 1) {
    assert.equal(cipher.encryptIndex(x), (9 * x + 7) % 26);
  }
  assert.equal(cipher.composed.a, 9);
  assert.equal(cipher.composed.b, 7);
  assert.equal(cipher.composedInverse.a, 3);
  assert.equal(cipher.composedInverse.b, 5);
});

test('dev key: A encrypts to display code 08 and 08 decrypts to A', () => {
  const cipher = buildCipher(config);
  assert.equal(cipher.encryptLetter('A'), '08');
  assert.equal(cipher.decryptCode('08'), 'A');
  assert.equal(cipher.decryptIndex(7), 0);
  assert.equal(cipher.encryptText('A'), '08');
  assert.equal(cipher.decryptText('08'), 'A');
});

test('all 26 letters round-trip through encryption and decryption', () => {
  const cipher = buildCipher(config);
  for (let index = 0; index < 26; index += 1) {
    const letter = indexToLetter(index);
    assert.equal(cipher.decryptCode(cipher.encryptLetter(letter)), letter);
  }
});

test('inverse composition reverses order: E^-1(y) = (3y + 5) mod 26', () => {
  const cipher = buildCipher(config);
  for (let y = 0; y < 26; y += 1) {
    assert.equal(cipher.decryptIndex(y), (3 * y + 5) % 26);
  }
});

test('text formatting preserves word separators, punctuation, and literal digits', () => {
  const cipher = buildCipher(config);
  const ciphertext = cipher.encryptText('HALO, DUNIA 2099!');
  assert.match(ciphertext, / \/ /);
  assert.match(ciphertext, /\[2099\]/);
  assert.doesNotMatch(ciphertext, /[A-Z]/);
  assert.equal(cipher.decryptText(ciphertext), 'HALO, DUNIA 2099!');
});

test('hyphenated words and mixed punctuation round-trip', () => {
  const cipher = buildCipher(config);
  const samples = [
    'ALUN-ALUN CIPHER',
    'MAJU KE GERBANG KOTA DAN TERIMA GAJI 200.',
    'ANDA TERPILIH SEBAGAI KETUA ARSIP. BAYAR 50 KEPADA SETIAP PEMAIN LAIN.',
    'PINJAMAN PEMBANGUNAN ANDA CAIR. TERIMA 150.'
  ];
  for (const sample of samples) {
    assert.equal(cipher.decryptText(cipher.encryptText(sample)), sample);
  }
});

test('ciphertext is deterministic for the same key and plaintext', () => {
  const cipher = buildCipher(config);
  assert.equal(cipher.encryptText('CRYPTONIA'), cipher.encryptText('CRYPTONIA'));
});

test('composition order F_AFTER_G is configurable and reversible', () => {
  const alternate = {
    ...config,
    functionF: { type: 'AFFINE', a: 5, b: 8 },
    functionG: { type: 'AFFINE', a: 7, b: 3 },
    compositionOrder: 'F_AFTER_G'
  };
  const cipher = buildCipher(alternate);
  for (let x = 0; x < 26; x += 1) {
    assert.equal(cipher.decryptIndex(cipher.encryptIndex(x)), x);
  }
  assert.match(cipher.formulas.encryption, /E\(x\) = f\(g\(x\)\)/);
  assert.match(cipher.formulas.decryption, /g⁻¹\(f⁻¹\(y\)\)/);
});

test('display offset 0 produces 00..25 and remains reversible', () => {
  const cipher = buildCipher({ ...config, displayOffset: 0 });
  assert.equal(cipher.encryptText('A'), '07');
  assert.equal(cipher.decryptText('07'), 'A');
  assert.equal(cipher.decryptCode('00'), cipher.decryptCode('00'));
});

test('invalid keys are rejected with readable errors', () => {
  assert.equal(validateEncryptionConfig({ ...config, functionF: { type: 'AFFINE', a: 2, b: 1 } }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, functionG: { type: 'AFFINE', a: 13, b: 0 } }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, functionF: { type: 'AFFINE', a: 5.5, b: 1 } }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, modulus: 25 }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, alphabet: 'ABC' }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, compositionOrder: 'WRONG' }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, displayOffset: 3 }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, wordSeparator: 'A' }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, mapping: 'A_TO_1' }).ok, false);
  assert.equal(validateEncryptionConfig(null).ok, false);
});

test('missing key values are rejected', () => {
  assert.equal(validateEncryptionConfig({ ...config, functionF: { type: 'AFFINE', a: null, b: 8 } }).ok, false);
  assert.equal(validateEncryptionConfig({ ...config, functionG: undefined }).ok, false);
});

test('unapproved dev key is valid but warns', () => {
  const result = validateEncryptionConfig(config);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length > 0, true);
  assert.equal(result.formulas.composed.a, 9);
});

test('formula helpers render readable affine expressions', () => {
  assert.equal(linearExpression({ a: 5, b: 8 }), '5x + 8');
  assert.equal(linearExpression({ a: 1, b: 0 }), 'x');
  assert.equal(linearExpression({ a: 1, b: -3 }), 'x - 3');
  assert.equal(formulaText({ a: 21, b: 14 }, 'y'), '21y + 14 mod 26');
});

test('answer comparison ignores case, spacing, and punctuation but not meaning', () => {
  assert.equal(checkAnswer('HALO DUNIA!', 'halo   dunia').correct, true);
  assert.equal(checkAnswer('BAYAR 50 KE BANK', 'bayar 50 ke bank.').correct, true);
  assert.equal(checkAnswer('BAYAR 50 KE BANK', 'bayar 50 dari bank').correct, false);
  assert.equal(checkAnswer('BAYAR 50', 'bayar 60').correct, false);
  assert.equal(checkAnswer('BAYAR 50', '   ').correct, false);
  assert.equal(normalizeForComparison('  A—B  '), 'A B');
});

test('splitWords collapses whitespace but preserves punctuation', () => {
  assert.deepEqual(splitWords('  MAJU   KE KOTA. '), ['MAJU', 'KE', 'KOTA.']);
  assert.deepEqual(splitWords(''), []);
});
