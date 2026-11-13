/**
 * Local save and settings persistence.
 *
 * Storage is injected so Node tests can use a small in-memory implementation.
 * The app uses window.localStorage.
 */

import { SAVE_KEY, SETTINGS_KEY, PROLOGUE_SEEN_KEY, SCHEMA_VERSION } from '../core/constants.js';
import { validateLoadedState } from './save-validation.js';

function getStorage(storage) {
  if (storage) return storage;
  if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  return null;
}

export function saveGame(state, storage) {
  const target = getStorage(storage);
  if (!target) return { ok: false, reason: 'localStorage tidak tersedia.' };
  try {
    const payload = JSON.stringify({ ...state, savedAt: new Date().toISOString() });
    target.setItem(SAVE_KEY, payload);
    return { ok: true, bytes: payload.length };
  } catch (error) {
    return { ok: false, reason: `Gagal menyimpan: ${error.message}` };
  }
}

export function loadGame(data, storage) {
  const target = getStorage(storage);
  if (!target) return { ok: false, reason: 'localStorage tidak tersedia.', empty: true };
  let raw;
  try {
    raw = target.getItem(SAVE_KEY);
  } catch (error) {
    return { ok: false, reason: `Gagal membaca save: ${error.message}`, empty: true };
  }
  if (!raw) return { ok: false, reason: 'Belum ada save.', empty: true };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'Save rusak dan tidak dapat dibaca sebagai JSON.', empty: false };
  }

  const validation = validateLoadedState(parsed, data);
  if (!validation.ok) {
    return {
      ok: false,
      reason: `Save tidak valid: ${validation.errors.join(' ')}`,
      empty: false,
      errors: validation.errors
    };
  }

  return { ok: true, state: parsed, savedAt: parsed.savedAt ?? null };
}

export function hasValidSave(data, storage) {
  return loadGame(data, storage).ok;
}

export function clearSave(storage) {
  const target = getStorage(storage);
  if (!target) return;
  try {
    target.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage errors on cleanup.
  }
}

export function saveSettings(settings, storage) {
  const target = getStorage(storage);
  if (!target) return;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are non-critical.
  }
}

export function loadSettings(storage) {
  const target = getStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function markPrologueSeen(storage) {
  const target = getStorage(storage);
  try {
    target?.setItem(PROLOGUE_SEEN_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function wasPrologueSeen(storage) {
  const target = getStorage(storage);
  try {
    return target?.getItem(PROLOGUE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function resetPrologueSeen(storage) {
  const target = getStorage(storage);
  try {
    target?.removeItem(PROLOGUE_SEEN_KEY);
  } catch {
    // Ignore.
  }
}

/** In-memory storage used by tests and as a safe fallback. */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    get length() {
      return map.size;
    }
  };
}

export { SAVE_KEY, SETTINGS_KEY, SCHEMA_VERSION };
