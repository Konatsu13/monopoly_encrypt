/**
 * Property and rent rules.
 *
 * Rent is always derived from structured deed data and current property state.
 * Displayed ciphertext is never parsed to decide a rule.
 */

import { addLog, countOwnedByKind, getOwnedProperties, getPlayer, ownsWholeGroup, recordHistory } from './game-state.js';
import { formatMoney } from '../utils/formatters.js';

export function getPropertyDefinition(data, spaceId) {
  const space = data.spacesById[spaceId];
  if (!space?.propertyId) return null;
  return data.propertiesById[space.propertyId] ?? null;
}

export function getPropertyState(state, spaceId) {
  return state.properties[spaceId] ?? null;
}

export function isUnowned(state, spaceId) {
  return state.properties[spaceId]?.ownerId == null;
}

export function isOwnedBy(state, spaceId, playerId) {
  return state.properties[spaceId]?.ownerId === playerId;
}

export function isMortgaged(state, spaceId) {
  return Boolean(state.properties[spaceId]?.mortgaged);
}

export function hasBuildingsAnywhereInGroup(state, data, group) {
  const ids = data.groupSpaceIds[group] ?? [];
  return ids.some((spaceId) => {
    const property = state.properties[spaceId];
    return Boolean(property?.hotel || property?.houses > 0);
  });
}

/**
 * Calculate rent for landing on a purchasable property.
 * Returns { amount, description } and never mutates state.
 */
export function calculateRent(state, data, profile, spaceId, options = {}) {
  const propertyState = state.properties[spaceId];
  const definition = getPropertyDefinition(data, spaceId);
  if (!propertyState || !definition) return { amount: 0, description: 'Bukan properti.' };
  if (!propertyState.ownerId) return { amount: 0, description: 'Properti belum dimiliki.' };

  const owner = getPlayer(state, propertyState.ownerId);
  if (!owner || owner.bankrupt) return { amount: 0, description: 'Pemilik tidak aktif.' };
  if (propertyState.mortgaged) return { amount: 0, description: 'Properti sedang digadaikan.' };

  if (definition.kind === 'STREET') {
    const level = propertyState.hotel ? 5 : propertyState.houses;
    if (level > 0) {
      return {
        amount: definition.rent[level],
        description: `${definition.rent[level]} karena ${propertyState.hotel ? 'hotel' : `${propertyState.houses} rumah`}.`
      };
    }
    if (ownsWholeGroup(state, data, owner.id, definition.group)) {
      return {
        amount: definition.rent[0] * 2,
        description: `${definition.rent[0] * 2} karena seluruh grup warna dimiliki.`
      };
    }
    return { amount: definition.rent[0], description: `${definition.rent[0]} sewa dasar.` };
  }

  if (definition.kind === 'RAILROAD') {
    const count = countOwnedByKind(state, data, owner.id, 'RAILROAD');
    const base = profile.railroadRent[Math.max(0, Math.min(3, count - 1))] ?? 0;
    const multiplier = options.rentMultiplier ?? 1;
    return {
      amount: base * multiplier,
      description: `${formatMoney(base, profile.currency)} × ${multiplier} (${count} stasiun dimiliki).`
    };
  }

  if (definition.kind === 'UTILITY') {
    const diceTotal = options.diceTotal ?? state.lastDice?.total;
    if (!Number.isInteger(diceTotal) || diceTotal <= 0) {
      throw new Error('Sewa utilitas membutuhkan total dadu.');
    }
    const count = countOwnedByKind(state, data, owner.id, 'UTILITY');
    const multiplier = options.rentMultiplier ?? profile.utilityRentMultiplier[Math.max(0, Math.min(1, count - 1))];
    return {
      amount: diceTotal * multiplier,
      description: `${diceTotal} × ${multiplier} (${count} utilitas dimiliki).`
    };
  }

  return { amount: 0, description: 'Tidak ada sewa.' };
}

/** Validate a purchase without mutating state. */
export function canBuyProperty(state, data, playerId, spaceId) {
  const player = getPlayer(state, playerId);
  const propertyState = state.properties[spaceId];
  const definition = getPropertyDefinition(data, spaceId);
  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (!propertyState || !definition) return { ok: false, reason: 'Petak ini bukan properti.' };
  if (propertyState.ownerId) return { ok: false, reason: 'Properti sudah dimiliki pemain lain.' };
  if (player.cash < definition.price) {
    return { ok: false, reason: `Saldo tidak cukup. Harga ${formatMoney(definition.price)}.` };
  }
  return { ok: true, price: definition.price };
}

/** Buy a property atomically: validate, debit, assign owner, record. */
export function buyProperty(state, data, profile, playerId, spaceId) {
  const validation = canBuyProperty(state, data, playerId, spaceId);
  if (!validation.ok) return validation;

  const player = getPlayer(state, playerId);
  const propertyState = state.properties[spaceId];
  const definition = getPropertyDefinition(data, spaceId);

  player.cash -= definition.price;
  propertyState.ownerId = playerId;

  recordHistory(state, {
    type: 'PURCHASE',
    playerId,
    spaceId,
    amount: definition.price,
    reason: 'Pembelian properti'
  });
  addLog(
    state,
    'PROPERTY',
    `${player.name} membeli properti terenkripsi di petak ${data.spacesById[spaceId].index} seharga ${formatMoney(definition.price, profile.currency)}.`,
    { playerId, spaceId, amount: definition.price }
  );

  return { ok: true, price: definition.price, property: propertyState, definition };
}

/** Return deed rows for the build/mortgage panel. */
export function describeDeed(state, data, spaceId) {
  const definition = getPropertyDefinition(data, spaceId);
  const propertyState = state.properties[spaceId];
  if (!definition || !propertyState) return null;
  return {
    spaceId,
    propertyId: definition.id,
    kind: definition.kind,
    group: definition.group,
    price: definition.price,
    mortgageValue: definition.mortgageValue,
    houseCost: definition.houseCost ?? null,
    rent: definition.rent ?? null,
    houses: propertyState.houses,
    hotel: propertyState.hotel,
    mortgaged: propertyState.mortgaged,
    ownerId: propertyState.ownerId
  };
}

/** All owned properties grouped for the asset panel. */
export function summarizeAssets(state, data, playerId) {
  return getOwnedProperties(state, data, playerId).map((property) => {
    const definition = data.propertiesById[property.propertyId];
    return {
      spaceId: property.spaceId,
      index: data.spacesById[property.spaceId].index,
      kind: definition.kind,
      group: definition.group,
      houses: property.houses,
      hotel: property.hotel,
      mortgaged: property.mortgaged,
      price: definition.price,
      houseCost: definition.houseCost ?? null,
      mortgageValue: definition.mortgageValue
    };
  });
}
