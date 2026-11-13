/**
 * Central money transfer helpers.
 *
 * A transfer never permits a negative balance. Forced payments first call
 * `canAfford`; if the payer is short, the GameEngine creates a debt-resolution
 * flow instead of silently allowing a negative balance.
 */

import { addLog, getPlayer, recordHistory } from './game-state.js';
import { formatMoney } from '../utils/formatters.js';

export function canAfford(state, playerId, amount) {
  const player = getPlayer(state, playerId);
  return Boolean(player && !player.bankrupt && player.cash >= amount);
}

/**
 * Atomic cash transfer. `toId === null` means the bank.
 * Caller must ensure the payer has enough cash (use canAfford).
 */
export function transferCash(state, profile, { fromId, toId = null, amount, reason }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError('Nominal transfer harus bilangan bulat positif.');
  }
  const payer = getPlayer(state, fromId);
  if (!payer || payer.bankrupt) throw new Error('Pembayar tidak aktif.');
  if (payer.cash < amount) throw new Error('Transfer melebihi saldo pembayar.');
  const recipient = toId ? getPlayer(state, toId) : null;
  if (toId && (!recipient || recipient.bankrupt)) throw new Error('Penerima tidak aktif.');
  if (toId && toId === fromId) throw new Error('Pembayar dan penerima tidak boleh sama.');

  payer.cash -= amount;
  if (recipient) recipient.cash += amount;

  recordHistory(state, {
    type: toId ? 'PAY_PLAYER' : 'PAY_BANK',
    fromId,
    toId,
    amount,
    reason
  });
  addLog(
    state,
    'MONEY',
    recipient
      ? `${payer.name} membayar ${formatMoney(amount, profile.currency)} kepada ${recipient.name} (${reason}).`
      : `${payer.name} membayar ${formatMoney(amount, profile.currency)} ke bank (${reason}).`,
    { fromId, toId, amount, reason }
  );

  return { fromId, toId, amount };
}

/** Bank pays a player (salary, card bonus, auction refunds). */
export function collectFromBank(state, profile, playerId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) throw new RangeError('Nominal harus positif.');
  const player = getPlayer(state, playerId);
  if (!player || player.bankrupt) throw new Error('Pemain tidak aktif.');
  player.cash += amount;
  recordHistory(state, { type: 'COLLECT_BANK', playerId, amount, reason });
  addLog(state, 'MONEY', `${player.name} menerima ${formatMoney(amount, profile.currency)} dari bank (${reason}).`, {
    playerId,
    amount
  });
  return { playerId, amount };
}

/** Repair cost based on the player's current houses/hotels. */
export function calculateRepairCost(state, data, playerId, perHouse, perHotel) {
  let houses = 0;
  let hotels = 0;
  for (const property of Object.values(state.properties)) {
    if (property.ownerId !== playerId) continue;
    const definition = data.propertiesById[property.propertyId];
    if (!definition || definition.kind !== 'STREET') continue;
    houses += property.houses;
    if (property.hotel) hotels += 1;
  }
  return {
    houses,
    hotels,
    amount: houses * perHouse + hotels * perHotel
  };
}

/** True when the player owns at least one asset that can still raise cash. */
export function hasLiquidatableAssets(state, data, playerId) {
  for (const property of Object.values(state.properties)) {
    if (property.ownerId !== playerId) continue;
    const definition = data.propertiesById[property.propertyId];
    if (!definition) continue;
    if (property.hotel || property.houses > 0) return true;
    if (!property.mortgaged) return true;
  }
  return false;
}

/** Estimated cash available after selling all buildings and mortgaging. */
export function liquidationCapacity(state, data, profile, playerId) {
  let total = getPlayer(state, playerId)?.cash ?? 0;
  for (const property of Object.values(state.properties)) {
    if (property.ownerId !== playerId) continue;
    const definition = data.propertiesById[property.propertyId];
    if (!definition) continue;
    if (property.hotel || property.houses > 0) {
      const levels = property.hotel ? 5 : property.houses;
      total += levels * Math.floor((definition.houseCost ?? 0) / 2);
    }
    if (!property.mortgaged) total += definition.mortgageValue;
  }
  return total;
}
