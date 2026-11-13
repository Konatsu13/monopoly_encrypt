/**
 * Dice and movement engine.
 *
 * Movement is always performed here so GO salary and jail interactions cannot
 * be duplicated by card handlers. Dice randomness is injected through `rng`.
 */

import { mod } from '../crypto/modular-math.js';
import { addLog, getPlayer } from './game-state.js';
import { randomInt } from '../utils/random.js';
import { formatMoney } from '../utils/formatters.js';

export function rollDice(rng = Math.random) {
  const d1 = randomInt(rng, 1, 6);
  const d2 = randomInt(rng, 1, 6);
  return { d1, d2, total: d1 + d2, isDouble: d1 === d2 };
}

/** Board path for a forward movement (final position included). */
export function forwardPath(from, steps, boardSize = 40) {
  const path = [];
  for (let step = 1; step <= steps; step += 1) {
    path.push(mod(from + step, boardSize));
  }
  return path;
}

/** Board path for a backward movement (final position included). */
export function backwardPath(from, steps, boardSize = 40) {
  const path = [];
  for (let step = 1; step <= steps; step += 1) {
    path.push(mod(from - step, boardSize));
  }
  return path;
}

export function awardGoSalary(state, profile, player, reason = 'Melewati Gerbang Kota') {
  player.cash += profile.goSalary;
  addLog(state, 'MONEY', `${player.name} menerima gaji ${formatMoney(profile.goSalary, profile.currency)} (${reason}).`, {
    playerId: player.id,
    amount: profile.goSalary
  });
}

/**
 * Move a player forward by `steps`, applying GO salary exactly once when the
 * player passes or lands on GO. Returns movement metadata for UI animation.
 */
export function moveBy(state, data, profile, playerId, steps, options = {}) {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error('Pemain tidak ditemukan.');
  if (!Number.isInteger(steps) || steps < 0) throw new RangeError('Langkah maju harus bilangan bulat non-negatif.');

  const collectGo = options.collectGo !== false;
  const from = player.position;
  const path = forwardPath(from, steps);
  const to = path.length > 0 ? path[path.length - 1] : from;
  const passedGo = steps > 0 && from + steps >= 40;

  player.position = to;

  if (passedGo && collectGo) {
    awardGoSalary(state, profile, player, options.reason ?? 'Melewati Gerbang Kota');
  }

  state.lastMove = {
    playerId,
    from,
    to,
    path,
    steps,
    direction: 'forward',
    collectGo,
    passedGo,
    reason: options.reason ?? null
  };

  return state.lastMove;
}

/** Move forward to a specific board index, wrapping through GO as needed. */
export function moveTo(state, data, profile, playerId, targetIndex, options = {}) {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error('Pemain tidak ditemukan.');
  const steps = mod(targetIndex - player.position, 40);
  if (steps === 0) {
    state.lastMove = {
      playerId,
      from: player.position,
      to: player.position,
      path: [],
      steps: 0,
      direction: 'forward',
      collectGo: options.collectGo !== false,
      passedGo: false,
      reason: options.reason ?? null
    };
    return state.lastMove;
  }
  return moveBy(state, data, profile, playerId, steps, options);
}

/** Move backward without salary (used by "go back three spaces" cards). */
export function moveBack(state, playerId, steps, reason = null) {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error('Pemain tidak ditemukan.');
  if (!Number.isInteger(steps) || steps <= 0) throw new RangeError('Langkah mundur harus bilangan bulat positif.');
  const from = player.position;
  const path = backwardPath(from, steps);
  player.position = path[path.length - 1];
  state.lastMove = {
    playerId,
    from,
    to: player.position,
    path,
    steps,
    direction: 'backward',
    collectGo: false,
    passedGo: false,
    reason
  };
  return state.lastMove;
}

/** Put a player in jail without awarding GO salary. */
export function sendToJail(state, profile, playerId, reason = 'Dipindahkan ke Pusat Detensi') {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error('Pemain tidak ditemukan.');
  const from = player.position;
  player.position = profile.jailPosition;
  player.inJail = true;
  player.jailTurns = 0;
  player.doublesCount = 0;
  state.lastMove = {
    playerId,
    from,
    to: player.position,
    path: [player.position],
    steps: 0,
    direction: 'jail',
    collectGo: false,
    passedGo: false,
    reason
  };
  addLog(state, 'JAIL', `${player.name} dipindahkan ke Pusat Detensi Cryptonia.`, { playerId: player.id });
  return state.lastMove;
}

/** Find the next space of a type, starting after the player's current space. */
export function findNearestSpace(data, fromIndex, kind) {
  for (let offset = 1; offset <= 40; offset += 1) {
    const space = data.spacesByIndex[mod(fromIndex + offset, 40)];
    if (!space) continue;
    if (kind === 'RAILROAD' && space.type === 'RAILROAD') return space;
    if (kind === 'UTILITY' && space.type === 'UTILITY') return space;
  }
  return null;
}
