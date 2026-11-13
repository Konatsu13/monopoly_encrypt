/**
 * Canonical game state and read-only helpers.
 *
 * All game mutations flow through the GameEngine. UI components receive the
 * state and render it, but never write to it directly.
 */

import { DECK_KEYS, DEFAULT_SETTINGS, PHASES, SCHEMA_VERSION } from './constants.js';
import { shuffle } from '../utils/random.js';
import { MAX_PLAYERS, MIN_PLAYERS } from './constants.js';
import { normalizePlayerName } from '../utils/validators.js';

function makeGameId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Validate setup input and create a fresh game state.
 * Throws for invalid setup; the setup UI converts this into an inline message.
 */
export function createGameState({ players, data, profile, encryptionConfig, rng = Math.random, settings = {}, gameId }) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Permainan membutuhkan ${MIN_PLAYERS}–${MAX_PLAYERS} pemain.`);
  }

  const tokenById = Object.fromEntries(data.tokens.map((token) => [token.id, token]));
  const normalizedNames = [];
  const tokenIds = [];

  const playerStates = players.map((input, index) => {
    const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Semua pemain harus memiliki nama.');
    const normalized = normalizePlayerName(name);
    if (normalizedNames.includes(normalized)) throw new Error('Nama pemain tidak boleh sama.');
    normalizedNames.push(normalized);

    const token = tokenById[input.tokenId];
    if (!token) throw new Error('Token yang dipilih tidak tersedia.');
    if (tokenIds.includes(token.id)) throw new Error('Setiap pemain harus memakai token unik.');
    tokenIds.push(token.id);

    return {
      id: `player-${index + 1}`,
      name,
      tokenId: token.id,
      tokenLabel: token.label,
      tokenIcon: token.icon,
      tokenColor: token.color,
      cash: profile.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailFreeCardIds: [],
      bankrupt: false,
      doublesCount: 0
    };
  });

  const board = data.spaces.map((space) => ({ spaceId: space.id, index: space.index }));

  const properties = {};
  for (const space of data.spaces) {
    if (space.propertyId) {
      properties[space.id] = {
        spaceId: space.id,
        propertyId: space.propertyId,
        ownerId: null,
        houses: 0,
        hotel: false,
        mortgaged: false
      };
    }
  }

  const decks = {};
  for (const deckKey of DECK_KEYS) {
    const cardIds = data.cardsByDeck[deckKey].map((card) => card.id);
    decks[deckKey] = {
      draw: shuffle(cardIds, rng),
      discard: []
    };
  }

  const state = {
    schemaVersion: SCHEMA_VERSION,
    gameId: gameId ?? makeGameId(),
    editionProfileId: profile.id,
    encryptionKeyId: encryptionConfig.keyId ?? 'unknown-key',
    encryptionConfig: JSON.parse(JSON.stringify(encryptionConfig)),
    createdAt: new Date().toISOString(),
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: PHASES.WAITING_FOR_ROLL,
    players: playerStates,
    board,
    properties,
    decks,
    bank: {
      houses: profile.houseSupply,
      hotels: profile.hotelSupply
    },
    lastDice: null,
    lastMove: null,
    lastCardDraw: null,
    pending: null,
    paymentQueue: [],
    queueCompletion: null,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    stats: {
      rolls: 0,
      turnsPlayed: 0,
      cardsDrawn: 0,
      cardsDecoded: 0,
      failedDecodeAttempts: 0,
      auctions: 0,
      trades: 0,
      bankruptcies: 0
    },
    log: [],
    history: [],
    winnerId: null
  };

  addLog(state, 'SYSTEM', `Permainan dimulai dengan ${playerStates.length} investor. Kunci sandi: ${state.encryptionKeyId}.`);
  return state;
}

export function getPlayer(state, playerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

export function getPlayerIndex(state, playerId) {
  return state.players.findIndex((player) => player.id === playerId);
}

export function getCurrentPlayer(state) {
  return state.players[state.currentPlayerIndex] ?? null;
}

export function getSolventPlayers(state) {
  return state.players.filter((player) => !player.bankrupt);
}

/** Properties owned by a player, ordered by board index. */
export function getOwnedProperties(state, data, playerId) {
  return Object.values(state.properties)
    .filter((property) => property.ownerId === playerId)
    .sort((a, b) => data.spacesById[a.spaceId].index - data.spacesById[b.spaceId].index);
}

/** All property state entries (including unowned) for one color group. */
export function getGroupProperties(state, data, group) {
  const ids = data.groupSpaceIds[group] ?? [];
  return ids.map((spaceId) => state.properties[spaceId]).filter(Boolean);
}

export function ownsWholeGroup(state, data, playerId, group) {
  const groupProperties = getGroupProperties(state, data, group);
  return groupProperties.length > 0 && groupProperties.every((property) => property.ownerId === playerId);
}

export function countOwnedByKind(state, data, playerId, kind) {
  return Object.values(state.properties).filter((property) => {
    if (property.ownerId !== playerId) return false;
    return data.propertiesById[property.propertyId]?.kind === kind;
  }).length;
}

export function countBuildings(state, data, playerId) {
  let houses = 0;
  let hotels = 0;
  for (const property of Object.values(state.properties)) {
    if (property.ownerId !== playerId) continue;
    if (data.propertiesById[property.propertyId]?.kind !== 'STREET') continue;
    if (property.hotel) hotels += 1;
    houses += property.houses;
  }
  return { houses, hotels };
}

/** Cash + property prices + building values, used only for the final summary. */
export function calculateNetWorth(state, data, playerId) {
  const player = getPlayer(state, playerId);
  if (!player) return 0;
  let total = player.cash;
  for (const property of getOwnedProperties(state, data, playerId)) {
    const definition = data.propertiesById[property.propertyId];
    total += definition.price;
    if (definition.kind === 'STREET') {
      total += property.houses * definition.houseCost;
      if (property.hotel) total += definition.houseCost;
    }
  }
  return total;
}

export function getActiveCardCount(player) {
  return player.jailFreeCardIds.length;
}

export function addLog(state, category, message, extra = {}) {
  const entry = {
    id: state.log.length + 1,
    turn: state.turnNumber,
    at: new Date().toISOString(),
    category,
    message,
    ...extra
  };
  state.log.push(entry);
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
  return entry;
}

export function recordHistory(state, entry) {
  const record = {
    id: state.history.length + 1,
    turn: state.turnNumber,
    at: new Date().toISOString(),
    ...entry
  };
  state.history.push(record);
  if (state.history.length > 600) state.history.splice(0, state.history.length - 600);
  return record;
}

export function returnJailCardToDeck(state, data, cardId) {
  const card = data.cardsById[cardId];
  if (!card) return false;
  const deck = state.decks[card.deck];
  if (!deck) return false;
  deck.draw.push(cardId);
  return true;
}

export function removeJailCardFromDeckIfNeeded(state, data, cardId) {
  const card = data.cardsById[cardId];
  if (!card) return;
  const deck = state.decks[card.deck];
  if (!deck) return;
  for (const list of [deck.draw, deck.discard]) {
    const index = list.indexOf(cardId);
    if (index >= 0) list.splice(index, 1);
  }
}

export function cloneState(state) {
  return structuredClone(state);
}

export function getDeckLabel(state, data, deckKey) {
  return data.cardsByDeck[deckKey]?.[0]?.deck === deckKey
    ? data.decks?.[deckKey]?.label ?? deckKey
    : deckKey;
}
