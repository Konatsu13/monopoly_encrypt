/** Shared helpers for Node tests. Loads the same JSON files as the browser. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildDataIndex } from '../../src/data-index.js';
import { validateGameData } from '../../src/data-validation.js';
import { GameEngine } from '../../src/core/game-engine.js';
import { buildCipher } from '../../src/crypto/encryption.js';
import { createSeededRng } from '../../src/utils/random.js';
import { createMemoryStorage } from '../../src/storage/local-save.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function readJson(relative) {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));
}

export function loadTestData() {
  const raw = {
    profile: readJson('data/edition-profile.json'),
    boardSpaces: readJson('data/board-spaces.json'),
    properties: readJson('data/properties.json'),
    groups: readJson('data/groups.json'),
    tokens: readJson('data/tokens.json'),
    chanceCards: readJson('data/chance-cards.json'),
    communityChestCards: readJson('data/community-chest-cards.json'),
    story: readJson('data/story.json'),
    encryptionConfig: readJson('data/encryption-config.json')
  };
  const data = buildDataIndex(raw);
  const validation = validateGameData(data);
  if (!validation.ok) throw new Error(`Test data invalid: ${validation.errors.join('; ')}`);
  return data;
}

export const data = loadTestData();
export const cipher = buildCipher(data.encryptionConfig);

export const DEFAULT_PLAYERS = [
  { name: 'Anisa', tokenId: 'token-amber' },
  { name: 'Bima', tokenId: 'token-cyan' }
];

export function createEngine({ players = DEFAULT_PLAYERS, seed = 12345, settings = {} } = {}) {
  const engine = GameEngine.create({
    players,
    data,
    cipher,
    rng: createSeededRng(seed),
    settings
  });
  return engine;
}

/** Replace the engine RNG with a fixed sequence of die faces. */
export function rigDice(engine, faces) {
  const values = faces.map((face) => (face - 1 + 0.01) / 6);
  let index = 0;
  engine.rng = () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
  return engine;
}

/** A sequence of random values for shuffles (not dice). */
export function sequenceRng(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

export function player(engine, index = 0) {
  return engine.state.players[index];
}

export function spaceIndex(engine, spaceId) {
  return engine.data.spacesById[spaceId].index;
}

export function setPosition(engine, playerIndex, index) {
  engine.state.players[playerIndex].position = index;
}

export function setCash(engine, playerIndex, amount) {
  engine.state.players[playerIndex].cash = amount;
}

export function setPhase(engine, phase) {
  engine.state.phase = phase;
}

export function giveProperty(engine, spaceId, playerId, { houses = 0, hotel = false, mortgaged = false } = {}) {
  const property = engine.state.properties[spaceId];
  if (!property) throw new Error(`No property at ${spaceId}`);
  property.ownerId = playerId;
  property.houses = houses;
  property.hotel = hotel;
  property.mortgaged = mortgaged;
  return property;
}

export function forceCard(engine, cardId, playerIndex = 0) {
  const card = data.cardsById[cardId];
  const deck = engine.state.decks[card.deck];
  deck.draw = deck.draw.filter((id) => id !== cardId);
  deck.discard = deck.discard.filter((id) => id !== cardId);
  for (const player of engine.state.players) {
    player.jailFreeCardIds = player.jailFreeCardIds.filter((id) => id !== cardId);
  }
  const playerId = engine.state.players[playerIndex].id;
  engine.state.pending = {
    type: 'CARD',
    cardId,
    deck: card.deck,
    playerId,
    attempts: 0,
    verified: true,
    effectApplied: false
  };
  engine.state.phase = 'CARD_DECRYPTION';
  return card;
}

export function makeStorage(initial = {}) {
  return createMemoryStorage(initial);
}

export { createMemoryStorage };
