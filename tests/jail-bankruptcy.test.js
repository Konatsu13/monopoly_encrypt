import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, data, giveProperty, rigDice, setCash, setPosition } from './helpers/data.js';
import { settleBankruptcy } from '../src/core/bankruptcy-engine.js';

function putInJail(engine, playerIndex = 0, jailTurns = 0) {
  const player = engine.state.players[playerIndex];
  player.position = data.profile.jailPosition;
  player.inJail = true;
  player.jailTurns = jailTurns;
  player.doublesCount = 0;
  engine.state.currentPlayerIndex = playerIndex;
  engine.state.phase = 'JAIL_DECISION';
  return player;
}

test('three consecutive doubles send the player directly to jail', () => {
  const engine = createEngine();
  setPosition(engine, 0, 5);
  engine.state.players[0].doublesCount = 2;
  rigDice(engine, [1, 1]);
  const result = engine.roll();
  assert.equal(result.ok, true);
  assert.equal(result.tripleDouble, true);
  assert.equal(engine.state.players[0].position, 10);
  assert.equal(engine.state.players[0].inJail, true);
  assert.equal(engine.state.phase, 'END_TURN');
});

test('rolling doubles on a normal turn grants another roll', () => {
  const engine = createEngine();
  setPosition(engine, 0, 0);
  rigDice(engine, [5, 5]); // lands on Just Visiting, no pending decision
  const result = engine.roll();
  assert.equal(result.ok, true);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
  assert.equal(engine.state.turnNumber, 1);
  assert.equal(engine.state.players[0].doublesCount, 1);
});

test('jail release by doubles moves the player and ends the turn normally', () => {
  const engine = createEngine();
  putInJail(engine);
  rigDice(engine, [1, 1]); // total 2 -> utility space 12
  const result = engine.jailRoll();
  assert.equal(result.ok, true);
  assert.equal(result.released, true);
  assert.equal(engine.state.players[0].inJail, false);
  assert.equal(engine.state.players[0].position, 12);
  assert.equal(engine.state.phase, 'PLAYER_DECISION');
});

test('a failed jail roll keeps the player detained and ends the turn', () => {
  const engine = createEngine();
  putInJail(engine);
  rigDice(engine, [1, 2]);
  const result = engine.jailRoll();
  assert.equal(result.ok, true);
  assert.equal(result.released, false);
  assert.equal(engine.state.players[0].position, 10);
  assert.equal(engine.state.players[0].inJail, true);
  assert.equal(engine.state.players[0].jailTurns, 1);
  assert.equal(engine.state.phase, 'END_TURN');

  const end = engine.endTurn();
  assert.equal(end.ok, true);
  assert.equal(engine.state.currentPlayerIndex, 1);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
});

test('third failed attempt forces the fine and movement', () => {
  const engine = createEngine();
  const player = putInJail(engine, 0, 2);
  rigDice(engine, [1, 2]); // total 3 -> space 13
  const result = engine.jailRoll();
  assert.equal(result.ok, true);
  assert.equal(result.paidFine, true);
  assert.equal(player.inJail, false);
  assert.equal(player.cash, 1450);
  assert.equal(player.position, 13);
  assert.equal(engine.state.phase, 'PLAYER_DECISION');
});

test('third failed attempt with insufficient cash enters debt resolution', () => {
  const engine = createEngine();
  const player = putInJail(engine, 0, 2);
  setCash(engine, 0, 10);
  rigDice(engine, [1, 2]);
  const result = engine.jailRoll();
  assert.equal(result.ok, true);
  assert.equal(result.debt, true);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');
  assert.equal(engine.state.pending.amount, 50);
  assert.equal(player.inJail, true);
  assert.equal(player.jailTurns, 3);
});

test('paying the jail fine releases the player, who must still roll', () => {
  const engine = createEngine();
  const player = putInJail(engine);
  setCash(engine, 0, 100);
  const result = engine.jailPayFine();
  assert.equal(result.ok, true);
  assert.equal(player.inJail, false);
  assert.equal(player.cash, 50);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
});

test('jail fine payment with insufficient cash enters debt and releases after payment', () => {
  const engine = createEngine();
  const player = putInJail(engine);
  setCash(engine, 0, 20);
  giveProperty(engine, 'space-01', player.id);
  const result = engine.jailPayFine();
  assert.equal(result.ok, true);
  assert.equal(result.debt, true);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');
  engine.mortgage('space-01');
  assert.equal(player.cash, 50);
  assert.equal(engine.payDebt().ok, true);
  assert.equal(player.inJail, false);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
});

test('using a get-out-of-jail card releases the player and returns the card to the deck', () => {
  const engine = createEngine();
  const player = putInJail(engine);
  player.jailFreeCardIds.push('chance-06');
  engine.state.decks.chance.draw = engine.state.decks.chance.draw.filter((id) => id !== 'chance-06');
  const result = engine.jailUseCard();
  assert.equal(result.ok, true);
  assert.equal(player.inJail, false);
  assert.equal(player.jailFreeCardIds.length, 0);
  assert.ok(engine.state.decks.chance.draw.includes('chance-06'));
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL');
});

test('settleBankruptcy transfers mortgaged property and jail cards to a player creditor', () => {
  const engine = createEngine();
  const [debtor, creditor] = engine.state.players;
  giveProperty(engine, 'space-01', debtor.id, { mortgaged: true });
  debtor.jailFreeCardIds.push('chance-06');
  engine.state.decks.chance.draw = engine.state.decks.chance.draw.filter((id) => id !== 'chance-06');
  const summary = settleBankruptcy(engine.state, data, data.profile, debtor.id, creditor.id);
  assert.equal(summary.ok, true);
  assert.equal(engine.state.properties['space-01'].ownerId, creditor.id);
  assert.equal(engine.state.properties['space-01'].mortgaged, true);
  assert.deepEqual(creditor.jailFreeCardIds, ['chance-06']);
  assert.equal(debtor.bankrupt, true);
});

test('bankruptcy to the bank clears mortgage and returns jail cards to the deck', () => {
  const engine = createEngine({
    players: [
      { name: 'Anisa', tokenId: 'token-amber' },
      { name: 'Bima', tokenId: 'token-cyan' },
      { name: 'Citra', tokenId: 'token-violet' }
    ]
  });
  const debtor = engine.state.players[0];
  giveProperty(engine, 'space-01', debtor.id, { mortgaged: true });
  debtor.jailFreeCardIds.push('chest-05');
  engine.state.decks.communityChest.draw = engine.state.decks.communityChest.draw.filter((id) => id !== 'chest-05');
  settleBankruptcy(engine.state, data, data.profile, debtor.id, null);
  assert.equal(engine.state.properties['space-01'].ownerId, null);
  assert.equal(engine.state.properties['space-01'].mortgaged, false);
  assert.ok(engine.state.decks.communityChest.draw.includes('chest-05'));
});

test('bankruptcy liquidates buildings back to the bank', () => {
  const engine = createEngine();
  const [debtor, creditor] = engine.state.players;
  giveProperty(engine, 'space-01', debtor.id, { houses: 2 });
  giveProperty(engine, 'space-03', debtor.id, { hotel: true });
  engine.state.bank.houses = 30;
  engine.state.bank.hotels = 11;
  const summary = settleBankruptcy(engine.state, data, data.profile, debtor.id, creditor.id);
  assert.equal(summary.housesRemoved, 2);
  assert.equal(summary.hotelsRemoved, 1);
  assert.equal(engine.state.properties['space-01'].houses, 0);
  assert.equal(engine.state.properties['space-03'].hotel, false);
  assert.equal(engine.state.bank.houses, 32);
  assert.equal(engine.state.bank.hotels, 12);
});
