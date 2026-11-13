/**
 * Player-to-player trade validation and atomic execution.
 *
 * Restricted to cash, eligible unbuilt properties, and get-out-of-jail cards.
 * Properties with buildings (or with any building in their color group) cannot
 * be traded until the buildings are sold. Both sides confirm in the UI before
 * `executeTrade` is called.
 */

import { addLog, getPlayer, recordHistory } from './game-state.js';
import { hasBuildingsAnywhereInGroup } from './property-engine.js';
import { formatMoney } from '../utils/formatters.js';

function validateSide(state, data, playerId, propertyIds, cash, jailCardCount, label) {
  const player = getPlayer(state, playerId);
  if (!player || player.bankrupt) return `${label} tidak aktif.`;
  if (!Number.isInteger(cash) || cash < 0) return `Uang dari ${label} tidak valid.`;
  if (cash > player.cash) return `Uang dari ${label} melebihi saldo.`;
  if (!Number.isInteger(jailCardCount) || jailCardCount < 0 || jailCardCount > player.jailFreeCardIds.length) {
    return `Jumlah kartu bebas penjara ${label} tidak valid.`;
  }
  if (!Array.isArray(propertyIds) || new Set(propertyIds).size !== propertyIds.length) {
    return `Daftar properti ${label} tidak valid.`;
  }
  for (const spaceId of propertyIds) {
    const property = state.properties[spaceId];
    const definition = data.propertiesBySpaceId[spaceId];
    if (!property || !definition) return `Properti ${spaceId} tidak valid.`;
    if (property.ownerId !== playerId) return `Properti ${spaceId} bukan milik ${label}.`;
    if (definition.kind === 'STREET' && hasBuildingsAnywhereInGroup(state, data, definition.group)) {
      return `Properti ${spaceId} tidak dapat diperdagangkan sebelum bangunan di grupnya dijual.`;
    }
  }
  return null;
}

export function validateTrade(state, data, profile, proposal) {
  if (!proposal || typeof proposal !== 'object') return { ok: false, reason: 'Penawaran tidak valid.' };
  const { fromId, toId, fromProperties = [], toProperties = [], fromCash = 0, toCash = 0, fromJailCards = 0, toJailCards = 0 } = proposal;

  if (fromId === toId) return { ok: false, reason: 'Tidak dapat bertukar dengan diri sendiri.' };
  if (!getPlayer(state, fromId) || !getPlayer(state, toId)) return { ok: false, reason: 'Pemain tidak ditemukan.' };
  if (fromCash > 0 && toCash > 0) {
    // Not illegal per se, but confusing and can hide a net transfer. Keep it
    // explicit for the classroom context.
    return { ok: false, reason: 'Isi uang hanya dari satu sisi penawaran.' };
  }

  const errors = [
    validateSide(state, data, fromId, fromProperties, fromCash, fromJailCards, 'penawar'),
    validateSide(state, data, toId, toProperties, toCash, toJailCards, 'penerima')
  ].filter(Boolean);

  if (errors.length > 0) return { ok: false, reason: errors[0] };
  if (fromProperties.length + toProperties.length + fromCash + toCash + fromJailCards + toJailCards === 0) {
    return { ok: false, reason: 'Penawaran tidak berisi aset apa pun.' };
  }

  return { ok: true };
}

export function executeTrade(state, data, profile, proposal) {
  const validation = validateTrade(state, data, profile, proposal);
  if (!validation.ok) return validation;

  const from = getPlayer(state, proposal.fromId);
  const to = getPlayer(state, proposal.toId);
  const fromCash = proposal.fromCash ?? 0;
  const toCash = proposal.toCash ?? 0;
  const fromProperties = proposal.fromProperties ?? [];
  const toProperties = proposal.toProperties ?? [];
  const fromJailCards = proposal.fromJailCards ?? 0;
  const toJailCards = proposal.toJailCards ?? 0;

  // Validate once more and then mutate only after all checks pass.
  from.cash = from.cash - fromCash + toCash;
  to.cash = to.cash - toCash + fromCash;

  for (const spaceId of fromProperties) state.properties[spaceId].ownerId = proposal.toId;
  for (const spaceId of toProperties) state.properties[spaceId].ownerId = proposal.fromId;

  if (fromJailCards > 0) {
    const moved = from.jailFreeCardIds.splice(0, fromJailCards);
    to.jailFreeCardIds.push(...moved);
  }
  if (toJailCards > 0) {
    const moved = to.jailFreeCardIds.splice(0, toJailCards);
    from.jailFreeCardIds.push(...moved);
  }

  recordHistory(state, {
    type: 'TRADE',
    fromId: proposal.fromId,
    toId: proposal.toId,
    fromCash,
    toCash,
    fromProperties,
    toProperties,
    fromJailCards,
    toJailCards,
    reason: 'Pertukaran pemain'
  });
  addLog(
    state,
    'TRADE',
    `${from.name} dan ${to.name} menyelesaikan pertukaran aset (${formatMoney(fromCash, profile.currency)} + ${fromProperties.length} properti ↔ ${formatMoney(toCash, profile.currency)} + ${toProperties.length} properti).`,
    { fromId: from.id, toId: to.id }
  );

  return { ok: true };
}

/** Human-readable proposal used by the confirmation dialog. */
export function summarizeTrade(state, data, profile, proposal) {
  const from = getPlayer(state, proposal.fromId);
  const to = getPlayer(state, proposal.toId);
  return {
    from: {
      player: from,
      cash: proposal.fromCash ?? 0,
      cards: proposal.fromJailCards ?? 0,
      properties: (proposal.fromProperties ?? []).map((spaceId) => data.spacesById[spaceId])
    },
    to: {
      player: to,
      cash: proposal.toCash ?? 0,
      cards: proposal.toJailCards ?? 0,
      properties: (proposal.toProperties ?? []).map((spaceId) => data.spacesById[spaceId])
    }
  };
}
