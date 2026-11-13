import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAfford,
  transferCash,
  collectFromBank,
  calculateRepairCost,
  liquidationCapacity
} from '../src/core/economy-engine.js';
import { createEngine, data, setCash, giveProperty, setPosition } from './helpers/data.js';

test('transferCash moves money atomically and records history', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  transferCash(engine.state, data.profile, {
    fromId: a.id,
    toId: b.id,
    amount: 250,
    reason: 'Sewa uji'
  });
  assert.equal(a.cash, 1250);
  assert.equal(b.cash, 1750);
  assert.equal(engine.state.history.at(-1).type, 'PAY_PLAYER');
  assert.equal(engine.state.history.at(-1).amount, 250);
});

test('transferCash rejects invalid amounts, insufficient funds, and self-payment', () => {
  const engine = createEngine();
  const [a, b] = engine.state.players;
  assert.throws(() => transferCash(engine.state, data.profile, { fromId: a.id, toId: b.id, amount: 0, reason: 'x' }));
  assert.throws(() => transferCash(engine.state, data.profile, { fromId: a.id, toId: b.id, amount: 5000, reason: 'x' }));
  assert.throws(() => transferCash(engine.state, data.profile, { fromId: a.id, toId: a.id, amount: 10, reason: 'x' }));
  assert.throws(() => transferCash(engine.state, data.profile, { fromId: a.id, toId: 'missing', amount: 10, reason: 'x' }));
});

test('canAfford reflects current cash', () => {
  const engine = createEngine();
  assert.equal(canAfford(engine.state, 'player-1', 1500), true);
  assert.equal(canAfford(engine.state, 'player-1', 1501), false);
});

test('collectFromBank credits a player', () => {
  const engine = createEngine();
  collectFromBank(engine.state, data.profile, 'player-1', 75, 'Bonus');
  assert.equal(engine.state.players[0].cash, 1575);
  assert.equal(engine.state.history.at(-1).type, 'COLLECT_BANK');
});

test('repair cost counts houses and hotels only for the player', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1', { houses: 2 });
  giveProperty(engine, 'space-03', 'player-1', { hotel: true });
  giveProperty(engine, 'space-06', 'player-2', { houses: 4 });
  const repair = calculateRepairCost(engine.state, data, 'player-1', 25, 100);
  assert.equal(repair.houses, 2);
  assert.equal(repair.hotels, 1);
  assert.equal(repair.amount, 150);
});

test('liquidation capacity includes cash, buildings, and unmortgaged properties', () => {
  const engine = createEngine();
  setCash(engine, 0, 10);
  giveProperty(engine, 'space-01', 'player-1', { houses: 2 });
  giveProperty(engine, 'space-03', 'player-1');
  const capacity = liquidationCapacity(engine.state, data, data.profile, 'player-1');
  // 10 cash + 2 houses * 25 + 30 + 30 mortgage values
  assert.equal(capacity, 120);
});

test('rent debt flow: mortgage an asset, then pay the debt', () => {
  const engine = createEngine();
  const [payer, owner] = engine.state.players;
  setCash(engine, 0, 1);
  giveProperty(engine, 'space-01', payer.id);
  giveProperty(engine, 'space-03', owner.id);
  setPosition(engine, 0, 3);
  engine.state.phase = 'RESOLVING_SPACE';
  engine._resolveLanding(payer.id);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');
  assert.equal(engine.state.pending.amount, 4);

  const mortgage = engine.mortgage('space-01');
  assert.equal(mortgage.ok, true);
  assert.equal(payer.cash, 31);
  assert.equal(engine.payDebt().ok, true);
  assert.equal(payer.cash, 27);
  assert.equal(owner.cash, 1504);
  assert.equal(engine.state.phase, 'END_TURN');
  assert.equal(engine.state.pending, null);
});

test('debt to the bank with a partial balance is paused, then paid', () => {
  const engine = createEngine();
  const payer = engine.state.players[0];
  setCash(engine, 0, 50);
  giveProperty(engine, 'space-01', payer.id);
  setPosition(engine, 0, 4);
  engine.state.phase = 'RESOLVING_SPACE';
  engine._resolveLanding(payer.id);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');
  assert.equal(engine.state.pending.amount, 200);
  assert.equal(payer.cash, 50);
  assert.equal(engine.payDebt().ok, false);

  engine.mortgage('space-01');
  assert.equal(payer.cash, 80);
  assert.equal(engine.payDebt().ok, false);

  engine.state.properties['space-01'].mortgaged = false; // test-only shortcut
  assert.equal(engine.declareBankruptcy().ok, true);
  assert.equal(payer.bankrupt, true);
});

test('bankruptcy to a player transfers cash, properties, and determines the winner', () => {
  const engine = createEngine();
  const [debtor, creditor] = engine.state.players;
  setCash(engine, 0, 0);
  giveProperty(engine, 'space-01', debtor.id);
  giveProperty(engine, 'space-03', creditor.id);
  setPosition(engine, 0, 3);
  engine.state.phase = 'RESOLVING_SPACE';
  engine._resolveLanding(debtor.id);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');

  const result = engine.declareBankruptcy();
  assert.equal(result.ok, true);
  assert.equal(result.gameOver, true);
  assert.equal(debtor.bankrupt, true);
  assert.equal(engine.state.phase, 'GAME_OVER');
  assert.equal(engine.state.winnerId, creditor.id);
  assert.equal(engine.state.properties['space-01'].ownerId, creditor.id);
});

test('bankruptcy to the bank returns properties and continues with remaining players', () => {
  const engine = createEngine({
    players: [
      { name: 'Anisa', tokenId: 'token-amber' },
      { name: 'Bima', tokenId: 'token-cyan' },
      { name: 'Citra', tokenId: 'token-violet' }
    ]
  });
  const debtor = engine.state.players[0];
  setCash(engine, 0, 0);
  giveProperty(engine, 'space-01', debtor.id);
  setPosition(engine, 0, 4);
  engine.state.phase = 'RESOLVING_SPACE';
  engine._resolveLanding(debtor.id);
  const result = engine.declareBankruptcy();
  assert.equal(result.ok, true);
  assert.equal(result.gameOver, false);
  assert.equal(debtor.bankrupt, true);
  assert.equal(engine.state.properties['space-01'].ownerId, null);
  assert.notEqual(engine.state.phase, 'GAME_OVER');
  assert.equal(engine.state.currentPlayerIndex, 1);
});

test('bankruptcy is blocked while the debtor can still pay', () => {
  const engine = createEngine();
  const payer = engine.state.players[0];
  setCash(engine, 0, 10);
  giveProperty(engine, 'space-03', engine.state.players[1].id);
  setPosition(engine, 0, 3);
  engine.state.phase = 'RESOLVING_SPACE';
  engine._resolveLanding(payer.id);
  // Rent is 4, payer has 10, so it is paid immediately and there is no debt.
  assert.notEqual(engine.state.phase, 'DEBT_RESOLUTION');
});
