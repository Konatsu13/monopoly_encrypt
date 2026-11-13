/**
 * House/hotel construction and sale rules.
 *
 * Enforced: complete color group, no mortgaged property in the group, even
 * building, a configured maximum of four houses, physical bank supply, and
 * reverse even selling.
 */

import { addLog, getGroupProperties, getPlayer, recordHistory } from './game-state.js';
import { getPropertyDefinition } from './property-engine.js';
import { formatMoney } from '../utils/formatters.js';

export function buildingLevel(property) {
  return property.hotel ? 5 : property.houses;
}

function groupLevels(state, data, group) {
  return getGroupProperties(state, data, group).map((property) => buildingLevel(property));
}

function groupHasMortgage(state, data, group) {
  return getGroupProperties(state, data, group).some((property) => property.mortgaged);
}

export function canBuildHouse(state, data, profile, playerId, spaceId) {
  const player = getPlayer(state, playerId);
  const definition = getPropertyDefinition(data, spaceId);
  const property = state.properties[spaceId];

  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (!definition || !property) return { ok: false, reason: 'Petak ini bukan properti.' };
  if (definition.kind !== 'STREET') return { ok: false, reason: 'Bangunan hanya dapat didirikan di properti jalan.' };
  if (property.ownerId !== playerId) return { ok: false, reason: 'Anda bukan pemilik properti ini.' };
  if (property.mortgaged) return { ok: false, reason: 'Properti yang digadaikan tidak boleh dibangun.' };
  if (property.hotel) return { ok: false, reason: 'Properti ini sudah memiliki hotel.' };

  const groupProperties = getGroupProperties(state, data, definition.group);
  const levels = groupProperties.map((entry) => buildingLevel(entry));
  if (levels.length !== data.groupSpaceIds[definition.group].length) {
    return { ok: false, reason: 'Data grup warna tidak lengkap.' };
  }
  if (!groupProperties.every((entry) => entry.ownerId === playerId)) {
    return { ok: false, reason: 'Anda harus memiliki seluruh properti dalam grup warna.' };
  }
  if (groupHasMortgage(state, data, definition.group)) {
    return { ok: false, reason: 'Lunasi gadai seluruh grup sebelum membangun.' };
  }

  const ownLevel = buildingLevel(property);
  const minimum = Math.min(...levels);
  if (ownLevel !== minimum) {
    return { ok: false, reason: 'Bangunan harus dibangun merata: pilih properti dengan jumlah bangunan paling sedikit.' };
  }
  if (ownLevel > profile.maxHousesPerProperty) {
    return { ok: false, reason: 'Bangunan sudah maksimum.' };
  }

  // 0..3 houses are normal houses; a fourth house (ownLevel === 4) upgrades
  // to a hotel on the next build. The rent table's index 5 is the hotel.
  const willUpgradeToHotel = ownLevel === profile.maxHousesPerProperty;
  if (player.cash < definition.houseCost) {
    return { ok: false, reason: `Saldo tidak cukup untuk membangun (${formatMoney(definition.houseCost)}).` };
  }

  if (willUpgradeToHotel) {
    if (state.bank.hotels <= 0) return { ok: false, reason: 'Persediaan hotel di bank habis.' };
  } else if (state.bank.houses <= 0) {
    return { ok: false, reason: 'Persediaan rumah di bank habis.' };
  }

  return {
    ok: true,
    cost: definition.houseCost,
    willUpgradeToHotel,
    group: definition.group,
    levels
  };
}

export function buildHouse(state, data, profile, playerId, spaceId) {
  const validation = canBuildHouse(state, data, profile, playerId, spaceId);
  if (!validation.ok) return validation;

  const player = getPlayer(state, playerId);
  const property = state.properties[spaceId];
  const definition = getPropertyDefinition(data, spaceId);

  player.cash -= definition.houseCost;

  if (validation.willUpgradeToHotel) {
    property.hotel = true;
    property.houses = 0;
    state.bank.hotels -= 1;
    // The four houses used for the upgrade return to the bank.
    state.bank.houses += 4;
    addLog(
      state,
      'BUILD',
      `${player.name} membangun hotel di properti terenkripsi petak ${data.spacesById[spaceId].index} (${formatMoney(definition.houseCost, profile.currency)}).`,
      { playerId, spaceId }
    );
  } else {
    property.houses += 1;
    state.bank.houses -= 1;
    addLog(
      state,
      'BUILD',
      `${player.name} membangun rumah ke-${property.houses} di properti terenkripsi petak ${data.spacesById[spaceId].index} (${formatMoney(definition.houseCost, profile.currency)}).`,
      { playerId, spaceId }
    );
  }

  recordHistory(state, {
    type: 'BUILD',
    playerId,
    spaceId,
    amount: definition.houseCost,
    reason: validation.willUpgradeToHotel ? 'Bangun hotel' : 'Bangun rumah'
  });

  return { ok: true, cost: definition.houseCost, hotel: validation.willUpgradeToHotel };
}

export function canSellBuilding(state, data, profile, playerId, spaceId) {
  const player = getPlayer(state, playerId);
  const definition = getPropertyDefinition(data, spaceId);
  const property = state.properties[spaceId];

  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (!definition || !property) return { ok: false, reason: 'Petak ini bukan properti.' };
  if (definition.kind !== 'STREET') return { ok: false, reason: 'Tidak ada bangunan di properti ini.' };
  if (property.ownerId !== playerId) return { ok: false, reason: 'Anda bukan pemilik properti ini.' };

  const level = buildingLevel(property);
  if (level === 0) return { ok: false, reason: 'Tidak ada bangunan untuk dijual.' };

  const levels = groupLevels(state, data, definition.group);
  const maximum = Math.max(...levels);
  if (level !== maximum) {
    return { ok: false, reason: 'Penjualan harus merata: jual bangunan dari properti yang paling banyak dibangun.' };
  }

  const saleValue = Math.floor(definition.houseCost / 2);
  let returnsFourHouses = false;
  if (property.hotel) {
    returnsFourHouses = profile.hotelSellReturnsHouses && state.bank.houses >= 4;
  }

  return { ok: true, saleValue, hotel: property.hotel, returnsFourHouses, level };
}

export function sellBuilding(state, data, profile, playerId, spaceId) {
  const validation = canSellBuilding(state, data, profile, playerId, spaceId);
  if (!validation.ok) return validation;

  const player = getPlayer(state, playerId);
  const property = state.properties[spaceId];
  const definition = getPropertyDefinition(data, spaceId);

  if (property.hotel) {
    property.hotel = false;
    state.bank.hotels += 1;
    if (validation.returnsFourHouses) {
      property.houses = 4;
      state.bank.houses -= 4;
      player.cash += validation.saleValue;
    } else {
      // Provisional documented rule: when four houses are unavailable, the
      // hotel is liquidated together with its four virtual houses.
      property.houses = 0;
      player.cash += Math.floor(definition.houseCost * 2.5);
    }
    addLog(state, 'BUILD', `${player.name} menjual hotel di properti terenkripsi petak ${data.spacesById[spaceId].index}.`, {
      playerId,
      spaceId
    });
  } else {
    property.houses -= 1;
    state.bank.houses += 1;
    player.cash += validation.saleValue;
    addLog(state, 'BUILD', `${player.name} menjual satu rumah di properti terenkripsi petak ${data.spacesById[spaceId].index}.`, {
      playerId,
      spaceId
    });
  }

  const actualSaleValue = property.hotel || validation.hotel
    ? (validation.returnsFourHouses ? validation.saleValue : Math.floor(definition.houseCost * 2.5))
    : validation.saleValue;

  recordHistory(state, {
    type: 'SELL_BUILDING',
    playerId,
    spaceId,
    amount: actualSaleValue,
    reason: validation.hotel ? 'Jual hotel' : 'Jual rumah'
  });

  return { ok: true, saleValue: actualSaleValue };
}
