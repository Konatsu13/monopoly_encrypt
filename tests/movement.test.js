import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moveBy,
  moveTo,
  moveBack,
  sendToJail,
  rollDice,
  forwardPath,
  findNearestSpace
} from '../src/core/movement-engine.js';
import { createEngine, data, setPosition, setCash } from './helpers/data.js';

test('rollDice returns values 1..6 and detects doubles', () => {
  assert.deepEqual(rollDice(() => 0), { d1: 1, d2: 1, total: 2, isDouble: true });
  assert.deepEqual(rollDice(() => 0.999999), { d1: 6, d2: 6, total: 12, isDouble: true });
  let index = 0;
  const values = [0.01, 0.5];
  const dice = rollDice(() => values[index++]);
  assert.equal(dice.d1, 1);
  assert.equal(dice.d2, 4);
  assert.equal(dice.total, 5);
  assert.equal(dice.isDouble, false);
});

test('forwardPath wraps around the 40-space board', () => {
  assert.deepEqual(forwardPath(38, 4), [39, 0, 1, 2]);
  assert.deepEqual(forwardPath(0, 1), [1]);
});

test('moveBy wraps and applies GO salary exactly once', () => {
  const engine = createEngine();
  setPosition(engine, 0, 38);
  const before = engine.state.players[0].cash;
  const movement = moveBy(engine.state, data, data.profile, 'player-1', 4);
  assert.equal(engine.state.players[0].position, 2);
  assert.equal(engine.state.players[0].cash, before + 200);
  assert.deepEqual(movement.path, [39, 0, 1, 2]);
  assert.equal(movement.passedGo, true);
  const salaryLogs = engine.state.log.filter((entry) => entry.message.includes('gaji'));
  assert.equal(salaryLogs.length, 1);
});

test('landing exactly on GO also pays salary once', () => {
  const engine = createEngine();
  setPosition(engine, 0, 36);
  const before = engine.state.players[0].cash;
  moveTo(engine.state, data, data.profile, 'player-1', 0);
  assert.equal(engine.state.players[0].position, 0);
  assert.equal(engine.state.players[0].cash, before + 200);
});

test('moveTo forward through GO pays salary; collectGo=false does not', () => {
  const engine = createEngine();
  setPosition(engine, 0, 36);
  const before = engine.state.players[0].cash;
  moveTo(engine.state, data, data.profile, 'player-1', 5);
  assert.equal(engine.state.players[0].position, 5);
  assert.equal(engine.state.players[0].cash, before + 200);

  const engine2 = createEngine();
  setPosition(engine2, 0, 36);
  const before2 = engine2.state.players[0].cash;
  moveTo(engine2.state, data, data.profile, 'player-1', 5, { collectGo: false });
  assert.equal(engine2.state.players[0].cash, before2);
});

test('moveBack never awards GO salary', () => {
  const engine = createEngine();
  setPosition(engine, 0, 1);
  const before = engine.state.players[0].cash;
  moveBack(engine.state, 'player-1', 3);
  assert.equal(engine.state.players[0].position, 38);
  assert.equal(engine.state.players[0].cash, before);
});

test('sendToJail moves to the configured jail space and clears doubles', () => {
  const engine = createEngine();
  engine.state.players[0].doublesCount = 2;
  sendToJail(engine.state, data.profile, 'player-1');
  assert.equal(engine.state.players[0].position, 10);
  assert.equal(engine.state.players[0].inJail, true);
  assert.equal(engine.state.players[0].jailTurns, 0);
  assert.equal(engine.state.players[0].doublesCount, 0);
});

test('findNearestSpace finds the next railroad/utility with wrapping', () => {
  assert.equal(findNearestSpace(data, 7, 'UTILITY').id, 'space-12');
  assert.equal(findNearestSpace(data, 22, 'UTILITY').id, 'space-28');
  assert.equal(findNearestSpace(data, 36, 'UTILITY').id, 'space-12');
  assert.equal(findNearestSpace(data, 7, 'RAILROAD').id, 'space-15');
  assert.equal(findNearestSpace(data, 36, 'RAILROAD').id, 'space-05');
});

test('rolling and moving updates lastMove for UI animation', () => {
  const engine = createEngine({ seed: 42 });
  const result = engine.roll();
  assert.equal(result.ok, true);
  assert.ok(engine.state.lastMove);
  assert.equal(engine.state.lastMove.playerId, 'player-1');
  assert.equal(engine.state.lastMove.path.length, result.dice.total);
});

test('invalid movement input is rejected', () => {
  const engine = createEngine();
  assert.throws(() => moveBy(engine.state, data, data.profile, 'player-1', -1));
  assert.throws(() => moveBack(engine.state, 'player-1', 0));
  assert.throws(() => moveBy(engine.state, data, data.profile, 'missing', 1));
});

test('GO salary is added to cash and cannot be duplicated by a card movement', () => {
  const engine = createEngine();
  setPosition(engine, 0, 30);
  const before = engine.state.players[0].cash;
  moveTo(engine.state, data, data.profile, 'player-1', 2);
  assert.equal(engine.state.players[0].position, 2);
  assert.equal(engine.state.players[0].cash, before + 200);
  assert.equal(engine.state.log.filter((entry) => entry.message.includes('gaji')).length, 1);
});
