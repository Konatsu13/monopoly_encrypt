import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, data, giveProperty, rigDice, setCash, setPosition } from './helpers/data.js';

function openAuction(engine) {
  setPosition(engine, 0, 0);
  rigDice(engine, [1, 2]); // total 3 -> space 3, unowned property
  const roll = engine.roll();
  assert.equal(roll.ok, true);
  assert.equal(engine.state.phase, 'PLAYER_DECISION');
  const decline = engine.declinePurchase();
  assert.equal(decline.ok, true);
  assert.equal(engine.state.phase, 'AUCTION');
  return engine.state.pending;
}

test('declining a purchase opens an auction starting with the active player', () => {
  const engine = createEngine();
  const auction = openAuction(engine);
  assert.equal(auction.type, 'AUCTION');
  assert.equal(auction.spaceId, 'space-03');
  assert.equal(auction.currentBidderId, 'player-1');
  assert.deepEqual(auction.order, ['player-1', 'player-2']);
});

test('auction sale transfers the property and money to the winner', () => {
  const engine = createEngine();
  openAuction(engine);
  assert.equal(engine.auctionPass().ok, true); // player 1 passes
  assert.equal(engine.state.pending.currentBidderId, 'player-2');
  const result = engine.auctionBid(100); // only active bidder left -> sold
  assert.equal(result.ok, true);
  assert.equal(result.ended, 'SOLD');
  assert.equal(engine.state.properties['space-03'].ownerId, 'player-2');
  assert.equal(engine.state.players[1].cash, 1400);
  assert.equal(engine.state.phase, 'END_TURN');
  assert.equal(engine.state.pending, null);
});

test('auction with three players continues until all other bidders pass', () => {
  const engine = createEngine({
    players: [
      { name: 'Anisa', tokenId: 'token-amber' },
      { name: 'Bima', tokenId: 'token-cyan' },
      { name: 'Citra', tokenId: 'token-violet' }
    ]
  });
  openAuction(engine);
  assert.equal(engine.auctionBid(100).ok, true); // player 1
  assert.equal(engine.state.pending.currentBidderId, 'player-2');
  assert.equal(engine.auctionBid(120).ok, true); // player 2
  assert.equal(engine.state.pending.currentBidderId, 'player-3');
  assert.equal(engine.auctionPass().ok, true); // player 3
  assert.equal(engine.state.pending.currentBidderId, 'player-1');
  const result = engine.auctionPass(); // player 1 passes; player 2 wins
  assert.equal(result.ok, true);
  assert.equal(result.ended, 'SOLD');
  assert.equal(engine.state.properties['space-03'].ownerId, 'player-2');
  assert.equal(engine.state.players[1].cash, 1380);
});

test('auction remains unsold when everyone passes', () => {
  const engine = createEngine();
  openAuction(engine);
  assert.equal(engine.auctionPass().ok, true);
  const result = engine.auctionPass();
  assert.equal(result.ok, true);
  assert.equal(result.ended, 'UNSOLD');
  assert.equal(engine.state.properties['space-03'].ownerId, null);
  assert.equal(engine.state.phase, 'END_TURN');
});

test('auction bid validation rejects low, excessive, and out-of-turn bids', () => {
  const engine = createEngine();
  openAuction(engine);
  assert.equal(engine.auctionBid(5).ok, false);
  assert.equal(engine.auctionBid(5000).ok, false);
  assert.equal(engine.auctionBid(100).ok, true);
  assert.equal(engine.state.pending.currentBidderId, 'player-2');
  assert.equal(engine.auctionBid(150).ok, true);
  assert.equal(engine.state.pending.currentBidderId, 'player-1');
  // Player 2 cannot bid again out of turn.
  assert.equal(engine.auctionBid(200, 'player-2').ok, false);
  // Player 1 is the current bidder and may raise.
  assert.equal(engine.auctionBid(200, 'player-1').ok, true);
});

test('auction min increment is enforced after the first bid', () => {
  const engine = createEngine();
  openAuction(engine);
  assert.equal(engine.auctionBid(100).ok, true);
  assert.equal(engine.auctionBid(105).ok, false);
  assert.equal(engine.auctionBid(110).ok, true);
});

test('a doubles roll grants another roll after an auction completes', () => {
  const engine = createEngine();
  setPosition(engine, 0, 0);
  rigDice(engine, [3, 3]); // total 6 -> space 6, doubles
  engine.roll();
  assert.equal(engine.state.players[0].doublesCount, 1);
  engine.declinePurchase();
  engine.auctionPass();
  engine.auctionPass();
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
});

test('trade requires proposer confirmation and partner acceptance', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  giveProperty(engine, 'space-01', a.id);
  giveProperty(engine, 'space-03', b.id);

  const proposal = {
    toId: b.id,
    fromProperties: ['space-01'],
    toProperties: ['space-03'],
    fromCash: 100,
    toCash: 0,
    fromJailCards: 0,
    toJailCards: 0
  };
  const proposed = engine.proposeTrade(proposal);
  assert.equal(proposed.ok, true);
  assert.equal(engine.state.phase, 'TRADE_PENDING');
  assert.equal(engine.state.pending.stage, 'offer');
  assert.equal(engine.acceptTrade().ok, false);

  const confirmed = engine.confirmTradeOffer();
  assert.equal(confirmed.ok, true);
  assert.equal(engine.state.pending.stage, 'confirmation');
  const accepted = engine.acceptTrade();
  assert.equal(accepted.ok, true);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
  assert.equal(engine.state.properties['space-01'].ownerId, b.id);
  assert.equal(engine.state.properties['space-03'].ownerId, a.id);
  assert.equal(a.cash, 1400);
  assert.equal(b.cash, 1600);
});

test('rejecting a trade restores the previous phase', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  giveProperty(engine, 'space-01', a.id);
  engine.proposeTrade({ toId: b.id, fromProperties: ['space-01'], toProperties: [], fromCash: 0, toCash: 0 });
  engine.confirmTradeOffer();
  const rejected = engine.rejectTrade();
  assert.equal(rejected.ok, true);
  assert.equal(engine.state.pending, null);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
  assert.equal(engine.state.properties['space-01'].ownerId, a.id);
});

test('trades reject unowned properties, buildings, excessive cash, and empty offers', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  giveProperty(engine, 'space-01', b.id);
  assert.equal(
    engine.proposeTrade({ toId: b.id, fromProperties: ['space-01'], toProperties: [], fromCash: 0, toCash: 0 }).ok,
    false
  );

  giveProperty(engine, 'space-01', a.id, { houses: 1 });
  assert.equal(
    engine.proposeTrade({ toId: b.id, fromProperties: ['space-01'], toProperties: [], fromCash: 0, toCash: 0 }).ok,
    false
  );

  giveProperty(engine, 'space-01', a.id);
  assert.equal(
    engine.proposeTrade({ toId: b.id, fromProperties: ['space-01'], toProperties: [], fromCash: 99999, toCash: 0 }).ok,
    false
  );
  assert.equal(engine.proposeTrade({ toId: b.id, fromProperties: [], toProperties: [], fromCash: 0, toCash: 0 }).ok, false);
});

test('jail-free cards can be included in a trade', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  a.jailFreeCardIds.push('chance-06');
  engine.state.decks.chance.draw = engine.state.decks.chance.draw.filter((id) => id !== 'chance-06');
  engine.proposeTrade({
    toId: b.id,
    fromProperties: [],
    toProperties: [],
    fromCash: 0,
    toCash: 50,
    fromJailCards: 1,
    toJailCards: 0
  });
  engine.confirmTradeOffer();
  assert.equal(engine.acceptTrade().ok, true);
  assert.deepEqual(a.jailFreeCardIds, []);
  assert.deepEqual(b.jailFreeCardIds, ['chance-06']);
  assert.equal(a.cash, 1550);
  assert.equal(b.cash, 1450);
});

test('auction and trade actions are blocked in invalid phases', () => {
  const engine = createEngine();
  assert.equal(engine.auctionBid(100).ok, false);
  assert.equal(engine.acceptTrade().ok, false);
  setCash(engine, 0, 0);
  assert.equal(engine.endTurn().ok, false); // WAITING_FOR_ROLL, not END_TURN
});
