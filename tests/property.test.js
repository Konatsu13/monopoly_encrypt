import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRent,
  canBuyProperty,
  buyProperty
} from '../src/core/property-engine.js';
import { canBuildHouse, buildHouse, canSellBuilding, sellBuilding } from '../src/core/building-engine.js';
import { canMortgage, mortgageProperty, canUnmortgage, unmortgageProperty, unmortgageCost } from '../src/core/mortgage-engine.js';
import { calculateNetWorth, getOwnedProperties, ownsWholeGroup } from '../src/core/game-state.js';
import { createEngine, data, giveProperty, setCash } from './helpers/data.js';

test('street rent: base rent when the owner does not control the group', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-2');
  const rent = calculateRent(engine.state, data, data.profile, 'space-01', { diceTotal: 7 });
  assert.equal(rent.amount, 2);
});

test('street rent doubles when the whole color group is owned and unbuilt', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-2');
  giveProperty(engine, 'space-03', 'player-2');
  assert.equal(ownsWholeGroup(engine.state, data, 'player-2', 'COKLAT'), true);
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-01', {}).amount, 4);
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-03', {}).amount, 8);
});

test('street rent follows house and hotel levels', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-2', { houses: 2 });
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-01', {}).amount, 30);
  giveProperty(engine, 'space-01', 'player-2', { hotel: true });
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-01', {}).amount, 250);
});

test('mortgaged property collects no rent', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-2', { mortgaged: true });
  const rent = calculateRent(engine.state, data, data.profile, 'space-01', {});
  assert.equal(rent.amount, 0);
});

test('railroad rent scales with the number of owned stations', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-05', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-05', {}).amount, 25);
  giveProperty(engine, 'space-15', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-05', {}).amount, 50);
  giveProperty(engine, 'space-25', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-05', {}).amount, 100);
  giveProperty(engine, 'space-35', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-05', {}).amount, 200);
});

test('railroad rent multiplier supports card effects', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-05', 'player-2');
  giveProperty(engine, 'space-15', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-05', { rentMultiplier: 2 }).amount, 100);
});

test('utility rent uses dice total and ownership count', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-12', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-12', { diceTotal: 7 }).amount, 28);
  giveProperty(engine, 'space-28', 'player-2');
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-12', { diceTotal: 7 }).amount, 70);
  assert.equal(
    calculateRent(engine.state, data, data.profile, 'space-12', { diceTotal: 7, rentMultiplier: 10 }).amount,
    70
  );
  assert.throws(() => calculateRent(engine.state, data, data.profile, 'space-12', {}));
});

test('buying a property validates funds and updates ownership atomically', () => {
  const engine = createEngine();
  const player = engine.state.players[0];
  assert.equal(canBuyProperty(engine.state, data, player.id, 'space-01').ok, true);
  const result = buyProperty(engine.state, data, data.profile, player.id, 'space-01');
  assert.equal(result.ok, true);
  assert.equal(player.cash, 1440);
  assert.equal(engine.state.properties['space-01'].ownerId, player.id);
  assert.equal(engine.state.history.at(-1).type, 'PURCHASE');

  assert.equal(canBuyProperty(engine.state, data, player.id, 'space-01').ok, false);
  setCash(engine, 0, 10);
  assert.equal(canBuyProperty(engine.state, data, player.id, 'space-03').ok, false);
});

test('building requires the whole color group and even distribution', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1');
  assert.equal(canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, false);
  giveProperty(engine, 'space-03', 'player-1');
  assert.equal(canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(buildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(engine.state.properties['space-01'].houses, 1);
  assert.equal(engine.state.bank.houses, 31);
  assert.equal(canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, false);
  assert.equal(canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-03').ok, true);
});

test('four houses upgrade to a hotel and hotel supply is enforced', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1');
  giveProperty(engine, 'space-03', 'player-1');
  for (let i = 0; i < 4; i += 1) {
    assert.equal(buildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
    assert.equal(buildHouse(engine.state, data, data.profile, 'player-1', 'space-03').ok, true);
  }
  assert.equal(engine.state.properties['space-01'].houses, 4);
  assert.equal(engine.state.bank.houses, 24);
  assert.equal(buildHouse(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(engine.state.properties['space-01'].hotel, true);
  assert.equal(engine.state.properties['space-01'].houses, 0);
  assert.equal(engine.state.bank.hotels, 11);
  assert.equal(engine.state.bank.houses, 28);

  engine.state.bank.hotels = 0;
  assert.equal(canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-03').ok, false);
});

test('house supply limits are enforced', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1');
  giveProperty(engine, 'space-03', 'player-1');
  engine.state.bank.houses = 0;
  const result = canBuildHouse(engine.state, data, data.profile, 'player-1', 'space-01');
  assert.equal(result.ok, false);
  assert.match(result.reason, /rumah/);
});

test('selling must be reverse-even; hotel sale returns four houses when possible', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1', { houses: 2 });
  giveProperty(engine, 'space-03', 'player-1', { houses: 1 });
  assert.equal(canSellBuilding(engine.state, data, data.profile, 'player-1', 'space-03').ok, false);
  assert.equal(canSellBuilding(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  const before = engine.state.players[0].cash;
  assert.equal(sellBuilding(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(engine.state.players[0].cash, before + 25);

  giveProperty(engine, 'space-01', 'player-1', { hotel: true });
  const result = sellBuilding(engine.state, data, data.profile, 'player-1', 'space-01');
  assert.equal(result.ok, true);
  assert.equal(engine.state.properties['space-01'].hotel, false);
  assert.equal(engine.state.properties['space-01'].houses, 4);
});

test('buildings block mortgaging the group; unmortgage charges 10% interest', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1', { houses: 1 });
  giveProperty(engine, 'space-03', 'player-1');
  assert.equal(canMortgage(engine.state, data, 'player-1', 'space-01').ok, false);

  giveProperty(engine, 'space-01', 'player-1');
  const before = engine.state.players[0].cash;
  assert.equal(mortgageProperty(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(engine.state.players[0].cash, before + 30);
  assert.equal(engine.state.properties['space-01'].mortgaged, true);
  assert.equal(calculateRent(engine.state, data, data.profile, 'space-01', {}).amount, 0);

  const cost = unmortgageCost(data.propertiesById['prop-01'], data.profile.mortgageInterestRate);
  assert.equal(cost, 33);
  assert.equal(canUnmortgage(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(unmortgageProperty(engine.state, data, data.profile, 'player-1', 'space-01').ok, true);
  assert.equal(engine.state.players[0].cash, before + 30 - 33);
  assert.equal(engine.state.properties['space-01'].mortgaged, false);
});

test('cannot mortgage a property owned by someone else or already mortgaged', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-2');
  assert.equal(canMortgage(engine.state, data, 'player-1', 'space-01').ok, false);
  giveProperty(engine, 'space-01', 'player-1', { mortgaged: true });
  assert.equal(canMortgage(engine.state, data, 'player-1', 'space-01').ok, false);
});

test('net worth includes cash, property prices, and buildings', () => {
  const engine = createEngine();
  giveProperty(engine, 'space-01', 'player-1', { houses: 2 });
  const worth = calculateNetWorth(engine.state, data, 'player-1');
  assert.equal(worth, 1500 + 60 + 100);
  assert.equal(getOwnedProperties(engine.state, data, 'player-1').length, 1);
});
