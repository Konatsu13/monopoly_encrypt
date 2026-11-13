/**
 * Mortgage and unmortgage rules.
 *
 * A mortgaged property collects no rent and cannot be built on. Selling all
 * buildings in its color group is required before mortgaging.
 */

import { addLog, getGroupProperties, getPlayer, recordHistory } from './game-state.js';
import { getPropertyDefinition } from './property-engine.js';
import { formatMoney } from '../utils/formatters.js';

export function unmortgageCost(definition, interestRate) {
  return Math.ceil(definition.mortgageValue * (1 + interestRate));
}

export function canMortgage(state, data, playerId, spaceId) {
  const player = getPlayer(state, playerId);
  const definition = getPropertyDefinition(data, spaceId);
  const property = state.properties[spaceId];

  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (!definition || !property) return { ok: false, reason: 'Petak ini bukan properti.' };
  if (property.ownerId !== playerId) return { ok: false, reason: 'Anda bukan pemilik properti ini.' };
  if (property.mortgaged) return { ok: false, reason: 'Properti sudah digadaikan.' };

  if (definition.kind === 'STREET') {
    const groupProperties = getGroupProperties(state, data, definition.group);
    if (groupProperties.some((entry) => entry.hotel || entry.houses > 0)) {
      return { ok: false, reason: 'Jual semua bangunan di grup warna ini sebelum menggadaikan properti.' };
    }
  }

  return { ok: true, value: definition.mortgageValue };
}

export function mortgageProperty(state, data, profile, playerId, spaceId) {
  const validation = canMortgage(state, data, playerId, spaceId);
  if (!validation.ok) return validation;

  const player = getPlayer(state, playerId);
  const property = state.properties[spaceId];
  player.cash += validation.value;
  property.mortgaged = true;

  recordHistory(state, {
    type: 'MORTGAGE',
    playerId,
    spaceId,
    amount: validation.value,
    reason: 'Gadai properti'
  });
  addLog(
    state,
    'MONEY',
    `${player.name} menggadaikan properti terenkripsi petak ${data.spacesById[spaceId].index} dan menerima ${formatMoney(validation.value, profile.currency)}.`,
    { playerId, spaceId, amount: validation.value }
  );

  return { ok: true, value: validation.value };
}

export function canUnmortgage(state, data, profile, playerId, spaceId) {
  const player = getPlayer(state, playerId);
  const definition = getPropertyDefinition(data, spaceId);
  const property = state.properties[spaceId];

  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (!definition || !property) return { ok: false, reason: 'Petak ini bukan properti.' };
  if (property.ownerId !== playerId) return { ok: false, reason: 'Anda bukan pemilik properti ini.' };
  if (!property.mortgaged) return { ok: false, reason: 'Properti tidak sedang digadaikan.' };

  const cost = unmortgageCost(definition, profile.mortgageInterestRate);
  if (player.cash < cost) {
    return { ok: false, reason: `Saldo tidak cukup untuk menebus (${formatMoney(cost, profile.currency)}).` };
  }
  return { ok: true, cost };
}

export function unmortgageProperty(state, data, profile, playerId, spaceId) {
  const validation = canUnmortgage(state, data, profile, playerId, spaceId);
  if (!validation.ok) return validation;

  const player = getPlayer(state, playerId);
  const property = state.properties[spaceId];
  player.cash -= validation.cost;
  property.mortgaged = false;

  recordHistory(state, {
    type: 'UNMORTGAGE',
    playerId,
    spaceId,
    amount: validation.cost,
    reason: 'Tebus gadai'
  });
  addLog(
    state,
    'MONEY',
    `${player.name} menebus properti terenkripsi petak ${data.spacesById[spaceId].index} sebesar ${formatMoney(validation.cost, profile.currency)}.`,
    { playerId, spaceId, amount: validation.cost }
  );

  return { ok: true, cost: validation.cost };
}
