/**
 * Sequential auction engine.
 *
 * Bidding proceeds in player order. A player who passes leaves the auction.
 * The highest bidder cannot bid against themselves and wins once every other
 * active bidder has passed. If everyone passes, the property remains unsold.
 */

import { getPlayer, getSolventPlayers } from './game-state.js';

export function createAuction(state, data, profile, spaceId, startPlayerId) {
  const solvent = getSolventPlayers(state);
  const startIndex = Math.max(0, solvent.findIndex((player) => player.id === startPlayerId));
  const order = [...solvent.slice(startIndex), ...solvent.slice(0, startIndex)].map((player) => player.id);
  const auction = {
    type: 'AUCTION',
    spaceId,
    order,
    activeIds: [...order],
    currentBidderId: order[0],
    highBidderId: null,
    currentBid: 0,
    minIncrement: profile.auctionMinIncrement,
    startedTurn: state.turnNumber
  };
  state.pending = auction;
  state.phase = 'AUCTION';
  state.stats.auctions += 1;
  return auction;
}

function findNextBidder(auction) {
  const eligible = auction.activeIds.filter((id) => id !== auction.highBidderId);
  if (eligible.length === 0) return null;
  const start = auction.order.indexOf(auction.currentBidderId);
  for (let step = 1; step <= auction.order.length; step += 1) {
    const candidate = auction.order[(start + step) % auction.order.length];
    if (eligible.includes(candidate)) return candidate;
  }
  return null;
}

function finishTurn(auction) {
  const eligible = auction.activeIds.filter((id) => id !== auction.highBidderId);
  if (auction.highBidderId && eligible.length === 0) {
    return { ended: 'SOLD', winnerId: auction.highBidderId, price: auction.currentBid };
  }
  if (!auction.highBidderId && auction.activeIds.length === 0) {
    return { ended: 'UNSOLD' };
  }
  const next = findNextBidder(auction);
  if (!next) {
    if (auction.highBidderId) {
      return { ended: 'SOLD', winnerId: auction.highBidderId, price: auction.currentBid };
    }
    return { ended: 'UNSOLD' };
  }
  auction.currentBidderId = next;
  return { ended: null };
}

export function placeBid(state, data, profile, playerId, amount) {
  const auction = state.pending;
  if (!auction || auction.type !== 'AUCTION' || state.phase !== 'AUCTION') {
    return { ok: false, reason: 'Lelang tidak sedang berlangsung.' };
  }
  if (auction.currentBidderId !== playerId) {
    return { ok: false, reason: 'Bukan giliran Anda untuk menawar.' };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'Penawaran harus bilangan bulat positif.' };
  }
  if (amount <= auction.currentBid) {
    return { ok: false, reason: 'Penawaran harus lebih tinggi dari penawaran saat ini.' };
  }
  if (auction.currentBid > 0 && amount < auction.currentBid + auction.minIncrement) {
    return { ok: false, reason: `Penawaran minimal naik ${auction.minIncrement} dari penawaran saat ini.` };
  }
  if (amount < auction.minIncrement) {
    return { ok: false, reason: `Penawaran minimal ${auction.minIncrement}.` };
  }
  const player = getPlayer(state, playerId);
  if (!player || player.bankrupt) return { ok: false, reason: 'Pemain tidak aktif.' };
  if (player.cash < amount) return { ok: false, reason: 'Saldo tidak cukup untuk penawaran ini.' };

  auction.currentBid = amount;
  auction.highBidderId = playerId;
  const result = finishTurn(auction);
  return { ok: true, ...result, currentBid: auction.currentBid, highBidderId: auction.highBidderId };
}

export function passAuction(state, playerId) {
  const auction = state.pending;
  if (!auction || auction.type !== 'AUCTION' || state.phase !== 'AUCTION') {
    return { ok: false, reason: 'Lelang tidak sedang berlangsung.' };
  }
  if (auction.currentBidderId !== playerId) {
    return { ok: false, reason: 'Bukan giliran Anda untuk memutuskan.' };
  }
  if (auction.highBidderId === playerId) {
    return { ok: false, reason: 'Penawar tertinggi tidak dapat mengundurkan diri.' };
  }
  auction.activeIds = auction.activeIds.filter((id) => id !== playerId);
  const result = finishTurn(auction);
  return { ok: true, ...result, currentBid: auction.currentBid, highBidderId: auction.highBidderId };
}

export function getAuctionPlayer(state) {
  const auction = state.pending;
  if (!auction || auction.type !== 'AUCTION') return null;
  return getPlayer(state, auction.currentBidderId);
}

/** UI helper: status of every player in the auction. */
export function describeAuction(state, data, playerIdLookup) {
  const auction = state.pending;
  if (!auction || auction.type !== 'AUCTION') return null;
  return {
    spaceId: auction.spaceId,
    currentBid: auction.currentBid,
    highBidderId: auction.highBidderId,
    currentBidderId: auction.currentBidderId,
    minIncrement: auction.minIncrement,
    players: auction.order.map((id) => ({
      id,
      name: playerIdLookup(id)?.name ?? id,
      active: auction.activeIds.includes(id),
      high: auction.highBidderId === id,
      current: auction.currentBidderId === id
    }))
  };
}
