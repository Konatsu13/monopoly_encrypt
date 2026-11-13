/**
 * Data validation for the board, edition profile, card decks, tokens, story,
 * and cipher key. The game refuses to start with invalid required data.
 */

import { validateEncryptionConfig } from './crypto/crypto-validation.js';
import { CARD_EFFECT_TYPES, DECK_KEYS, MAX_PLAYERS, MIN_PLAYERS, SPACE_TYPES } from './core/constants.js';
import { isIntegerInRange, isNonEmptyString, unique } from './utils/validators.js';

const REQUIRED_STORY_KEYS = ['title', 'year', 'prologue', 'setup', 'gameIntro', 'decks', 'jail', 'bankruptcy', 'winner'];
const REQUIRED_PROFILE_FIELDS = [
  'id',
  'startingCash',
  'goSalary',
  'jailFine',
  'jailMaxTurns',
  'jailPosition',
  'goToJailPosition',
  'mortgageInterestRate',
  'houseSupply',
  'hotelSupply',
  'maxHousesPerProperty',
  'auctionMinIncrement',
  'endCondition'
];

function checkCardEffect(card, data, errors) {
  const effect = card.effect;
  if (!effect || typeof effect !== 'object') {
    errors.push(`Kartu ${card.id} tidak memiliki efek terstruktur.`);
    return;
  }
  if (!CARD_EFFECT_TYPES.includes(effect.type)) {
    errors.push(`Kartu ${card.id} memakai tipe efek yang tidak didukung: ${effect.type}`);
    return;
  }
  switch (effect.type) {
    case 'MOVE_TO':
      if (!data.spacesById[effect.spaceId]) errors.push(`Kartu ${card.id}: tujuan ${effect.spaceId} tidak ada.`);
      if (typeof effect.collectGo !== 'boolean') errors.push(`Kartu ${card.id}: collectGo harus boolean.`);
      break;
    case 'MOVE_RELATIVE':
      if (!Number.isInteger(effect.steps) || effect.steps === 0) {
        errors.push(`Kartu ${card.id}: steps harus bilangan bulat bukan nol.`);
      }
      break;
    case 'MOVE_TO_NEAREST':
      if (!['RAILROAD', 'UTILITY'].includes(effect.kind)) {
        errors.push(`Kartu ${card.id}: kind MOVE_TO_NEAREST harus RAILROAD atau UTILITY.`);
      }
      if (!Number.isInteger(effect.rentMultiplier) || effect.rentMultiplier < 1) {
        errors.push(`Kartu ${card.id}: rentMultiplier tidak valid.`);
      }
      break;
    case 'COLLECT_BANK':
    case 'PAY_BANK':
    case 'COLLECT_EACH':
    case 'PAY_EACH':
      if (!Number.isInteger(effect.amount) || effect.amount <= 0) {
        errors.push(`Kartu ${card.id}: amount harus bilangan bulat positif.`);
      }
      break;
    case 'REPAIR':
      if (!Number.isInteger(effect.perHouse) || !Number.isInteger(effect.perHotel) || effect.perHouse < 0 || effect.perHotel < 0) {
        errors.push(`Kartu ${card.id}: biaya REPAIR tidak valid.`);
      }
      break;
    default:
      break;
  }
}

export function validateGameData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['Data permainan tidak ditemukan.'], warnings };
  }

  // --- Profile -----------------------------------------------------------
  const profile = data.profile;
  if (!profile || typeof profile !== 'object') {
    errors.push('Profil edisi tidak ditemukan.');
  } else {
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (profile[field] === undefined) errors.push(`Profil edisi kehilangan field ${field}.`);
    }
    for (const field of ['startingCash', 'goSalary', 'jailFine', 'houseSupply', 'hotelSupply']) {
      if (!Number.isInteger(profile[field]) || profile[field] < 0) {
        errors.push(`Profil edisi: ${field} harus bilangan bulat non-negatif.`);
      }
    }
    if (!Number.isInteger(profile.jailMaxTurns) || profile.jailMaxTurns < 1) {
      errors.push('Profil edisi: jailMaxTurns minimal 1.');
    }
    if (profile.maxHousesPerProperty !== 4) {
      errors.push('Profil edisi: maxHousesPerProperty harus 4 agar cocok dengan tabel sewa 6 tingkat.');
    }
    if (!isIntegerInRange(profile.jailPosition, 0, 39) || !isIntegerInRange(profile.goToJailPosition, 0, 39)) {
      errors.push('Profil edisi: posisi penjara harus 0–39.');
    }
    if (profile.endCondition !== 'LAST_SOLVENT') {
      errors.push('Profil edisi: endCondition yang didukung saat ini hanya LAST_SOLVENT.');
    }
    if (!Array.isArray(profile.railroadRent) || profile.railroadRent.length !== 4) {
      errors.push('Profil edisi: railroadRent harus berisi 4 nilai.');
    }
    if (!Array.isArray(profile.utilityRentMultiplier) || profile.utilityRentMultiplier.length !== 2) {
      errors.push('Profil edisi: utilityRentMultiplier harus berisi 2 nilai.');
    }
  }

  // --- Board -------------------------------------------------------------
  const spaces = data.spaces ?? data.boardSpaces?.spaces;
  if (!Array.isArray(spaces)) {
    errors.push('Data papan tidak ditemukan.');
    return { ok: false, errors, warnings };
  }
  if (spaces.length !== 40) errors.push(`Papan harus berisi 40 petak (ditemukan ${spaces.length}).`);
  if (!unique(spaces.map((space) => space.id))) errors.push('ID petak harus unik.');
  const indexes = spaces.map((space) => space.index).sort((a, b) => a - b);
  for (let index = 0; index < 40; index += 1) {
    if (indexes[index] !== index) {
      errors.push('Indeks petak harus lengkap dari 0 sampai 39 tanpa duplikat.');
      break;
    }
  }
  for (const space of spaces) {
    if (!Object.values(SPACE_TYPES).includes(space.type)) {
      errors.push(`Petak ${space.id} memakai tipe tidak dikenal: ${space.type}`);
    }
    if (!isNonEmptyString(space.name)) errors.push(`Petak ${space.id} tidak memiliki nama.`);
    if (['PROPERTY', 'RAILROAD', 'UTILITY'].includes(space.type)) {
      if (!space.propertyId) errors.push(`Petak ${space.id} tidak merujuk properti.`);
    }
    if (space.type === 'TAX' && (!Number.isInteger(space.taxAmount) || space.taxAmount <= 0)) {
      errors.push(`Petak pajak ${space.id} membutuhkan taxAmount positif.`);
    }
  }

  // --- Properties --------------------------------------------------------
  const properties = data.propertiesById ?? data.properties?.properties ?? data.properties;
  if (!properties || typeof properties !== 'object') {
    errors.push('Data properti tidak ditemukan.');
  } else {
    const propertyList = Object.values(properties);
    if (!unique(propertyList.map((property) => property.id))) errors.push('ID properti harus unik.');
    for (const property of propertyList) {
      const space = spaces.find((candidate) => candidate.id === property.spaceId);
      if (!space) {
        errors.push(`Properti ${property.id} merujuk petak yang tidak ada.`);
        continue;
      }
      if (space.propertyId !== property.id) {
        errors.push(`Properti ${property.id} tidak cocok dengan petak ${space.id}.`);
      }
      if (!['STREET', 'RAILROAD', 'UTILITY'].includes(property.kind)) {
        errors.push(`Properti ${property.id} memiliki kind tidak valid.`);
      }
      if (property.kind === 'STREET' && space.type !== 'PROPERTY') {
        errors.push(`Properti jalan ${property.id} harus berada di petak PROPERTY.`);
      }
      if (property.kind === 'RAILROAD' && space.type !== 'RAILROAD') {
        errors.push(`Properti stasiun ${property.id} harus berada di petak RAILROAD.`);
      }
      if (property.kind === 'UTILITY' && space.type !== 'UTILITY') {
        errors.push(`Properti utilitas ${property.id} harus berada di petak UTILITY.`);
      }
      if (!Number.isInteger(property.price) || property.price <= 0) {
        errors.push(`Properti ${property.id}: harga harus positif.`);
      }
      if (!Number.isInteger(property.mortgageValue) || property.mortgageValue <= 0) {
        errors.push(`Properti ${property.id}: nilai gadai harus positif.`);
      }
      if (property.kind === 'STREET') {
        if (!Array.isArray(property.rent) || property.rent.length !== 6) {
          errors.push(`Properti ${property.id}: tabel sewa harus berisi 6 nilai.`);
        }
        if (!Number.isInteger(property.houseCost) || property.houseCost <= 0) {
          errors.push(`Properti ${property.id}: biaya rumah harus positif.`);
        }
        if (!isNonEmptyString(property.group)) {
          errors.push(`Properti ${property.id}: grup warna wajib diisi.`);
        }
      }
    }

    // Every playable space must have exactly one property definition.
    for (const space of spaces) {
      if (['PROPERTY', 'RAILROAD', 'UTILITY'].includes(space.type)) {
        const property = propertyList.find((candidate) => candidate.spaceId === space.id);
        if (!property) errors.push(`Petak ${space.id} belum memiliki data properti.`);
      }
    }

    // A color group must contain at least two streets.
    if (data.groupSpaceIds) {
      for (const [group, ids] of Object.entries(data.groupSpaceIds)) {
        if (ids.length < 2) errors.push(`Grup warna ${group} hanya memiliki ${ids.length} properti.`);
      }
    }
  }

  // --- Decks -------------------------------------------------------------
  for (const deckKey of DECK_KEYS) {
    const cards = data.cardsByDeck?.[deckKey] ?? (deckKey === 'chance' ? data.chanceCards?.cards : data.communityChestCards?.cards);
    if (!Array.isArray(cards) || cards.length === 0) {
      errors.push(`Dek ${deckKey} tidak memiliki kartu.`);
      continue;
    }
    if (!unique(cards.map((card) => card.id))) errors.push(`ID kartu pada dek ${deckKey} harus unik.`);
    if (cards.length < 8) warnings.push(`Dek ${deckKey} hanya berisi ${cards.length} kartu; periksa profil edisi.`);
    if (cards.length !== 16) warnings.push(`Dek ${deckKey} berisi ${cards.length} kartu (referensi klasik umumnya 16).`);
    for (const card of cards) {
      if (card.deck !== deckKey) errors.push(`Kartu ${card.id} berada di dek yang salah.`);
      if (!isNonEmptyString(card.plaintext)) errors.push(`Kartu ${card.id} tidak memiliki plaintext.`);
      checkCardEffect(card, data, errors);
    }
  }

  // --- Story -------------------------------------------------------------
  if (!data.story || typeof data.story !== 'object') {
    errors.push('Data cerita tidak ditemukan.');
  } else {
    for (const key of REQUIRED_STORY_KEYS) {
      if (!data.story[key]) errors.push(`Cerita kehilangan bagian "${key}".`);
    }
    if (!Array.isArray(data.story.prologue?.slides) || data.story.prologue.slides.length === 0) {
      errors.push('Prolog cerita harus memiliki minimal satu layar.');
    }
    for (const deckKey of DECK_KEYS) {
      if (!data.story.decks?.[deckKey]?.label) errors.push(`Cerita dek ${deckKey} belum diisi.`);
    }
  }

  // --- Tokens ------------------------------------------------------------
  if (!Array.isArray(data.tokens) || data.tokens.length < MIN_PLAYERS) {
    errors.push('Daftar token harus berisi minimal 2 token.');
  } else {
    if (!unique(data.tokens.map((token) => token.id))) errors.push('ID token harus unik.');
    if (data.tokens.length < MAX_PLAYERS) warnings.push('Token tersedia kurang dari 8; jumlah pemain maksimum akan dibatasi.');
  }

  // --- Encryption --------------------------------------------------------
  const encryption = validateEncryptionConfig(data.encryptionConfig);
  if (!encryption.ok) {
    for (const error of encryption.errors) errors.push(`Enkripsi: ${error}`);
  }
  warnings.push(...encryption.warnings);

  // --- Limits ------------------------------------------------------------
  if (data.tokens?.length < MIN_PLAYERS) errors.push('Minimal dua token diperlukan.');

  return { ok: errors.length === 0, errors, warnings };
}

/** Human-readable summary for startup error screens. */
export function summarizeValidation(result) {
  if (result.ok) return 'Data permainan valid.';
  return `Data permainan tidak valid:\n- ${result.errors.join('\n- ')}`;
}
