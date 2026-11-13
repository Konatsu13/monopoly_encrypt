/**
 * Card deck mechanics.
 *
 * Deck order is shuffled once at game start. Cards are drawn from the front;
 * resolved cards go to a discard pile. "Get Out of Jail Free" cards are retained
 * by the player and returned to the deck only when used.
 */

import { addLog, getPlayer, returnJailCardToDeck } from './game-state.js';
import { shuffle } from '../utils/random.js';
import { formatMoney } from '../utils/formatters.js';

export function drawCard(state, data, rng, deckKey, playerId) {
  const deck = state.decks[deckKey];
  if (!deck) throw new Error(`Dek ${deckKey} tidak ditemukan.`);

  if (deck.draw.length === 0) {
    if (deck.discard.length === 0) return { ok: false, reason: 'Dek kartu kosong.' };
    deck.draw = shuffle(deck.discard, rng);
    deck.discard = [];
    addLog(state, 'CARDS', `Dek ${data.decks[deckKey].label} diacak ulang dari tumpukan buangan.`);
  }

  const cardId = deck.draw.shift();
  const card = data.cardsById[cardId];
  if (!card) return { ok: false, reason: `Kartu ${cardId} tidak ditemukan di data.` };

  state.stats.cardsDrawn += 1;
  state.lastCardDraw = {
    cardId,
    deck: deckKey,
    playerId,
    turn: state.turnNumber
  };
  addLog(state, 'CARDS', `${getPlayer(state, playerId)?.name ?? 'Investor'} menarik kartu terenkripsi dari ${data.decks[deckKey].label}.`, {
    playerId,
    deck: deckKey
  });
  return { ok: true, card };
}

/** Resolve a card into discard or the player's retained jail-free hand. */
export function resolveCardIntoDeck(state, data, card, playerId) {
  const player = getPlayer(state, playerId);
  if (!player) return;
  if (card.retain) {
    if (!player.jailFreeCardIds.includes(card.id)) player.jailFreeCardIds.push(card.id);
    return;
  }
  state.decks[card.deck].discard.push(card.id);
}

/** Use a retained jail card and put it at the bottom of its deck. */
export function useRetainedJailCard(state, data, playerId) {
  const player = getPlayer(state, playerId);
  if (!player || player.jailFreeCardIds.length === 0) {
    return { ok: false, reason: 'Tidak ada kartu bebas penjara.' };
  }
  const cardId = player.jailFreeCardIds.shift();
  returnJailCardToDeck(state, data, cardId);
  addLog(state, 'JAIL', `${player.name} memakai kartu bebas penjara; kartu dikembalikan ke dek.`, { playerId });
  return { ok: true, cardId };
}

/** Human-readable summary of a structured effect (only used after decoding). */
export function effectSummary(card, profile) {
  const effect = card.effect;
  switch (effect.type) {
    case 'MOVE_TO':
      return `Pindah ke petak ${effect.spaceId}${effect.collectGo ? ' dan terima gaji bila melewati Gerbang Kota' : ''}.`;
    case 'MOVE_RELATIVE':
      return `Bergerak ${Math.abs(effect.steps)} petak ke ${effect.steps < 0 ? 'belakang' : 'depan'}.`;
    case 'MOVE_TO_NEAREST':
      return `Pindah ke ${effect.kind === 'RAILROAD' ? 'stasiun' : 'utilitas'} terdekat; pembayaran dikali ${effect.rentMultiplier}.`;
    case 'COLLECT_BANK':
      return `Terima ${formatMoney(effect.amount, profile.currency)} dari bank.`;
    case 'PAY_BANK':
      return `Bayar ${formatMoney(effect.amount, profile.currency)} ke bank.`;
    case 'COLLECT_EACH':
      return `Terima ${formatMoney(effect.amount, profile.currency)} dari setiap pemain lain.`;
    case 'PAY_EACH':
      return `Bayar ${formatMoney(effect.amount, profile.currency)} kepada setiap pemain lain.`;
    case 'GO_TO_JAIL':
      return 'Masuk ke Pusat Detensi tanpa melewati Gerbang Kota.';
    case 'GET_OUT_OF_JAIL':
      return 'Simpan kartu bebas penjara.';
    case 'REPAIR':
      return `Bayar ${formatMoney(effect.perHouse, profile.currency)} per rumah dan ${formatMoney(effect.perHotel, profile.currency)} per hotel.`;
    default:
      return 'Efek tidak dikenal.';
  }
}

export function deckIsEmpty(state, deckKey) {
  return state.decks[deckKey].draw.length === 0 && state.decks[deckKey].discard.length === 0;
}
