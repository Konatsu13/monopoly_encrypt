/**
 * Save-file validation.
 *
 * Invalid or outdated saves must fail safely with a readable message rather
 * than crashing the game or resuming a corrupted board.
 */

import { validateEncryptionConfig } from '../crypto/crypto-validation.js';
import { DECK_KEYS, MAX_PLAYERS, MIN_PLAYERS, PHASES, SCHEMA_VERSION } from '../core/constants.js';
import { isIntegerInRange, isNonEmptyString, unique } from '../utils/validators.js';

const PHASE_VALUES = Object.values(PHASES);
const PENDING_PHASES = {
  BUY_OR_AUCTION: PHASES.PLAYER_DECISION,
  CARD: PHASES.CARD_DECRYPTION,
  AUCTION: PHASES.AUCTION,
  DEBT: PHASES.DEBT_RESOLUTION,
  TRADE: PHASES.TRADE_PENDING
};

function validatePending(state, data, playerIds, errors) {
  const pending = state.pending;
  if (pending == null) return;
  if (typeof pending !== 'object' || !pending.type) {
    errors.push('Data keputusan tertunda tidak valid.');
    return;
  }
  const expectedPhase = PENDING_PHASES[pending.type];
  if (!expectedPhase) errors.push(`Tipe keputusan tertunda tidak dikenal: ${pending.type}`);
  else if (state.phase !== expectedPhase) errors.push(`Fase ${state.phase} tidak cocok dengan keputusan ${pending.type}.`);

  switch (pending.type) {
    case 'BUY_OR_AUCTION':
      if (!state.properties[pending.spaceId]) errors.push('Properti yang ditawarkan tidak ada di papan.');
      if (!playerIds.includes(pending.playerId)) errors.push('Pemain pembeli tidak valid.');
      break;
    case 'CARD':
      if (!data.cardsById[pending.cardId]) errors.push('Kartu tertunda tidak ada di data.');
      if (!playerIds.includes(pending.playerId)) errors.push('Pemain kartu tidak valid.');
      if (typeof pending.verified !== 'boolean' || typeof pending.effectApplied !== 'boolean') {
        errors.push('Status dekripsi kartu tidak valid.');
      }
      if (pending.effectApplied && !pending.verified) errors.push('Efek kartu tidak boleh sudah diterapkan sebelum dekripsi.');
      break;
    case 'AUCTION': {
      if (!state.properties[pending.spaceId]) errors.push('Properti lelang tidak ada.');
      if (!Array.isArray(pending.order) || pending.order.length < 1) errors.push('Urutan lelang tidak valid.');
      else if (!pending.order.every((id) => playerIds.includes(id))) errors.push('Peserta lelang tidak valid.');
      if (!Array.isArray(pending.activeIds)) errors.push('Peserta aktif lelang tidak valid.');
      if (!playerIds.includes(pending.currentBidderId)) errors.push('Penawar aktif lelang tidak valid.');
      if (pending.highBidderId && !playerIds.includes(pending.highBidderId)) errors.push('Penawar tertinggi lelang tidak valid.');
      if (!Number.isInteger(pending.currentBid) || pending.currentBid < 0) errors.push('Nilai lelang tidak valid.');
      break;
    }
    case 'DEBT':
      if (!playerIds.includes(pending.debtorId)) errors.push('Debitur tidak valid.');
      if (pending.creditorId && !playerIds.includes(pending.creditorId)) errors.push('Kreditur tidak valid.');
      if (!Number.isInteger(pending.amount) || pending.amount <= 0) errors.push('Nominal utang tidak valid.');
      break;
    case 'TRADE': {
      const proposal = pending.proposal;
      if (!proposal || !playerIds.includes(proposal.fromId) || !playerIds.includes(proposal.toId)) {
        errors.push('Penawaran perdagangan tidak valid.');
      } else if (proposal.fromId === proposal.toId) {
        errors.push('Penawaran perdagangan tidak boleh kepada diri sendiri.');
      }
      if (!['offer', 'confirmation'].includes(pending.stage)) errors.push('Tahap perdagangan tidak valid.');
      if (![PHASES.WAITING_FOR_ROLL, PHASES.END_TURN].includes(pending.resumePhase)) {
        errors.push('Fase lanjutan perdagangan tidak valid.');
      }
      break;
    }
    default:
      break;
  }
}

export function validateLoadedState(state, data) {
  const errors = [];

  if (!state || typeof state !== 'object') return { ok: false, errors: ['Isi save bukan objek.'] };
  if (state.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Versi save ${state.schemaVersion ?? 'tidak dikenal'} tidak didukung (butuh ${SCHEMA_VERSION}).`]
    };
  }

  if (!isNonEmptyString(state.gameId)) errors.push('gameId tidak valid.');
  if (state.editionProfileId !== data.profile.id) errors.push('Profil edisi save tidak cocok dengan data saat ini.');
  if (!isNonEmptyString(state.encryptionKeyId)) errors.push('ID kunci sandi tidak valid.');

  const encryption = validateEncryptionConfig(state.encryptionConfig);
  if (!encryption.ok) errors.push(`Kunci sandi pada save tidak valid: ${encryption.errors.join(' ')}`);

  // Players
  if (!Array.isArray(state.players) || state.players.length < MIN_PLAYERS || state.players.length > MAX_PLAYERS) {
    errors.push(`Jumlah pemain pada save harus ${MIN_PLAYERS}–${MAX_PLAYERS}.`);
    return { ok: false, errors };
  }
  if (!unique(state.players.map((player) => player.id))) errors.push('ID pemain pada save duplikat.');
  if (!unique(state.players.map((player) => player.tokenId))) errors.push('Token pemain pada save duplikat.');
  const playerIds = state.players.map((player) => player.id);
  for (const player of state.players) {
    if (!isNonEmptyString(player.id) || !isNonEmptyString(player.name)) errors.push('Nama/ID pemain tidak valid.');
    if (!data.tokens.some((token) => token.id === player.tokenId)) errors.push(`Token ${player.tokenId} tidak dikenal.`);
    if (!Number.isInteger(player.cash) || player.cash < 0) errors.push(`Saldo ${player.name} tidak valid.`);
    if (!isIntegerInRange(player.position, 0, 39)) errors.push(`Posisi ${player.name} tidak valid.`);
    if (typeof player.bankrupt !== 'boolean' || typeof player.inJail !== 'boolean') {
      errors.push(`Status ${player.name} tidak valid.`);
    }
    if (!isIntegerInRange(player.jailTurns, 0, 99)) errors.push(`jailTurns ${player.name} tidak valid.`);
    if (!isIntegerInRange(player.doublesCount, 0, 3)) errors.push(`doublesCount ${player.name} tidak valid.`);
    if (!Array.isArray(player.jailFreeCardIds)) errors.push(`Kartu bebas penjara ${player.name} tidak valid.`);
    else if (!player.jailFreeCardIds.every((id) => Boolean(data.cardsById[id]))) {
      errors.push(`Kartu bebas penjara ${player.name} tidak ada di data.`);
    }
  }

  if (!isIntegerInRange(state.currentPlayerIndex, 0, state.players.length - 1)) {
    errors.push('currentPlayerIndex tidak valid.');
  } else if (state.phase !== PHASES.GAME_OVER && state.players[state.currentPlayerIndex].bankrupt) {
    errors.push('Pemain aktif tidak boleh sudah bangkrut.');
  }
  if (!isIntegerInRange(state.turnNumber, 1, Number.MAX_SAFE_INTEGER)) errors.push('turnNumber tidak valid.');
  if (!PHASE_VALUES.includes(state.phase)) errors.push(`Fase ${state.phase} tidak dikenal.`);

  // Board and properties
  if (!Array.isArray(state.board) || state.board.length !== 40) {
    errors.push('Papan pada save harus berisi 40 petak.');
  } else {
    for (const space of data.spaces) {
      const boardEntry = state.board.find((entry) => entry.spaceId === space.id);
      if (!boardEntry) errors.push(`Petak ${space.id} hilang dari save.`);
    }
  }
  const propertySpaces = data.spaces.filter((space) => space.propertyId);
  for (const space of propertySpaces) {
    const property = state.properties?.[space.id];
    if (!property) {
      errors.push(`Status properti ${space.id} hilang.`);
      continue;
    }
    if (property.spaceId !== space.id) errors.push(`Status properti ${space.id} tidak cocok.`);
    if (property.ownerId !== null && !playerIds.includes(property.ownerId)) {
      errors.push(`Pemilik properti ${space.id} tidak dikenal.`);
    }
    if (!isIntegerInRange(property.houses, 0, 4)) errors.push(`Jumlah rumah ${space.id} tidak valid.`);
    if (typeof property.hotel !== 'boolean' || typeof property.mortgaged !== 'boolean') {
      errors.push(`Status bangunan ${space.id} tidak valid.`);
    }
    if (property.hotel && property.houses !== 0) errors.push(`Properti ${space.id} tidak boleh punya hotel dan rumah sekaligus.`);
  }
  if (state.properties) {
    for (const key of Object.keys(state.properties)) {
      if (!propertySpaces.some((space) => space.id === key)) errors.push(`Properti ${key} tidak ada di papan.`);
    }
  }

  // Decks: every card must exist in exactly one location.
  const seenCards = new Set();
  const addCard = (cardId, where) => {
    if (!data.cardsById[cardId]) {
      errors.push(`Kartu ${cardId} di ${where} tidak dikenal.`);
      return;
    }
    if (seenCards.has(cardId)) errors.push(`Kartu ${cardId} muncul lebih dari sekali (${where}).`);
    seenCards.add(cardId);
  };
  for (const deckKey of DECK_KEYS) {
    const deck = state.decks?.[deckKey];
    if (!deck || !Array.isArray(deck.draw) || !Array.isArray(deck.discard)) {
      errors.push(`Dek ${deckKey} tidak valid.`);
      continue;
    }
    for (const id of deck.draw) {
      if (data.cardsById[id]?.deck !== deckKey) errors.push(`Kartu ${id} berada di dek ${deckKey} yang salah.`);
      addCard(id, `draw ${deckKey}`);
    }
    for (const id of deck.discard) {
      if (data.cardsById[id]?.deck !== deckKey) errors.push(`Kartu ${id} berada di dek ${deckKey} yang salah.`);
      addCard(id, `discard ${deckKey}`);
    }
  }
  for (const player of state.players) {
    for (const id of player.jailFreeCardIds ?? []) addCard(id, `tangan ${player.name}`);
  }
  if (state.pending?.type === 'CARD') addCard(state.pending.cardId, 'kartu tertunda');
  if (seenCards.size !== Object.keys(data.cardsById).length) {
    errors.push(`Jumlah kartu pada save (${seenCards.size}) tidak sama dengan data (${Object.keys(data.cardsById).length}).`);
  }

  // Bank supply invariant.
  let boardHouses = 0;
  let boardHotels = 0;
  for (const property of Object.values(state.properties ?? {})) {
    boardHouses += property.houses;
    if (property.hotel) boardHotels += 1;
  }
  if (!Number.isInteger(state.bank?.houses) || state.bank.houses < 0) errors.push('Persediaan rumah bank tidak valid.');
  if (!Number.isInteger(state.bank?.hotels) || state.bank.hotels < 0) errors.push('Persediaan hotel bank tidak valid.');
  if (state.bank && state.bank.houses + boardHouses !== data.profile.houseSupply) {
    errors.push('Jumlah rumah di bank dan papan tidak sesuai persediaan profil.');
  }
  if (state.bank && state.bank.hotels + boardHotels !== data.profile.hotelSupply) {
    errors.push('Jumlah hotel di bank dan papan tidak sesuai persediaan profil.');
  }

  if (!Array.isArray(state.paymentQueue)) errors.push('paymentQueue tidak valid.');
  else if (!state.paymentQueue.every((item) => playerIds.includes(item.fromId) && (item.toId === null || playerIds.includes(item.toId)) && Number.isInteger(item.amount) && item.amount > 0)) {
    errors.push('Isi paymentQueue tidak valid.');
  }
  if (state.queueCompletion && typeof state.queueCompletion.type !== 'string') errors.push('queueCompletion tidak valid.');

  validatePending(state, data, playerIds, errors);

  if (state.phase === PHASES.GAME_OVER) {
    if (state.winnerId && !playerIds.includes(state.winnerId)) errors.push('Pemenang tidak valid.');
  }
  if (!Array.isArray(state.log) || !Array.isArray(state.history)) errors.push('Log/riwayat save tidak valid.');
  if (!state.settings || typeof state.settings !== 'object') errors.push('Pengaturan save tidak valid.');

  return { ok: errors.length === 0, errors };
}
