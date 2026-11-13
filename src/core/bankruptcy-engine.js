/**
 * Bankruptcy settlement.
 *
 * Provisional documented behavior (see OPEN_QUESTIONS.md):
 * - money and valuable assets are transferred to the creditor when another
 *   player is owed;
 * - when the bank is owed, properties return to the bank as unowned and any
 *   mortgage is cleared;
 * - buildings are liquidated at half construction cost before settlement.
 */

import { addLog, getPlayer, recordHistory, returnJailCardToDeck } from './game-state.js';
import { formatMoney } from '../utils/formatters.js';

function liquidateBuildings(state, data, profile, debtorId) {
  let cash = 0;
  let housesRemoved = 0;
  let hotelsRemoved = 0;

  for (const property of Object.values(state.properties)) {
    if (property.ownerId !== debtorId) continue;
    const definition = data.propertiesById[property.propertyId];
    if (!definition || definition.kind !== 'STREET') continue;

    if (property.hotel) {
      cash += Math.floor(definition.houseCost * 2.5);
      state.bank.hotels += 1;
      property.hotel = false;
      hotelsRemoved += 1;
    }
    if (property.houses > 0) {
      cash += property.houses * Math.floor(definition.houseCost / 2);
      state.bank.houses += property.houses;
      housesRemoved += property.houses;
      property.houses = 0;
    }
  }

  return { cash, housesRemoved, hotelsRemoved };
}

/**
 * Settle a bankrupt player's estate. Returns a summary for the UI.
 * The caller is responsible for turn advancement and winner detection.
 */
export function settleBankruptcy(state, data, profile, debtorId, creditorId = null) {
  const debtor = getPlayer(state, debtorId);
  if (!debtor || debtor.bankrupt) return { ok: false, reason: 'Pemain sudah bangkrut atau tidak ditemukan.' };

  const creditor = creditorId ? getPlayer(state, creditorId) : null;
  const effectiveCreditor = creditor && !creditor.bankrupt ? creditor : null;

  const liquidation = liquidateBuildings(state, data, profile, debtorId);
  debtor.cash += liquidation.cash;

  const cashAmount = debtor.cash;
  let propertiesTransferred = 0;

  if (effectiveCreditor) {
    if (cashAmount > 0) {
      effectiveCreditor.cash += cashAmount;
      debtor.cash = 0;
    }
    for (const property of Object.values(state.properties)) {
      if (property.ownerId !== debtorId) continue;
      property.ownerId = effectiveCreditor.id;
      propertiesTransferred += 1;
    }
    for (const cardId of debtor.jailFreeCardIds) {
      effectiveCreditor.jailFreeCardIds.push(cardId);
    }
    debtor.jailFreeCardIds = [];
  } else {
    debtor.cash = 0;
    for (const property of Object.values(state.properties)) {
      if (property.ownerId !== debtorId) continue;
      property.ownerId = null;
      property.mortgaged = false;
      propertiesTransferred += 1;
    }
    for (const cardId of debtor.jailFreeCardIds) {
      returnJailCardToDeck(state, data, cardId);
    }
    debtor.jailFreeCardIds = [];
  }

  debtor.bankrupt = true;
  debtor.inJail = false;
  debtor.jailTurns = 0;
  debtor.doublesCount = 0;
  state.stats.bankruptcies += 1;

  recordHistory(state, {
    type: 'BANKRUPTCY',
    playerId: debtorId,
    creditorId: effectiveCreditor?.id ?? null,
    amount: cashAmount,
    reason: 'Kewajiban tidak terpenuhi'
  });
  addLog(
    state,
    'BANKRUPTCY',
    `${debtor.name} dinyatakan bangkrut. ${effectiveCreditor ? `Aset dialihkan kepada ${effectiveCreditor.name}` : 'Aset dikembalikan ke bank'} (${formatMoney(cashAmount, profile.currency)} tunai, ${propertiesTransferred} properti).`,
    { playerId: debtorId, creditorId: effectiveCreditor?.id ?? null }
  );

  return {
    ok: true,
    debtorId,
    creditorId: effectiveCreditor?.id ?? null,
    cashAmount,
    propertiesTransferred,
    housesRemoved: liquidation.housesRemoved,
    hotelsRemoved: liquidation.hotelsRemoved
  };
}
