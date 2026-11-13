import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, data, forceCard, giveProperty, rigDice, setCash, setPosition } from './helpers/data.js';
import { drawCard, deckIsEmpty } from '../src/core/card-engine.js';
import { createSeededRng, shuffle } from '../src/utils/random.js';

test('deck draw uses separate chance and community chest decks', () => {
  const engine = createEngine();
  const chance = drawCard(engine.state, data, () => 0.5, 'chance', 'player-1');
  assert.equal(chance.ok, true);
  assert.equal(chance.card.deck, 'chance');
  const chest = drawCard(engine.state, data, () => 0.5, 'communityChest', 'player-1');
  assert.equal(chest.ok, true);
  assert.equal(chest.card.deck, 'communityChest');
  assert.equal(engine.state.decks.chance.draw.length, 15);
  assert.equal(engine.state.decks.communityChest.draw.length, 15);
});

test('Fisher-Yates shuffle preserves items and is deterministic with a seed', () => {
  const input = Array.from({ length: 20 }, (_, index) => index);
  const first = shuffle(input, createSeededRng(7));
  const second = shuffle(input, createSeededRng(7));
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort((a, b) => a - b), input);
  assert.notDeepEqual(first, input);
});

test('card draw is gated by decryption: a wrong answer applies no effect', () => {
  const engine = createEngine();
  setPosition(engine, 0, 5);
  rigDice(engine, [1, 1]); // total 2 -> chance space 7
  engine.state.decks.chance.draw = ['chance-05', ...engine.state.decks.chance.draw.filter((id) => id !== 'chance-05')];
  const before = engine.state.players[0].cash;
  const roll = engine.roll();
  assert.equal(roll.ok, true);
  assert.equal(engine.state.phase, 'CARD_DECRYPTION');
  assert.equal(engine.state.pending.cardId, 'chance-05');

  const wrong = engine.checkCardAnswer('jawaban yang salah');
  assert.equal(wrong.ok, true);
  assert.equal(wrong.correct, false);
  assert.equal(engine.state.players[0].cash, before);
  assert.equal(engine.state.phase, 'CARD_DECRYPTION');
  assert.equal(engine.applyPendingCard().ok, false);
});

test('a correct answer reveals plaintext and applies the effect exactly once', () => {
  const engine = createEngine();
  const player = engine.state.players[0];
  setPosition(engine, 0, 5);
  rigDice(engine, [1, 1]);
  engine.state.decks.chance.draw = ['chance-05', ...engine.state.decks.chance.draw.filter((id) => id !== 'chance-05')];
  const before = player.cash;
  engine.roll();

  const correct = engine.checkCardAnswer('bank membayar dividen 50 kepada anda');
  assert.equal(correct.ok, true);
  assert.equal(correct.correct, true);
  assert.match(correct.plaintext, /Bank membayar dividen 50/);
  assert.equal(player.cash, before, 'effect must wait for confirmation');

  const applied = engine.applyPendingCard();
  assert.equal(applied.ok, true);
  assert.equal(player.cash, before + 50);
  assert.equal(engine.state.phase, 'WAITING_FOR_ROLL'); // doubles grants another roll
  assert.ok(engine.state.decks.chance.discard.includes('chance-05'));

  const second = engine.applyPendingCard();
  assert.equal(second.ok, false);
  assert.equal(player.cash, before + 50);
});

test('assisted mode must be enabled before revealing an answer', () => {
  const engine = createEngine();
  forceCard(engine, 'chance-05');
  assert.equal(engine.useAssistance().ok, false);
  engine.updateSettings({ assistedMode: true });
  const assisted = engine.useAssistance();
  assert.equal(assisted.ok, true);
  assert.match(assisted.plaintext, /dividen/);
});

test('GET_OUT_OF_JAIL is retained in hand, not discarded', () => {
  const engine = createEngine();
  forceCard(engine, 'chance-06');
  const result = engine.applyPendingCard();
  assert.equal(result.ok, true);
  assert.deepEqual(engine.state.players[0].jailFreeCardIds, ['chance-06']);
  assert.equal(engine.state.decks.chance.discard.includes('chance-06'), false);
});

test('MOVE_TO GO collects salary once', () => {
  const engine = createEngine();
  setPosition(engine, 0, 36);
  const before = engine.state.players[0].cash;
  forceCard(engine, 'chance-01');
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.players[0].position, 0);
  assert.equal(engine.state.players[0].cash, before + 200);
  assert.equal(engine.state.log.filter((entry) => entry.message.includes('gaji')).length, 1);
});

test('MOVE_TO an unowned property opens the buy decision', () => {
  const engine = createEngine();
  setPosition(engine, 0, 36);
  forceCard(engine, 'chance-02');
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.players[0].position, 24);
  assert.equal(engine.state.phase, 'PLAYER_DECISION');
  assert.equal(engine.state.pending.spaceId, 'space-24');
});

test('MOVE_RELATIVE resolves the destination space', () => {
  const engine = createEngine();
  setPosition(engine, 0, 22);
  forceCard(engine, 'chance-07');
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.players[0].position, 19);
  assert.equal(engine.state.phase, 'PLAYER_DECISION');
});

test('MOVE_TO_NEAREST utility pays ten times a fresh dice roll', () => {
  const engine = createEngine();
  const payer = engine.state.players[0];
  const owner = engine.state.players[1];
  giveProperty(engine, 'space-12', owner.id);
  setPosition(engine, 0, 7);
  forceCard(engine, 'chance-03');
  rigDice(engine, [3, 4]); // utility roll total 7 -> 70
  const before = payer.cash;
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(payer.position, 12);
  assert.equal(payer.cash, before - 70);
  assert.equal(owner.cash, 1570);
});

test('MOVE_TO_NEAREST railroad doubles normal rent', () => {
  const engine = createEngine();
  const payer = engine.state.players[0];
  const owner = engine.state.players[1];
  giveProperty(engine, 'space-05', owner.id);
  giveProperty(engine, 'space-15', owner.id);
  setPosition(engine, 0, 7);
  forceCard(engine, 'chance-04');
  const before = payer.cash;
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(payer.position, 15);
  assert.equal(payer.cash, before - 100); // 50 base * 2
});

test('COLLECT_BANK and PAY_BANK effects update cash', () => {
  const engine = createEngine();
  const player = engine.state.players[0];
  forceCard(engine, 'chance-14');
  const before = player.cash;
  engine.applyPendingCard();
  assert.equal(player.cash, before + 150);

  forceCard(engine, 'chance-10');
  const afterCollect = player.cash;
  engine.applyPendingCard();
  assert.equal(player.cash, afterCollect - 15);
});

test('PAY_EACH queues payments to every other solvent player', () => {
  const engine = createEngine({
    players: [
      { name: 'Anisa', tokenId: 'token-amber' },
      { name: 'Bima', tokenId: 'token-cyan' },
      { name: 'Citra', tokenId: 'token-violet' }
    ]
  });
  const player = engine.state.players[0];
  forceCard(engine, 'chance-13');
  const before = player.cash;
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(player.cash, before - 100);
  assert.equal(engine.state.players[1].cash, 1550);
  assert.equal(engine.state.players[2].cash, 1550);
});

test('COLLECT_EACH collects from other players; a bankrupt payer is removed and the queue continues', () => {
  const engine = createEngine({
    players: [
      { name: 'Anisa', tokenId: 'token-amber' },
      { name: 'Bima', tokenId: 'token-cyan' },
      { name: 'Citra', tokenId: 'token-violet' }
    ]
  });
  const [current, poor, rich] = engine.state.players;
  setCash(engine, 1, 0);
  forceCard(engine, 'chest-09');
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.phase, 'DEBT_RESOLUTION');
  assert.equal(engine.state.pending.debtorId, poor.id);

  const result = engine.declareBankruptcy();
  assert.equal(result.ok, true);
  assert.equal(poor.bankrupt, true);
  assert.equal(current.cash, 1510);
  assert.equal(rich.cash, 1490);
  assert.equal(engine.state.phase, 'END_TURN');
});

test('GO_TO_JAIL sends the player to jail and ends the turn', () => {
  const engine = createEngine();
  forceCard(engine, 'chance-08');
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.players[0].position, 10);
  assert.equal(engine.state.players[0].inJail, true);
  assert.equal(engine.state.phase, 'END_TURN');
});

test('REPAIR charges per house and per hotel', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1', { houses: 2 });
  giveProperty(engine, 'space-03', 'player-1', { hotel: true });
  forceCard(engine, 'chance-09');
  const before = engine.state.players[0].cash;
  assert.equal(engine.applyPendingCard().ok, true);
  assert.equal(engine.state.players[0].cash, before - (2 * 25 + 100));
});

test('deck reshuffles discard pile when the draw pile is empty', () => {
  const engine = createEngine();
  engine.state.decks.chance.draw = [];
  engine.state.decks.chance.discard = ['chance-05', 'chance-06'];
  const result = drawCard(engine.state, data, createSeededRng(1), 'chance', 'player-1');
  assert.equal(result.ok, true);
  assert.equal(engine.state.decks.chance.draw.length, 1);
  assert.equal(engine.state.decks.chance.discard.length, 0);
});

test('empty deck with no discard is reported, not ignored', () => {
  const engine = createEngine();
  engine.state.decks.chance.draw = [];
  engine.state.decks.chance.discard = [];
  assert.equal(deckIsEmpty(engine.state, 'chance'), true);
  assert.equal(drawCard(engine.state, data, () => 0.5, 'chance', 'player-1').ok, false);
});
