/**
 * Build lookup tables once so the engine never has to search arrays by label.
 * Stable IDs (space-01, prop-01, chance-01) are the only identifiers used by
 * game logic; displayed ciphertext can change without breaking the game.
 */

export function buildDataIndex(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Data permainan kosong.');

  const spaces = [...raw.boardSpaces.spaces].sort((a, b) => a.index - b.index);
  const spacesById = Object.fromEntries(spaces.map((space) => [space.id, space]));
  const spacesByIndex = Object.fromEntries(spaces.map((space) => [space.index, space]));

  const propertiesById = { ...raw.properties.properties };
  const propertiesBySpaceId = {};
  for (const property of Object.values(propertiesById)) {
    propertiesBySpaceId[property.spaceId] = property;
  }

  const deckSources = {
    chance: raw.chanceCards.cards,
    communityChest: raw.communityChestCards.cards
  };

  const cardsByDeck = { chance: [], communityChest: [] };
  const cardsById = {};
  for (const [deckKey, cards] of Object.entries(deckSources)) {
    for (const card of cards) {
      const indexedCard = { ...card, deck: deckKey };
      cardsById[card.id] = indexedCard;
      cardsByDeck[deckKey].push(indexedCard);
    }
  }

  // Color-group membership is derived from property data, not from display names.
  const groupSpaceIds = {};
  for (const property of Object.values(propertiesById)) {
    if (property.kind !== 'STREET') continue;
    if (!groupSpaceIds[property.group]) groupSpaceIds[property.group] = [];
    groupSpaceIds[property.group].push(property.spaceId);
  }
  for (const list of Object.values(groupSpaceIds)) list.sort();

  return {
    ...raw,
    spaces,
    spacesById,
    spacesByIndex,
    propertiesById,
    propertiesBySpaceId,
    cardsById,
    cardsByDeck,
    groupSpaceIds,
    decks: {
      chance: { label: raw.chanceCards.label, cards: cardsByDeck.chance },
      communityChest: {
        label: raw.communityChestCards.label,
        cards: cardsByDeck.communityChest
      }
    }
  };
}

export function getSpaceById(data, spaceId) {
  return data.spacesById[spaceId] ?? null;
}

export function getSpaceByIndex(data, index) {
  return data.spacesByIndex[index] ?? null;
}

export function getPropertyForSpace(data, spaceId) {
  return data.propertiesBySpaceId[spaceId] ?? null;
}

export function getCard(data, cardId) {
  return data.cardsById[cardId] ?? null;
}
