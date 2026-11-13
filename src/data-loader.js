/**
 * Browser data loader. All game content lives in /data as editable JSON.
 */

import { buildDataIndex } from './data-index.js';
import { validateGameData } from './data-validation.js';

const DATA_BASE = new URL('../data/', import.meta.url);

const FILES = {
  profile: 'edition-profile.json',
  boardSpaces: 'board-spaces.json',
  properties: 'properties.json',
  groups: 'groups.json',
  tokens: 'tokens.json',
  chanceCards: 'chance-cards.json',
  communityChestCards: 'community-chest-cards.json',
  story: 'story.json',
  encryptionConfig: 'encryption-config.json'
};

async function loadJson(fetchImpl, filename) {
  const url = new URL(filename, DATA_BASE);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Gagal memuat ${filename} (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`File ${filename} bukan JSON valid: ${error.message}`);
  }
}

export async function loadGameData(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch tidak tersedia; jalankan lewat server lokal.');
  }

  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, filename]) => [key, await loadJson(fetchImpl, filename)])
  );
  const raw = Object.fromEntries(entries);
  const data = buildDataIndex(raw);
  const validation = validateGameData(data);
  return { data, validation };
}

export { FILES as DATA_FILES };
